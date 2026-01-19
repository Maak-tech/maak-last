#!/bin/bash
# Development startup script
# Starts ML service with hot reload and logging

set -e

echo "Starting PPG ML Service in development mode..."

# Check if virtual environment exists
if [ ! -d "venv" ]; then
    echo "❌ Virtual environment not found. Run setup.sh first."
    exit 1
fi

# Activate virtual environment
source venv/bin/activate

# Check if model weights exist
if [ ! -f "weights/papagei_s.pt" ]; then
    echo "⚠️  Warning: Model weights not found!"
    echo "   Run: python download_model.py"
    read -p "Continue anyway? (y/n) " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        exit 1
    fi
fi

# Set development environment variables
export LOG_LEVEL=DEBUG
export DEVICE=cpu
export MODEL_PATH=weights/papagei_s.pt

# Start service with auto-reload
echo "Starting service on http://localhost:8000"
echo "Press Ctrl+C to stop"
echo ""

uvicorn main:app --host 0.0.0.0 --port 8000 --reload
