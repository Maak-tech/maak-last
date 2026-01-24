"""
Script to download PaPaGei model weights from Zenodo
"""
import os
import sys
from pathlib import Path
from urllib.request import urlretrieve
from urllib.error import URLError

# Fix Windows console encoding
if sys.platform == "win32":
    import io
    sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8', errors='replace')

ZENODO_RECORD = "13983110"
MODEL_FILENAME = "papagei_s.pt"
WEIGHTS_DIR = Path("weights")
MODEL_PATH = WEIGHTS_DIR / MODEL_FILENAME

# Zenodo download URL (this is a placeholder - actual URL may vary)
# You'll need to visit https://zenodo.org/record/13983110 to get the actual download link
ZENODO_BASE_URL = f"https://zenodo.org/record/{ZENODO_RECORD}/files/{MODEL_FILENAME}"


def download_file(url: str, destination: Path, chunk_size: int = 8192):
    """Download a file with progress indication"""
    def show_progress(block_num, block_size, total_size):
        downloaded = block_num * block_size
        percent = min(100, (downloaded * 100) / total_size) if total_size > 0 else 0
        sys.stdout.write(f"\rDownloading: {percent:.1f}% ({downloaded}/{total_size} bytes)")
        sys.stdout.flush()
    
    try:
        urlretrieve(url, str(destination), show_progress)
        print("\n[SUCCESS] Download complete!")
        return True
    except URLError as e:
        print(f"\n[ERROR] Download failed: {e}")
        return False


def main():
    """Download PaPaGei model weights"""
    print("=" * 60)
    print("PaPaGei Model Weight Downloader")
    print("=" * 60)
    
    # Create weights directory
    WEIGHTS_DIR.mkdir(exist_ok=True)
    
    # Check if model already exists
    if MODEL_PATH.exists():
        print(f"[OK] Model weights already exist at {MODEL_PATH}")
        print("Skipping download.")
        return
    
    print(f"\nDownloading {MODEL_FILENAME}...")
    print(f"Source: https://zenodo.org/record/{ZENODO_RECORD}")
    print(f"Destination: {MODEL_PATH}")
    print("\nNote: Zenodo may require manual download.")
    print("If automatic download fails, please:")
    print("1. Visit: https://zenodo.org/record/13983110")
    print("2. Download papagei_s.pt manually")
    print(f"3. Place it in: {WEIGHTS_DIR.absolute()}")
    print()
    
    # Try to download
    success = download_file(ZENODO_BASE_URL, MODEL_PATH)
    
    if not success:
        print("\n[WARNING] Automatic download failed.")
        print("Please download manually from:")
        print(f"   https://zenodo.org/record/{ZENODO_RECORD}")
        print(f"\nAnd place {MODEL_FILENAME} in:")
        print(f"   {WEIGHTS_DIR.absolute()}")
        
        # Try to open browser
        try:
            import webbrowser
            print("\nOpening download page in browser...")
            webbrowser.open(f"https://zenodo.org/record/{ZENODO_RECORD}")
        except:
            pass


if __name__ == "__main__":
    main()
