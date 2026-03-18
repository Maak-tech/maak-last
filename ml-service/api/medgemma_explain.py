"""
MedGemma Explain — Clinical & Genomic Explanations for Nora
============================================================
Generates patient-friendly and clinician-grade explanations for:
  - VHI elevating/declining factors
  - Genomic variants and pharmacogenomics conflicts
  - Lab abnormalities and vital anomalies
  - Clinical note summaries

Model priority:
  1. Google MedGemma-4b-it (Google AI API, Apache 2.0*) — primary, medical fine-tuning
  2. Microsoft BioGPT-Large (HuggingFace, MIT)           — variant-specific explanations
  3. OpenAI GPT-4o (API)                                 — general fallback

MedGemma access:
  Set GOOGLE_AI_API_KEY env var. Model: medgemma-4b-it (or gemma-3-4b-it).
  Alternatively, set MEDGEMMA_LOCAL=1 to load from HuggingFace locally
  (requires ~8 GB VRAM: google/medgemma-4b-it).

Outputs are informational only — never diagnostic.
"""

from __future__ import annotations

import logging
import os
import re
from typing import Optional

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api/explain", tags=["explain"])

# ── Request / Response models ─────────────────────────────────────────────────


class ExplainRequest(BaseModel):
    topic: str = Field(
        ...,
        description=(
            "What to explain. Examples: 'declining_factor', 'variant', "
            "'pharmacogenomics', 'lab_result', 'vhi_summary'"
        ),
    )
    context: dict = Field(
        ...,
        description="Structured context — see topic-specific fields below.",
    )
    language: str = Field(default="en", description="ISO 639-1 language code")
    audience: str = Field(
        default="patient",
        description="'patient' (plain language) or 'clinician' (technical)",
    )
    preferred_model: Optional[str] = Field(
        default=None,
        description="Force: 'medgemma' | 'biogpt' | 'openai'",
    )


class ExplainResponse(BaseModel):
    explanation: str
    model_used: str
    disclaimer: str = (
        "This explanation is for informational purposes only "
        "and does not constitute medical advice or a diagnosis."
    )


class VariantExplainRequest(BaseModel):
    """Targeted request for variant/pharmacogenomics explanations (uses BioGPT)."""
    rsid: str
    gene: str
    condition: Optional[str] = None
    drug: Optional[str] = None
    interaction: Optional[str] = None
    pathogenicity: Optional[str] = None
    language: str = "en"


class VariantExplainResponse(BaseModel):
    rsid: str
    gene: str
    explanation: str
    model_used: str


# ── Lazy model clients ────────────────────────────────────────────────────────

_genai_client = None
_medgemma_local = None
_biogpt_pipeline = None
_openai_client = None


def _get_medgemma_api():
    """Google AI API client for MedGemma / Gemma-3."""
    global _genai_client
    if _genai_client is not None:
        return _genai_client
    api_key = os.environ.get("GOOGLE_AI_API_KEY", "")
    if not api_key:
        return None
    try:
        import google.generativeai as genai

        genai.configure(api_key=api_key)
        # MedGemma-4b-it on Google AI Studio
        model_id = os.environ.get("MEDGEMMA_MODEL_ID", "medgemma-4b-it")
        _genai_client = genai.GenerativeModel(model_id)
        logger.info(f"[medgemma_explain] Google AI client initialised ({model_id})")
    except Exception as e:
        logger.warning(f"[medgemma_explain] Google AI unavailable: {e}")
    return _genai_client


def _get_medgemma_local():
    """Load google/medgemma-4b-it locally via HuggingFace (requires ~8GB VRAM)."""
    global _medgemma_local
    if _medgemma_local is not None:
        return _medgemma_local
    if not os.environ.get("MEDGEMMA_LOCAL"):
        return None
    try:
        import torch
        from transformers import AutoModelForCausalLM, AutoTokenizer, pipeline

        model_id = "google/medgemma-4b-it"
        device = "cuda" if torch.cuda.is_available() else "cpu"
        tokenizer = AutoTokenizer.from_pretrained(model_id)
        model = AutoModelForCausalLM.from_pretrained(
            model_id,
            torch_dtype=torch.bfloat16 if device == "cuda" else torch.float32,
            device_map=device,
        )
        _medgemma_local = pipeline(
            "text-generation",
            model=model,
            tokenizer=tokenizer,
            max_new_tokens=512,
            do_sample=False,
        )
        logger.info(f"[medgemma_explain] MedGemma-4b-it loaded locally on {device}")
    except Exception as e:
        logger.warning(f"[medgemma_explain] Local MedGemma unavailable: {e}")
    return _medgemma_local


def _get_biogpt():
    """Microsoft BioGPT-Large for biomedical text (especially variant explanations)."""
    global _biogpt_pipeline
    if _biogpt_pipeline is not None:
        return _biogpt_pipeline
    try:
        from transformers import pipeline as hf_pipeline

        _biogpt_pipeline = hf_pipeline(
            "text-generation",
            model="microsoft/BioGPT-Large",
            max_new_tokens=256,
            do_sample=False,
            temperature=1.0,
        )
        logger.info("[medgemma_explain] BioGPT-Large loaded")
    except Exception as e:
        logger.warning(f"[medgemma_explain] BioGPT unavailable: {e}")
    return _biogpt_pipeline


def _get_openai():
    """OpenAI client as final fallback."""
    global _openai_client
    if _openai_client is not None:
        return _openai_client
    api_key = os.environ.get("OPENAI_API_KEY", "")
    if not api_key:
        return None
    try:
        from openai import OpenAI

        _openai_client = OpenAI(api_key=api_key)
        logger.info("[medgemma_explain] OpenAI client initialised (fallback)")
    except Exception as e:
        logger.warning(f"[medgemma_explain] OpenAI unavailable: {e}")
    return _openai_client


# ── Prompt builders ───────────────────────────────────────────────────────────

_SYSTEM_PATIENT = (
    "You are Nora, a compassionate AI health companion. "
    "Explain health information in clear, empathetic, non-technical language. "
    "Never diagnose. Encourage the user to speak with their doctor. "
    "Keep explanations under 120 words."
)

_SYSTEM_CLINICIAN = (
    "You are a clinical decision support tool. "
    "Provide concise, evidence-based summaries suitable for clinicians. "
    "Use appropriate medical terminology. Keep responses under 200 words."
)


def _build_prompt(topic: str, context: dict, audience: str, language: str) -> str:
    system = _SYSTEM_PATIENT if audience == "patient" else _SYSTEM_CLINICIAN
    lang_note = f"Respond in {language}." if language != "en" else ""

    if topic == "declining_factor":
        factor = context.get("factor", "")
        category = context.get("category", "")
        recommendation = context.get("recommendation", "")
        return (
            f"{system}\n{lang_note}\n\n"
            f"Explain this health declining factor to the user:\n"
            f"Factor: {factor}\nCategory: {category}\n"
            f"Recommendation: {recommendation}\n\n"
            f"Keep it empathetic and actionable."
        )

    if topic == "elevating_factor":
        factor = context.get("factor", "")
        explanation = context.get("explanation", "")
        return (
            f"{system}\n{lang_note}\n\n"
            f"Explain this positive health factor to the user:\n"
            f"Factor: {factor}\nDetails: {explanation}\n\n"
            f"Reinforce this positive behaviour."
        )

    if topic == "pharmacogenomics":
        drug = context.get("drug", "")
        gene = context.get("gene", "")
        interaction = context.get("interaction", "")
        annotation = context.get("annotation", "")
        return (
            f"{system}\n{lang_note}\n\n"
            f"Explain this pharmacogenomics finding:\n"
            f"Drug: {drug}\nGene: {gene}\nInteraction: {interaction}\n"
            f"Details: {annotation}\n\n"
            f"Explain what this means for the user's medication and urge them to "
            f"discuss with their prescriber before changing anything."
        )

    if topic == "variant":
        rsid = context.get("rsid", "")
        gene = context.get("gene", "")
        condition = context.get("condition", "")
        pathogenicity = context.get("pathogenicity", "")
        return (
            f"{system}\n{lang_note}\n\n"
            f"Explain this genetic finding:\n"
            f"Variant: {rsid} ({gene})\nCondition: {condition}\n"
            f"Significance: {pathogenicity}\n\n"
            f"Explain what carrying this variant means in plain terms. "
            f"Emphasise it is not a diagnosis."
        )

    if topic == "lab_result":
        test = context.get("test", "")
        value = context.get("value", "")
        flag = context.get("flag", "")
        reference = context.get("reference_range", "")
        return (
            f"{system}\n{lang_note}\n\n"
            f"Explain this abnormal lab result:\n"
            f"Test: {test}\nValue: {value} (flag: {flag})\n"
            f"Reference range: {reference}\n\n"
            f"Explain what this result might indicate and why the user should "
            f"discuss it with their doctor."
        )

    if topic == "vhi_summary":
        score = context.get("overall_score", "")
        trajectory = context.get("trajectory", "")
        declining = context.get("top_declining", [])
        elevating = context.get("top_elevating", [])
        return (
            f"{system}\n{lang_note}\n\n"
            f"Give a brief, encouraging health summary:\n"
            f"Overall health score: {score}/100 ({trajectory})\n"
            f"Top improving factors: {', '.join(elevating[:3])}\n"
            f"Top concerns: {', '.join(declining[:3])}\n\n"
            f"Keep it supportive and forward-looking."
        )

    # Generic fallback
    return f"{system}\n{lang_note}\n\nExplain this health information:\n{context}"


# ── Explanation engines ───────────────────────────────────────────────────────


def _explain_via_medgemma_api(prompt: str) -> str:
    client = _get_medgemma_api()
    if client is None:
        raise RuntimeError("Google AI not configured")
    response = client.generate_content(prompt)
    return response.text.strip()


def _explain_via_medgemma_local(prompt: str) -> str:
    pipe = _get_medgemma_local()
    if pipe is None:
        raise RuntimeError("Local MedGemma not available")
    result = pipe(prompt)
    generated = result[0]["generated_text"]
    # Strip the prompt prefix that some pipelines echo back
    return generated[len(prompt):].strip() if generated.startswith(prompt) else generated.strip()


def _explain_via_biogpt(prompt: str) -> str:
    pipe = _get_biogpt()
    if pipe is None:
        raise RuntimeError("BioGPT not available")
    result = pipe(prompt)
    generated = result[0]["generated_text"]
    return generated[len(prompt):].strip() if generated.startswith(prompt) else generated.strip()


def _explain_via_openai(prompt: str) -> str:
    client = _get_openai()
    if client is None:
        raise RuntimeError("OpenAI not configured")
    response = client.chat.completions.create(
        model="gpt-4o",
        messages=[{"role": "user", "content": prompt}],
        max_tokens=300,
        temperature=0.4,
    )
    return response.choices[0].message.content.strip()


def _explain_static_fallback(topic: str, context: dict) -> str:
    """Rule-based fallback when no AI model is available."""
    if topic == "pharmacogenomics":
        drug = context.get("drug", "your medication")
        interaction = context.get("interaction", "")
        if "reduced_efficacy" in interaction:
            return (
                f"Your DNA shows that {drug} may work less effectively for you than average. "
                f"This is because of a variation in how your body breaks down this medication. "
                f"Please discuss this with your doctor before making any changes."
            )
        if "increased_toxicity" in interaction:
            return (
                f"Your DNA suggests that {drug} may accumulate more than usual in your body, "
                f"increasing the chance of side effects. Talk to your prescriber about this finding."
            )
        if "contraindicated" in interaction:
            return (
                f"Your DNA indicates that {drug} carries an elevated risk for you. "
                f"This requires urgent discussion with your prescribing doctor."
            )
    if topic == "declining_factor":
        factor = context.get("factor", "a health concern")
        return f"Your health data shows {factor}. Consider speaking to your healthcare provider for guidance."
    return "Please review this information with your healthcare provider."


# ── Routes ────────────────────────────────────────────────────────────────────


@router.post("/", response_model=ExplainResponse)
async def explain_health(request: ExplainRequest) -> ExplainResponse:
    """
    Generate a plain-language or clinical explanation for a VHI factor,
    genetic variant, lab result, or pharmacogenomics finding.

    Model priority: MedGemma API → MedGemma local → BioGPT → GPT-4o → rule-based fallback
    """
    prompt = _build_prompt(
        request.topic, request.context, request.audience, request.language
    )
    preferred = (request.preferred_model or "").lower()

    # Try models in priority order
    attempt_order = (
        [preferred]
        if preferred in ("medgemma", "biogpt", "openai")
        else ["medgemma", "biogpt", "openai"]
    )

    explanation = ""
    model_used = "rule-based"

    for model_name in attempt_order:
        if explanation:
            break
        try:
            if model_name == "medgemma":
                # Try API first, then local
                try:
                    explanation = _explain_via_medgemma_api(prompt)
                    model_used = "medgemma-4b-it (api)"
                except Exception:
                    explanation = _explain_via_medgemma_local(prompt)
                    model_used = "medgemma-4b-it (local)"
            elif model_name == "biogpt":
                explanation = _explain_via_biogpt(prompt)
                model_used = "biogpt-large"
            elif model_name == "openai":
                explanation = _explain_via_openai(prompt)
                model_used = "gpt-4o"
        except Exception as e:
            logger.debug(f"[medgemma_explain] {model_name} failed: {e}")

    if not explanation:
        explanation = _explain_static_fallback(request.topic, request.context)
        model_used = "rule-based"

    return ExplainResponse(explanation=explanation, model_used=model_used)


@router.post("/variant", response_model=VariantExplainResponse)
async def explain_variant(request: VariantExplainRequest) -> VariantExplainResponse:
    """
    Explain a specific genomic variant or drug-gene interaction using BioGPT.
    BioGPT is preferred because it is trained on biomedical literature (PubMed).
    Falls back to MedGemma API or GPT-4o if BioGPT is unavailable.
    """
    if request.drug and request.interaction:
        prompt = (
            f"Explain the pharmacogenomics interaction between the {request.gene} gene "
            f"and {request.drug} ({request.interaction}) in simple terms. "
            f"Variant: {request.rsid}. "
            f"Clinical annotation: {request.interaction}. "
            f"Limit to 150 words. Do not diagnose."
        )
    else:
        cond = request.condition or "unknown condition"
        path = request.pathogenicity or "uncertain significance"
        prompt = (
            f"Explain the clinical significance of variant {request.rsid} in gene {request.gene} "
            f"associated with {cond}. Pathogenicity: {path}. "
            f"Respond in plain language for a patient. Limit to 120 words. Do not diagnose."
        )

    explanation = ""
    model_used = "rule-based"

    # BioGPT is preferred for variant-level explanations
    for model_fn, name in [
        (_explain_via_biogpt, "biogpt-large"),
        (_explain_via_medgemma_api, "medgemma-4b-it (api)"),
        (_explain_via_openai, "gpt-4o"),
    ]:
        try:
            explanation = model_fn(prompt)
            model_used = name
            break
        except Exception as e:
            logger.debug(f"[medgemma_explain] variant explain {name} failed: {e}")

    if not explanation:
        explanation = (
            f"Variant {request.rsid} in gene {request.gene} has been identified in your DNA. "
            f"Please discuss this with a genetic counsellor or your doctor."
        )
        model_used = "rule-based"

    return VariantExplainResponse(
        rsid=request.rsid,
        gene=request.gene,
        explanation=explanation,
        model_used=model_used,
    )


@router.get("/status")
async def explain_status() -> dict:
    """Check which explanation models are available."""
    medgemma_api = _get_medgemma_api() is not None
    medgemma_local = _get_medgemma_local() is not None
    biogpt = _get_biogpt() is not None
    openai_ok = _get_openai() is not None

    return {
        "medgemma_api": medgemma_api,
        "medgemma_local": medgemma_local,
        "biogpt": biogpt,
        "openai_fallback": openai_ok,
        "rule_based": True,
        "primary": (
            "medgemma-4b-it"
            if (medgemma_api or medgemma_local)
            else "biogpt-large"
            if biogpt
            else "gpt-4o"
            if openai_ok
            else "rule-based"
        ),
    }
