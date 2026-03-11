import httpx
from tenacity import retry, stop_after_attempt, wait_exponential, retry_if_exception_type

_client: httpx.AsyncClient | None = None

TIMEOUT = httpx.Timeout(15.0, connect=10.0)


def get_http_client() -> httpx.AsyncClient:
    global _client
    if _client is None or _client.is_closed:
        _client = httpx.AsyncClient(
            timeout=TIMEOUT,
            follow_redirects=True,
            headers={"Accept": "application/json"},
        )
    return _client


async def close_http_client() -> None:
    global _client
    if _client is not None and not _client.is_closed:
        await _client.aclose()
        _client = None


@retry(
    stop=stop_after_attempt(3),
    wait=wait_exponential(multiplier=1, min=1, max=8),
    retry=retry_if_exception_type((httpx.ConnectError, httpx.ReadTimeout, httpx.ConnectTimeout)),
    reraise=True,
)
async def fetch_json(url: str, params: dict | None = None, headers: dict | None = None) -> dict | list:
    client = get_http_client()
    response = await client.get(url, params=params, headers=headers)
    response.raise_for_status()
    return response.json()


@retry(
    stop=stop_after_attempt(3),
    wait=wait_exponential(multiplier=1, min=1, max=8),
    retry=retry_if_exception_type((httpx.ConnectError, httpx.ReadTimeout, httpx.ConnectTimeout)),
    reraise=True,
)
async def post_json(url: str, json_body: dict, headers: dict | None = None) -> dict | list:
    client = get_http_client()
    response = await client.post(url, json=json_body, headers=headers)
    response.raise_for_status()
    return response.json()


@retry(
    stop=stop_after_attempt(3),
    wait=wait_exponential(multiplier=1, min=1, max=8),
    retry=retry_if_exception_type((httpx.ConnectError, httpx.ReadTimeout, httpx.ConnectTimeout)),
    reraise=True,
)
async def fetch_text(url: str, params: dict | None = None, headers: dict | None = None) -> str:
    client = get_http_client()
    response = await client.get(url, params=params, headers=headers)
    response.raise_for_status()
    return response.text
