# Quick Command Reference

## 🚀 Most Common Commands

### Start Service
```powershell
.\start_service_safe.ps1
```

### Verify Setup
```powershell
.\verify_setup.ps1
```

### Run Tests
```powershell
.\venv\Scripts\Activate.ps1
python test_service.py
```

### Check Health
```powershell
Invoke-WebRequest -Uri "http://localhost:8000/api/health"
```

## 📋 Setup Commands

### Initial Setup
```powershell
.\setup.ps1
python download_model.py
```

### Activate Environment
```powershell
.\venv\Scripts\Activate.ps1
```

### Set PYTHONPATH
```powershell
$env:PYTHONPATH = "$env:PYTHONPATH;C:\Users\nours\Documents\GitHub\maak-last\ml-service\papagei-foundation-model"
```

## 🧪 Testing Commands

### Test Service
```powershell
python test_service.py
```

### Verify Integration
```powershell
python verify_integration.py
```

### Compare Methods
```powershell
python compare_traditional_vs_ml.py
```

## 🔧 Development Commands

### Start Dev Mode
```powershell
.\scripts\start_dev.ps1
```

### Format Code
```powershell
black .
isort .
```

## 📡 API Testing

### Health Check
```powershell
curl http://localhost:8000/api/health
```

### Analyze PPG
```powershell
$body = @{
    signal = @(0.5, 0.52, 0.48, 0.51)
    frameRate = 30
    duration = 60
} | ConvertTo-Json

Invoke-RestMethod -Uri "http://localhost:8000/api/ppg/analyze" -Method Post -Body $body -ContentType "application/json"
```

## 🐳 Docker Commands

### Build Image
```powershell
docker build -t ppg-ml-service .
```

### Run Container
```powershell
docker run -p 8000:8000 ppg-ml-service
```

## ☁️ Deployment Commands

### Deploy to Cloud Run
```powershell
gcloud builds submit --config cloudbuild.yaml
```

### Deploy Firebase Functions
```bash
firebase deploy --only functions:analyzePPGWithML
```

## 📚 Documentation

- `START_HERE.md` - Quick start
- `GETTING_STARTED.md` - Detailed guide
- `README_DEPLOYMENT.md` - Deployment guide
