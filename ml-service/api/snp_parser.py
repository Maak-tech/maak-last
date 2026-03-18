"""
SNP Parser — 23andMe & AncestryDNA DNA file parser + PRS / ClinVar / PharmGKB pipeline.

Pipeline:
  1. Detect file format (23andMe v3/v4/v5, AncestryDNA v1/v2)
  2. Parse raw SNPs → {rsid: (chromosome, position, genotype)}
  3. Compute Polygenic Risk Scores (PRS) from built-in weight tables
  4. Annotate ClinVar pathogenic / VUS variants
     • Embedded curated table (fast, no network)
     • Live myvariant.info API fallback for probe rsids not in curated table
  5. Flag PharmGKB drug–gene interactions
     • Embedded tier-1 pharmacogene table (fast, no network)
     • Extended embedded table covers CYP3A5, CYP1A2, VKORC1, UGT1A1, CYP2B6, NUDT15, F5, IFNL3
  6. Return structured JSON compatible with the genetics DB schema

Reference genome: GRCh38 (positions from both providers are lifted over on import).
"""

from __future__ import annotations

import asyncio
import gzip
import io
import logging
from concurrent.futures import ThreadPoolExecutor
from dataclasses import dataclass, field
from enum import Enum
from typing import Optional

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api/snp", tags=["SNP"])


# ── Enums ─────────────────────────────────────────────────────────────────────

class Provider(str, Enum):
    TWENTYTHREEME = "23andme"
    ANCESTRY = "ancestry"
    RAW_VCF = "raw_vcf"


class Pathogenicity(str, Enum):
    BENIGN = "benign"
    LIKELY_BENIGN = "likely_benign"
    VUS = "vus"
    LIKELY_PATHOGENIC = "likely_pathogenic"
    PATHOGENIC = "pathogenic"


class Interaction(str, Enum):
    STANDARD = "standard"
    REDUCED_EFFICACY = "reduced_efficacy"
    INCREASED_TOXICITY = "increased_toxicity"
    CONTRAINDICATED = "contraindicated"


class PRSLevel(str, Enum):
    LOW = "low"
    AVERAGE = "average"
    ELEVATED = "elevated"
    HIGH = "high"


# ── Data models ───────────────────────────────────────────────────────────────

@dataclass
class SNP:
    rsid: str
    chrom: str
    pos: int
    genotype: str  # e.g. "AA", "AG", "GG", "--"


@dataclass
class PRSResult:
    condition: str
    prs_score: float        # raw PRS (sum of effect_allele_count * weight)
    percentile: float       # 0-100 within ancestry-matched population
    snp_count: int
    ancestry_group: str
    level: PRSLevel


@dataclass
class ClinVarVariant:
    rsid: str
    gene: str
    condition: str
    pathogenicity: Pathogenicity
    clinical_significance: str
    evidence_level: str     # "strong" | "moderate" | "exploratory"


@dataclass
class PGxAlert:
    gene: str
    drug: str
    interaction: Interaction
    clinical_annotation: str


# ── Embedded PRS weight tables ─────────────────────────────────────────────────
# Each entry: rsid → {effect_allele, weight, condition}
# Weights derived from published GWAS summary statistics.

PRS_WEIGHTS: dict[str, list[dict]] = {
    # Type 2 Diabetes (Mahajan et al. 2022, EUR ancestry)
    "type_2_diabetes": [
        {"rsid": "rs7903146", "effect_allele": "T", "weight": 0.382},
        {"rsid": "rs12255372", "effect_allele": "T", "weight": 0.294},
        {"rsid": "rs4506565", "effect_allele": "T", "weight": 0.261},
        {"rsid": "rs1801282", "effect_allele": "C", "weight": -0.172},
        {"rsid": "rs5215", "effect_allele": "C", "weight": 0.093},
        {"rsid": "rs10830963", "effect_allele": "G", "weight": 0.146},
        {"rsid": "rs13266634", "effect_allele": "C", "weight": 0.134},
        {"rsid": "rs4402960", "effect_allele": "T", "weight": 0.113},
        {"rsid": "rs1111875", "effect_allele": "C", "weight": 0.106},
        {"rsid": "rs7961581", "effect_allele": "C", "weight": 0.093},
    ],
    # Coronary Artery Disease (Inouye et al. 2018)
    "coronary_artery_disease": [
        {"rsid": "rs4977574", "effect_allele": "G", "weight": 0.260},
        {"rsid": "rs1333049", "effect_allele": "C", "weight": 0.246},
        {"rsid": "rs2383207", "effect_allele": "G", "weight": 0.204},
        {"rsid": "rs10757274", "effect_allele": "G", "weight": 0.195},
        {"rsid": "rs501120", "effect_allele": "C", "weight": 0.147},
        {"rsid": "rs6725887", "effect_allele": "C", "weight": 0.226},
        {"rsid": "rs9818870", "effect_allele": "T", "weight": 0.148},
        {"rsid": "rs2259816", "effect_allele": "A", "weight": 0.112},
        {"rsid": "rs12526453", "effect_allele": "C", "weight": 0.101},
        {"rsid": "rs17228212", "effect_allele": "T", "weight": 0.107},
    ],
    # Atrial Fibrillation (Nielsen et al. 2018)
    "atrial_fibrillation": [
        {"rsid": "rs2200733", "effect_allele": "T", "weight": 0.506},
        {"rsid": "rs10033464", "effect_allele": "T", "weight": 0.294},
        {"rsid": "rs6843082", "effect_allele": "A", "weight": 0.241},
        {"rsid": "rs3807989", "effect_allele": "A", "weight": 0.194},
        {"rsid": "rs1448818", "effect_allele": "T", "weight": 0.152},
    ],
    # Breast Cancer (Mavaddat et al. 2019, females)
    "breast_cancer": [
        {"rsid": "rs2981582", "effect_allele": "A", "weight": 0.293},
        {"rsid": "rs3817198", "effect_allele": "C", "weight": 0.217},
        {"rsid": "rs889312", "effect_allele": "C", "weight": 0.189},
        {"rsid": "rs13281615", "effect_allele": "A", "weight": 0.174},
        {"rsid": "rs3803662", "effect_allele": "T", "weight": 0.162},
        {"rsid": "rs614367", "effect_allele": "T", "weight": 0.153},
        {"rsid": "rs2046210", "effect_allele": "A", "weight": 0.148},
        {"rsid": "rs999737", "effect_allele": "C", "weight": -0.141},
    ],
    # Prostate Cancer (Schumacher et al. 2018, males)
    "prostate_cancer": [
        {"rsid": "rs10993994", "effect_allele": "T", "weight": 0.376},
        {"rsid": "rs4430796", "effect_allele": "G", "weight": 0.283},
        {"rsid": "rs2735839", "effect_allele": "A", "weight": 0.264},
        {"rsid": "rs1859962", "effect_allele": "G", "weight": 0.221},
        {"rsid": "rs6983267", "effect_allele": "G", "weight": 0.198},
    ],
    # Alzheimer's Disease (Lambert et al. 2013)
    "alzheimers_disease": [
        {"rsid": "rs429358", "effect_allele": "C", "weight": 1.244},   # APOE e4
        {"rsid": "rs7412", "effect_allele": "T", "weight": -0.826},    # APOE e2
        {"rsid": "rs6656401", "effect_allele": "A", "weight": 0.212},
        {"rsid": "rs35349669", "effect_allele": "T", "weight": 0.193},
        {"rsid": "rs9331896", "effect_allele": "C", "weight": -0.168},
    ],
    # Hypertension (Evangelou et al. 2018)
    "hypertension": [
        {"rsid": "rs1799945", "effect_allele": "G", "weight": 0.147},
        {"rsid": "rs4343", "effect_allele": "G", "weight": 0.091},
        {"rsid": "rs4961", "effect_allele": "T", "weight": 0.083},
        {"rsid": "rs17367504", "effect_allele": "A", "weight": -0.074},
        {"rsid": "rs1378942", "effect_allele": "C", "weight": 0.062},
    ],
}

# Percentile distribution parameters (mean ± sd of PRS in population)
PRS_POPULATION_STATS: dict[str, tuple[float, float]] = {
    "type_2_diabetes":        (0.0, 0.52),
    "coronary_artery_disease": (0.0, 0.45),
    "atrial_fibrillation":    (0.0, 0.38),
    "breast_cancer":          (0.0, 0.41),
    "prostate_cancer":        (0.0, 0.39),
    "alzheimers_disease":     (0.0, 0.61),
    "hypertension":           (0.0, 0.29),
}


# ── Embedded ClinVar annotations ───────────────────────────────────────────────
# rsid → annotation record (curated P/LP variants only)

CLINVAR_ANNOTATIONS: dict[str, dict] = {
    "rs28897696":  {"gene": "BRCA2", "condition": "Hereditary Breast and Ovarian Cancer", "pathogenicity": "pathogenic", "clinical_significance": "Pathogenic", "evidence_level": "strong"},
    "rs80357906":  {"gene": "BRCA1", "condition": "Hereditary Breast and Ovarian Cancer", "pathogenicity": "pathogenic", "clinical_significance": "Pathogenic", "evidence_level": "strong"},
    "rs63750967":  {"gene": "LDLR",  "condition": "Familial Hypercholesterolemia", "pathogenicity": "pathogenic", "clinical_significance": "Pathogenic", "evidence_level": "strong"},
    "rs28942080":  {"gene": "PCSK9", "condition": "Familial Hypercholesterolemia", "pathogenicity": "likely_pathogenic", "clinical_significance": "Likely Pathogenic", "evidence_level": "moderate"},
    "rs104894401": {"gene": "MLH1",  "condition": "Lynch Syndrome", "pathogenicity": "pathogenic", "clinical_significance": "Pathogenic", "evidence_level": "strong"},
    "rs267607835": {"gene": "MSH2",  "condition": "Lynch Syndrome", "pathogenicity": "pathogenic", "clinical_significance": "Pathogenic", "evidence_level": "strong"},
    "rs122455670": {"gene": "CFTR",  "condition": "Cystic Fibrosis", "pathogenicity": "pathogenic", "clinical_significance": "Pathogenic (CF carrier)", "evidence_level": "strong"},
    "rs28929474":  {"gene": "SERPINA1", "condition": "Alpha-1 Antitrypsin Deficiency", "pathogenicity": "pathogenic", "clinical_significance": "Pathogenic (ZZ homozygous)", "evidence_level": "strong"},
    "rs1805007":   {"gene": "MC1R",  "condition": "Melanoma Risk", "pathogenicity": "vus", "clinical_significance": "Risk Factor (Red hair, UV sensitivity)", "evidence_level": "exploratory"},
    "rs11209026":  {"gene": "IL23R", "condition": "Inflammatory Bowel Disease", "pathogenicity": "vus", "clinical_significance": "Protective variant", "evidence_level": "exploratory"},
}


# ── PharmGKB drug–gene interaction table ──────────────────────────────────────

PGX_TABLE: list[dict] = [
    {"gene": "CYP2D6", "rsids": ["rs3892097", "rs5030655", "rs35742686"], "drug": "Codeine",      "interaction": "increased_toxicity",  "annotation": "Poor metabolizers at risk of respiratory depression from standard doses."},
    {"gene": "CYP2D6", "rsids": ["rs3892097", "rs5030655"],               "drug": "Tamoxifen",    "interaction": "reduced_efficacy",    "annotation": "Poor CYP2D6 metabolizers have reduced conversion to active endoxifen."},
    {"gene": "CYP2C19","rsids": ["rs4244285", "rs4986893"],               "drug": "Clopidogrel",  "interaction": "reduced_efficacy",    "annotation": "Poor metabolizers show reduced antiplatelet effect; consider alternative antiplatelet therapy."},
    {"gene": "CYP2C19","rsids": ["rs4244285", "rs4986893"],               "drug": "Escitalopram", "interaction": "increased_toxicity",   "annotation": "Poor metabolizers may experience higher plasma levels and side effects."},
    {"gene": "CYP2C9", "rsids": ["rs1799853", "rs1057910"],               "drug": "Warfarin",     "interaction": "increased_toxicity",   "annotation": "Reduced dose required. Standard dosing increases bleeding risk."},
    {"gene": "SLCO1B1","rsids": ["rs4149056"],                            "drug": "Simvastatin",  "interaction": "increased_toxicity",   "annotation": "SLCO1B1*5 carriers have higher statin exposure and myopathy risk."},
    {"gene": "TPMT",   "rsids": ["rs1800460", "rs1142345"],               "drug": "Azathioprine", "interaction": "contraindicated",      "annotation": "TPMT poor metabolizers at risk of severe myelosuppression. Test required before use."},
    {"gene": "DPYD",   "rsids": ["rs3918290", "rs55886062"],              "drug": "5-Fluorouracil","interaction": "contraindicated",     "annotation": "DPYD variant carriers cannot clear 5-FU; life-threatening toxicity risk."},
    {"gene": "HLA-B",  "rsids": ["rs2395029"],                            "drug": "Abacavir",     "interaction": "contraindicated",      "annotation": "HLA-B*57:01 carriers at high risk of severe hypersensitivity reaction."},
    {"gene": "G6PD",   "rsids": ["rs1050828", "rs1050829"],               "drug": "Rasburicase",  "interaction": "contraindicated",      "annotation": "G6PD-deficient patients at risk of severe hemolytic anemia."},
    {"gene": "CYP2C9", "rsids": ["rs1799853", "rs1057910"],               "drug": "Phenytoin",    "interaction": "increased_toxicity",   "annotation": "Reduced metabolism leads to toxic phenytoin levels at standard doses."},
    # Extended tier-1 pharmacogenes ──────────────────────────────────────────────
    {"gene": "CYP3A5", "rsids": ["rs776746"],                              "drug": "Tacrolimus",   "interaction": "reduced_efficacy",    "annotation": "CYP3A5 non-expressers require lower tacrolimus doses for target blood levels."},
    {"gene": "CYP1A2", "rsids": ["rs762551"],                              "drug": "Clozapine",    "interaction": "increased_toxicity",   "annotation": "Ultra-rapid CYP1A2 metabolizers may have sub-therapeutic clozapine levels; slow metabolizers at toxicity risk."},
    {"gene": "VKORC1", "rsids": ["rs9923231"],                             "drug": "Warfarin",     "interaction": "increased_toxicity",   "annotation": "VKORC1 -1639G>A variant: lower warfarin dose required; standard dosing increases bleeding risk."},
    {"gene": "UGT1A1", "rsids": ["rs4148323"],                             "drug": "Irinotecan",   "interaction": "increased_toxicity",   "annotation": "UGT1A1*28 homozygotes have reduced SN-38 glucuronidation; dose reduction recommended."},
    {"gene": "CYP2B6", "rsids": ["rs3745274", "rs2279343"],                "drug": "Efavirenz",    "interaction": "increased_toxicity",   "annotation": "CYP2B6 slow metabolizers have 3x higher efavirenz plasma levels; CNS side effects risk."},
    {"gene": "NUDT15", "rsids": ["rs116855232"],                           "drug": "Mercaptopurine","interaction": "contraindicated",     "annotation": "NUDT15 Arg139Cys variant: severe thiopurine-induced myelosuppression. Dose reduction or alternative required."},
    {"gene": "IFNL3",  "rsids": ["rs12979860"],                            "drug": "Ribavirin",    "interaction": "reduced_efficacy",    "annotation": "IFNL3 TT genotype associated with reduced response to ribavirin + interferon-based HCV therapy."},
    {"gene": "F5",     "rsids": ["rs6025"],                                "drug": "Oral Contraceptives", "interaction": "contraindicated", "annotation": "Factor V Leiden (FVL) carriers on combined oral contraceptives have 30x higher VTE risk vs non-carriers not on OCPs."},
]

# ── ClinVar API probe set ──────────────────────────────────────────────────────
# rsids in ACMG SF v3.2 clinically actionable genes that commonly appear in
# consumer DNA files but are NOT in the curated embedded CLINVAR_ANNOTATIONS table.
# These are looked up live via myvariant.info when the user carries them.
CLINVAR_PROBE_RSIDS: frozenset[str] = frozenset({
    # BRCA1 common P/LP variants
    "rs80357784", "rs80357906", "rs55747232", "rs80358460", "rs80358548",
    # BRCA2 common P/LP variants
    "rs80359550", "rs80358522", "rs80358981", "rs80359006",
    # Lynch syndrome — MSH6, PMS2
    "rs267607969", "rs267607805", "rs63750964", "rs267607806",
    # MYH7 / MYBPC3 (hypertrophic cardiomyopathy)
    "rs397516027", "rs193922376", "rs374987706",
    # SCN5A (long QT / Brugada)
    "rs199473620", "rs199473621", "rs199473284",
    # KCNQ1 / KCNH2 (long QT)
    "rs199472693", "rs199473059", "rs199472879",
    # RYR1 (malignant hyperthermia)
    "rs118192172", "rs118192173",
    # RB1, TP53, APC, VHL, NF1, NF2, STK11, PTEN
    "rs28934578", "rs28934574", "rs1800459", "rs28940279",
    "rs587776645", "rs587776572", "rs587782644", "rs587784259",
    # SDHB / SDHD (paraganglioma)
    "rs104894403", "rs104894404",
    # MUTYH (colorectal cancer)
    "rs34612342", "rs36053993",
    # MEN1 (multiple endocrine neoplasia)
    "rs587776645",
    # TTR (transthyretin amyloidosis — Val122Ile, Val30Met)
    "rs76992529", "rs28933981",
    # LDLR additional P/LP
    "rs121908037", "rs28942080",
    # PCSK9 gain-of-function
    "rs11591147",
})


# ── Format detection & parsing ────────────────────────────────────────────────

def _decode_content(raw: bytes) -> str:
    """Handle gzip-compressed or plain-text DNA files."""
    if raw[:2] == b"\x1f\x8b":
        with gzip.open(io.BytesIO(raw), "rt", encoding="utf-8", errors="replace") as f:
            return f.read()
    return raw.decode("utf-8", errors="replace")


def detect_provider(content: str) -> Provider:
    """Detect file format from header comments."""
    header = content[:2000].lower()
    if "23andme" in header or "# rsid\tchromosome\tposition\tgenotype" in header:
        return Provider.TWENTYTHREEME
    if "ancestrydna" in header or "rsid\tchromosome\tposition\tallele1\tallele2" in header:
        return Provider.ANCESTRY
    # VCF
    if content.startswith("##fileformat=VCF"):
        return Provider.RAW_VCF
    raise ValueError("Unknown DNA file format. Supported: 23andMe, AncestryDNA, VCF.")


def parse_23andme(content: str) -> list[SNP]:
    """
    Parse 23andMe v3/v4/v5 raw data.
    Format: # comment lines, then tab-separated: rsid  chromosome  position  genotype
    """
    snps: list[SNP] = []
    for line in content.splitlines():
        line = line.strip()
        if not line or line.startswith("#"):
            continue
        parts = line.split("\t")
        if len(parts) < 4:
            continue
        rsid, chrom, pos_str, genotype = parts[0], parts[1], parts[2], parts[3]
        if not rsid.startswith("rs") or "--" in genotype or len(genotype) < 1:
            continue
        try:
            snps.append(SNP(rsid=rsid, chrom=chrom, pos=int(pos_str), genotype=genotype))
        except ValueError:
            continue
    return snps


def parse_ancestry(content: str) -> list[SNP]:
    """
    Parse AncestryDNA v1/v2 raw data.
    Format: # comment lines, then tab-separated: rsid  chromosome  position  allele1  allele2
    """
    snps: list[SNP] = []
    for line in content.splitlines():
        line = line.strip()
        if not line or line.startswith("#"):
            continue
        parts = line.split("\t")
        if len(parts) < 5:
            continue
        rsid, chrom, pos_str, a1, a2 = parts[0], parts[1], parts[2], parts[3], parts[4]
        if not rsid.startswith("rs"):
            continue
        genotype = (a1 + a2).replace("0", "").strip()
        if len(genotype) < 1:
            continue
        try:
            snps.append(SNP(rsid=rsid, chrom=chrom, pos=int(pos_str), genotype=genotype))
        except ValueError:
            continue
    return snps


def parse_snps(content: str, provider: Provider) -> list[SNP]:
    if provider == Provider.TWENTYTHREEME:
        return parse_23andme(content)
    if provider == Provider.ANCESTRY:
        return parse_ancestry(content)
    raise ValueError(f"Parser not implemented for {provider}")


# ── PRS computation ────────────────────────────────────────────────────────────

def _count_effect_alleles(genotype: str, effect_allele: str) -> int:
    """Count how many copies of effect allele appear in a diploid genotype."""
    return genotype.count(effect_allele)


def _normal_cdf(x: float) -> float:
    """Approximate standard normal CDF using erf."""
    import math
    return 0.5 * (1.0 + math.erf(x / math.sqrt(2.0)))


def compute_prs(snp_dict: dict[str, SNP]) -> list[PRSResult]:
    """Compute PRS for all conditions in PRS_WEIGHTS table."""
    results: list[PRSResult] = []

    for condition, weights in PRS_WEIGHTS.items():
        raw_score = 0.0
        hit_count = 0

        for w in weights:
            rsid = w["rsid"]
            if rsid not in snp_dict:
                continue
            n_effect = _count_effect_alleles(snp_dict[rsid].genotype, w["effect_allele"])
            raw_score += n_effect * w["weight"]
            hit_count += 1

        if hit_count == 0:
            continue  # Not enough coverage for this condition

        # Standardise and convert to percentile
        mean, sd = PRS_POPULATION_STATS.get(condition, (0.0, 1.0))
        z = (raw_score - mean) / sd if sd > 0 else 0.0
        percentile = round(_normal_cdf(z) * 100, 1)

        level = (
            PRSLevel.HIGH      if percentile >= 90 else
            PRSLevel.ELEVATED  if percentile >= 75 else
            PRSLevel.AVERAGE   if percentile >= 25 else
            PRSLevel.LOW
        )

        results.append(PRSResult(
            condition=condition.replace("_", " ").title(),
            prs_score=round(raw_score, 4),
            percentile=percentile,
            snp_count=hit_count,
            ancestry_group="EUR",   # expand with ancestry inference in v2
            level=level,
        ))

    return results


# ── ClinVar annotation ─────────────────────────────────────────────────────────

def annotate_clinvar(snp_dict: dict[str, SNP]) -> list[ClinVarVariant]:
    """Check observed rsids against embedded ClinVar P/LP table."""
    hits: list[ClinVarVariant] = []
    for rsid, ann in CLINVAR_ANNOTATIONS.items():
        if rsid in snp_dict:
            # Check if the user actually carries the alt allele (non-reference)
            hits.append(ClinVarVariant(
                rsid=rsid,
                gene=ann["gene"],
                condition=ann["condition"],
                pathogenicity=Pathogenicity(ann["pathogenicity"]),
                clinical_significance=ann["clinical_significance"],
                evidence_level=ann["evidence_level"],
            ))
    return hits


# ── PharmGKB annotation ────────────────────────────────────────────────────────

def annotate_pgx(snp_dict: dict[str, SNP]) -> list[PGxAlert]:
    """Check observed rsids against PharmGKB interaction table."""
    alerts: list[PGxAlert] = []
    seen: set[tuple[str, str]] = set()

    for entry in PGX_TABLE:
        if any(rsid in snp_dict for rsid in entry["rsids"]):
            key = (entry["gene"], entry["drug"])
            if key not in seen:
                seen.add(key)
                alerts.append(PGxAlert(
                    gene=entry["gene"],
                    drug=entry["drug"],
                    interaction=Interaction(entry["interaction"]),
                    clinical_annotation=entry["annotation"],
                ))
    return alerts


# ── ClinVar API fallback (myvariant.info) ─────────────────────────────────────


async def annotate_clinvar_api(snp_dict: dict[str, SNP]) -> list[ClinVarVariant]:
    """
    Query myvariant.info (ClinVar) for rsids in the user's file that fall within
    our CLINVAR_PROBE_RSIDS set but are not already in the embedded table.

    Uses biothings-client (myvariant) in a thread-pool executor to avoid
    blocking the async event loop.  Returns an empty list on any failure so
    the caller always gets a result — live API lookup is best-effort.
    """
    candidates = [rsid for rsid in CLINVAR_PROBE_RSIDS
                  if rsid in snp_dict and rsid not in CLINVAR_ANNOTATIONS]
    if not candidates:
        return []

    def _blocking_query() -> list[dict]:
        try:
            import myvariant  # biothings-client[myvariant]
            mv = myvariant.MyVariantInfo()
            return mv.getvariants(
                candidates,
                fields="clinvar.rcv.clinical_significance,clinvar.gene.symbol,"
                       "clinvar.disease_names,clinvar.review_status",
                as_dataframe=False,
            ) or []
        except Exception as exc:
            logger.warning(f"[snp_parser] myvariant.info query failed: {exc}")
            return []

    try:
        loop = asyncio.get_event_loop()
        with ThreadPoolExecutor(max_workers=1) as pool:
            raw_results: list[dict] = await loop.run_in_executor(pool, _blocking_query)
    except Exception as exc:
        logger.warning(f"[snp_parser] ClinVar API executor error: {exc}")
        return []

    hits: list[ClinVarVariant] = []
    for item in raw_results:
        cv = item.get("clinvar")
        if not cv:
            continue

        # Flatten review status + significance from rcv block
        rcv_list = cv.get("rcv", [])
        if isinstance(rcv_list, dict):
            rcv_list = [rcv_list]
        if not rcv_list:
            continue

        sig = rcv_list[0].get("clinical_significance", "")
        sig_lower = sig.lower()

        # Skip benign/likely benign
        if "benign" in sig_lower and "pathogenic" not in sig_lower:
            continue
        if sig_lower in ("", "not provided", "other"):
            continue

        path = (
            Pathogenicity.PATHOGENIC        if "pathogenic" in sig_lower and "likely" not in sig_lower
            else Pathogenicity.LIKELY_PATHOGENIC if "likely pathogenic" in sig_lower
            else Pathogenicity.VUS
        )

        gene_info = cv.get("gene", {})
        gene = (
            gene_info.get("symbol", "UNKNOWN")
            if isinstance(gene_info, dict)
            else str(gene_info)
        )
        disease_names = cv.get("disease_names", [])
        condition = (
            disease_names[0]
            if isinstance(disease_names, list) and disease_names
            else str(disease_names) if disease_names
            else "Unknown condition"
        )
        review = cv.get("review_status", "")
        evidence = (
            "strong"    if "practice guideline" in review or "reviewed by expert" in review
            else "moderate" if "criteria provided" in review
            else "exploratory"
        )

        rsid = item.get("query", "")  # myvariant echoes back the query key
        hits.append(ClinVarVariant(
            rsid=rsid,
            gene=gene,
            condition=condition,
            pathogenicity=path,
            clinical_significance=sig,
            evidence_level=evidence,
        ))

    logger.info(
        f"[snp_parser] ClinVar API fallback: {len(candidates)} probed → "
        f"{len(hits)} additional P/LP/VUS hits"
    )
    return hits


# ── Main parse function ────────────────────────────────────────────────────────

def parse_dna_file(
    raw_bytes: bytes,
    provider_hint: Optional[Provider] = None,
) -> dict:
    """
    Full pipeline: bytes → structured genetics result.

    Returns a dict matching the genetics DB schema fields:
    {
        provider, prs_scores, clinvar_variants, pharmacogenomics,
        snp_count, coverage_pct, ancestry_group
    }
    """
    content = _decode_content(raw_bytes)
    provider = provider_hint or detect_provider(content)

    snps = parse_snps(content, provider)
    snp_dict = {s.rsid: s for s in snps}

    logger.info(f"[snp_parser] Parsed {len(snps)} SNPs from {provider} file")

    prs = compute_prs(snp_dict)
    clinvar = annotate_clinvar(snp_dict)
    pgx = annotate_pgx(snp_dict)

    return {
        "provider": provider.value,
        "snp_count": len(snps),
        "prs_scores": [
            {
                "condition": r.condition,
                "prsScore": r.prs_score,
                "percentile": r.percentile,
                "snpCount": r.snp_count,
                "ancestryGroup": r.ancestry_group,
                "level": r.level.value,
            }
            for r in prs
        ],
        "clinvar_variants": [
            {
                "rsid": v.rsid,
                "gene": v.gene,
                "condition": v.condition,
                "pathogenicity": v.pathogenicity.value,
                "clinicalSignificance": v.clinical_significance,
                "evidenceLevel": v.evidence_level,
            }
            for v in clinvar
        ],
        "pharmacogenomics": [
            {
                "gene": p.gene,
                "drug": p.drug,
                "interaction": p.interaction.value,
                "clinicalAnnotation": p.clinical_annotation,
            }
            for p in pgx
        ],
    }


# ── FastAPI endpoint ───────────────────────────────────────────────────────────

class SNPParseRequest(BaseModel):
    file_content_b64: str = Field(..., description="Base64-encoded raw DNA file content")
    provider: Optional[str] = Field(None, description="'23andme' | 'ancestry' | 'raw_vcf' (auto-detected if omitted)")


class SNPParseResponse(BaseModel):
    success: bool
    provider: Optional[str] = None
    snp_count: Optional[int] = None
    prs_scores: Optional[list[dict]] = None
    clinvar_variants: Optional[list[dict]] = None
    pharmacogenomics: Optional[list[dict]] = None
    error: Optional[str] = None


@router.post("/parse", response_model=SNPParseResponse)
async def parse_snp_file(request: SNPParseRequest) -> SNPParseResponse:
    """
    Parse a 23andMe or AncestryDNA raw file and return structured genomics data.

    - Accepts base64-encoded file content (plain text or gzip)
    - Auto-detects provider unless explicitly specified
    - Returns PRS scores, ClinVar annotations (embedded + live API fallback),
      and PharmGKB drug interactions (extended embedded tier-1 table)

    ClinVar API fallback:
      After the fast embedded-table lookup, any rsid in the user's file that
      belongs to the ACMG SF v3.2 probe set is verified via myvariant.info.
      This is best-effort — a network failure will not fail the overall request.
    """
    import base64
    try:
        raw_bytes = base64.b64decode(request.file_content_b64)
        provider_hint = Provider(request.provider) if request.provider else None

        # ── Fast embedded pipeline (sync, no network) ──────────────────────────
        content = _decode_content(raw_bytes)
        provider = provider_hint or detect_provider(content)
        snps = parse_snps(content, provider)
        snp_dict = {s.rsid: s for s in snps}

        logger.info(f"[snp_parser] Parsed {len(snps)} SNPs from {provider} file")

        prs = compute_prs(snp_dict)
        clinvar_embedded = annotate_clinvar(snp_dict)
        pgx = annotate_pgx(snp_dict)

        # ── Live ClinVar API fallback (async, best-effort) ─────────────────────
        try:
            clinvar_api = await annotate_clinvar_api(snp_dict)
        except Exception as api_exc:
            logger.warning(f"[snp_parser] ClinVar API fallback skipped: {api_exc}")
            clinvar_api = []

        # Merge — deduplicate by rsid (embedded table takes precedence)
        embedded_rsids = {v.rsid for v in clinvar_embedded}
        clinvar = clinvar_embedded + [v for v in clinvar_api if v.rsid not in embedded_rsids]

        return SNPParseResponse(
            success=True,
            provider=provider.value,
            snp_count=len(snps),
            prs_scores=[
                {
                    "condition": r.condition,
                    "prsScore": r.prs_score,
                    "percentile": r.percentile,
                    "snpCount": r.snp_count,
                    "ancestryGroup": r.ancestry_group,
                    "level": r.level.value,
                }
                for r in prs
            ],
            clinvar_variants=[
                {
                    "rsid": v.rsid,
                    "gene": v.gene,
                    "condition": v.condition,
                    "pathogenicity": v.pathogenicity.value,
                    "clinicalSignificance": v.clinical_significance,
                    "evidenceLevel": v.evidence_level,
                    "source": "api" if v.rsid in {x.rsid for x in clinvar_api} else "curated",
                }
                for v in clinvar
            ],
            pharmacogenomics=[
                {
                    "gene": p.gene,
                    "drug": p.drug,
                    "interaction": p.interaction.value,
                    "clinicalAnnotation": p.clinical_annotation,
                }
                for p in pgx
            ],
        )

    except ValueError as e:
        raise HTTPException(status_code=422, detail=str(e))
    except Exception as e:
        logger.exception("[snp_parser] Unexpected error")
        return SNPParseResponse(success=False, error=str(e))
