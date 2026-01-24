"""
PPG ML Service - FastAPI application for PPG signal analysis
"""
import os
from contextlib import asynccontextmanager
from typing import Optional

import numpy as np
from dotenv import load_dotenv
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

from api.endpoints import router
try:
    from models.papagei import PaPaGeiModel
    PAPAGEI_AVAILABLE = True
except ImportError as e:
    print(f"Warning: PaPaGei model not available: {e}")
    PAPAGEI_AVAILABLE = False
    PaPaGeiModel = None

try:
    from preprocessing.ppg import preprocess_ppg_signal
    PREPROCESSING_AVAILABLE = True
except ImportError as e:
    print(f"Warning: Preprocessing not available: {e}")
    PREPROCESSING_AVAILABLE = False
    def preprocess_ppg_signal(*args, **kwargs):
        raise NotImplementedError("Preprocessing not available")

# Load environment variables
load_dotenv()

# Global model instance
papagei_model: Optional[PaPaGeiModel] = None


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Load model on startup, cleanup on shutdown"""
    global papagei_model
    
    if not PAPAGEI_AVAILABLE:
        print("PaPaGei model not available - ML endpoints will be disabled")
        return
    
    print("Loading PaPaGei model...")
    model_path = os.getenv("MODEL_PATH", "weights/papagei_s.pt")
    device = os.getenv("DEVICE", "cpu")
    
    try:
        papagei_model = PaPaGeiModel(model_path=model_path, device=device)
        print(f"Model loaded successfully on {device}")
    except FileNotFoundError as e:
        print(f"Model weights not found: {e}")
        print("Please download model weights from: https://zenodo.org/record/13983110")
        print("Service will start but model endpoints will fail")
    except Exception as e:
        print(f"Error loading model: {e}")
        print("Service will start but model endpoints will fail")
    
    yield
    
    # Cleanup
    papagei_model = None
    print("Model unloaded")


# Initialize FastAPI app
app = FastAPI(
    title="PPG ML Service",
    description="Advanced PPG signal analysis using PaPaGei foundation models",
    version="1.0.0",
    lifespan=lifespan,
)

# CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Configure appropriately for production
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include routers
app.include_router(router)


# Request/Response models
class PPGAnalysisRequest(BaseModel):
    """Request model for PPG analysis"""
    signal: list[float] = Field(..., description="PPG signal values (normalized 0-1)")
    frameRate: float = Field(..., description="Original frame rate in Hz")
    duration: Optional[float] = Field(None, description="Signal duration in seconds")
    userId: Optional[str] = Field(None, description="User ID for tracking")
    metadata: Optional[dict] = Field(None, description="Additional metadata")


class PPGAnalysisResponse(BaseModel):
    """Response model for PPG analysis"""
    success: bool
    heartRate: Optional[float] = None
    heartRateVariability: Optional[float] = None
    respiratoryRate: Optional[float] = None
    signalQuality: float
    confidence: Optional[float] = None
    embeddings: Optional[list[float]] = None
    warnings: list[str] = Field(default_factory=list)
    error: Optional[str] = None


@app.post("/api/ppg/analyze", response_model=PPGAnalysisResponse)
async def analyze_ppg(request: PPGAnalysisRequest):
    """
    Analyze PPG signal using PaPaGei model
    
    This endpoint processes PPG signals and extracts:
    - Heart rate (BPM)
    - Heart rate variability (ms)
    - Respiratory rate (breaths/min)
    - Signal quality metrics
    """
    if papagei_model is None:
        raise HTTPException(
            status_code=503,
            detail="Model not loaded. Please check server logs and ensure model weights are downloaded."
        )
    
    try:
        # Convert signal to numpy array
        signal_array = np.array(request.signal, dtype=np.float32)
        
        # Validate signal
        if len(signal_array) < 30:
            return PPGAnalysisResponse(
                success=False,
                signalQuality=0.0,
                error="Insufficient signal data (minimum 30 samples required)"
            )
        
        # Preprocess signal
        # Convert from frame rate to sampling frequency
        # Assuming signal is already normalized PPG waveform
        fs_original = request.frameRate
        
        # Preprocess PPG signal (bandpass filter, etc.)
        processed_signal, fs_target = preprocess_ppg_signal(
            signal_array,
            fs_original=fs_original,
            fs_target=125.0  # PaPaGei target sampling rate
        )
        
        # Extract features using PaPaGei
        embeddings = papagei_model.extract_embeddings(processed_signal)
        
        # Predict downstream metrics
        # TODO: Train and integrate downstream models
        # For now, use traditional methods as fallback
        heart_rate = estimate_heart_rate_traditional(processed_signal, fs_target)
        hrv = estimate_hrv_traditional(processed_signal, fs_target)
        respiratory_rate = estimate_respiratory_rate_traditional(processed_signal, fs_target)
        
        # Calculate signal quality from embeddings
        signal_quality = calculate_signal_quality_from_embeddings(embeddings)
        
        return PPGAnalysisResponse(
            success=True,
            heartRate=heart_rate,
            heartRateVariability=hrv,
            respiratoryRate=respiratory_rate,
            signalQuality=float(signal_quality),
            confidence=min(signal_quality * 1.2, 1.0),  # Simple confidence metric
            warnings=[] if signal_quality > 0.7 else ["Low signal quality detected"]
        )
        
    except Exception as e:
        return PPGAnalysisResponse(
            success=False,
            signalQuality=0.0,
            error=f"Processing error: {str(e)}"
        )


@app.get("/api/health")
async def health_check():
    """Health check endpoint"""
    return {
        "status": "healthy",
        "model_loaded": papagei_model is not None
    }


# Temporary traditional estimation functions
# TODO: Replace with ML-based predictions using downstream models
def estimate_heart_rate_traditional(signal: np.ndarray, fs: float) -> float:
    """Temporary: Estimate heart rate using traditional methods"""
    # Simple peak detection
    from scipy.signal import find_peaks
    peaks, _ = find_peaks(signal, distance=int(fs * 0.4))  # Minimum 0.4s between peaks
    if len(peaks) < 2:
        return None
    intervals = np.diff(peaks) / fs
    hr = 60.0 / np.mean(intervals)
    return float(np.clip(hr, 40, 200))


def estimate_hrv_traditional(signal: np.ndarray, fs: float) -> Optional[float]:
    """Temporary: Estimate HRV using traditional methods"""
    from scipy.signal import find_peaks
    peaks, _ = find_peaks(signal, distance=int(fs * 0.4))
    if len(peaks) < 3:
        return None
    intervals = np.diff(peaks) / fs * 1000  # Convert to ms
    hrv = np.std(intervals)
    return float(hrv)


def estimate_respiratory_rate_traditional(signal: np.ndarray, fs: float) -> Optional[float]:
    """Temporary: Estimate respiratory rate using traditional methods"""
    # Simple frequency domain analysis
    from scipy.signal import welch
    freqs, psd = welch(signal, fs, nperseg=min(len(signal), int(fs * 4)))
    # Respiratory rate typically 0.15-0.4 Hz (9-24 breaths/min)
    resp_band = (freqs >= 0.15) & (freqs <= 0.4)
    if not np.any(resp_band):
        return None
    resp_freq = freqs[resp_band][np.argmax(psd[resp_band])]
    return float(resp_freq * 60)


def calculate_signal_quality_from_embeddings(embeddings: np.ndarray) -> float:
    """Calculate signal quality from PaPaGei embeddings"""
    # Simple heuristic: variance of embeddings indicates signal quality
    # Higher variance = more informative = better quality
    if embeddings.size == 0:
        return 0.0
    variance = np.var(embeddings)
    # Normalize to 0-1 range (heuristic threshold)
    quality = min(variance / 10.0, 1.0)
    return float(quality)


if __name__ == "__main__":
    import uvicorn
    port = int(os.getenv("PORT", os.getenv("API_PORT", 8000)))
    uvicorn.run(app, host="0.0.0.0", port=port)
