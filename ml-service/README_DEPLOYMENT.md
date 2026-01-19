# PPG ML Service Deployment Guide

## Local Development

### Prerequisites
- Python 3.9+
- Git
- 8GB+ RAM

### Setup

```bash
# Run setup script
chmod +x setup.sh
./setup.sh

# Or manually:
python3 -m venv venv
source venv/bin/activate  # Windows: venv\Scripts\activate
pip install -r requirements.txt

# Download PaPaGei model weights
# Visit: https://zenodo.org/record/13983110
# Place papagei_s.pt in weights/ directory
```

### Run Locally

```bash
source venv/bin/activate
python main.py
```

Service will be available at `http://localhost:8000`

## Google Cloud Run Deployment

### Prerequisites
- Google Cloud SDK installed
- GCP project created
- Cloud Run API enabled

### Steps

1. **Set up GCP project**
   ```bash
   gcloud config set project YOUR_PROJECT_ID
   gcloud services enable cloudbuild.googleapis.com
   gcloud services enable run.googleapis.com
   ```

2. **Build and deploy using Cloud Build**
   ```bash
   gcloud builds submit --config cloudbuild.yaml
   ```

3. **Or deploy manually**
   ```bash
   # Build Docker image
   docker build -t gcr.io/YOUR_PROJECT_ID/ppg-ml-service .
   
   # Push to Container Registry
   docker push gcr.io/YOUR_PROJECT_ID/ppg-ml-service
   
   # Deploy to Cloud Run
   gcloud run deploy ppg-ml-service \
     --image gcr.io/YOUR_PROJECT_ID/ppg-ml-service \
     --region us-central1 \
     --platform managed \
     --allow-unauthenticated \
     --memory 2Gi \
     --cpu 2 \
     --timeout 300
   ```

4. **Set environment variables**
   ```bash
   gcloud run services update ppg-ml-service \
     --region us-central1 \
     --set-env-vars MODEL_PATH=/app/weights/papagei_s.pt,DEVICE=cpu
   ```

5. **Upload model weights**
   ```bash
   # Create a Cloud Storage bucket
   gsutil mb gs://YOUR_PROJECT_ID-ppg-ml-weights
   
   # Upload model weights
   gsutil cp weights/papagei_s.pt gs://YOUR_PROJECT_ID-ppg-ml-weights/
   
   # Mount as volume or download on startup
   ```

### Get Service URL

After deployment, get the service URL:
```bash
gcloud run services describe ppg-ml-service --region us-central1 --format 'value(status.url)'
```

Update Firebase Functions environment variable:
```bash
firebase functions:config:set ppg_ml_service.url="https://ppg-ml-service-xxx.run.app"
```

## AWS ECS/Fargate Deployment

### Build and push to ECR

```bash
# Create ECR repository
aws ecr create-repository --repository-name ppg-ml-service

# Get login token
aws ecr get-login-password --region us-east-1 | docker login --username AWS --password-stdin YOUR_ACCOUNT.dkr.ecr.us-east-1.amazonaws.com

# Build and push
docker build -t ppg-ml-service .
docker tag ppg-ml-service:latest YOUR_ACCOUNT.dkr.ecr.us-east-1.amazonaws.com/ppg-ml-service:latest
docker push YOUR_ACCOUNT.dkr.ecr.us-east-1.amazonaws.com/ppg-ml-service:latest
```

## Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `MODEL_PATH` | Path to PaPaGei model weights | `weights/papagei_s.pt` |
| `DEVICE` | Device to run model on (`cpu` or `cuda`) | `cpu` |
| `API_PORT` | Port for API server | `8000` |
| `API_HOST` | Host for API server | `0.0.0.0` |
| `LOG_LEVEL` | Logging level | `INFO` |

## Monitoring

### Health Check Endpoint

```bash
curl http://your-service-url/api/health
```

### Logs

**Cloud Run:**
```bash
gcloud run services logs read ppg-ml-service --region us-central1
```

**Docker:**
```bash
docker logs <container-id>
```

## Cost Optimization

- Use CPU instances for inference (cheaper than GPU)
- Set max instances to limit costs
- Use Cloud Run's pay-per-use model
- Consider using smaller model variants if available

## Troubleshooting

### Model not loading
- Check model weights are in correct location
- Verify file permissions
- Check logs for specific error messages

### Out of memory
- Increase Cloud Run memory allocation (2Gi minimum)
- Use CPU instead of GPU for inference
- Process signals in smaller batches

### Slow response times
- Check Cloud Run region (should be close to Firebase Functions)
- Consider using GPU instances for faster inference
- Optimize preprocessing pipeline
