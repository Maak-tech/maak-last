"""
Genomics Models — HuggingFace Transformer-Based Variant Analysis
================================================================
Provides optional deep learning enrichment for the SNP parser pipeline.

Models (all loaded lazily — service starts without any of them):
  • ESM-2 35M (Meta, MIT)         — missense variant pathogenicity prediction
  • DNABERT-2 117M                — SNP/variant classification
  • Nucleotide Transformer 500M   — regulatory variant effect prediction
  • HyenaDNA large-1M             — long-range genomic context
  • m42-health/med42-v2 70B       — deep medical reasoning (API only via Ollama)

All models are loaded from HuggingFace Hub; no data leaves the service.
GPU is strongly recommended for Nucleotide Transformer (500M) and HyenaDNA.
ESM-2 and DNABERT-2 run comfortably on CPU.

This module is called by snp_parser.py when GENOMICS_MODELS_ENABLED=1 is set.
Results are returned as optional enrichment fields on each variant annotation.
"""

from __future__ import annotations

import logging
import os
from dataclasses import dataclass, field
from typing import Optional

import numpy as np

logger = logging.getLogger(__name__)

# ── Feature flags ─────────────────────────────────────────────────────────────
ENABLED = os.environ.get("GENOMICS_MODELS_ENABLED", "0") == "1"

# ── Model state (lazy loaded per process) ─────────────────────────────────────
_esm2_model = None
_esm2_tokenizer = None
_dnabert2_model = None
_dnabert2_tokenizer = None
_nucleotide_model = None
_nucleotide_tokenizer = None
_hyenadna_model = None
_hyenadna_tokenizer = None


# ── Data classes ──────────────────────────────────────────────────────────────


@dataclass
class VariantEnrichment:
    """Additional annotations produced by transformer models."""
    rsid: str
    # ESM-2: likelihood of pathogenic effect on protein function (0.0–1.0)
    esm2_pathogenicity_score: Optional[float] = None
    # DNABERT-2: variant classification confidence
    dnabert2_classification: Optional[str] = None   # 'benign' | 'pathogenic' | 'vus'
    dnabert2_confidence: Optional[float] = None
    # Nucleotide Transformer: predicted regulatory impact
    regulatory_impact: Optional[str] = None         # 'high' | 'medium' | 'low' | 'none'
    regulatory_score: Optional[float] = None
    # HyenaDNA: long-range genomic context label
    long_range_context: Optional[str] = None
    models_used: list[str] = field(default_factory=list)


# ── ESM-2: Missense variant pathogenicity ─────────────────────────────────────


def _load_esm2():
    """Load ESM-2 35M (CPU-feasible) for protein variant pathogenicity."""
    global _esm2_model, _esm2_tokenizer
    if _esm2_model is not None:
        return _esm2_model, _esm2_tokenizer
    try:
        import torch
        from transformers import AutoModelForMaskedLM, AutoTokenizer

        model_id = "facebook/esm2_t12_35M_UR50D"
        _esm2_tokenizer = AutoTokenizer.from_pretrained(model_id)
        _esm2_model = AutoModelForMaskedLM.from_pretrained(model_id)
        _esm2_model.eval()
        logger.info("[genomics_models] ESM-2 35M loaded")
    except Exception as e:
        logger.warning(f"[genomics_models] ESM-2 unavailable: {e}")
    return _esm2_model, _esm2_tokenizer


def score_variant_esm2(
    wildtype_seq: str, variant_seq: str, position: int
) -> Optional[float]:
    """
    Compute ESM-2 log-likelihood ratio (variant vs wildtype) at a given position.
    A negative log-likelihood ratio indicates the variant is less "protein-likely"
    (proxy for pathogenicity). Returns a 0.0–1.0 pathogenicity proxy score.

    Args:
        wildtype_seq: Amino acid sequence (wildtype)
        variant_seq:  Amino acid sequence (with substitution at `position`)
        position:     0-indexed position of the substitution

    Returns:
        Float in [0.0, 1.0] where higher → more likely pathogenic, or None on error.
    """
    if not ENABLED:
        return None
    model, tokenizer = _load_esm2()
    if model is None:
        return None
    try:
        import torch

        with torch.no_grad():
            # Score wildtype
            wt_inputs = tokenizer(wildtype_seq, return_tensors="pt")
            vt_inputs = tokenizer(variant_seq, return_tensors="pt")

            wt_logits = model(**wt_inputs).logits[0, position + 1]  # +1 for [CLS]
            vt_logits = model(**vt_inputs).logits[0, position + 1]

            wt_aa_id = tokenizer.convert_tokens_to_ids(wildtype_seq[position])
            vt_aa_id = tokenizer.convert_tokens_to_ids(variant_seq[position])

            import torch.nn.functional as F

            wt_log_prob = float(F.log_softmax(wt_logits, dim=-1)[wt_aa_id])
            vt_log_prob = float(F.log_softmax(vt_logits, dim=-1)[vt_aa_id])
            llr = vt_log_prob - wt_log_prob  # negative → variant less likely

            # Convert log-likelihood ratio to [0, 1] pathogenicity proxy
            # Typical pathogenic variants have LLR < -5; benign variants > -1
            score = float(1.0 / (1.0 + np.exp(llr + 3.0)))
            return round(score, 4)
    except Exception as e:
        logger.debug(f"[genomics_models] ESM-2 scoring failed: {e}")
        return None


# ── DNABERT-2: DNA variant classification ─────────────────────────────────────


def _load_dnabert2():
    """Load DNABERT-2 117M for SNP-level variant classification."""
    global _dnabert2_model, _dnabert2_tokenizer
    if _dnabert2_model is not None:
        return _dnabert2_model, _dnabert2_tokenizer
    try:
        import torch
        from transformers import AutoModelForSequenceClassification, AutoTokenizer

        model_id = "zhihan1996/DNABERT-2-117M"
        _dnabert2_tokenizer = AutoTokenizer.from_pretrained(
            model_id, trust_remote_code=True
        )
        # Fine-tuned classification head — use base model + downstream head
        # For zero-shot use we take the base and interpret the masked-LM logits
        from transformers import AutoModel

        _dnabert2_model = AutoModel.from_pretrained(model_id, trust_remote_code=True)
        _dnabert2_model.eval()
        logger.info("[genomics_models] DNABERT-2-117M loaded")
    except Exception as e:
        logger.warning(f"[genomics_models] DNABERT-2 unavailable: {e}")
    return _dnabert2_model, _dnabert2_tokenizer


def classify_variant_dnabert2(
    ref_sequence: str, alt_sequence: str
) -> Optional[tuple[str, float]]:
    """
    Compute DNABERT-2 embedding similarity between reference and alternate allele
    DNA sequences as a proxy for variant impact.

    Returns (classification_label, confidence) or None on error.
    classification_label: 'likely_benign' | 'uncertain' | 'likely_pathogenic'
    """
    if not ENABLED:
        return None
    model, tokenizer = _load_dnabert2()
    if model is None:
        return None
    try:
        import torch

        with torch.no_grad():
            ref_inputs = tokenizer(ref_sequence, return_tensors="pt", padding=True)
            alt_inputs = tokenizer(alt_sequence, return_tensors="pt", padding=True)

            ref_embed = model(**ref_inputs).last_hidden_state[:, 0, :]  # [CLS] token
            alt_embed = model(**alt_inputs).last_hidden_state[:, 0, :]

            # Cosine similarity between reference and alternate embeddings
            sim = float(
                torch.nn.functional.cosine_similarity(ref_embed, alt_embed).item()
            )

        # Map cosine similarity → classification
        # High similarity → variant is "close" to reference → likely benign
        if sim > 0.95:
            label, conf = "likely_benign", round((sim - 0.95) / 0.05, 3)
        elif sim > 0.85:
            label, conf = "uncertain", 0.5
        else:
            label, conf = "likely_pathogenic", round(1.0 - sim, 3)

        return label, round(min(max(conf, 0.1), 0.95), 3)
    except Exception as e:
        logger.debug(f"[genomics_models] DNABERT-2 classification failed: {e}")
        return None


# ── Nucleotide Transformer: regulatory variant effects ────────────────────────


def _load_nucleotide_transformer():
    """Load Nucleotide Transformer 500M (InstaDeep) — GPU recommended."""
    global _nucleotide_model, _nucleotide_tokenizer
    if _nucleotide_model is not None:
        return _nucleotide_model, _nucleotide_tokenizer
    try:
        import torch
        from transformers import AutoModel, AutoTokenizer

        model_id = "InstaDeepAI/nucleotide-transformer-500m-1000g"
        _nucleotide_tokenizer = AutoTokenizer.from_pretrained(model_id)
        device = "cuda" if torch.cuda.is_available() else "cpu"
        _nucleotide_model = AutoModel.from_pretrained(
            model_id,
            torch_dtype=torch.float16 if device == "cuda" else torch.float32,
        ).to(device)
        _nucleotide_model.eval()
        logger.info(f"[genomics_models] Nucleotide Transformer 500M loaded on {device}")
    except Exception as e:
        logger.warning(f"[genomics_models] Nucleotide Transformer unavailable: {e}")
    return _nucleotide_model, _nucleotide_tokenizer


def predict_regulatory_impact(
    genomic_sequence: str,
) -> Optional[tuple[str, float]]:
    """
    Compute Nucleotide Transformer embedding for a genomic sequence window
    and estimate regulatory impact based on embedding norm / attention weights.

    Returns (impact_level, score) or None on error.
    impact_level: 'high' | 'medium' | 'low' | 'none'
    """
    if not ENABLED:
        return None
    model, tokenizer = _load_nucleotide_transformer()
    if model is None:
        return None
    try:
        import torch

        # Nucleotide Transformer expects 6-mer tokens; tokenizer handles this
        inputs = tokenizer(
            genomic_sequence,
            return_tensors="pt",
            truncation=True,
            max_length=512,
        ).to(next(model.parameters()).device)

        with torch.no_grad():
            outputs = model(**inputs, output_attentions=False)
            # Use mean embedding norm as a rough regulatory impact proxy
            embed = outputs.last_hidden_state.mean(dim=1)  # (1, hidden)
            norm = float(embed.norm(dim=-1).item())

        # Calibrated thresholds (rough, based on model embedding norms)
        if norm > 14.0:
            return "high", min(1.0, round((norm - 14.0) / 4.0, 3))
        elif norm > 10.0:
            return "medium", round((norm - 10.0) / 4.0, 3)
        elif norm > 7.0:
            return "low", round((norm - 7.0) / 3.0, 3)
        else:
            return "none", 0.0
    except Exception as e:
        logger.debug(f"[genomics_models] Nucleotide Transformer failed: {e}")
        return None


# ── HyenaDNA: long-range genomic context ─────────────────────────────────────


def _load_hyenadna():
    """Load HyenaDNA large-1M (LongSafari, MIT) — GPU recommended."""
    global _hyenadna_model, _hyenadna_tokenizer
    if _hyenadna_model is not None:
        return _hyenadna_model, _hyenadna_tokenizer
    try:
        import torch
        from transformers import AutoModel, AutoTokenizer

        model_id = "LongSafari/hyenadna-large-1m-seqlen-hf"
        _hyenadna_tokenizer = AutoTokenizer.from_pretrained(
            model_id, trust_remote_code=True
        )
        device = "cuda" if torch.cuda.is_available() else "cpu"
        _hyenadna_model = AutoModel.from_pretrained(
            model_id,
            trust_remote_code=True,
            torch_dtype=torch.float16 if device == "cuda" else torch.float32,
        ).to(device)
        _hyenadna_model.eval()
        logger.info(f"[genomics_models] HyenaDNA large-1M loaded on {device}")
    except Exception as e:
        logger.warning(f"[genomics_models] HyenaDNA unavailable: {e}")
    return _hyenadna_model, _hyenadna_tokenizer


def get_long_range_context(
    long_sequence: str,
) -> Optional[str]:
    """
    Use HyenaDNA to characterise the long-range genomic context of a variant.
    Designed for sequences up to 1M bp — far longer than Transformer-based models.

    Returns a context label: 'promoter_proximal' | 'intronic' | 'intergenic' | 'exonic'
    or None on error. (Heuristic — proper annotation requires BED intersection.)
    """
    if not ENABLED:
        return None
    model, tokenizer = _load_hyenadna()
    if model is None:
        return None
    try:
        import torch

        inputs = tokenizer(
            long_sequence,
            return_tensors="pt",
            truncation=True,
            max_length=65536,
        ).to(next(model.parameters()).device)

        with torch.no_grad():
            outputs = model(**inputs)
            embed = outputs.last_hidden_state.mean(dim=1)  # (1, hidden)

        # Use embedding statistics as a heuristic annotation
        # (A proper implementation would train a downstream head on ENCODE annotations)
        embed_np = embed.cpu().float().numpy()[0]
        mean_val = float(np.mean(embed_np))
        std_val = float(np.std(embed_np))

        if std_val > 0.8:
            return "exonic"
        elif mean_val > 0.05:
            return "promoter_proximal"
        elif mean_val > -0.05:
            return "intronic"
        else:
            return "intergenic"
    except Exception as e:
        logger.debug(f"[genomics_models] HyenaDNA failed: {e}")
        return None


# ── Public API ────────────────────────────────────────────────────────────────


def enrich_variant(
    rsid: str,
    wildtype_aa_seq: Optional[str] = None,
    variant_aa_seq: Optional[str] = None,
    aa_position: Optional[int] = None,
    ref_dna_seq: Optional[str] = None,
    alt_dna_seq: Optional[str] = None,
    genomic_window: Optional[str] = None,
    long_genomic_window: Optional[str] = None,
) -> VariantEnrichment:
    """
    Run all available transformer models on a variant and return enrichment annotations.

    Call this after basic ClinVar/PharmGKB lookup to add deep genomic analysis.
    All model calls are best-effort — None is returned per field if a model is unavailable.

    Args:
        rsid:               Variant rsID
        wildtype_aa_seq:    Protein wildtype amino acid sequence (for ESM-2)
        variant_aa_seq:     Protein variant amino acid sequence (for ESM-2)
        aa_position:        Position of the substitution in the protein (0-indexed)
        ref_dna_seq:        Reference allele DNA context (±50bp) (for DNABERT-2)
        alt_dna_seq:        Alternate allele DNA context (±50bp) (for DNABERT-2)
        genomic_window:     200–512bp genomic context window (for Nucleotide Transformer)
        long_genomic_window: Up to 65536bp window (for HyenaDNA)

    Returns:
        VariantEnrichment with all available predictions.
    """
    enrichment = VariantEnrichment(rsid=rsid)

    if not ENABLED:
        logger.debug("[genomics_models] Genomic models disabled (GENOMICS_MODELS_ENABLED != 1)")
        return enrichment

    # ESM-2: missense pathogenicity
    if wildtype_aa_seq and variant_aa_seq and aa_position is not None:
        score = score_variant_esm2(wildtype_aa_seq, variant_aa_seq, aa_position)
        if score is not None:
            enrichment.esm2_pathogenicity_score = score
            enrichment.models_used.append("esm2_t12_35M")

    # DNABERT-2: variant classification
    if ref_dna_seq and alt_dna_seq:
        result = classify_variant_dnabert2(ref_dna_seq, alt_dna_seq)
        if result:
            enrichment.dnabert2_classification, enrichment.dnabert2_confidence = result
            enrichment.models_used.append("dnabert2_117M")

    # Nucleotide Transformer: regulatory impact
    if genomic_window:
        result = predict_regulatory_impact(genomic_window)
        if result:
            enrichment.regulatory_impact, enrichment.regulatory_score = result
            enrichment.models_used.append("nucleotide_transformer_500M")

    # HyenaDNA: long-range context
    if long_genomic_window:
        context = get_long_range_context(long_genomic_window)
        if context:
            enrichment.long_range_context = context
            enrichment.models_used.append("hyenadna_large_1M")

    return enrichment


def status() -> dict:
    """Return availability status of all genomic models."""
    if not ENABLED:
        return {
            "enabled": False,
            "message": "Set GENOMICS_MODELS_ENABLED=1 to activate transformer models",
        }
    esm2_ok, _ = _load_esm2()
    dnabert2_ok, _ = _load_dnabert2()
    nt_ok, _ = _load_nucleotide_transformer()
    hyena_ok, _ = _load_hyenadna()
    return {
        "enabled": True,
        "esm2_35M": esm2_ok is not None,
        "dnabert2_117M": dnabert2_ok is not None,
        "nucleotide_transformer_500M": nt_ok is not None,
        "hyenadna_large_1M": hyena_ok is not None,
    }
