# PPG ML Integration Quick Start

## Overview

This guide shows you how to use **PaPaGei**, **REBAR**, and **ResNet1D** together to enhance PPG signal analysis in your React Native health app.

## What Each Tool Does

### 1. **PaPaGei** (Primary Recommendation)
- **What**: Pre-trained foundation model specifically for PPG signals
- **Best For**: Immediate performance improvement, feature extraction
- **Setup Time**: ~1 hour
- **Performance Gain**: High (better accuracy, robustness)

### 2. **REBAR** (Advanced)
- **What**: Self-supervised learning framework for time-series
- **Best For**: Improving models when you have limited labeled data
- **Setup Time**: ~4-8 hours (requires training)
- **Performance Gain**: Medium-High (better generalization)

### 3. **ResNet1D** (Architecture)
- **What**: PyTorch implementations of ResNet for 1D signals
- **Best For**: Custom model architectures, specific tasks
- **Setup Time**: Variable (depends on use case)
- **Performance Gain**: Medium (depends on training)

## Recommended Integration Path

### Phase 1: PaPaGei (Week 1-2) ✅ **START HERE**

**Why**: Fastest path to improved performance with minimal setup.

**Steps**:

1. **Set up Python ML Service**
   ```bash
   cd ml-service
   # Windows:
   .\setup.ps1

   # Linux/Mac:
   chmod +x setup.sh
   ./setup.sh
   ```

   Or manually:
   ```bash
   python -m venv venv
   source venv/bin/activate  # Windows: venv\Scripts\activate
   pip install -r requirements.txt
   ```

2. **Download PaPaGei Model Weights**
   - Visit: https://zenodo.org/record/13983110
   - Download `papagei_s.pt`
   - Place in `ml-service/weights/` directory

3. **Start ML Service**
   ```bash
   # Windows (recommended):
   .\start_service_safe.ps1

   # Linux/Mac (dev):
   ./scripts/start_dev.sh
   ```

   Or run directly:
   ```bash
   python main.py
   # Service runs on http://localhost:8000
   ```

4. **Test the Service**
   ```bash
   curl -X POST http://localhost:8000/api/ppg/analyze \
     -H "Content-Type: application/json" \
     -d '{
       "signal": [0.5, 0.52, 0.48, ...],
       "frameRate": 30,
       "duration": 60
     }'
   ```

5. **Deploy to Cloud** (GCP Cloud Run recommended)
   ```bash
   # Build and deploy
   gcloud run deploy ppg-ml-service --source . --region us-central1
   ```

6. **Update Firebase Functions**
   - Set runtime env var: `PPG_ML_SERVICE_URL=https://your-service-url.run.app`
   - Deploy functions: `firebase deploy --only functions`

7. **Update React Native App**
   - The app already has Firebase Functions integration
   - Call `analyzePPGWithML` Cloud Function from your PPG component
   - See integration example below

### Phase 2: REBAR (Week 3-4) - Optional

**Why**: Improve model robustness with your specific user data.

**Steps**:

1. **Collect Unlabeled PPG Data** (with user consent)
2. **Set up REBAR Training Pipeline**
3. **Pre-train Encoder** using REBAR methodology
4. **Fine-tune** on labeled heart rate data
5. **Compare** performance vs. PaPaGei-only

### Phase 3: Custom ResNet1D Models (Future)

**Why**: Task-specific models (e.g., arrhythmia detection).

**Steps**:

1. Use ResNet1D as backbone architecture
2. Train on your specific labeled data
3. Deploy alongside PaPaGei for ensemble predictions

## React Native Integration Example

Update your `BiometricUtils.ts` to optionally use ML service:

```typescript
import { getFunctions, httpsCallable } from "firebase/functions";

export async function processPPGSignalWithML(
  signal: number[],
  frameRate: number
): Promise<PPGResult> {
  try {
    const functions = getFunctions();
    const analyzePPG = httpsCallable(functions, "analyzePPGWithML");
    
    const result = await analyzePPG({
      signal,
      frameRate,
      duration: signal.length / frameRate,
    });
    
    if (result.data.success) {
      return {
        success: true,
        heartRate: result.data.heartRate,
        heartRateVariability: result.data.heartRateVariability,
        respiratoryRate: result.data.respiratoryRate,
        signalQuality: result.data.signalQuality,
        isEstimate: (result.data.confidence || 0) < 0.7,
      };
    } else {
      // Fallback to traditional processing
      return processPPGSignalEnhanced(signal, frameRate);
    }
  } catch (error) {
    // Fallback to traditional processing
    console.warn("ML service unavailable, using traditional processing");
    return processPPGSignalEnhanced(signal, frameRate);
  }
}
```

## Comparison: Traditional vs. ML

| Metric | Traditional | PaPaGei ML |
|--------|------------|------------|
| **Accuracy** | Good (clean signals) | Better (noisy signals) |
| **Latency** | <100ms (on-device) | ~500ms (API call) |
| **Generalization** | Device-specific | Cross-device/user |
| **Signal Quality** | Rule-based | Learned assessment |
| **Setup Complexity** | Low | Medium |

## Migration Strategy

1. **Parallel Processing**: Run both methods simultaneously
2. **A/B Testing**: Compare results (start with 10% of users)
3. **Gradual Rollout**: Increase to 100% if ML performs better
4. **Fallback**: Always have traditional method as backup

## Troubleshooting

### ML Service Not Responding
- Check service is running: `curl http://localhost:8000/api/health`
- Check Firebase Functions logs: `firebase functions:log`
- Verify environment variables are set

### Model Not Loading
- Ensure `papagei_s.pt` is in `ml-service/weights/`
- Check file permissions
- Verify PyTorch is installed correctly

### Poor Performance
- Check signal preprocessing matches PaPaGei requirements
- Verify sampling rate conversion is correct
- Consider fine-tuning downstream models on your data

## Next Steps

1. ✅ Set up Python ML service
2. ✅ Download PaPaGei model weights
3. ✅ Test ML service locally
4. ⏳ Deploy to cloud
5. ⏳ Integrate with React Native app
6. ⏳ Monitor performance
7. ⏳ Iterate and improve

## Resources

- [PaPaGei GitHub](https://github.com/Nokia-Bell-Labs/papagei-foundation-model)
- [REBAR GitHub](https://github.com/maxxu05/rebar)
- [ResNet1D GitHub](https://github.com/hsd1503/resnet1d)
- [Full Integration Plan](./PPG_ML_INTEGRATION.md)
