# PPG ML Integration - Complete Setup Guide ✅

## 🎯 Overview

This guide provides a complete walkthrough for setting up the PPG ML service using PaPaGei, REBAR, and ResNet1D models.

## 📦 What's Included

### 1. Python ML Service (`ml-service/`)
- ✅ FastAPI backend with PaPaGei integration
- ✅ Preprocessing pipeline for PPG signals
- ✅ REST API endpoints
- ✅ Docker and Cloud Run deployment configs
- ✅ Test suite and utilities

### 2. Firebase Functions Integration
- ✅ Cloud Function wrapper (`analyzePPGWithML`)
- ✅ Service client with error handling
- ✅ Automatic fallback support

### 3. React Native Integration
- ✅ ML service client (`lib/services/ppgMLService.ts`)
- ✅ Updated BiometricUtils with ML processing
- ✅ Updated PPG component
- ✅ Automatic fallback to traditional processing

## 🚀 Step-by-Step Setup

### Step 1: Set Up Python ML Service

#### Windows:
```powershell
cd ml-service
.\setup.ps1
```

#### Linux/Mac:
```bash
cd ml-service
chmod +x setup.sh
./setup.sh
```

### Step 2: Download PaPaGei Model Weights

**Option A: Automatic (if available)**
```bash
python download_model.py
```

**Option B: Manual**
1. Visit: https://zenodo.org/record/13983110
2. Download `papagei_s.pt`
3. Place in `ml-service/weights/` directory

### Step 3: Clone PaPaGei Repository

```bash
cd ml-service
git clone https://github.com/Nokia-Bell-Labs/papagei-foundation-model.git
```

**Set PYTHONPATH:**
- **Windows (PowerShell):**
  ```powershell
  $env:PYTHONPATH = "$env:PYTHONPATH;$(Get-Location)\papagei-foundation-model"
  ```
- **Linux/Mac:**
  ```bash
  export PYTHONPATH=$PYTHONPATH:$(pwd)/papagei-foundation-model
  ```

### Step 4: Test Locally

```bash
# Start the service
source venv/bin/activate  # or .\venv\Scripts\Activate.ps1
python main.py
```

**In another terminal, run tests:**
```bash
python test_service.py
```

Or use test scripts:
- Linux/Mac: `./run_tests.sh`
- Windows: `.\run_tests.ps1`

### Step 5: Deploy to Cloud (Optional)

See `ml-service/README_DEPLOYMENT.md` for detailed deployment instructions.

**Quick Cloud Run deployment:**
```bash
cd ml-service
gcloud builds submit --config cloudbuild.yaml
```

### Step 6: Configure Firebase Functions

Set environment variable:
```bash
firebase functions:config:set ppg_ml_service.url="https://your-service-url.run.app"
```

Or add to `functions/.env`:
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

## 🔍 Verification Checklist

- [ ] Python ML service starts without errors
- [ ] Health endpoint responds: `curl http://localhost:8000/api/health`
- [ ] Test suite passes: `python test_service.py`
- [ ] Model weights are in `weights/papagei_s.pt`
- [ ] PaPaGei repository is cloned
- [ ] PYTHONPATH is set correctly
- [ ] Firebase Functions deployed
- [ ] React Native app can call ML service

## 📊 How It Works

### Signal Flow

```
React Native App
    ↓ Captures PPG signal (60s @ 30fps)
    ↓ Calls processPPGSignalWithML()
    ↓
Firebase Cloud Function (analyzePPGWithML)
    ↓ Validates request
    ↓ Calls Python ML Service
    ↓
Python ML Service
    ↓ Preprocesses signal (bandpass filter, resample to 125Hz)
    ↓ Segments into 10-second windows
    ↓ Extracts embeddings using PaPaGei
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
- ✅ App automatically uses traditional processing
- ✅ No user-facing errors
- ✅ Seamless degradation
- ✅ Results still saved to Firestore

## 🎨 Features

### Current Implementation
- ✅ ML-powered PPG signal analysis
- ✅ Heart rate detection (40-200 BPM)
- ✅ Heart rate variability (HRV) in ms
- ✅ Respiratory rate estimation (breaths/min)
- ✅ Signal quality assessment (0-1)
- ✅ Confidence scoring
- ✅ Automatic fallback

### Future Enhancements
- ⏳ Arrhythmia detection
- ⏳ Blood pressure estimation
- ⏳ Sleep quality analysis
- ⏳ Stress level detection
- ⏳ REBAR fine-tuning on user data
- ⏳ Custom ResNet1D models

## 📈 Performance Expectations

| Metric | Traditional | ML (PaPaGei) |
|--------|------------|--------------|
| **Accuracy** | Good (clean signals) | Better (noisy signals) |
| **Latency** | <100ms (on-device) | ~500ms (API call) |
| **Signal Quality** | Rule-based | Learned assessment |
| **Generalization** | Device-specific | Cross-device/user |
| **Robustness** | Sensitive to noise | More robust |

## 🐛 Troubleshooting

### Common Issues

#### 1. Model Not Loading
**Error:** `FileNotFoundError: Model weights not found`

**Solution:**
```bash
python download_model.py
# Or manually download and place in weights/
```

#### 2. Import Errors
**Error:** `ImportError: No module named 'preprocessing.ppg'`

**Solution:**
```bash
git clone https://github.com/Nokia-Bell-Labs/papagei-foundation-model.git
export PYTHONPATH=$PYTHONPATH:$(pwd)/papagei-foundation-model
```

#### 3. Service Won't Start
**Error:** Port already in use

**Solution:**
```bash
# Find process using port 8000
lsof -i :8000  # Mac/Linux
netstat -ano | findstr :8000  # Windows

# Kill process or change port in .env
```

#### 4. ML Service Timeout
**Error:** Request timeout in Firebase Functions

**Solution:**
- Increase Cloud Run timeout
- Check service logs
- Verify network connectivity

## 📚 Documentation

- **Quick Start**: `ml-service/QUICK_START.md`
- **Deployment**: `ml-service/README_DEPLOYMENT.md`
- **Integration Plan**: `docs/PPG_ML_INTEGRATION.md`
- **Setup Complete**: `docs/PPG_ML_SETUP_COMPLETE.md`

## 🔗 Resources

- [PaPaGei GitHub](https://github.com/Nokia-Bell-Labs/papagei-foundation-model)
- [REBAR GitHub](https://github.com/maxxu05/rebar)
- [ResNet1D GitHub](https://github.com/hsd1503/resnet1d)
- [PaPaGei Paper](https://arxiv.org/abs/2410.20542)
- [Model Weights](https://zenodo.org/record/13983110)

## ✅ Success Criteria

Your setup is complete when:
1. ✅ Python service runs without errors
2. ✅ Test suite passes
3. ✅ Firebase Functions deployed
4. ✅ React Native app can call ML service
5. ✅ PPG measurements use ML processing
6. ✅ Results are accurate and saved

## 🎉 Next Steps

1. **Monitor Performance**: Check logs and metrics
2. **Collect Data**: Gather PPG signals for fine-tuning
3. **Fine-tune Models**: Use REBAR for domain adaptation
4. **Add Features**: Implement arrhythmia detection, etc.
5. **Scale**: Optimize for production load

---

**Need Help?** Check the troubleshooting section or review the detailed documentation files.
