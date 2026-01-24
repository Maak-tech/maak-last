#!/bin/bash
# Setup script for PPG ML Service

set -e

echo "Setting up PPG ML Service..."

# Create virtual environment
if [ ! -d "venv" ]; then
    echo "Creating virtual environment..."
    python3 -m venv venv
fi

# Activate virtual environment
source venv/bin/activate

# Upgrade pip
pip install --upgrade pip

# Install dependencies
echo "Installing Python dependencies..."
pip install -r requirements.txt

# Create weights directory
mkdir -p weights

# Check if PaPaGei model weights exist
if [ ! -f "weights/papagei_s.pt" ]; then
    echo ""
    echo "⚠️  WARNING: PaPaGei model weights not found!"
    echo "Please download papagei_s.pt from: https://zenodo.org/record/13983110"
    echo "And place it in the weights/ directory"
    echo ""
else
    echo "✅ PaPaGei model weights found"
fi

# Initialize or clone PaPaGei repository
if [ ! -d "papagei-foundation-model" ]; then
    echo ""
    echo "Initializing PaPaGei repository (git submodule)..."
    
    # Try to initialize submodule first
    if git submodule update --init --recursive 2>/dev/null; then
        echo "✅ PaPaGei repository initialized (submodule)"
    else
        # Fallback: clone directly if submodule init fails
        echo "Submodule not found, cloning repository..."
        git clone https://github.com/Nokia-Bell-Labs/papagei-foundation-model.git
        echo "✅ PaPaGei repository cloned"
    fi
    echo ""
    echo "⚠️  NOTE: You may need to add papagei-foundation-model to your PYTHONPATH"
    echo "   export PYTHONPATH=\$PYTHONPATH:\$(pwd)/papagei-foundation-model"
    echo ""
fi

echo ""
echo "✅ Setup complete!"
echo ""
echo "Next steps:"
echo ""
echo "1. Download model weights (if not already done):"
echo "   python download_model.py"
echo ""
echo "2. Start the service:"
echo "   source venv/bin/activate"
echo "   python main.py"
echo ""
echo "3. Test the service (in another terminal):"
echo "   source venv/bin/activate"
echo "   python test_service.py"
echo ""
echo "4. Or use the test script:"
echo "   ./run_tests.sh"
echo ""
