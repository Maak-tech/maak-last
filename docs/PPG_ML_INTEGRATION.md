# PPG ML Integration Plan: PaPaGei, REBAR, and ResNet1D

## Overview

This document outlines the integration strategy for using three powerful ML tools to enhance PPG (Photoplethysmography) signal analysis in the Maak health app:

1. **PaPaGei** - Pre-trained foundation model for PPG signals
2. **REBAR** - Self-supervised learning framework for time-series
3. **ResNet1D** - PyTorch implementations of ResNet architectures

## Current State

- **Frontend**: React Native app with real-time PPG measurement using VisionCamera
- **Processing**: Traditional signal processing (Butterworth filtering, peak detection, autocorrelation)
- **Backend**: Firebase Functions (TypeScript/Node.js)
- **Signal Flow**: Camera → Frame processing → PPG signal extraction → Traditional analysis → Results

## Integration Architecture

### Option A: Separate Python ML Service (Recommended)

```
React Native App
    ↓ (PPG signal array)
Firebase Functions (API Gateway)
    ↓ (HTTP request with PPG data)
Python ML Service (Cloud Run / EC2 / GCP)
    ├── PaPaGei Model (Feature Extraction)
    ├── Downstream Models (HR/HRV/Respiratory Rate)
    └── REBAR (Optional: Fine-tuning)
    ↓ (JSON response with predictions)
Firebase Functions
    ↓
React Native App (Display results)
```

### Option B: Direct Integration (Future)

- Convert PyTorch models to TensorFlow.js
- Run inference directly in React Native
- **Limitation**: Larger bundle size, potential accuracy loss

## Implementation Plan

### Phase 1: PaPaGei Integration (Quick Win)

**Goal**: Replace/enhance traditional signal processing with PaPaGei embeddings

**Steps**:
1. Set up Python ML service
2. Integrate PaPaGei model loading
3. Create preprocessing pipeline matching PaPaGei requirements
4. Extract embeddings from PPG signals
5. Train lightweight downstream models (linear regression/classification)
6. Create REST API endpoints
7. Integrate with Firebase Functions
8. Update React Native app to use ML backend

**Expected Benefits**:
- Better signal quality assessment
- More accurate heart rate detection
- Improved robustness to noise
- Better generalization across devices/users

### Phase 2: REBAR Integration (Advanced)

**Goal**: Improve model robustness with self-supervised learning

**Steps**:
1. Collect unlabeled PPG data from users (with consent)
2. Pre-train encoder using REBAR methodology
3. Fine-tune on labeled data (heart rate annotations)
4. Compare performance vs. PaPaGei-only approach

**Expected Benefits**:
- Better performance with limited labeled data
- Improved robustness to artifacts
- Domain adaptation to your specific user population

### Phase 3: Custom ResNet1D Models (Optional)

**Goal**: Custom architectures for specific tasks

**Steps**:
1. Use ResNet1D as backbone architecture
2. Train task-specific models (e.g., arrhythmia detection)
3. Deploy alongside PaPaGei for ensemble predictions

## Technical Details

### PaPaGei Model Requirements

- **Input**: Preprocessed PPG signal segments (10 seconds @ 125 Hz = 1250 samples)
- **Preprocessing**: 
  - Bandpass filtering (0.5-8 Hz)
  - Segmentation into 10-second windows
  - Resampling to 125 Hz
- **Output**: 512-dimensional embeddings per segment
- **Model Size**: ~50MB (PaPaGei-S)

### Signal Format Conversion

**Current Format** (from React Native):
```typescript
signal: number[]  // Pixel intensity values (0-255)
frameRate: number // Typically 14-30 fps
```

**PaPaGei Format**:
```python
signal: np.ndarray  # Preprocessed PPG waveform
fs: int            # Sampling frequency (125 Hz target)
segments: np.ndarray # (num_segments, segment_length)
```

**Conversion Steps**:
1. Normalize pixel intensities to PPG waveform
2. Apply bandpass filter (0.5-8 Hz)
3. Resample to 125 Hz
4. Segment into 10-second windows
5. Feed to PaPaGei model

### API Design

**Endpoint**: `POST /api/ppg/analyze`

**Request**:
```json
{
  "signal": [0.5, 0.52, 0.48, ...],  // Normalized PPG values
  "frameRate": 30,
  "duration": 60,  // seconds
  "userId": "user123",
  "metadata": {
    "device": "iPhone 14",
    "timestamp": "2024-01-01T12:00:00Z"
  }
}
```

**Response**:
```json
{
  "success": true,
  "heartRate": 72,
  "heartRateVariability": 45,
  "respiratoryRate": 16,
  "signalQuality": 0.85,
  "confidence": 0.92,
  "embeddings": [...],  // Optional: for advanced analysis
  "warnings": []
}
```

## Performance Considerations

### Latency Targets
- **Feature Extraction**: < 500ms
- **Downstream Prediction**: < 100ms
- **Total API Response**: < 1s

### Scalability
- **Concurrent Requests**: Support 100+ simultaneous users
- **Model Loading**: Use model caching to avoid cold starts
- **Batch Processing**: Process multiple segments in parallel

### Cost Optimization
- Use GPU instances only for training
- CPU instances sufficient for inference
- Consider model quantization for faster inference

## Comparison: Traditional vs. ML Approach

| Aspect | Traditional (Current) | ML (PaPaGei) |
|--------|---------------------|--------------|
| **Accuracy** | Good for clean signals | Better for noisy signals |
| **Generalization** | Device/user specific | Better cross-device/user |
| **Latency** | < 100ms (on-device) | ~500ms (API call) |
| **Signal Quality** | Rule-based metrics | Learned quality assessment |
| **Robustness** | Sensitive to artifacts | More robust to noise |
| **Maintenance** | Manual tuning | Self-improving with data |

## Migration Strategy

1. **Parallel Processing**: Run both traditional and ML methods
2. **A/B Testing**: Compare results and user experience
3. **Gradual Rollout**: Start with 10% of users, increase to 100%
4. **Fallback**: Use traditional method if ML service unavailable

## Next Steps

1. ✅ Create integration plan (this document)
2. ⏳ Set up Python ML service structure
3. ⏳ Integrate PaPaGei model
4. ⏳ Create API endpoints
5. ⏳ Update React Native integration
6. ⏳ Deploy and test
7. ⏳ Monitor performance and iterate

## References

- [PaPaGei GitHub](https://github.com/Nokia-Bell-Labs/papagei-foundation-model)
- [REBAR GitHub](https://github.com/maxxu05/rebar)
- [ResNet1D GitHub](https://github.com/hsd1503/resnet1d)
- [PaPaGei Paper](https://arxiv.org/abs/2410.20542)
