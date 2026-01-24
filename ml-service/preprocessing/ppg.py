"""
PPG Signal Preprocessing
Handles preprocessing of PPG signals for ML model input.
"""
from typing import Tuple

import numpy as np
from scipy import signal as scipy_signal


def preprocess_ppg_signal(
    waveform: np.ndarray,
    fs_original: float,
    fs_target: float = 125.0,
    filter_low: float = 0.5,
    filter_high: float = 8.0,
    remove_dc: bool = True,
) -> Tuple[np.ndarray, float]:
    """
    Preprocess PPG signal for ML model input.

    Steps:
    1. Remove DC component (optional)
    2. Apply bandpass filter
    3. Resample to target frequency

    Args:
        waveform: Raw PPG signal
        fs_original: Original sampling frequency
        fs_target: Target sampling frequency
        filter_low: Low cutoff frequency (Hz)
        filter_high: High cutoff frequency (Hz)
        remove_dc: Whether to remove DC component

    Returns:
        Tuple of (processed signal, target sampling frequency)
    """
    if waveform is None or len(waveform) == 0:
        raise ValueError("Empty waveform provided")

    signal = np.asarray(waveform, dtype=np.float32)

    # Remove DC component
    if remove_dc:
        signal = signal - np.mean(signal)

    # Bandpass filter
    nyquist = 0.5 * fs_original
    low = max(filter_low / nyquist, 1e-4)
    high = min(filter_high / nyquist, 0.999)
    if low >= high:
        raise ValueError("Invalid bandpass filter bounds")

    b, a = scipy_signal.butter(4, [low, high], btype="band")
    filtered = scipy_signal.filtfilt(b, a, signal)

    # Resample to target frequency if needed
    if fs_target != fs_original:
        num_samples = int(len(filtered) * (fs_target / fs_original))
        resampled = scipy_signal.resample(filtered, num_samples)
    else:
        resampled = filtered

    return resampled.astype(np.float32), fs_target
