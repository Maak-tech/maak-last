"""
PaPaGei Model Wrapper
Loads and uses the pre-trained PaPaGei-S foundation model for PPG signal analysis
"""
import os
from typing import Optional

import numpy as np  # pyright: ignore[reportMissingImports]
import torch  # pyright: ignore[reportMissingImports]
import torch.nn as nn  # pyright: ignore[reportMissingImports]

# Note: These imports assume you've cloned the PaPaGei repository
# and added it to your Python path or installed it as a package
try:
    from linearprobing.utils import resample_batch_signal, load_model_without_module_prefix  # pyright: ignore[reportMissingImports]
    from preprocessing.ppg import preprocess_one_ppg_signal  # pyright: ignore[reportMissingImports]
    from segmentations import waveform_to_segments  # pyright: ignore[reportMissingImports]
    from models.resnet import ResNet1DMoE  # pyright: ignore[reportMissingImports]
except ImportError:
    print("Warning: PaPaGei modules not found. Install from https://github.com/Nokia-Bell-Labs/papagei-foundation-model")
    # Create stub functions for development
    def resample_batch_signal(*args, **kwargs):
        raise NotImplementedError("PaPaGei not installed")
    def load_model_without_module_prefix(*args, **kwargs):
        raise NotImplementedError("PaPaGei not installed")
    def preprocess_one_ppg_signal(*args, **kwargs):
        raise NotImplementedError("PaPaGei not installed")
    def waveform_to_segments(*args, **kwargs):
        raise NotImplementedError("PaPaGei not installed")
    class ResNet1DMoE(nn.Module):
        pass


class PaPaGeiModel:
    """
    Wrapper for PaPaGei-S foundation model
    
    Model Configuration:
    - base_filters: 32
    - kernel_size: 3
    - stride: 2
    - groups: 1
    - n_block: 18
    - n_classes: 512 (embedding dimension)
    - n_experts: 3
    """
    
    def __init__(
        self,
        model_path: str = "weights/papagei_s.pt",
        device: str = "cpu",
        segment_duration_seconds: float = 10.0,
        target_fs: float = 125.0
    ):
        """
        Initialize PaPaGei model
        
        Args:
            model_path: Path to pre-trained model weights
            device: Device to run model on ('cpu' or 'cuda')
            segment_duration_seconds: Duration of each segment in seconds
            target_fs: Target sampling frequency in Hz
        """
        self.device = torch.device(device if torch.cuda.is_available() else "cpu")
        self.segment_duration_seconds = segment_duration_seconds
        self.target_fs = target_fs
        
        # Model configuration
        self.model_config = {
            'base_filters': 32,
            'kernel_size': 3,
            'stride': 2,
            'groups': 1,
            'n_block': 18,
            'n_classes': 512,  # Embedding dimension
            'n_experts': 3
        }
        
        # Load model
        self.model = self._load_model(model_path)
        self.model.eval()  # Set to evaluation mode
        
        print(f"PaPaGei model loaded on {self.device}")
    
    def _load_model(self, model_path: str) -> nn.Module:
        """Load pre-trained PaPaGei model"""
        if not os.path.exists(model_path):
            raise FileNotFoundError(
                f"Model weights not found at {model_path}. "
                f"Please download from https://zenodo.org/record/13983110"
            )
        
        # Initialize model architecture
        model = ResNet1DMoE(
            in_channels=1,
            base_filters=self.model_config['base_filters'],
            kernel_size=self.model_config['kernel_size'],
            stride=self.model_config['stride'],
            groups=self.model_config['groups'],
            n_block=self.model_config['n_block'],
            n_classes=self.model_config['n_classes'],
            n_experts=self.model_config['n_experts']
        )
        
        # Load weights
        model = load_model_without_module_prefix(model, model_path)
        model.to(self.device)
        
        return model
    
    def extract_embeddings(
        self,
        signal: np.ndarray,
        fs: float,
        return_segments: bool = False
    ) -> np.ndarray:
        """
        Extract embeddings from PPG signal
        
        Args:
            signal: Preprocessed PPG signal (1D array)
            fs: Sampling frequency of the signal
            return_segments: If True, return per-segment embeddings; if False, return averaged
        
        Returns:
            Embeddings array of shape (n_segments, 512) or (512,) if averaged
        """
        # Preprocess signal if needed
        # PaPaGei expects clean, filtered signals
        signal_processed, _, _, _ = preprocess_one_ppg_signal(
            waveform=signal,
            frequency=fs
        )
        
        # Segment signal
        segment_length_samples = int(fs * self.segment_duration_seconds)
        segmented_signals = waveform_to_segments(
            waveform_name='ppg',
            segment_length=segment_length_samples,
            clean_signal=signal_processed
        )
        
        if len(segmented_signals) == 0:
            raise ValueError("No valid segments extracted from signal")
        
        # Resample segments to target frequency
        resampled_segments = resample_batch_signal(
            segmented_signals,
            fs_original=fs,
            fs_target=self.target_fs,
            axis=-1
        )
        
        # Convert to PyTorch tensor
        # Shape: (n_segments, 1, segment_length)
        signal_tensor = torch.Tensor(resampled_segments).unsqueeze(dim=1).to(self.device)
        
        # Extract embeddings
        with torch.no_grad():
            outputs = self.model(signal_tensor)
            # PaPaGei returns (embeddings, expert_outputs, gating_weights)
            embeddings = outputs[0].cpu().detach().numpy()
        
        if return_segments:
            return embeddings  # Shape: (n_segments, 512)
        else:
            # Average embeddings across segments
            return np.mean(embeddings, axis=0)  # Shape: (512,)
    
    def predict_signal_quality(self, signal: np.ndarray, fs: float) -> float:
        """
        Predict signal quality using PaPaGei embeddings
        
        Args:
            signal: PPG signal
            fs: Sampling frequency
        
        Returns:
            Signal quality score (0-1)
        """
        try:
            embeddings = self.extract_embeddings(signal, fs, return_segments=True)
            
            # Calculate quality metrics from embeddings
            # Higher variance = more informative = better quality
            variance = np.var(embeddings, axis=0).mean()
            
            # Normalize to 0-1 range
            # This is a heuristic - can be improved with a trained quality classifier
            quality = min(variance / 5.0, 1.0)
            
            return float(quality)
        except Exception as e:
            print(f"Error predicting signal quality: {e}")
            return 0.0
    
    def get_model_info(self) -> dict:
        """Get model information"""
        return {
            "model_type": "PaPaGei-S",
            "embedding_dim": self.model_config['n_classes'],
            "segment_duration": self.segment_duration_seconds,
            "target_fs": self.target_fs,
            "device": str(self.device),
            "num_parameters": sum(p.numel() for p in self.model.parameters())
        }
