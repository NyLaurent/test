from __future__ import annotations

from pydantic import BaseModel, ConfigDict


class EpisodeByDayRobot(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    recorded_date: str
    robot_id: str
    episode_count: int


class RequestFulfilment(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    status: str
    request_count: int


class TopTaskByGoodEpisodes(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    task_name: str
    good_episode_count: int


class AnalyticsResponse(BaseModel):
    episodes_by_day_robot: list[EpisodeByDayRobot]
    request_fulfilment: list[RequestFulfilment]
    median_delivery_seconds: int | None
    top_good_tasks: list[TopTaskByGoodEpisodes]
