from __future__ import annotations

from datetime import date

from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from app.api.deps import require_roles
from app.db.session import get_db
from app.models.user import User, UserRole
from app.schemas.analytics import AnalyticsResponse
from app.services.analytics_service import AnalyticsService

router = APIRouter(prefix="/analytics", tags=["analytics"])


@router.get("", response_model=AnalyticsResponse)
def get_analytics(
    start_date: date | None = Query(default=None),
    end_date: date | None = Query(default=None),
    current_user: User = Depends(require_roles(UserRole.operator.value, UserRole.admin.value)),
    db: Session = Depends(get_db),
) -> AnalyticsResponse:
    return AnalyticsResponse(
        episodes_by_day_robot=AnalyticsService.get_episodes_per_day_per_robot(db, start_date, end_date),
        request_fulfilment=AnalyticsService.get_request_fulfilment(db),
        median_delivery_seconds=AnalyticsService.get_delivery_median_seconds(db),
        top_good_tasks=AnalyticsService.get_top_good_tasks(db),
    )
