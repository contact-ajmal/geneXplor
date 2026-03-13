import logging
import re
from datetime import datetime, timezone

from app.core.redis import get_redis
from app.utils.cache_utils import cache_get, cache_set

logger = logging.getLogger(__name__)

RECONCILIATION_CACHE_KEY = "reconciliation:{symbol}"


def _normalize_significance(sig: str) -> str:
    """Normalize ClinVar significance to lowercase canonical form."""
    s = sig.lower().strip()
    if "pathogenic" in s and "likely" not in s and "conflicting" not in s:
        return "pathogenic"
    if "likely pathogenic" in s or "likely_pathogenic" in s:
        return "likely_pathogenic"
    if "benign" in s and "likely" not in s:
        return "benign"
    if "likely benign" in s or "likely_benign" in s:
        return "likely_benign"
    if "uncertain" in s or "vus" in s:
        return "vus"
    if "conflicting" in s:
        return "conflicting"
    return "other"


def _check_pathogenic_but_common(
    clinvar_variant: dict,
    gnomad_variant: dict,
    normalized_sig: str,
) -> dict | None:
    """CONFLICT TYPE 1: Pathogenic but common (AF > 1%)."""
    if normalized_sig not in ("pathogenic", "likely_pathogenic"):
        return None
    af = gnomad_variant.get("allele_frequency", 0)
    if af <= 0.01:
        return None
    return {
        "conflict_type": "pathogenic_but_common",
        "severity": "HIGH",
        "explanation": (
            f"This variant is classified as {clinvar_variant.get('clinical_significance', '')} "
            f"in ClinVar but has an allele frequency of {af*100:.2f}% in gnomAD, which is "
            f"unusually high for a truly pathogenic variant."
        ),
        "recommendation": (
            "Consider re-evaluating this classification with current population data. "
            "High-frequency pathogenic variants may indicate incomplete penetrance, "
            "population-specific effects, or potential misclassification."
        ),
    }


def _check_vus_high_frequency(
    clinvar_variant: dict,
    gnomad_variant: dict,
    normalized_sig: str,
) -> dict | None:
    """CONFLICT TYPE 3: VUS with high frequency (AF > 5%)."""
    if normalized_sig != "vus":
        return None
    af = gnomad_variant.get("allele_frequency", 0)
    if af <= 0.05:
        return None
    return {
        "conflict_type": "vus_high_frequency",
        "severity": "MEDIUM",
        "explanation": (
            f"This variant is classified as Uncertain Significance (VUS) in ClinVar "
            f"but has an allele frequency of {af*100:.1f}% in gnomAD. Variants this common "
            f"in the population are unlikely to be pathogenic."
        ),
        "recommendation": (
            "This variant may be reclassifiable as Benign or Likely Benign based on its "
            "high population frequency. Consider submitting updated evidence to ClinVar."
        ),
    }


def _check_population_stratification(
    clinvar_variant: dict,
    gnomad_variant: dict,
    normalized_sig: str,
) -> dict | None:
    """CONFLICT TYPE 4: Pathogenic with >10x AF variation between populations."""
    if normalized_sig != "pathogenic":
        return None
    pop_freqs = gnomad_variant.get("population_frequencies", [])
    if len(pop_freqs) < 2:
        return None
    afs = [pf.get("af", 0) for pf in pop_freqs if pf.get("af", 0) > 0]
    if len(afs) < 2:
        return None
    max_af = max(afs)
    min_af = min(afs)
    if min_af == 0 or max_af / min_af < 10:
        return None
    # Find population names
    max_pop = next(
        (pf.get("population", "?") for pf in pop_freqs if pf.get("af") == max_af), "?"
    )
    min_pop = next(
        (pf.get("population", "?") for pf in pop_freqs if pf.get("af") == min_af), "?"
    )
    return {
        "conflict_type": "population_stratification",
        "severity": "MEDIUM",
        "explanation": (
            f"This pathogenic variant shows >10x allele frequency variation between populations: "
            f"{max_pop.upper()} ({max_af:.4f}) vs {min_pop.upper()} ({min_af:.6f}). "
            f"This may indicate a population-specific carrier state or founder effect."
        ),
        "recommendation": (
            "Interpret pathogenicity in the context of the patient's ancestry. "
            "This variant may be a benign carrier variant in some populations."
        ),
    }


def _check_conflicting_submissions(
    clinvar_variant: dict,
    normalized_sig: str,
) -> dict | None:
    """CONFLICT TYPE 5: Multiple conflicting ClinVar submissions."""
    if normalized_sig == "conflicting":
        return {
            "conflict_type": "conflicting_submissions",
            "severity": "MEDIUM",
            "explanation": (
                "This variant has conflicting interpretations from different ClinVar submitters. "
                f"Review status: {clinvar_variant.get('review_status', 'unknown')}."
            ),
            "recommendation": (
                "Review individual submitter evidence in ClinVar. Conflicting interpretations "
                "may reflect differences in evidence interpretation or patient populations studied."
            ),
        }
    # Also check submission count > 1 for non-conflicting — indicates potential disagreement
    count = clinvar_variant.get("submission_count", 0)
    review = clinvar_variant.get("review_status", "").lower()
    if count > 1 and "conflicting" in review:
        return {
            "conflict_type": "conflicting_submissions",
            "severity": "MEDIUM",
            "explanation": (
                f"This variant has {count} submissions in ClinVar with conflicting interpretations. "
                f"Classified as '{clinvar_variant.get('clinical_significance', '')}' but review status "
                f"indicates disagreement."
            ),
            "recommendation": (
                "Check individual ClinVar submissions for this variant to understand the basis "
                "for differing interpretations."
            ),
        }
    return None


def _check_classification_age(
    clinvar_variant: dict,
) -> dict | None:
    """CONFLICT TYPE 6: Classification older than 3 years."""
    date_str = clinvar_variant.get("date_last_evaluated", "")
    if not date_str:
        return None
    try:
        # Parse various date formats
        for fmt in ("%Y-%m-%d", "%Y/%m/%d", "%b %d, %Y", "%Y-%m-%dT%H:%M:%S"):
            try:
                eval_date = datetime.strptime(date_str[:10], fmt[:min(len(fmt), len(date_str[:10]))])
                break
            except ValueError:
                continue
        else:
            # Try just year-month
            if len(date_str) >= 7:
                eval_date = datetime.strptime(date_str[:7], "%Y-%m")
            else:
                return None

        age_days = (datetime.now() - eval_date).days
        if age_days < 365 * 3:
            return None
        years = age_days / 365
        return {
            "conflict_type": "classification_age",
            "severity": "LOW",
            "explanation": (
                f"This variant was last evaluated {years:.1f} years ago ({date_str[:10]}). "
                f"Newer evidence or population data may be available."
            ),
            "recommendation": (
                "Classification may benefit from re-evaluation with current evidence and "
                "updated population frequency data from gnomAD v4."
            ),
        }
    except Exception:
        return None


def _check_benign_but_absent(
    clinvar_variant: dict,
    gnomad_variant: dict | None,
    normalized_sig: str,
) -> dict | None:
    """CONFLICT TYPE 2: Benign but absent from gnomAD."""
    if normalized_sig not in ("benign", "likely_benign"):
        return None
    if gnomad_variant is not None:
        return None
    return {
        "conflict_type": "benign_but_absent",
        "severity": "LOW",
        "explanation": (
            f"This variant is classified as {clinvar_variant.get('clinical_significance', '')} "
            f"in ClinVar but was not found in gnomAD population data. While benign variants "
            f"can still be rare, the absence is noteworthy."
        ),
        "recommendation": (
            "This is informational — benign variants can be rare. No action required "
            "unless additional evidence suggests reclassification."
        ),
    }


async def reconcile_variants(
    symbol: str,
    clinvar_data: dict | None,
    gnomad_data: dict | None,
) -> dict:
    """
    Cross-reference ClinVar and gnomAD data to find conflicts.

    Takes already-fetched data dictionaries (not raw API responses).
    Returns reconciliation report with conflicts and summary statistics.
    """
    # Check cache first
    redis_client = await get_redis()
    cache_key = RECONCILIATION_CACHE_KEY.format(symbol=symbol)
    cached = await cache_get(redis_client, cache_key)
    if cached is not None:
        return cached

    clinvar_variants = (clinvar_data or {}).get("variants", [])
    gnomad_variants = (gnomad_data or {}).get("variants", [])

    # Build gnomAD lookups: by variant_id AND by HGVS coding notation
    gnomad_by_id: dict[str, dict] = {}
    gnomad_by_hgvsc: dict[str, dict] = {}
    for gv in gnomad_variants:
        gnomad_by_id[gv.get("variant_id", "")] = gv
        hgvsc = gv.get("hgvsc", "").strip()
        if hgvsc:
            gnomad_by_hgvsc[hgvsc] = gv

    # Extract HGVS c. notation from ClinVar title (e.g. "NM_000518.5(HBB):c.20A>T" → "c.20A>T")
    _hgvsc_pattern = re.compile(r"(c\.\S+?)(?:\s|$|\))")

    def _extract_hgvsc(title: str) -> str:
        m = _hgvsc_pattern.search(title)
        return m.group(1) if m else ""

    # Match ClinVar variants to gnomAD via ID or HGVS
    matched_clinvar: set[str] = set()  # ClinVar variant_ids that matched a gnomAD entry
    matched_gnomad: set[str] = set()   # gnomAD variant_ids that were matched

    def _find_gnomad_match(cv: dict) -> dict | None:
        vid = cv.get("variant_id", "")
        # Try direct ID match first
        gv = gnomad_by_id.get(vid)
        if gv:
            matched_clinvar.add(vid)
            matched_gnomad.add(gv.get("variant_id", ""))
            return gv
        # Try HGVS coding match
        hgvsc = _extract_hgvsc(cv.get("title", ""))
        if hgvsc:
            gv = gnomad_by_hgvsc.get(hgvsc)
            if gv:
                matched_clinvar.add(vid)
                matched_gnomad.add(gv.get("variant_id", ""))
                return gv
        return None

    # First pass: match all ClinVar variants to gnomAD
    cv_gnomad_pairs: list[tuple[dict, dict | None]] = []
    for cv in clinvar_variants:
        gv = _find_gnomad_match(cv)
        cv_gnomad_pairs.append((cv, gv))

    # Build Venn diagram counts
    clinvar_total = len(clinvar_variants)
    gnomad_total = len(gnomad_variants)
    both_count = len(matched_clinvar)
    clinvar_only_count = clinvar_total - both_count
    gnomad_only_count = gnomad_total - len(matched_gnomad)

    conflicts: list[dict] = []

    for cv, gv in cv_gnomad_pairs:
        vid = cv.get("variant_id", "")
        sig = cv.get("clinical_significance", "")
        normalized_sig = _normalize_significance(sig)

        variant_conflicts: list[dict] = []

        # Type 2: Benign but absent (check against variants NOT in gnomAD)
        if gv is None:
            conflict = _check_benign_but_absent(cv, None, normalized_sig)
            if conflict:
                variant_conflicts.append(conflict)
        else:
            # Type 1: Pathogenic but common
            conflict = _check_pathogenic_but_common(cv, gv, normalized_sig)
            if conflict:
                variant_conflicts.append(conflict)

            # Type 3: VUS with high frequency
            conflict = _check_vus_high_frequency(cv, gv, normalized_sig)
            if conflict:
                variant_conflicts.append(conflict)

            # Type 4: Population stratification
            conflict = _check_population_stratification(cv, gv, normalized_sig)
            if conflict:
                variant_conflicts.append(conflict)

        # Type 5: Conflicting submissions (doesn't need gnomAD)
        conflict = _check_conflicting_submissions(cv, normalized_sig)
        if conflict:
            variant_conflicts.append(conflict)

        # Type 6: Classification age (doesn't need gnomAD)
        conflict = _check_classification_age(cv)
        if conflict:
            variant_conflicts.append(conflict)

        # Build conflict entries
        for vc in variant_conflicts:
            gnomad_af = gv.get("allele_frequency", 0) if gv else 0
            pop_afs = {}
            if gv:
                for pf in gv.get("population_frequencies", []):
                    pop_afs[pf.get("population", "")] = pf.get("af", 0)

            conflicts.append({
                "variant_id": vid,
                "hgvs": gv.get("hgvsp", "") or gv.get("hgvsc", "") if gv else cv.get("title", ""),
                "conflict_type": vc["conflict_type"],
                "severity": vc["severity"],
                "clinvar_significance": sig,
                "clinvar_review_status": cv.get("review_status", ""),
                "clinvar_last_evaluated": cv.get("date_last_evaluated", ""),
                "gnomad_af": gnomad_af,
                "gnomad_population_afs": pop_afs,
                "explanation": vc["explanation"],
                "recommendation": vc["recommendation"],
                "external_links": {
                    "clinvar": f"https://www.ncbi.nlm.nih.gov/clinvar/variation/{vid}/",
                    "gnomad": f"https://gnomad.broadinstitute.org/variant/{vid}?dataset=gnomad_r4",
                },
            })

    # Sort by severity: HIGH first, then MEDIUM, then LOW
    severity_order = {"HIGH": 0, "MEDIUM": 1, "LOW": 2}
    conflicts.sort(key=lambda c: severity_order.get(c["severity"], 3))

    # Summary statistics
    by_severity: dict[str, int] = {"HIGH": 0, "MEDIUM": 0, "LOW": 0}
    by_type: dict[str, int] = {}
    for c in conflicts:
        by_severity[c["severity"]] = by_severity.get(c["severity"], 0) + 1
        by_type[c["conflict_type"]] = by_type.get(c["conflict_type"], 0) + 1

    total_reconciled = clinvar_total + gnomad_only_count
    conflict_count = len(conflicts)

    # Reconciliation score: 100 = no conflicts, scales down by severity
    if total_reconciled == 0:
        score = 100.0
    else:
        weighted = by_severity["HIGH"] * 3 + by_severity["MEDIUM"] * 1.5 + by_severity["LOW"] * 0.5
        score = max(0.0, min(100.0, 100.0 - (weighted / total_reconciled) * 100))
        score = round(score, 1)

    report = {
        "conflicts": conflicts,
        "summary": {
            "total_variants_reconciled": total_reconciled,
            "conflicts_found": conflict_count,
            "by_severity": by_severity,
            "by_type": by_type,
            "reconciliation_score": score,
            "variants_in_both_databases": both_count,
            "variants_clinvar_only": clinvar_only_count,
            "variants_gnomad_only": gnomad_only_count,
        },
    }

    # Cache result
    await cache_set(redis_client, cache_key, report)

    return report
