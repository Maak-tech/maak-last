"""
API Endpoints for PPG ML Service — raw embedding extraction via PaPaGei.

The /api/ppg/analyze endpoint (heart rate, HRV, SpO2) lives in main.py because
it needs direct access to the PaPaGei model loaded at startup.  This router
handles the companion /api/ppg/embeddings endpoint that exposes raw 512-dim
embeddings for downstream model training and research use.

The module-level _papagei_model reference is populated by main.py's lifespan
hook after the model has loaded — same pattern used by twin_forecast.py and
medgemma_explain.py.
"""
from typing import Optional

import numpy as np  # pyright: ignore[reportMissingImports]
from fastapi import APIRouter, HTTPException  # pyright: ignore[reportMissingImports]
from pydantic import BaseModel, Field  # pyright: ignore[reportMissingImports]

router = APIRouter(prefix="/api", tags=["PPG"])

# ── Shared model reference ─────────────────────────────────────────────────────
# Set by main.py lifespan after PaPaGei weights are loaded.

_papagei_model = None  # Optional[PaPaGeiModel]


def set_papagei_model(model) -> None:
    """Called by main.py to inject the loaded PaPaGei model into this router."""
    global _papagei_model
    _papagei_model = model


# ── Schemas ────────────────────────────────────────────────────────────────────


class EmbeddingRequest(BaseModel):
    """Request for embedding extraction"""

    signal: list[float] = Field(..., description="Raw PPG signal values")
    frameRate: float = Field(..., description="Sampling rate of the signal (Hz)")
    returnSegments: bool = Field(
        False,
        description=(
            "If True, return per-segment embeddings "
            "(shape: n_segments × 512) flattened to a 1-D list. "
            "If False (default), return a single averaged 512-dim vector."
        ),
    )


class EmbeddingResponse(BaseModel):
    """Response with embeddings"""

    success: bool
    # 1-D list: either 512 floats (averaged) or n_segments*512 floats (per-segment)
    embeddings: Optional[list[float]] = None
    # Original shape before flattening, e.g. [512] or [n_segments, 512]
    shape: Optional[list[int]] = None
    # Number of 10-second segments extracted from the signal
    n_segments: Optional[int] = None
    error: Optional[str] = None


# ── Endpoint ───────────────────────────────────────────────────────────────────


@router.post("/ppg/embeddings", response_model=EmbeddingResponse)
async def extract_embeddings(request: EmbeddingRequest) -> EmbeddingResponse:
    """
    Extract raw 512-dim PaPaGei embeddings from a PPG signal.

    Useful for:
    - Training downstream clinical prediction models
    - Signal quality assessment
    - Research / model development

    Returns a single averaged 512-dim vector (default) or per-segment embeddings
    when `returnSegments=True`.  Requires the PaPaGei model to be loaded — see
    `/api/health` to check model availability.
    """
    if _papagei_model is None:
        raise HTTPException(
            status_code=503,
            detail=(
                "PaPaGei model is not loaded. "
                "Ensure MODEL_PATH points to valid weights and the service "
                "started successfully. Check /api/health for model status."
            ),
        )

    if len(request.signal) < 2:
        raise HTTPException(
            status_code=422,
            detail="Signal must contain at least 2 samples.",
        )

    if request.frameRate <= 0:
        raise HTTPException(
            status_code=422,
            detail="frameRate must be a positive number.",
        )

    try:
        signal_array = np.array(request.signal, dtype=np.float32)

        # extract_embeddings handles internal resampling to PaPaGei's 125 Hz
        # target and per-segment or averaged output.
        raw_embeddings = _papagei_model.extract_embeddings(
            signal=signal_array,
            fs=request.frameRate,
            return_segments=request.returnSegments,
        )

        # Determine shape before flattening
        if raw_embeddings.ndim == 1:
            # Averaged output: shape (512,)
            shape = list(raw_embeddings.shape)
            n_segments = 1
        else:
            # Per-segment output: shape (n_segments, 512)
            shape = list(raw_embeddings.shape)
            n_segments = raw_embeddings.shape[0]

        return EmbeddingResponse(
            success=True,
            embeddings=raw_embeddings.flatten().tolist(),
            shape=shape,
            n_segments=n_segments,
        )

    except ValueError as exc:
        # e.g. "No valid segments extracted from signal"
        raise HTTPException(status_code=422, detail=str(exc)) from exc
    except Exception as exc:
        raise HTTPException(
            status_code=500,
            detail=f"Embedding extraction failed: {exc}",
        ) from exc
