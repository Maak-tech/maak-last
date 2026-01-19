"""
API Endpoints for PPG ML Service
"""
from typing import Optional

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field

router = APIRouter(prefix="/api", tags=["PPG"])


class EmbeddingRequest(BaseModel):
    """Request for embedding extraction"""
    signal: list[float] = Field(..., description="PPG signal values")
    frameRate: float = Field(..., description="Original frame rate")
    returnSegments: bool = Field(False, description="Return per-segment embeddings")


class EmbeddingResponse(BaseModel):
    """Response with embeddings"""
    success: bool
    embeddings: Optional[list[float]] = None
    shape: Optional[list[int]] = None
    error: Optional[str] = None


@router.post("/ppg/embeddings", response_model=EmbeddingResponse)
async def extract_embeddings(request: EmbeddingRequest):
    """
    Extract embeddings from PPG signal using PaPaGei model
    
    This endpoint is useful for:
    - Advanced signal analysis
    - Training downstream models
    - Signal quality assessment
    """
    # This will be implemented when model is loaded
    # For now, return placeholder
    return EmbeddingResponse(
        success=False,
        error="Endpoint not yet implemented. Model loading required."
    )
