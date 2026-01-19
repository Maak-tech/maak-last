# PPG ML Service

Python backend service for advanced PPG signal analysis using **PaPaGei**, **REBAR**, and **ResNet1D** models.

## 🚀 Quick Start

### Windows
```powershell
.\setup.ps1
python download_model.py
.\scripts\start_dev.ps1
```

### Linux/Mac
```bash
chmod +x setup.sh
./setup.sh
python download_model.py
./scripts/start_dev.sh
```

See [QUICK_START.md](QUICK_START.md) for detailed instructions.

## 📋 Prerequisites

- Python 3.9+
- 8GB+ RAM
- CUDA-capable GPU (optional, for faster inference)

## 🛠️ Setup

### Automated Setup

**Windows:**
```powershell
.\setup.ps1
```

**Linux/Mac:**
```bash
chmod +x setup.sh
./setup.sh
```

### Manual Setup

```bash
# Create virtual environment
python -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate

# Install dependencies
pip install -r requirements.txt

# Download PaPaGei model weights
python download_model.py
# Or manually: https://zenodo.org/record/13983110
```

## 🏃 Running

### Development Mode (with auto-reload)

```bash
# Windows
.\scripts\start_dev.ps1

# Linux/Mac
./scripts/start_dev.sh
```

### Production Mode

```bash
python main.py
```

### Using Docker

```bash
docker build -t ppg-ml-service .
docker run -p 8000:8000 ppg-ml-service
```

## 🧪 Testing

### Run Test Suite

```bash
python test_service.py
```

### Verify Integration

```bash
python verify_integration.py
```

### Compare Traditional vs ML

```bash
python compare_traditional_vs_ml.py
```

### Test Scripts

- **Windows:** `.\run_tests.ps1`
- **Linux/Mac:** `./run_tests.sh`

## 📡 API Endpoints

### POST /api/ppg/analyze

Analyze PPG signal using PaPaGei model.

**Request:**
```json
{
  "signal": [0.5, 0.52, 0.48, ...],
  "frameRate": 30,
  "duration": 60
}
```

**Response:**
```json
{
  "success": true,
  "heartRate": 72,
  "heartRateVariability": 45,
  "respiratoryRate": 16,
  "signalQuality": 0.85,
  "confidence": 0.92,
  "warnings": []
}
```

### GET /api/health

Health check endpoint.

### POST /api/ppg/embeddings

Extract embeddings from PPG signal (for advanced analysis).

## 📁 Project Structure

```
ml-service/
├── main.py                      # FastAPI application
├── models/
│   └── papagei.py              # PaPaGei model wrapper
├── preprocessing/
│   └── ppg.py                  # PPG signal preprocessing
├── api/
│   └── endpoints.py            # API route handlers
├── scripts/
│   ├── start_dev.sh            # Development startup (Linux/Mac)
│   └── start_dev.ps1            # Development startup (Windows)
├── weights/                    # Model weights directory
├── setup.sh / setup.ps1        # Setup scripts
├── test_service.py             # Test suite
├── verify_integration.py       # Integration verification
├── compare_traditional_vs_ml.py # Comparison tool
├── download_model.py            # Model download utility
├── requirements.txt             # Python dependencies
├── Dockerfile                   # Container configuration
└── cloudbuild.yaml              # Cloud Run deployment config
```

## 🔧 Configuration

Create `.env` file:

```env
MODEL_PATH=weights/papagei_s.pt
DEVICE=cpu  # or cuda
API_PORT=8000
API_HOST=0.0.0.0
LOG_LEVEL=INFO
```

## 🚀 Deployment

See [README_DEPLOYMENT.md](README_DEPLOYMENT.md) for detailed deployment instructions.

**Quick Cloud Run deployment:**
```bash
gcloud builds submit --config cloudbuild.yaml
```

## 📚 Documentation

- **[QUICK_START.md](QUICK_START.md)** - Quick setup guide
- **[README_DEPLOYMENT.md](README_DEPLOYMENT.md)** - Deployment guide
- **[../docs/PPG_ML_INTEGRATION.md](../docs/PPG_ML_INTEGRATION.md)** - Integration plan
- **[../docs/DEVELOPMENT_WORKFLOW.md](../docs/DEVELOPMENT_WORKFLOW.md)** - Development workflow

## 🐛 Troubleshooting

### Model Not Found
```bash
python download_model.py
```

### Import Errors
```bash
git clone https://github.com/Nokia-Bell-Labs/papagei-foundation-model.git
export PYTHONPATH=$PYTHONPATH:$(pwd)/papagei-foundation-model
```

### Service Won't Start
- Check port 8000 is available
- Verify virtual environment is activated
- Check dependencies: `pip list`

See [QUICK_START.md](QUICK_START.md) for more troubleshooting tips.

## 🔗 Resources

- [PaPaGei GitHub](https://github.com/Nokia-Bell-Labs/papagei-foundation-model)
- [REBAR GitHub](https://github.com/maxxu05/rebar)
- [ResNet1D GitHub](https://github.com/hsd1503/resnet1d)
- [Model Weights](https://zenodo.org/record/13983110)

## 📝 License

See main project LICENSE file.
