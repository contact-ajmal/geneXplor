"""Search API endpoints."""

from fastapi import APIRouter, Query

from app.core.redis import get_redis
from app.services.search_service import search, autocomplete, suggest

router = APIRouter(prefix="/search", tags=["search"])


@router.get("")
async def search_genes(
    q: str = Query(..., min_length=1, description="Search query"),
    limit: int = Query(20, ge=1, le=100),
    offset: int = Query(0, ge=0),
):
    redis_client = await get_redis()
    result = await search(q, limit=limit, offset=offset, redis_client=redis_client)
    return result.to_dict()


@router.get("/autocomplete")
async def autocomplete_search(
    q: str = Query(..., min_length=1, description="Partial query for autocomplete"),
    limit: int = Query(10, ge=1, le=30),
):
    items = await autocomplete(q, limit=limit)
    return [item.to_dict() for item in items]


@router.get("/suggest")
async def suggest_spelling(
    q: str = Query(..., min_length=2, description="Query for spelling suggestions"),
):
    suggestions = await suggest(q)
    return {"suggestions": suggestions}
