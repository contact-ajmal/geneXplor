from fastapi import HTTPException, status


class GeneNotFoundError(HTTPException):
    def __init__(self, symbol: str) -> None:
        super().__init__(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Gene '{symbol}' not found in Ensembl database.",
        )


class InvalidGeneSymbolError(HTTPException):
    def __init__(self, symbol: str) -> None:
        super().__init__(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Invalid gene symbol '{symbol}'. Must be uppercase alphanumeric (e.g., TP53, BRCA1).",
        )


class ExternalAPIError(HTTPException):
    def __init__(self, service: str, detail: str | None = None) -> None:
        msg = f"Error fetching data from {service}."
        if detail:
            msg += f" {detail}"
        super().__init__(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=msg,
        )
