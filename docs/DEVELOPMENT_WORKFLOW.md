# PPG ML Service - Development Workflow

## 🛠️ Development Setup

### Prerequisites
- Python 3.9+
- Node.js 18+ (for Firebase Functions)
- Git
- Docker (optional, for containerized development)

### Initial Setup

1. **Clone and setup Python service:**
   ```bash
   cd ml-service
   ./setup.sh  # or setup.ps1 on Windows
   python download_model.py
   ```

2. **Setup Firebase Functions:**
   ```bash
   cd functions
   npm install
   ```

3. **Configure environment:**
   ```bash
   # Copy example env file
   cp ml-service/.env.example ml-service/.env
   # Edit with your settings
   ```

## 🔄 Development Workflow

### Local Development

#### 1. Start ML Service
```bash
cd ml-service
source venv/bin/activate
python main.py
```

Service runs on `http://localhost:8000`

#### 2. Start Firebase Emulator (Optional)
```bash
firebase emulators:start --only functions
```

#### 3. Run Tests
```bash
# Test ML service
cd ml-service
python test_service.py

# Test integration
python verify_integration.py

# Compare traditional vs ML
python compare_traditional_vs_ml.py
```

#### 4. Make Changes
- Edit Python code in `ml-service/`
- Edit TypeScript code in `functions/src/`
- Edit React Native code in `lib/`

#### 5. Test Changes
```bash
# Restart ML service
# Re-run tests
# Test in React Native app
```

### Code Quality

#### Python
```bash
cd ml-service
source venv/bin/activate

# Format code
black .
isort .

# Type checking
mypy .

# Run tests
pytest tests/  # if you add pytest tests
```

#### TypeScript
```bash
cd functions
npm run build
npm test
```

## 🧪 Testing Strategy

### Unit Tests
- Test individual functions
- Test preprocessing steps
- Test model loading

### Integration Tests
- Test API endpoints
- Test Firebase Functions
- Test end-to-end flow

### Comparison Tests
- Compare traditional vs ML processing
- Validate accuracy improvements
- Measure performance differences

## 📊 Monitoring & Debugging

### Logs

#### ML Service
```bash
# View logs in console
python main.py

# Or redirect to file
python main.py > ml-service.log 2>&1
```

#### Firebase Functions
```bash
# View logs
firebase functions:log

# Or in Firebase Console
# https://console.firebase.google.com/project/YOUR_PROJECT/functions/logs
```

### Debugging

#### ML Service Issues
1. Check service is running: `curl http://localhost:8000/api/health`
2. Check model weights exist: `ls weights/papagei_s.pt`
3. Check dependencies: `pip list`
4. Review error logs

#### Firebase Functions Issues
1. Check function deployed: `firebase functions:list`
2. Check environment variables: `firebase functions:config:get`
3. Review function logs
4. Test locally with emulator

#### React Native Issues
1. Check network requests in DevTools
2. Verify Firebase Functions URL is correct
3. Check authentication state
4. Review error messages

## 🚀 Deployment Workflow

### 1. Test Locally
```bash
# Run all tests
cd ml-service
python verify_integration.py
python test_service.py
```

### 2. Build Docker Image (Optional)
```bash
cd ml-service
docker build -t ppg-ml-service .
docker run -p 8000:8000 ppg-ml-service
```

### 3. Deploy ML Service
```bash
# Cloud Run
cd ml-service
gcloud builds submit --config cloudbuild.yaml

# Or manual deployment
gcloud run deploy ppg-ml-service --source .
```

### 4. Deploy Firebase Functions
```bash
cd functions
firebase deploy --only functions:analyzePPGWithML
```

### 5. Update Environment Variables
```bash
firebase functions:config:set ppg_ml_service.url="https://your-service.run.app"
```

### 6. Verify Deployment
```bash
# Test ML service
curl https://your-service.run.app/api/health

# Test Firebase Function
# Use Firebase Console or test from React Native app
```

## 🔍 Troubleshooting Workflow

### Issue: ML Service Not Responding

1. **Check service status:**
   ```bash
   curl http://localhost:8000/api/health
   ```

2. **Check logs:**
   ```bash
   # View service logs
   # Check for errors
   ```

3. **Restart service:**
   ```bash
   # Kill existing process
   # Restart: python main.py
   ```

### Issue: Model Not Loading

1. **Verify model file:**
   ```bash
   ls -lh weights/papagei_s.pt
   ```

2. **Check file permissions:**
   ```bash
   chmod 644 weights/papagei_s.pt
   ```

3. **Re-download if needed:**
   ```bash
   python download_model.py
   ```

### Issue: Firebase Functions Timeout

1. **Check ML service response time:**
   ```bash
   time curl -X POST http://localhost:8000/api/ppg/analyze ...
   ```

2. **Increase timeout in Firebase:**
   ```javascript
   // In functions/src/index.ts
   functions.runWith({ timeoutSeconds: 60 })
   ```

3. **Optimize ML service:**
   - Use GPU if available
   - Optimize preprocessing
   - Cache model in memory

## 📝 Best Practices

### Code Organization
- Keep preprocessing separate from model code
- Use type hints in Python
- Use TypeScript for Firebase Functions
- Document API endpoints

### Error Handling
- Always handle errors gracefully
- Provide fallback mechanisms
- Log errors for debugging
- Return meaningful error messages

### Performance
- Cache model in memory
- Optimize preprocessing pipeline
- Use async/await appropriately
- Monitor response times

### Security
- Validate input data
- Use environment variables for secrets
- Implement rate limiting
- Use HTTPS in production

## 🔄 CI/CD (Future)

### GitHub Actions Example
```yaml
# .github/workflows/test.yml
name: Test ML Service
on: [push, pull_request]
jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v2
      - uses: actions/setup-python@v2
      - run: |
          cd ml-service
          pip install -r requirements.txt
          python test_service.py
```

## 📚 Resources

- [FastAPI Documentation](https://fastapi.tiangolo.com/)
- [Firebase Functions Docs](https://firebase.google.com/docs/functions)
- [PaPaGei GitHub](https://github.com/Nokia-Bell-Labs/papagei-foundation-model)
- [React Native Docs](https://reactnative.dev/)
