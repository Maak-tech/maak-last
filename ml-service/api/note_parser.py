"""
Clinical Note Parser — Nuralix ML Service
==========================================
Accepts a clinical note as plain text or base64-encoded PDF.
Returns structured SOAP fields + extractedData (conditions, medications,
allergies, recommended actions, follow-up date, risk mentions).

Pipeline:
  1. If PDF → extract text with pdfplumber (fallback: pypdf)
  2. Send text to OpenAI GPT-4o with a structured JSON prompt
  3. Return parsed fields

The parser is intentionally stateless: it does NOT write to the database.
The calling API route (POST /api/notes/:id/processed) persists the result.
"""

from __future__ import annotations

import base64
import io
import json
import logging
import os
import re
from typing import Any

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api/notes", tags=["notes"])

# ── OpenAI client (lazy init) ─────────────────────────────────────────────────

_openai_client = None


def _get_openai():
    global _openai_client
    if _openai_client is None:
        try:
            from openai import OpenAI
            _openai_client = OpenAI(api_key=os.environ.get("OPENAI_API_KEY", ""))
        except ImportError:
            raise RuntimeError("openai package not installed. Run: pip install openai")
    return _openai_client


# ── PDF extraction (best-effort) ──────────────────────────────────────────────

def _extract_text_from_pdf(pdf_bytes: bytes) -> str:
    """Extract text from a PDF. Tries pdfplumber first, falls back to pypdf."""
    text_parts: list[str] = []

    try:
        import pdfplumber
        with pdfplumber.open(io.BytesIO(pdf_bytes)) as pdf:
            for page in pdf.pages:
                page_text = page.extract_text()
                if page_text:
                    text_parts.append(page_text)
        if text_parts:
            return "\n\n".join(text_parts)
    except Exception as e:
        logger.warning("pdfplumber failed: %s — trying pypdf", e)

    try:
        import pypdf
        reader = pypdf.PdfReader(io.BytesIO(pdf_bytes))
        for page in reader.pages:
            page_text = page.extract_text()
            if page_text:
                text_parts.append(page_text)
        return "\n\n".join(text_parts)
    except Exception as e:
        logger.warning("pypdf also failed: %s", e)

    return ""


# ── GPT-4o structured extraction ──────────────────────────────────────────────

_SYSTEM_PROMPT = """
You are a clinical NLP assistant. You extract structured information from
clinical / doctor notes with high accuracy. Return ONLY valid JSON.

Output schema (all fields optional; use null when not found):
{
  "soap": {
    "subjective":  "<patient complaints, history, HPI — string or null>",
    "objective":   "<exam findings, vitals, labs — string or null>",
    "assessment":  "<diagnosis, clinical reasoning — string or null>",
    "plan":        "<treatment plan, prescriptions, referrals — string or null>"
  },
  "noteType": "<soap|progress|discharge|referral|other>",
  "providerName": "<string or null>",
  "specialty": "<string or null>",
  "facility": "<string or null>",
  "noteDate": "<ISO 8601 date string or null>",
  "extractedData": {
    "mentionedConditions":   ["<string>"],
    "mentionedMedications":  ["<string>"],
    "mentionedAllergies":    ["<string>"],
    "recommendedActions":    ["<string>"],
    "followUpDate":          "<ISO 8601 date string or null>",
    "riskMentions":          ["<string>"]
  }
}

Guidelines:
- mentionedConditions: ICD-10 diagnoses, symptoms described as conditions
- mentionedMedications: drugs mentioned (prescribed, continued, or discontinued)
- mentionedAllergies: any allergy documented in this note
- recommendedActions: explicit next steps the clinician wrote (referrals, tests, lifestyle changes)
- riskMentions: phrases indicating patient risk ("non-compliant", "worsening", "high-risk", "critical")
- noteType: if SOAP sections are identifiable → "soap"; else infer from context
- Return ONLY valid JSON. No markdown, no commentary outside the JSON object.
""".strip()


def _parse_with_gpt(note_text: str) -> dict[str, Any]:
    client = _get_openai()

    # Truncate to avoid token limits (≈ 15k chars ≈ 4k tokens)
    truncated = note_text[:15_000] if len(note_text) > 15_000 else note_text

    response = client.chat.completions.create(
        model="gpt-4o",
        response_format={"type": "json_object"},
        messages=[
            {"role": "system", "content": _SYSTEM_PROMPT},
            {"role": "user", "content": f"Parse this clinical note:\n\n{truncated}"},
        ],
        temperature=0,
        max_tokens=1500,
    )

    raw = response.choices[0].message.content or "{}"
    return json.loads(raw)


# ── Rule-based fallback (no OpenAI key) ───────────────────────────────────────

_SECTION_PATTERNS: dict[str, list[str]] = {
    "subjective": [r"(?i)^S[:\s]", r"(?i)^Subjective[:\s]", r"(?i)^Chief\s+Complaint[:\s]"],
    "objective":  [r"(?i)^O[:\s]", r"(?i)^Objective[:\s]", r"(?i)^Physical\s+Exam[:\s]"],
    "assessment": [r"(?i)^A[:\s]", r"(?i)^Assessment[:\s]", r"(?i)^Diagnosis[:\s]", r"(?i)^Impression[:\s]"],
    "plan":       [r"(?i)^P[:\s]", r"(?i)^Plan[:\s]", r"(?i)^Treatment[:\s]"],
}

_MEDICATION_WORDS = {
    "metformin", "warfarin", "lisinopril", "atorvastatin", "aspirin",
    "omeprazole", "amlodipine", "metoprolol", "losartan", "hydrochlorothiazide",
    "gabapentin", "sertraline", "levothyroxine", "furosemide", "albuterol",
    "insulin", "prednisone", "amoxicillin", "ciprofloxacin", "azithromycin",
}

_RISK_WORDS = [
    "non-compliant", "non-compliance", "non compliant",
    "worsening", "deteriorating", "high-risk", "critical",
    "urgent", "concerning", "worrisome", "at risk",
]

_CONDITION_PATTERN = re.compile(
    r"\b(diabetes|hypertension|hyperlipidemia|atrial fibrillation|"
    r"heart failure|COPD|asthma|depression|anxiety|obesity|"
    r"chronic kidney disease|CKD|coronary artery disease|CAD|"
    r"hypothyroidism|hyperthyroidism|osteoporosis|arthritis|"
    r"stroke|TIA|cancer|GERD|anemia)\b",
    re.IGNORECASE,
)

_FOLLOW_UP_PATTERN = re.compile(
    r"(?i)follow[\s-]up\s+(?:in\s+)?(\d+)\s+(days?|weeks?|months?)",
)

_ACTION_PATTERN = re.compile(
    r"(?i)(?:refer(?:red)?\s+to|order(?:ed)?|schedule[d]?\s+|start(?:ed)?\s+|"
    r"continue\s+|discontinue\s+|increase\s+|decrease\s+|monitor\s+)\s+[\w\s]{3,50}",
)


def _rule_based_parse(text: str) -> dict[str, Any]:
    lines = text.splitlines()
    soap: dict[str, str | None] = {
        "subjective": None, "objective": None, "assessment": None, "plan": None,
    }
    current_section: str | None = None
    section_content: dict[str, list[str]] = {k: [] for k in soap}

    for line in lines:
        matched = False
        for section, patterns in _SECTION_PATTERNS.items():
            if any(re.match(p, line.strip()) for p in patterns):
                current_section = section
                remainder = re.sub(r"^[SOAP][\s:]", "", line.strip(), flags=re.IGNORECASE).strip()
                if remainder:
                    section_content[section].append(remainder)
                matched = True
                break
        if not matched and current_section:
            section_content[current_section].append(line.strip())

    for section in soap:
        content = " ".join(l for l in section_content[section] if l)
        soap[section] = content or None

    words_lower = text.lower()
    conditions = list({m.group().title() for m in _CONDITION_PATTERN.finditer(text)})
    medications = [m for m in _MEDICATION_WORDS if m in words_lower]
    risk_mentions = [r for r in _RISK_WORDS if r in words_lower]
    actions = [m.group().strip() for m in _ACTION_PATTERN.finditer(text)][:5]

    follow_up: str | None = None
    fu_match = _FOLLOW_UP_PATTERN.search(text)
    if fu_match:
        follow_up = f"Follow up in {fu_match.group(1)} {fu_match.group(2)}"

    any_soap = any(v for v in soap.values())
    note_type = "soap" if any_soap else "progress"

    return {
        "soap": soap,
        "noteType": note_type,
        "providerName": None,
        "specialty": None,
        "facility": None,
        "noteDate": None,
        "extractedData": {
            "mentionedConditions": conditions,
            "mentionedMedications": [m.title() for m in medications],
            "mentionedAllergies": [],
            "recommendedActions": actions,
            "followUpDate": follow_up,
            "riskMentions": risk_mentions,
        },
    }


# ── Request / response models ──────────────────────────────────────────────────

class NoteParseRequest(BaseModel):
    """
    Either plain-text `content` OR a base64-encoded `pdfBase64` must be provided.
    """
    content: str | None = Field(None, description="Plain-text clinical note")
    pdfBase64: str | None = Field(None, description="Base64-encoded PDF bytes")
    noteId: str | None = Field(None, description="Optional note ID for logging")


class ExtractedData(BaseModel):
    mentionedConditions: list[str] = []
    mentionedMedications: list[str] = []
    mentionedAllergies: list[str] = []
    recommendedActions: list[str] = []
    followUpDate: str | None = None
    riskMentions: list[str] = []


class SOAPFields(BaseModel):
    subjective: str | None = None
    objective: str | None = None
    assessment: str | None = None
    plan: str | None = None


class NoteParseResponse(BaseModel):
    ok: bool = True
    noteId: str | None = None
    noteType: str = "progress"
    providerName: str | None = None
    specialty: str | None = None
    facility: str | None = None
    noteDate: str | None = None
    soap: SOAPFields
    extractedData: ExtractedData
    method: str  # 'gpt4o' | 'rule_based'
    charCount: int


# ── Route ─────────────────────────────────────────────────────────────────────

@router.post("/parse", response_model=NoteParseResponse)
async def parse_clinical_note(req: NoteParseRequest) -> NoteParseResponse:
    """
    Parse a clinical note (plain text or PDF) into structured SOAP + extracted data.

    - Prefers GPT-4o when OPENAI_API_KEY is set.
    - Falls back to rule-based extraction when the key is absent or the API fails.
    """
    # 1. Resolve plain text
    if req.pdfBase64:
        try:
            pdf_bytes = base64.b64decode(req.pdfBase64)
        except Exception:
            raise HTTPException(status_code=400, detail="Invalid base64 in pdfBase64")
        note_text = _extract_text_from_pdf(pdf_bytes)
        if not note_text.strip():
            raise HTTPException(status_code=422, detail="Could not extract text from PDF")
    elif req.content:
        note_text = req.content
    else:
        raise HTTPException(status_code=400, detail="Provide either 'content' or 'pdfBase64'")

    char_count = len(note_text)
    method = "rule_based"
    parsed: dict[str, Any] = {}

    # 2. Try GPT-4o
    openai_key = os.environ.get("OPENAI_API_KEY", "")
    if openai_key and openai_key.startswith("sk-"):
        try:
            parsed = _parse_with_gpt(note_text)
            method = "gpt4o"
        except Exception as e:
            logger.warning("GPT-4o note parsing failed (%s) — falling back to rules", e)

    # 3. Rule-based fallback
    if not parsed:
        parsed = _rule_based_parse(note_text)

    # 4. Normalise output
    soap_raw = parsed.get("soap") or {}
    extracted_raw = parsed.get("extractedData") or {}

    return NoteParseResponse(
        ok=True,
        noteId=req.noteId,
        noteType=parsed.get("noteType") or "progress",
        providerName=parsed.get("providerName"),
        specialty=parsed.get("specialty"),
        facility=parsed.get("facility"),
        noteDate=parsed.get("noteDate"),
        soap=SOAPFields(
            subjective=soap_raw.get("subjective"),
            objective=soap_raw.get("objective"),
            assessment=soap_raw.get("assessment"),
            plan=soap_raw.get("plan"),
        ),
        extractedData=ExtractedData(
            mentionedConditions=extracted_raw.get("mentionedConditions") or [],
            mentionedMedications=extracted_raw.get("mentionedMedications") or [],
            mentionedAllergies=extracted_raw.get("mentionedAllergies") or [],
            recommendedActions=extracted_raw.get("recommendedActions") or [],
            followUpDate=extracted_raw.get("followUpDate"),
            riskMentions=extracted_raw.get("riskMentions") or [],
        ),
        method=method,
        charCount=char_count,
    )
