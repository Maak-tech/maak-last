# PPG ML Service - Quick Start Guide

## 🚀 Quick Setup (5 minutes)

### Windows (PowerShell)

```powershell
# 1. Run setup script
.\setup.ps1

# 2. Download model weights
python download_model.py

# 3. Start the service
.\venv\Scripts\Activate.ps1
python main.py
```

### Linux/Mac (Bash)

```bash
# 1. Run setup script
chmod +x setup.sh
./setup.sh

# 2. Download model weights
python download_model.py

# 3. Start the service
source venv/bin/activate
python main.py
```

## ✅ Verify Installation

### Test the Service

In another terminal:

```bash
# Activate environment
source venv/bin/activate  # or .\venv\Scripts\Activate.ps1 on Windows

# Run tests
python test_service.py
```

Or use the test scripts:
- Linux/Mac: `./run_tests.sh`
- Windows: `.\run_tests.ps1`

## 📡 API Usage

### Health Check

```bash
curl http://localhost:8000/api/health
```

### Analyze PPG Signal

```bash
curl -X POST http://localhost:8000/api/ppg/analyze \
  -H "Content-Type: application/json" \
  -d '{
    "signal": [0.5, 0.52, 0.48, 0.51, ...],
    "frameRate": 30,
    "duration": 60
  }'
```

### Python Example

```python
import requests

response = requests.post(
    "http://localhost:8000/api/ppg/analyze",
    json={
        "signal": [0.5, 0.52, 0.48, ...],  # Your PPG signal
        "frameRate": 30,
        "duration": 60
    }
)

result = response.json()
print(f"Heart Rate: {result['heartRate']} BPM")
print(f"Signal Quality: {result['signalQuality']}")
```

## 🔧 Troubleshooting

### Model Not Found

```
Error: Model weights not found at weights/papagei_s.pt
```

**Solution:**
1. Run `python download_model.py`
2. Or manually download from: https://zenodo.org/record/13983110
3. Place `papagei_s.pt` in `weights/` directory

### PaPaGei Import Error

```
ImportError: No module named 'preprocessing.ppg'
```

**Solution:**
1. Clone PaPaGei repository:
   ```bash
   git clone https://github.com/Nokia-Bell-Labs/papagei-foundation-model.git
   ```
2. Add to PYTHONPATH:
   ```bash
   export PYTHONPATH=$PYTHONPATH:$(pwd)/papagei-foundation-model
   ```

### Service Won't Start

**Check:**
1. Port 8000 is not in use: `netstat -an | grep 8000`
2. Virtual environment is activated
3. Dependencies are installed: `pip list`

## 📚 Next Steps

1. **Deploy to Cloud**: See `README_DEPLOYMENT.md`
2. **Integrate with Firebase**: See `../docs/PPG_ML_INTEGRATION.md`
3. **Customize Models**: See `models/papagei.py`

## 🆘 Need Help?

- Check logs: Service outputs to console
- Test endpoints: Use `test_service.py`
- Review docs: See `README.md` and `README_DEPLOYMENT.md`
