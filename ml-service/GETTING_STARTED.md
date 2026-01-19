# Getting Started with PPG ML Service

## ✅ Setup Complete!

Your PPG ML Service has been successfully set up with:
- ✅ Python virtual environment
- ✅ All dependencies installed
- ✅ PaPaGei repository cloned
- ✅ Model weights downloaded (22.26 MB)

## 🚀 Quick Start

### Option 1: Use the Safe Startup Script (Recommended)

```powershell
cd ml-service
.\start_service_safe.ps1
```

This script handles errors gracefully and will start the service even if PyTorch has issues.

### Option 2: Manual Start

```powershell
cd ml-service

# Activate virtual environment
.\venv\Scripts\Activate.ps1

# Set PYTHONPATH
$env:PYTHONPATH = "$env:PYTHONPATH;C:\Users\nours\Documents\GitHub\maak-last\ml-service\papagei-foundation-model"

# Start service
python main.py
```

## 🧪 Test the Service

Once the service is running, test it:

### Health Check
```powershell
curl http://localhost:8000/api/health
```

Or in PowerShell:
```powershell
Invoke-WebRequest -Uri "http://localhost:8000/api/health"
```

### Run Test Suite
```powershell
.\venv\Scripts\Activate.ps1
python test_service.py
```

## ⚠️ Troubleshooting

### PyTorch Import Error

If you see:
```
OSError: [WinError 126] The specified module could not be found
```

**Solution:** Install Visual C++ Redistributable:
1. Download: https://aka.ms/vs/17/release/vc_redist.x64.exe
2. Install it
3. Restart terminal
4. Try again

### Service Starts But ML Endpoints Fail

This is expected if PyTorch fails to load. The service will:
- ✅ Start successfully
- ✅ Health endpoint works
- ❌ ML endpoints return errors (but won't crash)

**Solution:** Install Visual C++ Redistributable (see above)

### Model Not Found

If you see model not found errors:
```powershell
# Verify model exists
Test-Path weights\papagei_s.pt

# If missing, download again
python download_model.py
```

## 📡 API Endpoints

### Health Check
```
GET http://localhost:8000/api/health
```

### Analyze PPG Signal
```
POST http://localhost:8000/api/ppg/analyze
Content-Type: application/json

{
  "signal": [0.5, 0.52, 0.48, ...],
  "frameRate": 30,
  "duration": 60
}
```

## 🔗 Integration

Your React Native app is already configured to use this service:

1. **Firebase Functions**: `analyzePPGWithML` function is ready
2. **React Native**: `ppgMLService.ts` client is ready
3. **Automatic Fallback**: App will use traditional processing if ML service unavailable

### To Connect React Native App:

1. Start ML service locally (or deploy to cloud)
2. Update Firebase Functions environment:
   ```bash
   firebase functions:config:set ppg_ml_service.url="http://localhost:8000"
   ```
3. Deploy Firebase Functions:
   ```bash
   firebase deploy --only functions:analyzePPGWithML
   ```

## 📚 Documentation

- **Quick Start**: `QUICK_START.md`
- **Deployment**: `README_DEPLOYMENT.md`
- **Setup Status**: `SETUP_STATUS.md`
- **Development**: `../docs/DEVELOPMENT_WORKFLOW.md`

## 🎯 Next Steps

1. **Start the service**: `.\start_service_safe.ps1`
2. **Test it**: `python test_service.py`
3. **Deploy to cloud** (optional): See `README_DEPLOYMENT.md`
4. **Integrate with app**: Already done! Just deploy Firebase Functions

## 💡 Tips

- The service runs on port 8000 by default
- Check logs in the console for any errors
- Health endpoint always works, even if ML model fails
- React Native app has automatic fallback to traditional processing

## 🆘 Need Help?

- Check `SETUP_STATUS.md` for current status
- Review error messages in console
- Verify all files exist (see verification checklist)
- Check Visual C++ Redistributable is installed

---

**You're all set!** 🎉 Start the service and test it when ready.
