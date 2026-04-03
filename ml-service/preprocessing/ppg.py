"""
PPG signal preprocessing for the Nuralix ML service.

Provides a lightweight, dependency-minimal wrapper that the main FastAPI
service calls before passing a signal to PaPaGeiModel.extract_embeddings().

Pipeline
--------
1. Resample from fs_original → fs_target (125 Hz) using scipy.signal.resample
2. Bandpass filter (0.5 – 12 Hz, Butterworth order 4) to remove motion artefacts
   and high-frequency noise while preserving the PPG waveform
3. Z-score normalise the entire signal

This is intentionally simpler than the pyPPG-based pipeline in the
foundation-model repo (papagei-foundation-model/preprocessing/ppg.py), which
requires pyPPG, vitaldb, and dotmap — heavy deps not needed at inference time.
The scipy pipeline produces equivalent results for the embedding extraction use
case.

Public API (matches the call-site in main.py)
----------------------------------------------
    processed, fs = preprocess_ppg_signal(signal, fs_original, fs_target=125.0)
"""

from __future__ import annotations

import logging
from typing import Tuple

import numpy as np
from scipy import signal as sp_signal

logger = logging.getLogger(__name__)

# Bandpass specification — matches the pyPPG defaults in the foundation repo
_BP_LOW_HZ: float = 0.5
_BP_HIGH_HZ: float = 12.0
_BP_ORDER: int = 4


def preprocess_ppg_signal(
    raw_signal: np.ndarray,
    fs_original: float,
    fs_target: float = 125.0,
) -> Tuple[np.ndarray, float]:
    """
    Prepare a raw PPG signal for PaPaGei embedding extraction.

    Steps
    -----
    1. Cast to float32.
    2. Resample from *fs_original* to *fs_target* (125 Hz by default).
    3. Apply a zero-phase Butterworth bandpass filter (0.5 – 12 Hz, order 4).
    4. Z-score normalise (mean 0, std 1).

    Parameters
    ----------
    raw_signal : np.ndarray, shape (N,)
        Raw, 1-D PPG waveform samples.
    fs_original : float
        Sampling frequency of the input signal in Hz.
    fs_target : float, optional
        Desired output sampling frequency in Hz (default 125.0 — PaPaGei rate).

    Returns
    -------
    processed : np.ndarray, shape (M,)
        Preprocessed signal at *fs_target* Hz, dtype float32.
    fs_target : float
        The effective sampling frequency of the returned signal.

    Raises
    ------
    ValueError
        If *raw_signal* is empty or *fs_original* is non-positive.
    """
    if len(raw_signal) == 0:
        raise ValueError("raw_signal must not be empty.")
    if fs_original <= 0:
        raise ValueError(f"fs_original must be positive, got {fs_original}.")

    sig = np.asarray(raw_signal, dtype=np.float32)

    # ── 1. Resample ────────────────────────────────────────────────────────────
    if fs_original != fs_target:
        n_target = int(round(len(sig) * fs_target / fs_original))
        sig = sp_signal.resample(sig, n_target).astype(np.float32)
        logger.debug(
            "[PPG] Resampled %d → %d samples  (%.1f Hz → %.1f Hz)",
            len(raw_signal), len(sig), fs_original, fs_target,
        )

    # ── 2. Bandpass filter ─────────────────────────────────────────────────────
    nyq = fs_target / 2.0
    low = _BP_LOW_HZ / nyq
    high = _BP_HIGH_HZ / nyq

    # Guard against edge-case sampling rates that would push the cutoffs ≥ 1
    if high >= 1.0:
        high = 0.99
        logger.warning(
            "[PPG] fs_target=%.1f Hz is low; clamping high bandpass cutoff to 0.99 × Nyquist.",
            fs_target,
        )

    sos = sp_signal.butter(_BP_ORDER, [low, high], btype="bandpass", output="sos")
    sig = sp_signal.sosfiltfilt(sos, sig).astype(np.float32)

    # ── 3. Z-score normalise ───────────────────────────────────────────────────
    mean = sig.mean()
    std = sig.std()
    if std == 0.0:
        logger.warning("[PPG] Signal has zero variance after filtering — returning zero array.")
        sig = np.zeros_like(sig)
    else:
        sig = (sig - mean) / std

    return sig, fs_target
