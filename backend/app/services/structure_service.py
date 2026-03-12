"""Fetch AlphaFold/PDB 3D structure metadata and map variants to residues."""

import logging
import re

import httpx

from app.core.redis import get_redis
from app.utils.cache_utils import cache_get, cache_set
from app.utils.http_client import fetch_json

logger = logging.getLogger(__name__)

ALPHAFOLD_API = "https://alphafold.ebi.ac.uk/api/prediction"
PDB_UNIPROT_API = "https://data.rcsb.org/rest/v1/core/uniprot"

# Matches HGVS protein notation like p.Arg175His, p.R175H, p.Gly245Ser
HGVSP_PATTERN = re.compile(
    r"p\.(?P<ref>[A-Z][a-z]{0,2})(?P<pos>\d+)(?P<alt>[A-Z][a-z]{0,2})"
)

# Three-letter to one-letter amino acid mapping
AA3_TO_1 = {
    "Ala": "A", "Arg": "R", "Asn": "N", "Asp": "D", "Cys": "C",
    "Gln": "Q", "Glu": "E", "Gly": "G", "His": "H", "Ile": "I",
    "Leu": "L", "Lys": "K", "Met": "M", "Phe": "F", "Pro": "P",
    "Ser": "S", "Thr": "T", "Trp": "W", "Tyr": "Y", "Val": "V",
    "Ter": "*",
}


async def fetch_structure_data(
    symbol: str,
    uniprot_id: str | None,
    clinvar_variants: list[dict] | None,
    gnomad_variants: list[dict] | None,
) -> dict | None:
    """Fetch 3D structure info and map variants to residue positions."""
    cache_key = f"structure:{symbol}"
    redis_client = await get_redis()
    cached = await cache_get(redis_client, cache_key)
    if cached is not None:
        return cached

    if not uniprot_id:
        return None

    # Try AlphaFold first, then PDB fallback
    structure = await _fetch_alphafold(uniprot_id)
    if structure is None:
        structure = await _fetch_pdb_fallback(uniprot_id)

    if structure is None:
        result = {"structure_available": False}
        await cache_set(redis_client, cache_key, result)
        return result

    # Map variants to residues
    variant_residues = _map_variants_to_residues(clinvar_variants, gnomad_variants)

    result = {
        **structure,
        "structure_available": True,
        "uniprot_id": uniprot_id,
        "variant_residues": variant_residues,
    }
    await cache_set(redis_client, cache_key, result)
    return result


async def _fetch_alphafold(uniprot_id: str) -> dict | None:
    """Query AlphaFold DB for predicted structure."""
    url = f"{ALPHAFOLD_API}/{uniprot_id}"
    try:
        data = await fetch_json(url)
        if not data:
            return None

        entry = data[0] if isinstance(data, list) else data
        pdb_url = entry.get("pdbUrl") or entry.get("cifUrl")
        if not pdb_url:
            return None

        return {
            "source": "alphafold",
            "structure_url": pdb_url,
            "mean_confidence": entry.get("globalMetricValue", 0.0),
            "model_version": str(entry.get("latestVersion", "unknown")),
            "alphafold_url": f"https://alphafold.ebi.ac.uk/entry/{uniprot_id}",
        }
    except (httpx.HTTPStatusError, httpx.HTTPError, KeyError, IndexError) as exc:
        logger.warning("AlphaFold lookup failed for %s: %s", uniprot_id, exc)
        return None


async def _fetch_pdb_fallback(uniprot_id: str) -> dict | None:
    """Fallback: look for experimental PDB structures via RCSB."""
    url = f"{PDB_UNIPROT_API}/{uniprot_id}"
    try:
        data = await fetch_json(url)
        pdb_ids = []
        for entry in data.get("rcsb_uniprot_container_identifiers", {}).get(
            "reference_sequence_identifiers", []
        ):
            if entry.get("database_name") == "PDB":
                pdb_ids.append(entry.get("database_accession"))

        if not pdb_ids:
            return None

        pdb_id = pdb_ids[0]
        return {
            "source": "pdb",
            "structure_url": f"https://files.rcsb.org/download/{pdb_id}.cif",
            "mean_confidence": 0.0,
            "model_version": pdb_id,
            "alphafold_url": f"https://www.rcsb.org/structure/{pdb_id}",
        }
    except (httpx.HTTPStatusError, httpx.HTTPError, KeyError) as exc:
        logger.warning("PDB fallback failed for %s: %s", uniprot_id, exc)
        return None


def _map_variants_to_residues(
    clinvar_variants: list[dict] | None,
    gnomad_variants: list[dict] | None,
) -> list[dict]:
    """Extract protein-level variant positions from HGVS notation."""
    seen_positions: dict[int, dict] = {}

    # gnomAD variants have explicit hgvsp field
    for v in gnomad_variants or []:
        hgvsp = v.get("hgvsp", "")
        match = HGVSP_PATTERN.search(hgvsp)
        if match:
            pos = int(match.group("pos"))
            ref = match.group("ref")
            alt = match.group("alt")
            ref1 = AA3_TO_1.get(ref, ref)
            alt1 = AA3_TO_1.get(alt, alt)
            if pos not in seen_positions:
                seen_positions[pos] = {
                    "residue_number": pos,
                    "amino_acid_change": f"{ref1}{pos}{alt1}",
                    "clinical_significance": "population",
                    "allele_frequency": v.get("allele_frequency"),
                    "variant_id": v.get("variant_id", ""),
                }

    # ClinVar variants — parse from title (e.g. "NM_000546.6(TP53):c.524G>A (p.Arg175His)")
    for v in clinvar_variants or []:
        title = v.get("title", "")
        match = HGVSP_PATTERN.search(title)
        if match:
            pos = int(match.group("pos"))
            ref = match.group("ref")
            alt = match.group("alt")
            ref1 = AA3_TO_1.get(ref, ref)
            alt1 = AA3_TO_1.get(alt, alt)
            # ClinVar significance takes priority
            seen_positions[pos] = {
                "residue_number": pos,
                "amino_acid_change": f"{ref1}{pos}{alt1}",
                "clinical_significance": v.get("clinical_significance", ""),
                "allele_frequency": seen_positions.get(pos, {}).get("allele_frequency"),
                "variant_id": v.get("variant_id", ""),
            }

    return sorted(seen_positions.values(), key=lambda x: x["residue_number"])
