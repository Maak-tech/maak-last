"""
Test script for PPG ML Service
Tests the API endpoints and model functionality
"""
import json
import sys
import time
from pathlib import Path

import numpy as np
import requests

# Test configuration
BASE_URL = "http://localhost:8000"
TEST_SIGNAL_DURATION = 10  # seconds
TEST_FRAME_RATE = 30  # Hz


def generate_test_signal(duration: float = 10.0, frame_rate: float = 30.0) -> list[float]:
    """
    Generate a synthetic PPG-like test signal
    
    Args:
        duration: Signal duration in seconds
        frame_rate: Sampling rate in Hz
    
    Returns:
        List of signal values (normalized 0-1)
    """
    t = np.linspace(0, duration, int(duration * frame_rate))
    
    # Simulate heart rate around 72 BPM (1.2 Hz)
    heart_rate_hz = 72 / 60
    heart_signal = np.sin(2 * np.pi * heart_rate_hz * t)
    
    # Add respiratory component (~0.25 Hz = 15 breaths/min)
    respiratory_hz = 0.25
    respiratory_signal = 0.3 * np.sin(2 * np.pi * respiratory_hz * t)
    
    # Add noise
    noise = 0.1 * np.random.randn(len(t))
    
    # Combine and normalize to 0-1
    signal = heart_signal + respiratory_signal + noise
    signal = (signal - signal.min()) / (signal.max() - signal.min())
    
    return signal.tolist()


def test_health_endpoint():
    """Test the health check endpoint"""
    print("Testing health endpoint...")
    try:
        response = requests.get(f"{BASE_URL}/api/health", timeout=5)
        if response.status_code == 200:
            data = response.json()
            print(f"✅ Health check passed: {data}")
            return True
        else:
            print(f"❌ Health check failed: {response.status_code}")
            return False
    except requests.exceptions.RequestException as e:
        print(f"❌ Health check failed: {e}")
        return False


def test_analyze_endpoint():
    """Test the PPG analysis endpoint"""
    print("\nTesting PPG analysis endpoint...")
    
    # Generate test signal
    signal = generate_test_signal(TEST_SIGNAL_DURATION, TEST_FRAME_RATE)
    print(f"Generated test signal: {len(signal)} samples")
    
    # Prepare request
    payload = {
        "signal": signal,
        "frameRate": TEST_FRAME_RATE,
        "duration": TEST_SIGNAL_DURATION,
        "metadata": {
            "test": True,
            "source": "test_script"
        }
    }
    
    try:
        print("Sending request...")
        start_time = time.time()
        response = requests.post(
            f"{BASE_URL}/api/ppg/analyze",
            json=payload,
            timeout=30
        )
        elapsed_time = time.time() - start_time
        
        if response.status_code == 200:
            data = response.json()
            print(f"✅ Analysis completed in {elapsed_time:.2f}s")
            print(f"   Success: {data.get('success')}")
            print(f"   Heart Rate: {data.get('heartRate')} BPM")
            print(f"   HRV: {data.get('heartRateVariability')} ms")
            print(f"   Respiratory Rate: {data.get('respiratoryRate')} bpm")
            print(f"   Signal Quality: {data.get('signalQuality'):.3f}")
            print(f"   Confidence: {data.get('confidence', 0):.3f}")
            
            if data.get('warnings'):
                print(f"   Warnings: {data.get('warnings')}")
            
            return True
        else:
            print(f"❌ Analysis failed: {response.status_code}")
            print(f"   Response: {response.text}")
            return False
    except requests.exceptions.RequestException as e:
        print(f"❌ Analysis request failed: {e}")
        return False


def test_model_loading():
    """Test if model can be loaded"""
    print("\nTesting model loading...")
    try:
        from models.papagei import PaPaGeiModel
        
        model_path = Path("weights/papagei_s.pt")
        if not model_path.exists():
            print("⚠️  Model weights not found. Skipping model test.")
            print("   Download from: https://zenodo.org/record/13983110")
            return None
        
        print("Loading model...")
        model = PaPaGeiModel(model_path=str(model_path), device="cpu")
        print("✅ Model loaded successfully")
        
        # Test embedding extraction
        test_signal = generate_test_signal(10, 125)  # 10s at 125 Hz
        print("Testing embedding extraction...")
        embeddings = model.extract_embeddings(np.array(test_signal), fs=125.0)
        print(f"✅ Embeddings extracted: shape {embeddings.shape}")
        
        return True
    except ImportError as e:
        print(f"⚠️  Could not import PaPaGei model: {e}")
        print("   This is expected if PaPaGei repository is not cloned")
        return None
    except Exception as e:
        print(f"❌ Model test failed: {e}")
        return False


def main():
    """Run all tests"""
    print("=" * 60)
    print("PPG ML Service Test Suite")
    print("=" * 60)
    
    results = {}
    
    # Test 1: Health endpoint
    results["health"] = test_health_endpoint()
    
    # Test 2: Model loading (optional)
    results["model"] = test_model_loading()
    
    # Test 3: Analysis endpoint
    results["analysis"] = test_analyze_endpoint()
    
    # Summary
    print("\n" + "=" * 60)
    print("Test Summary")
    print("=" * 60)
    
    for test_name, result in results.items():
        if result is True:
            print(f"✅ {test_name}: PASSED")
        elif result is False:
            print(f"❌ {test_name}: FAILED")
        else:
            print(f"⚠️  {test_name}: SKIPPED")
    
    # Overall result
    passed = sum(1 for r in results.values() if r is True)
    failed = sum(1 for r in results.values() if r is False)
    
    print(f"\nTotal: {passed} passed, {failed} failed")
    
    if failed > 0:
        sys.exit(1)
    else:
        print("\n✅ All tests passed!")
        sys.exit(0)


if __name__ == "__main__":
    main()
