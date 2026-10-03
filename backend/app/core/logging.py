import json
import logging
import time

from fastapi import Request
from starlette.responses import Response
from starlette.types import RequestResponseEndpoint

request_logger = logging.getLogger("dataset_request_desk.requests")


def configure_logging() -> None:
    logging.basicConfig(level=logging.INFO, format="%(message)s")


async def log_requests(
    request: Request, call_next: RequestResponseEndpoint
) -> Response:
    started_at = time.perf_counter()
    status_code = 500
    try:
        response = await call_next(request)
        status_code = response.status_code
        return response
    finally:
        log_entry = {
            "method": request.method,
            "path": request.url.path,
            "status": status_code,
            "duration_ms": round((time.perf_counter() - started_at) * 1000, 2),
            "user_id": getattr(request.state, "user_id", None),
        }
        request_logger.info(json.dumps(log_entry, separators=(",", ":")))
