"""
PaPaGei wrapper for the Nuralix ML service.

Bridges the Nokia Bell Labs PaPaGei foundation model (ResNet1DMoE) from the
`papagei-foundation-model/` submodule into a clean, service-facing API.

Model spec:
  Architecture : ResNet1DMoE
  Weights file : weights/papagei_s.pt   (resolved relative to this file)
  Input        : (batch, 1, 1250)  — 10-second PPG @ 125 Hz
  Output[0]    : (batch, 512)      — health embeddings used downstream
"""

import os
import sys
import logging
import numpy as np

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Resolve path to the foundation-model source so its modules are importable
# without installing a package.
# ---------------------------------------------------------------------------
_THIS_DIR = os.path.dirname(os.path.abspath(__file__))
_FM_DIR = os.path.join(_THIS_DIR, "..", "papagei-foundation-model")
_FM_DIR = os.path.normpath(_FM_DIR)

if _FM_DIR not in sys.path:
    sys.path.insert(0, _FM_DIR)


def _load_foundation_modules():
    """Import heavy deps lazily so the service can start without torch."""
    import torch
    from models.resnet import ResNet1DMoE  # from papagei-foundation-model/models/resnet.py
    from linearprobing.utils import load_model_without_module_prefix  # utility in foundation repo

    return torch, ResNet1DMoE, load_model_without_module_prefix


class PaPaGeiModel:
    """
    Service-facing wrapper around the PaPaGei ResNet1DMoE foundation model.

    Usage
    -----
    model = PaPaGeiModel(model_path="weights/papagei_s.pt", device="cpu")
    embeddings = model.extract_embeddings(signal)   # signal: 1-D np.ndarray
    # embeddings.shape == (512,)
    """

    #: PaPaGei target sampling rate
    FS_TARGET: float = 125.0
    #: Samples per 10-second segment at 125 Hz
    SEGMENT_LEN: int = 1250
    #: Embedding dimensionality
    EMBEDDING_DIM: int = 512

    def __init__(self, model_path: str = "weights/papagei_s.pt", device: str = "cpu") -> None:
        torch, ResNet1DMoE, load_model_without_module_prefix = _load_foundation_modules()
        self._torch = torch
        self._device = torch.device(device)

        # Resolve weights path relative to caller if not absolute
        if not os.path.isabs(model_path):
            model_path = os.path.join(_THIS_DIR, "..", model_path)
            model_path = os.path.normpath(model_path)

        if not os.path.exists(model_path):
            raise FileNotFoundError(
                f"PaPaGei weights not found at: {model_path}\n"
                "Download papagei_s.pt and place it in ml-service/weights/"
            )

        logger.info("[PaPaGei] Building ResNet1DMoE architecture …")
        model = ResNet1DMoE(
            in_channels=1,
            base_filters=32,
            kernel_size=3,
            stride=2,
            groups=1,
            n_block=18,
            n_classes=self.EMBEDDING_DIM,
            n_experts=3,
        )

        logger.info("[PaPaGei] Loading weights from %s …", model_path)
        model = load_model_without_module_prefix(model, model_path)
        model.eval()
        model.to(self._device)
        self._model = model
        logger.info("[PaPaGei] Model ready on %s", device)

    # ------------------------------------------------------------------
    # Public API
    # ------------------------------------------------------------------

    def extract_embeddings(self, signal: np.ndarray) -> np.ndarray:
        """
        Extract a 512-dimensional health embedding from a preprocessed PPG signal.

        The signal is split into non-overlapping 10-second (1250-sample) windows.
        Each window is z-score normalised and passed through the model.
        The per-window embeddings are averaged to produce a single (512,) vector.

        Parameters
        ----------
        signal : np.ndarray, shape (N,)
            Preprocessed, resampled PPG signal at 125 Hz.
            N must be >= 1250; shorter signals raise ValueError.

        Returns
        -------
        np.ndarray, shape (512,)
            Averaged embedding across all windows.

        Raises
        ------
        ValueError
            If the signal is shorter than one segment (1250 samples).
        """
        if len(signal) < self.SEGMENT_LEN:
            raise ValueError(
                f"Signal too short: got {len(signal)} samples, "
                f"need at least {self.SEGMENT_LEN} (10 s @ 125 Hz)."
            )

        torch = self._torch
        segments = self._segment_signal(signal)       # (n_windows, 1250)
        segments = self._z_score_normalize(segments)  # per-window normalisation

        # Shape: (n_windows, 1, 1250)
        tensor = torch.tensor(segments, dtype=torch.float32).unsqueeze(1).to(self._device)

        with torch.inference_mode():
            # ResNet1DMoE forward: returns (out_class, out_moe1, out_moe2, out_emb)
            # out_class[0] is the (batch, 512) embedding from the dense head
            outputs = self._model(tensor)
            # Index 0 → dense (n_classes=512) projection; shape (n_windows, 512)
            embeddings = outputs[0].cpu().detach().numpy()

        # Average across windows → (512,)
        return embeddings.mean(axis=0)

    # ------------------------------------------------------------------
    # Internal helpers
    # ------------------------------------------------------------------

    def _segment_signal(self, signal: np.ndarray) -> np.ndarray:
        """Split a 1-D signal into non-overlapping windows of SEGMENT_LEN."""
        n_windows = len(signal) // self.SEGMENT_LEN
        trimmed = signal[: n_windows * self.SEGMENT_LEN]
        return trimmed.reshape(n_windows, self.SEGMENT_LEN)

    @staticmethod
    def _z_score_normalize(segments: np.ndarray) -> np.ndarray:
        """Z-score each row (window) independently."""
        mean = segments.mean(axis=1, keepdims=True)
        std = segments.std(axis=1, keepdims=True)
        std = np.where(std == 0, 1.0, std)  # guard against flat segments
        return (segments - mean) / std
