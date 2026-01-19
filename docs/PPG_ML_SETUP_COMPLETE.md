# PPG ML Integration - Setup Complete ✅

## What's Been Created

### 1. Python ML Service (`ml-service/`)
- ✅ FastAPI backend with PaPaGei model integration
- ✅ Preprocessing pipeline for PPG signals
- ✅ REST API endpoints for signal analysis
- ✅ Docker configuration for deployment
- ✅ Cloud Build configuration for GCP

### 2. Firebase Functions Integration
- ✅ Cloud Function wrapper (`analyzePPGWithML`)
- ✅ Service client for calling ML backend
- ✅ Error handling and fallback logic

### 3. React Native Integration
- ✅ ML service client (`lib/services/ppgMLService.ts`)
- ✅ Updated BiometricUtils with ML processing
- ✅ Updated PPG component to use ML processing
- ✅ Automatic fallback to traditional processing

### 4. Documentation
- ✅ Integration plan (`docs/PPG_ML_INTEGRATION.md`)
- ✅ Quick start guide (`docs/PPG_ML_QUICK_START.md`)
- ✅ Deployment guide (`ml-service/README_DEPLOYMENT.md`)

## Next Steps to Get Running

### Step 1: Set Up Python ML Service

```bash
cd ml-service

# Run setup script
chmod +x setup.sh
./setup.sh

# Or manually:
python3 -m venv venv
source venv/bin/activate  # Windows: venv\Scripts\activate
pip install -r requirements.txt
```

### Step 2: Download PaPaGei Model Weights

1. Visit: https://zenodo.org/record/13983110
2. Download `papagei_s.pt`
3. Place in `ml-service/weights/` directory

### Step 3: Clone PaPaGei Repository

```bash
cd ml-service
git clone https://github.com/Nokia-Bell-Labs/papagei-foundation-model.git
export PYTHONPATH=$PYTHONPATH:$(pwd)/papagei-foundation-model
```

### Step 4: Test Locally

```bash
cd ml-service
source venv/bin/activate
python main.py
```

Test the API:
```bash
curl -X POST http://localhost:8000/api/ppg/analyze \
  -H "Content-Type: application/json" \
  -d '{
    "signal": [0.5, 0.52, 0.48, 0.51, 0.49, ...],
    "frameRate": 30,
    "duration": 60
  }'
```

### Step 5: Deploy to Cloud (Recommended: Google Cloud Run)

```bash
# Build and deploy
cd ml-service
gcloud builds submit --config cloudbuild.yaml

# Get service URL
gcloud run services describe ppg-ml-service --region us-central1 --format 'value(status.url)'
```

### Step 6: Configure Firebase Functions

Set environment variable in Firebase:
```bash
firebase functions:config:set ppg_ml_service.url="https://your-service-url.run.app"
```

Or add to `.env` in functions directory:
```
PPG_ML_SERVICE_URL=https://your-service-url.run.app
```

### Step 7: Deploy Firebase Functions

```bash
cd functions
npm install
firebase deploy --only functions:analyzePPGWithML
```

### Step 8: Test in React Native App

The app will automatically:
1. Try ML processing first
2. Fall back to traditional processing if ML unavailable
3. Show results with quality indicators

## How It Works

### Signal Flow

```
React Native App (PPG Component)
    ↓ Captures PPG signal from camera
    ↓ Calls processPPGSignalWithML()
    ↓
Firebase Cloud Function (analyzePPGWithML)
    ↓ Validates request
    ↓ Calls Python ML Service
    ↓
Python ML Service (PaPaGei Model)
    ↓ Preprocesses signal
    ↓ Extracts embeddings
    ↓ Predicts heart rate, HRV, respiratory rate
    ↓ Returns results
    ↓
Firebase Cloud Function
    ↓ Returns to React Native
    ↓
React Native App
    ↓ Displays results
    ↓ Saves to Firestore
```

### Fallback Behavior

If ML service is unavailable:
- App automatically uses traditional processing
- No user-facing errors
- Seamless degradation

## Features

### Current Implementation
- ✅ ML-powered PPG signal analysis
- ✅ Heart rate detection
- ✅ Heart rate variability (HRV)
- ✅ Respiratory rate estimation
- ✅ Signal quality assessment
- ✅ Automatic fallback

### Future Enhancements
- ⏳ Arrhythmia detection
- ⏳ Blood pressure estimation
- ⏳ Sleep quality analysis
- ⏳ Stress level detection
- ⏳ REBAR fine-tuning on user data

## Performance Expectations

| Metric | Traditional | ML (PaPaGei) |
|--------|------------|--------------|
| **Accuracy** | Good (clean signals) | Better (noisy signals) |
| **Latency** | <100ms (on-device) | ~500ms (API call) |
| **Signal Quality** | Rule-based | Learned assessment |
| **Generalization** | Device-specific | Cross-device/user |

## Troubleshooting

### ML Service Not Responding
- Check service is running: `curl http://localhost:8000/api/health`
- Check Firebase Functions logs: `firebase functions:log`
- Verify environment variables are set

### Model Not Loading
- Ensure `papagei_s.pt` is in `ml-service/weights/`
- Check file permissions
- Verify PyTorch is installed correctly

### Import Errors
- Ensure PaPaGei repository is cloned
- Set PYTHONPATH: `export PYTHONPATH=$PYTHONPATH:/path/to/papagei-foundation-model`

## Resources

- [PaPaGei GitHub](https://github.com/Nokia-Bell-Labs/papagei-foundation-model)
- [REBAR GitHub](https://github.com/maxxu05/rebar)
- [ResNet1D GitHub](https://github.com/hsd1503/resnet1d)
- [PaPaGei Paper](https://arxiv.org/abs/2410.20542)

## Support

For issues or questions:
1. Check logs in Firebase Functions
2. Check Python service logs
3. Review integration documentation
4. Test API endpoints directly
