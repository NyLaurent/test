from fastapi import APIRouter

from app.api.routes.auth import router as auth_router
from app.api.routes.episodes import router as episode_router
from app.api.routes.requests import router as request_router

api_router = APIRouter()
api_router.include_router(auth_router)
api_router.include_router(request_router)
api_router.include_router(episode_router)
