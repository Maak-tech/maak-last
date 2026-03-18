"""
Causal Calibration — Weekly Risk Weight Calibration
====================================================
Uses DoWhy + EconML to estimate causal treatment effects from historical
outcome data, then writes updated risk component weights back to Neon.

Schedule: Weekly (Sunday 00:00 UTC) via Railway cron:
  bun run ml-service/scripts/causal_calibration.py

Pipeline:
  1. Load 90-day outcome records from Neon (via REST API)
  2. Build causal DAG for each risk component
     (treatment = high_risk_flag, outcome = adverse_event_occurred)
  3. Estimate Average Treatment Effect (ATE) using EconML
     (DoublyRobustLearner with LightGBM nuisance models)
  4. If ATE is significant, update component weights in the API
  5. Emit calibration results to audit trail

Risk components calibrated:
  - fall_risk       → calibrated against fall events
  - adherence_risk  → calibrated against hospitalisation / adverse events
  - deterioration   → calibrated against ER visits / critical alerts

Environment variables required:
  API_BASE_URL      — Nuralix API base URL
  CALIBRATION_TOKEN — Service-to-service auth token (not a user session)
  MIN_SAMPLES       — Minimum outcome records required (default: 100)
  DRY_RUN           — If "1", compute but do not write updated weights

Usage:
  python -m ml_service.scripts.causal_calibration
  or:
  bun run ml-service/scripts/causal_calibration.py
"""

from __future__ import annotations

import json
import logging
import os
import sys
from dataclasses import asdict, dataclass, field
from datetime import datetime, timedelta, timezone
from typing import Optional

import numpy as np
import requests

logger = logging.getLogger(__name__)
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
)

# ── Config ────────────────────────────────────────────────────────────────────

API_BASE_URL = os.environ.get("API_BASE_URL", "http://localhost:3000")
CALIBRATION_TOKEN = os.environ.get("CALIBRATION_TOKEN", "")
MIN_SAMPLES = int(os.environ.get("MIN_SAMPLES", "100"))
DRY_RUN = os.environ.get("DRY_RUN", "0") == "1"

# Risk components and their outcome event types
RISK_COMPONENTS = {
    "fall_risk": {
        "treatment_field": "fall_risk_score",
        "outcome_event": "fall_detected",
        "weight_key": "fall_risk_weight",
        "high_threshold": 60,
    },
    "adherence_risk": {
        "treatment_field": "adherence_risk_score",
        "outcome_event": "medication_adverse_event",
        "weight_key": "adherence_risk_weight",
        "high_threshold": 60,
    },
    "deterioration_risk": {
        "treatment_field": "deterioration_score",
        "outcome_event": "er_visit_or_hospitalisation",
        "weight_key": "deterioration_risk_weight",
        "high_threshold": 60,
    },
}

# ── Data classes ──────────────────────────────────────────────────────────────


@dataclass
class OutcomeRecord:
    user_id: str
    risk_component: str
    risk_score: float           # 0–100 from VHI at the time of measurement
    high_risk_flag: int         # 1 if risk_score >= threshold, else 0 (treatment)
    adverse_event: int          # 1 if outcome occurred within follow-up window
    follow_up_days: int
    confounders: dict           # e.g. {"age_group": "65+", "med_count": 3}


@dataclass
class CalibrationResult:
    component: str
    n_samples: int
    ate: float                  # Average Treatment Effect (ATE)
    ate_std: float              # Standard error of ATE
    ate_significant: bool       # p < 0.05
    current_weight: float
    recommended_weight: float
    updated: bool
    notes: str = ""


# ── API helpers ───────────────────────────────────────────────────────────────


def _api_get(path: str) -> dict | list:
    url = f"{API_BASE_URL}{path}"
    headers = {"Authorization": f"Bearer {CALIBRATION_TOKEN}"}
    resp = requests.get(url, headers=headers, timeout=30)
    resp.raise_for_status()
    return resp.json()


def _api_post(path: str, payload: dict) -> dict:
    url = f"{API_BASE_URL}{path}"
    headers = {
        "Authorization": f"Bearer {CALIBRATION_TOKEN}",
        "Content-Type": "application/json",
    }
    resp = requests.post(url, headers=headers, json=payload, timeout=30)
    resp.raise_for_status()
    return resp.json()


# ── Data loading ──────────────────────────────────────────────────────────────


def load_outcome_records(component: str, cfg: dict) -> list[OutcomeRecord]:
    """
    Fetch 90-day outcome records from the Nuralix API.

    The /api/internal/calibration/outcomes endpoint is a service-to-service
    route gated by CALIBRATION_TOKEN (not user session auth).
    """
    since = (datetime.now(timezone.utc) - timedelta(days=90)).isoformat()
    try:
        rows = _api_get(
            f"/api/internal/calibration/outcomes"
            f"?component={component}&since={since}&limit=5000"
        )
    except Exception as e:
        logger.warning(f"[causal_calibration] Could not load outcomes for {component}: {e}")
        return []

    records: list[OutcomeRecord] = []
    threshold = cfg["high_threshold"]

    for row in rows:
        score = float(row.get(cfg["treatment_field"], 0))
        event = int(row.get(cfg["outcome_event"], 0))
        records.append(
            OutcomeRecord(
                user_id=row.get("user_id", ""),
                risk_component=component,
                risk_score=score,
                high_risk_flag=int(score >= threshold),
                adverse_event=event,
                follow_up_days=int(row.get("follow_up_days", 30)),
                confounders={
                    "age_group": row.get("age_group", "unknown"),
                    "med_count": int(row.get("med_count", 0)),
                    "has_comorbidities": int(row.get("has_comorbidities", 0)),
                },
            )
        )
    return records


# ── Causal estimation ─────────────────────────────────────────────────────────


def estimate_ate(records: list[OutcomeRecord]) -> tuple[float, float]:
    """
    Estimate the Average Treatment Effect (ATE) of being high-risk
    on adverse outcome occurrence using DoublyRobustLearner (EconML).

    Returns (ate, ate_std_error).
    """
    try:
        import dowhy
        from econml.dr import LinearDRLearner
        from sklearn.ensemble import GradientBoostingClassifier, GradientBoostingRegressor
    except ImportError as e:
        raise RuntimeError(
            f"DoWhy / EconML not installed. Run: pip install dowhy econml. Error: {e}"
        )

    n = len(records)
    if n < MIN_SAMPLES:
        raise ValueError(f"Insufficient samples: {n} < {MIN_SAMPLES}")

    # Build feature matrices
    T = np.array([r.high_risk_flag for r in records], dtype=float)          # treatment
    Y = np.array([r.adverse_event for r in records], dtype=float)           # outcome
    X = np.array(                                                             # confounders
        [
            [
                r.confounders.get("med_count", 0),
                1 if r.confounders.get("age_group") == "65+" else 0,
                r.confounders.get("has_comorbidities", 0),
                r.risk_score / 100.0,  # normalised risk score as additional covariate
            ]
            for r in records
        ],
        dtype=float,
    )

    # ── DoWhy causal graph ────────────────────────────────────────────────────
    import pandas as pd

    df = pd.DataFrame(
        {
            "T": T,
            "Y": Y,
            "med_count": X[:, 0],
            "age_65plus": X[:, 1],
            "has_comorbidities": X[:, 2],
            "risk_score": X[:, 3],
        }
    )

    causal_graph = """
    digraph {
        age_65plus -> T;
        age_65plus -> Y;
        has_comorbidities -> T;
        has_comorbidities -> Y;
        med_count -> T;
        med_count -> Y;
        risk_score -> T;
        T -> Y;
    }
    """

    model = dowhy.CausalModel(
        data=df,
        treatment="T",
        outcome="Y",
        graph=causal_graph,
    )
    identified_estimand = model.identify_effect(proceed_when_unidentifiable=True)

    # ── EconML Doubly Robust Learner ─────────────────────────────────────────
    # More robust than IPW or direct regression — handles model misspecification
    dr_learner = LinearDRLearner(
        model_regression=GradientBoostingRegressor(n_estimators=100, max_depth=3),
        model_propensity=GradientBoostingClassifier(n_estimators=100, max_depth=3),
        cv=5,
    )
    dr_learner.fit(Y, T, X=X)

    ate = float(dr_learner.ate(X))
    ate_std = float(dr_learner.ate_interval(X, alpha=0.05)[1] - ate)  # half-width CI

    logger.info(f"[causal_calibration] ATE={ate:.4f} ± {ate_std:.4f} (n={n})")
    return ate, abs(ate_std)


# ── Weight update ─────────────────────────────────────────────────────────────


def compute_new_weight(
    current_weight: float, ate: float, ate_std: float
) -> tuple[float, bool]:
    """
    Adjust risk component weight based on the estimated ATE.

    Logic:
      - If ATE > 0.05 and significant → risk component has real causal effect
        → increase weight toward 1.0 (capped at +10% per cycle)
      - If ATE < -0.02 → component may be anti-causal or confounded
        → decrease weight toward 0.5 (capped at -5% per cycle)
      - Otherwise → keep current weight (no evidence to update)

    Returns (new_weight, should_update).
    """
    is_significant = ate_std > 0 and abs(ate) / ate_std > 1.96  # p < 0.05

    if not is_significant:
        return current_weight, False

    if ate > 0.05:
        # Component has real causal effect — increase weight
        delta = min(0.10, ate * 0.5)
        new_weight = min(1.0, current_weight + delta)
    elif ate < -0.02:
        # Component may be anti-correlated or confounded — reduce influence
        delta = min(0.05, abs(ate) * 0.3)
        new_weight = max(0.5, current_weight - delta)
    else:
        return current_weight, False

    return round(new_weight, 4), abs(new_weight - current_weight) > 0.005


# ── Main calibration loop ─────────────────────────────────────────────────────


def run_calibration() -> list[CalibrationResult]:
    """Run causal calibration for all risk components."""
    logger.info(
        f"[causal_calibration] Starting weekly calibration "
        f"(dry_run={DRY_RUN}, min_samples={MIN_SAMPLES})"
    )
    results: list[CalibrationResult] = []

    # Fetch current weights from API
    try:
        current_weights: dict = _api_get("/api/internal/vhi/weights")
    except Exception as e:
        logger.error(f"[causal_calibration] Cannot fetch current weights: {e}")
        current_weights = {}

    for component, cfg in RISK_COMPONENTS.items():
        logger.info(f"[causal_calibration] Processing component: {component}")
        current_weight = float(current_weights.get(cfg["weight_key"], 1.0))

        # Load outcome records
        records = load_outcome_records(component, cfg)
        n = len(records)

        if n < MIN_SAMPLES:
            results.append(
                CalibrationResult(
                    component=component,
                    n_samples=n,
                    ate=0.0,
                    ate_std=0.0,
                    ate_significant=False,
                    current_weight=current_weight,
                    recommended_weight=current_weight,
                    updated=False,
                    notes=f"Insufficient samples ({n} < {MIN_SAMPLES}). No update.",
                )
            )
            logger.warning(f"[causal_calibration] {component}: skipped ({n} samples)")
            continue

        # Estimate ATE
        try:
            ate, ate_std = estimate_ate(records)
            is_significant = ate_std > 0 and abs(ate) / ate_std > 1.96
        except Exception as e:
            logger.error(f"[causal_calibration] {component}: ATE estimation failed: {e}")
            results.append(
                CalibrationResult(
                    component=component,
                    n_samples=n,
                    ate=0.0,
                    ate_std=0.0,
                    ate_significant=False,
                    current_weight=current_weight,
                    recommended_weight=current_weight,
                    updated=False,
                    notes=f"ATE estimation error: {e}",
                )
            )
            continue

        # Compute recommended weight
        new_weight, should_update = compute_new_weight(current_weight, ate, ate_std)

        updated = False
        if should_update and not DRY_RUN:
            try:
                _api_post(
                    "/api/internal/vhi/weights",
                    {cfg["weight_key"]: new_weight, "calibrated_at": datetime.now(timezone.utc).isoformat()},
                )
                updated = True
                logger.info(
                    f"[causal_calibration] {component}: weight "
                    f"{current_weight:.4f} → {new_weight:.4f}"
                )
            except Exception as e:
                logger.error(f"[causal_calibration] {component}: weight update failed: {e}")

        results.append(
            CalibrationResult(
                component=component,
                n_samples=n,
                ate=round(ate, 5),
                ate_std=round(ate_std, 5),
                ate_significant=is_significant,
                current_weight=current_weight,
                recommended_weight=new_weight,
                updated=updated,
                notes=(
                    "DRY_RUN — no write performed" if DRY_RUN and should_update
                    else "No significant change" if not should_update
                    else "Weight updated"
                ),
            )
        )

    return results


def _emit_audit_log(results: list[CalibrationResult]) -> None:
    """Emit calibration results to the audit trail."""
    try:
        _api_post(
            "/api/audit/log",
            {
                "actorType": "system",
                "action": "agent_action",
                "resourceType": "vhi_weights",
                "resourceId": "causal_calibration",
                "details": {
                    "calibrated_at": datetime.now(timezone.utc).isoformat(),
                    "dry_run": DRY_RUN,
                    "results": [asdict(r) for r in results],
                },
                "outcome": "success",
            },
        )
        logger.info("[causal_calibration] Audit log emitted")
    except Exception as e:
        logger.warning(f"[causal_calibration] Audit log failed (non-fatal): {e}")


# ── Entry point ───────────────────────────────────────────────────────────────


if __name__ == "__main__":
    logger.info("=" * 60)
    logger.info("Nuralix Causal Calibration — Weekly Risk Weight Update")
    logger.info("=" * 60)

    try:
        results = run_calibration()
        _emit_audit_log(results)

        # Print summary table
        print("\n── Calibration Summary ──────────────────────────────────────")
        for r in results:
            status = "✓ UPDATED" if r.updated else ("DRY" if DRY_RUN else "─ SKIPPED")
            print(
                f"  {r.component:<22} "
                f"n={r.n_samples:<5} "
                f"ATE={r.ate:+.4f} "
                f"w: {r.current_weight:.3f} → {r.recommended_weight:.3f}  "
                f"[{status}]  {r.notes}"
            )
        print()

        updated_count = sum(1 for r in results if r.updated)
        logger.info(f"[causal_calibration] Complete. {updated_count}/{len(results)} weights updated.")
        sys.exit(0)
    except Exception as e:
        logger.error(f"[causal_calibration] Fatal error: {e}", exc_info=True)
        sys.exit(1)
