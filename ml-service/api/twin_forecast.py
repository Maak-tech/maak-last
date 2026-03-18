"""
Twin Forecast — Vital Time-Series Forecasting
==============================================
Forecasts 7/14/30-day trajectories for individual vital dimensions using
open-source foundation models (zero-shot, no fine-tuning on patient data).

Model priority:
  1. Amazon Chronos-T5-small  (MIT)        — primary, GPU or CPU
  2. Google TimesFM-1.0-200M  (Apache 2.0) — fallback, GPU or CPU
  3. IBM Granite TTM-R2       (Apache 2.0) — lightweight CPU fallback
  4. Scipy polynomial regression            — offline fallback, always available

No patient data leaves the service; all inference runs locally.
"""

from __future__ import annotations

import logging
from typing import Optional

import numpy as np
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field
from scipy.stats import norm

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api/twin-forecast", tags=["forecast"])

# ── Request / Response models ─────────────────────────────────────────────────


class DimensionTimeSeries(BaseModel):
    name: str = Field(..., description="Vital dimension name, e.g. 'heart_rate'")
    timestamps: list[float] = Field(..., description="Unix timestamps (seconds)")
    values: list[float] = Field(..., description="Observed values aligned with timestamps")
    # higher_is_worse = True means declining values are "improving" (e.g. fall risk score)
    higher_is_worse: bool = Field(default=False)


class ForecastRequest(BaseModel):
    dimensions: list[DimensionTimeSeries] = Field(..., description="Vital dimensions to forecast")
    horizon_days: list[int] = Field(default=[7, 14, 30], description="Forecast horizons in days")
    preferred_model: Optional[str] = Field(
        default=None,
        description="Force a specific model: 'chronos' | 'timesfm' | 'granite' | 'scipy'",
    )


class DimensionForecast(BaseModel):
    name: str
    model_used: str
    horizon_7d: Optional[float] = None
    horizon_14d: Optional[float] = None
    horizon_30d: Optional[float] = None
    trend: str  # 'improving' | 'stable' | 'worsening' | 'unknown'
    confidence: float  # 0.0–1.0
    daily_forecast: list[float] = Field(
        default_factory=list,
        description="Day-by-day forecast values up to max(horizon_days)",
    )


class ForecastResponse(BaseModel):
    forecasts: list[DimensionForecast]
    primary_model: str


# ── Lazy model loading ─────────────────────────────────────────────────────────

_chronos_pipeline = None
_timesfm_model = None
_granite_pipeline = None


def _load_chronos():
    global _chronos_pipeline
    if _chronos_pipeline is not None:
        return _chronos_pipeline
    try:
        import torch
        from chronos import ChronosPipeline

        device = "cuda" if torch.cuda.is_available() else "cpu"
        _chronos_pipeline = ChronosPipeline.from_pretrained(
            "amazon/chronos-t5-small",
            device_map=device,
            torch_dtype=torch.bfloat16 if device == "cuda" else torch.float32,
        )
        logger.info(f"[twin_forecast] Chronos-T5-small loaded on {device}")
    except Exception as e:
        logger.warning(f"[twin_forecast] Chronos unavailable: {e}")
    return _chronos_pipeline


def _load_timesfm():
    global _timesfm_model
    if _timesfm_model is not None:
        return _timesfm_model
    try:
        import timesfm

        _timesfm_model = timesfm.TimesFm(
            hparams=timesfm.TimesFmHparams(
                backend="torch",
                per_core_batch_size=32,
                horizon_len=30,
                input_patch_len=32,
                output_patch_len=128,
                num_layers=20,
                model_dims=1280,
            ),
            checkpoint=timesfm.TimesFmCheckpoint(
                huggingface_repo_id="google/timesfm-1.0-200m-pytorch"
            ),
        )
        logger.info("[twin_forecast] TimesFM-1.0-200M loaded")
    except Exception as e:
        logger.warning(f"[twin_forecast] TimesFM unavailable: {e}")
    return _timesfm_model


def _load_granite():
    global _granite_pipeline
    if _granite_pipeline is not None:
        return _granite_pipeline
    try:
        # IBM Granite TTM is distributed via the tsfm_public package
        from tsfm_public import TinyTimeMixerForPrediction
        from transformers import AutoConfig

        config = AutoConfig.from_pretrained("ibm/granite-timeseries-ttm-r2")
        _granite_pipeline = TinyTimeMixerForPrediction.from_pretrained(
            "ibm/granite-timeseries-ttm-r2", config=config
        )
        _granite_pipeline.eval()
        logger.info("[twin_forecast] Granite TTM-R2 loaded")
    except Exception as e:
        logger.warning(f"[twin_forecast] Granite TTM unavailable: {e}")
    return _granite_pipeline


# ── Forecasting implementations ───────────────────────────────────────────────


def _forecast_chronos(
    values: list[float], max_horizon: int
) -> tuple[list[float], float]:
    """Forecast via Amazon Chronos-T5-small (zero-shot)."""
    pipeline = _load_chronos()
    if pipeline is None:
        raise RuntimeError("Chronos not available")

    import torch

    context = torch.tensor(values, dtype=torch.float32).unsqueeze(0)
    # num_samples=20 → compute median + IQR for confidence
    forecast = pipeline.predict(
        context=context,
        prediction_length=max_horizon,
        num_samples=20,
        limit_prediction_length=False,
    )
    # forecast: (1, num_samples, prediction_length)
    daily = forecast[0].median(dim=0).values.tolist()

    q25 = forecast[0].quantile(0.25, dim=0).values.numpy()
    q75 = forecast[0].quantile(0.75, dim=0).values.numpy()
    iqr = float(np.mean(q75 - q25))
    value_range = float(np.ptp(values)) if len(values) > 1 else 1.0
    confidence = float(np.clip(1.0 - iqr / (value_range + 1e-6) * 0.5, 0.3, 0.95))

    return daily, confidence


def _forecast_timesfm(
    values: list[float], max_horizon: int
) -> tuple[list[float], float]:
    """Forecast via Google TimesFM-1.0-200M."""
    model = _load_timesfm()
    if model is None:
        raise RuntimeError("TimesFM not available")

    arr = np.array(values, dtype=np.float32)
    point_forecast, _ = model.forecast([arr], freq=[0])  # freq=0 → daily
    daily = point_forecast[0][:max_horizon].tolist()
    return daily, 0.82


def _forecast_granite(
    values: list[float], max_horizon: int
) -> tuple[list[float], float]:
    """Forecast via IBM Granite TTM-R2 (lightweight CPU model)."""
    import torch

    model = _load_granite()
    if model is None:
        raise RuntimeError("Granite not available")

    ctx_len = min(512, len(values))
    context = torch.tensor(values[-ctx_len:], dtype=torch.float32).unsqueeze(0).unsqueeze(-1)
    with torch.no_grad():
        output = model(past_values=context)
    preds = output.prediction_outputs.squeeze().tolist()
    if isinstance(preds, float):
        preds = [preds]
    daily = preds[:max_horizon]
    # Pad if model predicts fewer than max_horizon steps
    if len(daily) < max_horizon:
        daily = daily + [daily[-1]] * (max_horizon - len(daily))
    return daily, 0.75


def _forecast_scipy(
    values: list[float], max_horizon: int
) -> tuple[list[float], float]:
    """Polynomial regression fallback — always available, no network or GPU."""
    n = len(values)
    if n < 2:
        v = float(values[0]) if values else 0.0
        return [v] * max_horizon, 0.25

    x = np.arange(n, dtype=float)
    y = np.array(values, dtype=float)

    # Fit up to degree-2 polynomial depending on series length
    degree = min(2, n - 1)
    coeffs = np.polyfit(x, y, degree)
    poly = np.poly1d(coeffs)

    future_x = np.arange(n, n + max_horizon, dtype=float)
    daily = poly(future_x).tolist()

    # R² as a proxy for confidence
    y_hat = poly(x)
    ss_res = float(np.sum((y - y_hat) ** 2))
    ss_tot = float(np.sum((y - float(np.mean(y))) ** 2))
    r2 = 1.0 - ss_res / (ss_tot + 1e-9)
    confidence = float(np.clip(r2, 0.2, 0.75))

    return daily, confidence


def _pick_horizons(
    daily: list[float], horizon_days: list[int]
) -> dict[int, Optional[float]]:
    """Map requested horizon days to forecast values."""
    return {
        d: float(daily[min(d - 1, len(daily) - 1)]) if daily else None
        for d in horizon_days
    }


def _classify_trend(
    recent_values: list[float],
    forecast_7d: Optional[float],
    higher_is_worse: bool,
) -> str:
    """Classify 7-day trajectory vs the patient's recent baseline."""
    if forecast_7d is None or not recent_values:
        return "unknown"
    baseline = float(np.mean(recent_values))
    if baseline == 0:
        return "unknown"
    delta_pct = (forecast_7d - baseline) / (abs(baseline) + 1e-6) * 100.0
    if abs(delta_pct) < 3.0:
        return "stable"
    improving = delta_pct < 0.0 if higher_is_worse else delta_pct > 0.0
    return "improving" if improving else "worsening"


# ── Route ─────────────────────────────────────────────────────────────────────


@router.post("/", response_model=ForecastResponse)
async def forecast_vitals(request: ForecastRequest) -> ForecastResponse:
    """
    Forecast vital dimension trajectories using open-source foundation models.

    Tries models in priority order:
      Chronos-T5-small → TimesFM → Granite-TTM → Scipy polynomial (always available)

    All inference runs locally — no PHI leaves the service.
    """
    if not request.dimensions:
        raise HTTPException(status_code=400, detail="No dimensions provided")

    preferred = (request.preferred_model or "").lower()
    max_horizon = max(request.horizon_days) if request.horizon_days else 30
    primary_model = "scipy-polynomial"
    forecasts: list[DimensionForecast] = []

    for dim in request.dimensions:
        if len(dim.values) < 2:
            forecasts.append(
                DimensionForecast(
                    name=dim.name,
                    model_used="none",
                    trend="unknown",
                    confidence=0.0,
                )
            )
            continue

        daily: list[float] = []
        model_used = "scipy-polynomial"
        confidence = 0.5

        # ── Try each model in priority order ──────────────────────────────────
        model_order = (
            [preferred]
            if preferred in ("chronos", "timesfm", "granite", "scipy")
            else ["chronos", "timesfm", "granite"]
        )

        for model_name in model_order:
            if daily:
                break
            try:
                if model_name == "chronos":
                    daily, confidence = _forecast_chronos(dim.values, max_horizon)
                    model_used = "chronos-t5-small"
                elif model_name == "timesfm":
                    daily, confidence = _forecast_timesfm(dim.values, max_horizon)
                    model_used = "timesfm-1.0-200m"
                elif model_name == "granite":
                    daily, confidence = _forecast_granite(dim.values, max_horizon)
                    model_used = "granite-timeseries-ttm-r2"
            except Exception as e:
                logger.debug(f"[twin_forecast] {model_name} failed for {dim.name}: {e}")

        # ── Always-available scipy fallback ───────────────────────────────────
        if not daily:
            try:
                daily, confidence = _forecast_scipy(dim.values, max_horizon)
                model_used = "scipy-polynomial"
            except Exception:
                daily = [float(dim.values[-1])] * max_horizon
                model_used = "constant"
                confidence = 0.1

        # Track which model dominated
        if primary_model == "scipy-polynomial" and model_used != "scipy-polynomial":
            primary_model = model_used

        horizon_vals = _pick_horizons(daily, request.horizon_days)
        recent = dim.values[-7:] if len(dim.values) >= 7 else dim.values

        forecasts.append(
            DimensionForecast(
                name=dim.name,
                model_used=model_used,
                horizon_7d=horizon_vals.get(7),
                horizon_14d=horizon_vals.get(14),
                horizon_30d=horizon_vals.get(30),
                trend=_classify_trend(recent, horizon_vals.get(7), dim.higher_is_worse),
                confidence=round(confidence, 3),
                daily_forecast=[round(v, 4) for v in daily],
            )
        )

    return ForecastResponse(forecasts=forecasts, primary_model=primary_model)


@router.get("/status")
async def model_status() -> dict:
    """Check which forecasting models are loaded / available."""
    chronos_ok = _load_chronos() is not None
    timesfm_ok = _load_timesfm() is not None
    granite_ok = _load_granite() is not None

    available = []
    if chronos_ok:
        available.append("chronos-t5-small")
    if timesfm_ok:
        available.append("timesfm-1.0-200m")
    if granite_ok:
        available.append("granite-timeseries-ttm-r2")
    available.append("scipy-polynomial")  # always available

    return {
        "available_models": available,
        "primary": available[0],
        "chronos_loaded": chronos_ok,
        "timesfm_loaded": timesfm_ok,
        "granite_loaded": granite_ok,
        "scipy_available": True,
    }
