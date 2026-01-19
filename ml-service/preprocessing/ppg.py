"""
PPG Signal Preprocessing
Handles preprocessing of PPG signals for ML model input
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
    remove_dc: bool = True
) -> Tuple[np.ndarray, float]:
    """
    Preprocess PPG signal for ML model input
    
    Steps:
    1. Remove DC component (optional)
    2. Apply bandpass filter (0.5-8 Hz for heart rate)
    3. Resample to target frequency
    
    Args:
        waveform: Raw PPG signal
        fs_original: Original sampling frequency
        fs_target: Target sampling frequency (default: 125 Hz for PaPaGei)
        filter_low: Low cutoff frequency for bandpass filter (Hz)
        filter_high: High cutoff frequency for bandpass filter (Hz)
        remove_dc: Whether to remove DC component
    
    Returns:
        Tuple of (processed_signal, actual_fs)
    """
    if len(waveform) < 10:
        raise ValueError("Signal too short for processing")
    
    # Remove DC component
    if remove_dc:
        waveform = waveform - np.mean(waveform)
    
    # Apply bandpass filter
    # Design Butterworth bandpass filter
    nyquist = fs_original / 2.0
    low_norm = filter_low / nyquist
    high_norm = filter_high / nyquist
    
    # Ensure frequencies are within valid range
    low_norm = max(0.01, min(low_norm, 0.99))
    high_norm = max(0.01, min(high_norm, 0.99))
    
    if low_norm < high_norm:
        b, a = scipy_signal.butter(4, [low_norm, high_norm], btype='band')
        filtered_signal = scipy_signal.filtfilt(b, a, waveform)
    else:
        # If filter design fails, use highpass only
        high_norm = min(filter_high / nyquist, 0.99)
        b, a = scipy_signal.butter(4, high_norm, btype='high')
        filtered_signal = scipy_signal.filtfilt(b, a, waveform)
    
    # Resample to target frequency if needed
    if abs(fs_original - fs_target) > 0.1:  # Only resample if significantly different
        num_samples = int(len(filtered_signal) * fs_target / fs_original)
        resampled_signal = scipy_signal.resample(filtered_signal, num_samples)
        actual_fs = fs_target
    else:
        resampled_signal = filtered_signal
        actual_fs = fs_original
    
    return resampled_signal, actual_fs


def normalize_signal(signal: np.ndarray, method: str = "minmax") -> np.ndarray:
    """
    Normalize signal to 0-1 range
    
    Args:
        signal: Input signal
        method: Normalization method ('minmax' or 'zscore')
    
    Returns:
        Normalized signal
    """
    if method == "minmax":
        signal_min = np.min(signal)
        signal_max = np.max(signal)
        if signal_max - signal_min > 1e-10:
            return (signal - signal_min) / (signal_max - signal_min)
        else:
            return signal - signal_min
    elif method == "zscore":
        mean = np.mean(signal)
        std = np.std(signal)
        if std > 1e-10:
            return (signal - mean) / std
        else:
            return signal - mean
    else:
        raise ValueError(f"Unknown normalization method: {method}")


def detect_flatline(signal: np.ndarray, threshold: float = 0.01) -> bool:
    """
    Detect if signal is flatlined (no variation)
    
    Args:
        signal: Input signal
        threshold: Maximum allowed standard deviation
    
    Returns:
        True if signal is flatlined
    """
    return np.std(signal) < threshold


def calculate_snr(signal: np.ndarray, fs: float) -> float:
    """
    Estimate Signal-to-Noise Ratio
    
    Args:
        signal: PPG signal
        fs: Sampling frequency
    
    Returns:
        SNR estimate in dB
    """
    # Simple SNR estimation using frequency domain
    # Power in signal band (0.5-4 Hz) vs noise band (4-8 Hz)
    from scipy.signal import welch
    
    freqs, psd = welch(signal, fs, nperseg=min(len(signal), int(fs * 4)))
    
    # Signal band (heart rate: 0.5-4 Hz = 30-240 BPM)
    signal_mask = (freqs >= 0.5) & (freqs <= 4.0)
    noise_mask = (freqs >= 4.0) & (freqs <= 8.0)
    
    if np.any(signal_mask) and np.any(noise_mask):
        signal_power = np.mean(psd[signal_mask])
        noise_power = np.mean(psd[noise_mask])
        
        if noise_power > 0:
            snr_db = 10 * np.log10(signal_power / noise_power)
            return float(snr_db)
    
    return 0.0
