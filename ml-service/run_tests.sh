#!/bin/bash
# Run tests for PPG ML Service

set -e

echo "Running PPG ML Service Tests..."
echo ""

# Check if virtual environment exists
if [ ! -d "venv" ]; then
    echo "❌ Virtual environment not found. Please run setup.sh first."
    exit 1
fi

# Activate virtual environment
source venv/bin/activate

# Check if service is running
echo "Checking if service is running..."
if ! curl -s http://localhost:8000/api/health > /dev/null 2>&1; then
    echo "⚠️  Service not running. Starting service in background..."
    python main.py &
    SERVICE_PID=$!
    echo "Waiting for service to start..."
    sleep 5
    
    # Check again
    if ! curl -s http://localhost:8000/api/health > /dev/null 2>&1; then
        echo "❌ Service failed to start"
        kill $SERVICE_PID 2>/dev/null || true
        exit 1
    fi
    echo "✅ Service started (PID: $SERVICE_PID)"
    echo ""
    
    # Run tests
    python test_service.py
    TEST_RESULT=$?
    
    # Stop service
    echo ""
    echo "Stopping service..."
    kill $SERVICE_PID 2>/dev/null || true
    wait $SERVICE_PID 2>/dev/null || true
    
    exit $TEST_RESULT
else
    echo "✅ Service is running"
    echo ""
    python test_service.py
fi
