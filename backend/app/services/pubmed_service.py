import asyncio
import logging
from xml.etree import ElementTree

import httpx

from app.core.config import settings
from app.core.redis import get_redis
from app.utils.cache_utils import cache_get, cache_set
from app.utils.http_client import fetch_json, fetch_text

logger = logging.getLogger(__name__)

CACHE_KEY = "pubmed:{symbol}"


def _format_authors(author_list: list[ElementTree.Element]) -> str:
    names = []
    for author in author_list:
        last = author.findtext("LastName", "")
        initials = author.findtext("Initials", "")
        if last:
            names.append(f"{last} {initials}".strip())

    if len(names) == 0:
        return "Unknown"
    if len(names) <= 3:
        return ", ".join(names)
    return ", ".join(names[:3]) + " et al."


async def fetch_pubmed_articles(symbol: str) -> dict | None:
    cache_key = CACHE_KEY.format(symbol=symbol.upper())
    redis_client = await get_redis()

    cached = await cache_get(redis_client, cache_key)
    if cached is not None:
        logger.info("PubMed cache hit for %s", symbol)
        return cached

    logger.info("Fetching PubMed data for %s", symbol)

    base_params: dict = {}
    if settings.ncbi_api_key:
        base_params["api_key"] = settings.ncbi_api_key

    # Step 1: Search for PMIDs
    search_url = f"{settings.pubmed_base_url}/esearch.fcgi"
    search_params = {
        **base_params,
        "db": "pubmed",
        "term": f"{symbol}[gene] AND human[organism]",
        "retmax": "10",
        "sort": "date",
        "retmode": "json",
    }

    try:
        search_data = await fetch_json(search_url, params=search_params)
    except (httpx.HTTPStatusError, httpx.ConnectError, httpx.ReadTimeout, httpx.ConnectTimeout) as exc:
        logger.error("PubMed search error for %s: %s", symbol, exc)
        return None

    esearch = search_data.get("esearchresult", {})
    id_list = esearch.get("idlist", [])
    total_results = int(esearch.get("count", 0))

    if not id_list:
        logger.info("No PubMed articles found for %s", symbol)
        result: dict = {"articles": [], "total_results": 0}
        await cache_set(redis_client, cache_key, result)
        return result

    # Respect NCBI rate limits (3 req/sec without API key, 10/sec with key)
    # ClinVar esearch also hits eutils concurrently, so we need a longer gap
    await asyncio.sleep(1.0 if not settings.ncbi_api_key else 0.2)

    # Step 2: Fetch article details via XML
    fetch_url = f"{settings.pubmed_base_url}/efetch.fcgi"
    fetch_params = {
        **base_params,
        "db": "pubmed",
        "id": ",".join(id_list),
        "retmode": "xml",
    }

    try:
        xml_text = await fetch_text(fetch_url, params=fetch_params)
    except (httpx.HTTPStatusError, httpx.ConnectError, httpx.ReadTimeout, httpx.ConnectTimeout) as exc:
        logger.error("PubMed fetch error for %s: %s", symbol, exc)
        return None

    try:
        root = ElementTree.fromstring(xml_text)
    except ElementTree.ParseError as exc:
        logger.error("PubMed XML parse error for %s: %s", symbol, exc)
        return None

    articles = []
    for article_elem in root.findall(".//PubmedArticle"):
        medline = article_elem.find("MedlineCitation")
        if medline is None:
            continue

        pmid = medline.findtext("PMID", "")
        article = medline.find("Article")
        if article is None:
            continue

        title = article.findtext("ArticleTitle", "")

        # Authors
        author_list_elem = article.find("AuthorList")
        author_elems = author_list_elem.findall("Author") if author_list_elem is not None else []
        authors = _format_authors(author_elems)

        # Journal
        journal_elem = article.find("Journal")
        journal = ""
        if journal_elem is not None:
            journal = journal_elem.findtext("Title", "")
            if not journal:
                journal = journal_elem.findtext("ISOAbbreviation", "")

        # Year
        year = ""
        pub_date = None
        if journal_elem is not None:
            pub_date = journal_elem.find(".//PubDate")
        if pub_date is not None:
            year = pub_date.findtext("Year", "")
            if not year:
                medline_date = pub_date.findtext("MedlineDate", "")
                if medline_date:
                    year = medline_date[:4]

        # Abstract
        abstract_elem = article.find("Abstract")
        abstract_text = ""
        if abstract_elem is not None:
            parts = []
            for at in abstract_elem.findall("AbstractText"):
                text = at.text or ""
                if text:
                    parts.append(text)
            abstract_text = " ".join(parts)

        abstract_snippet = abstract_text[:200] + "..." if len(abstract_text) > 200 else abstract_text

        articles.append({
            "pmid": pmid,
            "title": title,
            "authors": authors,
            "journal": journal,
            "year": year,
            "pubmed_link": f"https://pubmed.ncbi.nlm.nih.gov/{pmid}/",
            "abstract_snippet": abstract_snippet,
        })

    result = {
        "articles": articles,
        "total_results": total_results,
    }

    await cache_set(redis_client, cache_key, result)
    logger.info("PubMed data cached for %s (%d articles)", symbol, len(articles))
    return result
