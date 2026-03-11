import json
from typing import Any

import redis.asyncio as redis

from app.core.config import settings


async def cache_get(redis_client: redis.Redis, key: str) -> Any | None:
    raw = await redis_client.get(key)
    if raw is None:
        return None
    return json.loads(raw)


async def cache_set(
    redis_client: redis.Redis,
    key: str,
    value: Any,
    ttl: int | None = None,
) -> None:
    if ttl is None:
        ttl = settings.redis_cache_ttl
    await redis_client.set(key, json.dumps(value, default=str), ex=ttl)
