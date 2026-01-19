"""
Compare traditional signal processing vs ML-based processing
Useful for validating ML improvements
"""
import json
import sys
import time
from pathlib import Path

import numpy as np
import requests

# Add parent directory to path to import BiometricUtils
sys.path.insert(0, str(Path(__file__).parent.parent))

ML_SERVICE_URL = "http://localhost:8000"


def generate_test_signals():
    """Generate various test signals with different characteristics"""
    signals = {}
    
    # Clean signal (good quality)
    t = np.linspace(0, 60, 1800)  # 60s at 30fps
    clean = np.sin(2 * np.pi * 1.2 * t) + 0.3 * np.sin(2 * np.pi * 0.25 * t)
    clean = (clean - clean.min()) / (clean.max() - clean.min())
    signals["clean"] = clean.tolist()
    
    # Noisy signal
    noisy = clean + 0.2 * np.random.randn(len(clean))
    noisy = np.clip(noisy, 0, 1)
    signals["noisy"] = noisy.tolist()
    
    # Low amplitude signal
    low_amp = clean * 0.3 + 0.5
    signals["low_amplitude"] = low_amp.tolist()
    
    # High heart rate signal (~100 BPM)
    high_hr = np.sin(2 * np.pi * 1.67 * t) + 0.3 * np.sin(2 * np.pi * 0.25 * t)
    high_hr = (high_hr - high_hr.min()) / (high_hr.max() - high_hr.min())
    signals["high_hr"] = high_hr.tolist()
    
    return signals


def test_traditional_processing(signal, frame_rate=30.0):
    """Test traditional signal processing"""
    try:
        # Import traditional processing
        from lib.utils.BiometricUtils import processPPGSignalEnhanced
        
        start_time = time.time()
        result = processPPGSignalEnhanced(signal, frame_rate)
        elapsed = time.time() - start_time
        
        return {
            "success": result.get("success", False),
            "heartRate": result.get("heartRate"),
            "signalQuality": result.get("signalQuality", 0),
            "elapsed_time": elapsed,
            "method": "traditional"
        }
    except Exception as e:
        return {
            "success": False,
            "error": str(e),
            "method": "traditional"
        }


def test_ml_processing(signal, frame_rate=30.0):
    """Test ML-based processing"""
    try:
        response = requests.post(
            f"{ML_SERVICE_URL}/api/ppg/analyze",
            json={
                "signal": signal,
                "frameRate": frame_rate,
                "duration": len(signal) / frame_rate
            },
            timeout=30
        )
        
        if response.status_code == 200:
            data = response.json()
            return {
                "success": data.get("success", False),
                "heartRate": data.get("heartRate"),
                "signalQuality": data.get("signalQuality", 0),
                "confidence": data.get("confidence", 0),
                "elapsed_time": response.elapsed.total_seconds(),
                "method": "ml"
            }
        else:
            return {
                "success": False,
                "error": f"HTTP {response.status_code}",
                "method": "ml"
            }
    except Exception as e:
        return {
            "success": False,
            "error": str(e),
            "method": "ml"
        }


def compare_results(traditional_result, ml_result, signal_name):
    """Compare and display results"""
    print(f"\n{'='*60}")
    print(f"Signal: {signal_name}")
    print(f"{'='*60}")
    
    print(f"\nTraditional Processing:")
    if traditional_result["success"]:
        print(f"  ✅ Success")
        print(f"  Heart Rate: {traditional_result.get('heartRate', 'N/A')} BPM")
        print(f"  Signal Quality: {traditional_result.get('signalQuality', 0):.3f}")
        print(f"  Processing Time: {traditional_result.get('elapsed_time', 0)*1000:.1f}ms")
    else:
        print(f"  ❌ Failed: {traditional_result.get('error', 'Unknown error')}")
    
    print(f"\nML Processing (PaPaGei):")
    if ml_result["success"]:
        print(f"  ✅ Success")
        print(f"  Heart Rate: {ml_result.get('heartRate', 'N/A')} BPM")
        print(f"  Signal Quality: {ml_result.get('signalQuality', 0):.3f}")
        print(f"  Confidence: {ml_result.get('confidence', 0):.3f}")
        print(f"  Processing Time: {ml_result.get('elapsed_time', 0)*1000:.1f}ms")
    else:
        print(f"  ❌ Failed: {ml_result.get('error', 'Unknown error')}")
    
    # Comparison
    if traditional_result["success"] and ml_result["success"]:
        hr_diff = abs(traditional_result.get('heartRate', 0) - ml_result.get('heartRate', 0))
        quality_diff = ml_result.get('signalQuality', 0) - traditional_result.get('signalQuality', 0)
        
        print(f"\nComparison:")
        print(f"  Heart Rate Difference: {hr_diff:.1f} BPM")
        print(f"  Quality Difference: {quality_diff:+.3f} ({'Better' if quality_diff > 0 else 'Worse' if quality_diff < 0 else 'Same'})")
        
        time_diff = ml_result.get('elapsed_time', 0) - traditional_result.get('elapsed_time', 0)
        print(f"  Time Difference: {time_diff*1000:+.1f}ms")


def main():
    """Run comparison tests"""
    print("=" * 60)
    print("Traditional vs ML Processing Comparison")
    print("=" * 60)
    
    # Check if ML service is running
    try:
        response = requests.get(f"{ML_SERVICE_URL}/api/health", timeout=2)
        if response.status_code != 200:
            print(f"❌ ML service not responding at {ML_SERVICE_URL}")
            print("   Please start the service: python main.py")
            return 1
    except:
        print(f"❌ Cannot connect to ML service at {ML_SERVICE_URL}")
        print("   Please start the service: python main.py")
        return 1
    
    print("✅ ML service is running")
    
    # Generate test signals
    print("\nGenerating test signals...")
    signals = generate_test_signals()
    
    # Run comparisons
    results = {}
    for signal_name, signal in signals.items():
        print(f"\nTesting {signal_name} signal...")
        
        traditional_result = test_traditional_processing(signal)
        ml_result = test_ml_processing(signal)
        
        compare_results(traditional_result, ml_result, signal_name)
        
        results[signal_name] = {
            "traditional": traditional_result,
            "ml": ml_result
        }
    
    # Summary
    print("\n" + "=" * 60)
    print("Summary")
    print("=" * 60)
    
    traditional_success = sum(1 for r in results.values() if r["traditional"]["success"])
    ml_success = sum(1 for r in results.values() if r["ml"]["success"])
    
    print(f"\nTraditional Processing: {traditional_success}/{len(signals)} successful")
    print(f"ML Processing: {ml_success}/{len(signals)} successful")
    
    if ml_success > traditional_success:
        print("\n✅ ML processing shows better success rate")
    elif ml_success == traditional_success:
        print("\n⚠️  Both methods have similar success rates")
    else:
        print("\n⚠️  Traditional processing shows better success rate")
    
    return 0


if __name__ == "__main__":
    sys.exit(main())
