from fastapi import FastAPI

from app.api.router import api_router
from app.core.logging import configure_logging, log_requests

configure_logging()

app = FastAPI(title="Dataset Request Desk API", version="0.1.0")
app.middleware("http")(log_requests)
app.include_router(api_router, prefix="/api")


@app.get("/health", tags=["health"])
def health_check() -> dict[str, str]:
    return {"status": "healthy"}
