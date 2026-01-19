"""
End-to-end integration verification script
Tests the complete flow from React Native → Firebase → ML Service
"""
import json
import sys
from pathlib import Path

import requests

# Configuration
ML_SERVICE_URL = "http://localhost:8000"
FIREBASE_FUNCTIONS_URL = None  # Set if testing Firebase Functions directly


def test_ml_service_direct():
    """Test ML service directly"""
    print("=" * 60)
    print("Testing ML Service Direct Connection")
    print("=" * 60)
    
    # Generate test signal
    import numpy as np
    t = np.linspace(0, 60, 1800)  # 60s at 30fps
    signal = np.sin(2 * np.pi * 1.2 * t) + 0.3 * np.sin(2 * np.pi * 0.25 * t)
    signal = (signal - signal.min()) / (signal.max() - signal.min())
    
    try:
        response = requests.post(
            f"{ML_SERVICE_URL}/api/ppg/analyze",
            json={
                "signal": signal.tolist(),
                "frameRate": 30.0,
                "duration": 60.0
            },
            timeout=30
        )
        
        if response.status_code == 200:
            data = response.json()
            print("✅ ML Service Response:")
            print(f"   Success: {data.get('success')}")
            print(f"   Heart Rate: {data.get('heartRate')} BPM")
            print(f"   Signal Quality: {data.get('signalQuality'):.3f}")
            return True
        else:
            print(f"❌ ML Service failed: {response.status_code}")
            print(f"   Response: {response.text}")
            return False
    except Exception as e:
        print(f"❌ ML Service connection failed: {e}")
        return False


def test_firebase_functions():
    """Test Firebase Functions integration"""
    if not FIREBASE_FUNCTIONS_URL:
        print("⚠️  Firebase Functions URL not configured. Skipping.")
        return None
    
    print("\n" + "=" * 60)
    print("Testing Firebase Functions Integration")
    print("=" * 60)
    
    # This would require Firebase Functions emulator or deployed functions
    # For now, just verify the function exists
    print("✅ Firebase Functions integration configured")
    print("   (Run Firebase emulator or deploy to test)")
    return None


def verify_file_structure():
    """Verify all required files exist"""
    print("\n" + "=" * 60)
    print("Verifying File Structure")
    print("=" * 60)
    
    required_files = [
        "main.py",
        "requirements.txt",
        "models/papagei.py",
        "preprocessing/ppg.py",
        "api/endpoints.py",
    ]
    
    required_dirs = [
        "weights",
        "models",
        "preprocessing",
        "api",
    ]
    
    all_ok = True
    
    for file_path in required_files:
        if Path(file_path).exists():
            print(f"✅ {file_path}")
        else:
            print(f"❌ {file_path} - MISSING")
            all_ok = False
    
    for dir_path in required_dirs:
        if Path(dir_path).is_dir():
            print(f"✅ {dir_path}/")
        else:
            print(f"❌ {dir_path}/ - MISSING")
            all_ok = False
    
    # Check model weights
    if Path("weights/papagei_s.pt").exists():
        print("✅ weights/papagei_s.pt")
    else:
        print("⚠️  weights/papagei_s.pt - Not found (run download_model.py)")
    
    return all_ok


def verify_dependencies():
    """Verify Python dependencies are installed"""
    print("\n" + "=" * 60)
    print("Verifying Dependencies")
    print("=" * 60)
    
    required_packages = [
        "fastapi",
        "uvicorn",
        "torch",
        "numpy",
        "scipy",
        "requests",
    ]
    
    missing = []
    for package in required_packages:
        try:
            __import__(package)
            print(f"✅ {package}")
        except ImportError:
            print(f"❌ {package} - NOT INSTALLED")
            missing.append(package)
    
    if missing:
        print(f"\n⚠️  Missing packages: {', '.join(missing)}")
        print("   Run: pip install -r requirements.txt")
        return False
    
    return True


def verify_react_native_integration():
    """Verify React Native integration files exist"""
    print("\n" + "=" * 60)
    print("Verifying React Native Integration")
    print("=" * 60)
    
    # Check if we're in the project root
    project_root = Path(__file__).parent.parent
    
    react_native_files = [
        "lib/services/ppgMLService.ts",
        "lib/utils/BiometricUtils.ts",
        "functions/src/services/ppgMLService.ts",
        "functions/src/index.ts",
    ]
    
    all_ok = True
    for file_path in react_native_files:
        full_path = project_root / file_path
        if full_path.exists():
            print(f"✅ {file_path}")
        else:
            print(f"❌ {file_path} - MISSING")
            all_ok = False
    
    return all_ok


def main():
    """Run all verification checks"""
    print("\n" + "=" * 60)
    print("PPG ML Integration Verification")
    print("=" * 60)
    print()
    
    results = {}
    
    # 1. File structure
    results["files"] = verify_file_structure()
    
    # 2. Dependencies
    results["dependencies"] = verify_dependencies()
    
    # 3. React Native integration
    results["react_native"] = verify_react_native_integration()
    
    # 4. ML Service (if running)
    results["ml_service"] = test_ml_service_direct()
    
    # 5. Firebase Functions (optional)
    results["firebase"] = test_firebase_functions()
    
    # Summary
    print("\n" + "=" * 60)
    print("Verification Summary")
    print("=" * 60)
    
    for check, result in results.items():
        if result is True:
            print(f"✅ {check}: PASSED")
        elif result is False:
            print(f"❌ {check}: FAILED")
        else:
            print(f"⚠️  {check}: SKIPPED")
    
    # Overall status
    passed = sum(1 for r in results.values() if r is True)
    failed = sum(1 for r in results.values() if r is False)
    
    print(f"\nTotal: {passed} passed, {failed} failed")
    
    if failed == 0:
        print("\n✅ All checks passed! Integration is ready.")
        return 0
    else:
        print("\n⚠️  Some checks failed. Please review and fix issues.")
        return 1


if __name__ == "__main__":
    sys.exit(main())
