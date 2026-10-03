from datetime import datetime, timezone

from app.models.episode import Episode
from app.models.user import UserRole
from app.services.auth_service import AuthService
from app.services.episode_import_service import EpisodeImportService

CSV_HEADER = "episode_id,robot_id,task_name,recorded_at,duration_seconds,operator_name,quality\n"
GOOD_ROW = "EP-IMPORT-1,Arm-01,pick cup,2026-09-01T09:00:00Z,42,Ada,GOOD\n"


def test_import_parses_timestamp_and_is_idempotent(db_session) -> None:
    first = EpisodeImportService.import_csv(db_session, CSV_HEADER + GOOD_ROW)
    second = EpisodeImportService.import_csv(db_session, CSV_HEADER + GOOD_ROW)

    assert first.total_rows == 1
    assert first.imported_count == 1
    assert first.skipped_count == 0
    assert second.imported_count == 0
    assert second.skipped_count == 1
    assert second.reasons == ["line 2: already exists"]
    episode = db_session.query(Episode).one()
    assert episode.robot_id == "arm-01"
    assert episode.duration_seconds == 42
    assert EpisodeImportService.parse_recorded_at(GOOD_ROW.split(",")[3]).tzinfo == timezone.utc
    assert episode.recorded_at == datetime(2026, 9, 1, 9, 0)


def test_invalid_row_does_not_poison_later_rows(db_session) -> None:
    csv_text = (
        CSV_HEADER
        + "EP-BAD,arm-01,pick cup,not-a-timestamp,42,Ada,good\n"
        + GOOD_ROW.replace("EP-IMPORT-1", "EP-IMPORT-2")
    )

    summary = EpisodeImportService.import_csv(db_session, csv_text)

    assert summary.total_rows == 2
    assert summary.imported_count == 1
    assert summary.skipped_count == 1
    assert summary.reasons[0].startswith("line 2: invalid recorded_at")
    assert [episode.episode_id for episode in db_session.query(Episode).all()] == ["EP-IMPORT-2"]


def test_import_reports_missing_fields_duplicates_and_bad_duration(db_session) -> None:
    csv_text = (
        CSV_HEADER
        + "EP-DUP,arm-01,pick cup,2026-09-01 09:00:00,42,Ada,good\n"
        + "EP-DUP,arm-02,pick cup,2026-09-01 10:00:00,42,Ada,good\n"
        + "EP-DURATION,arm-02,pick cup,2026-09-01T10:00:00,invalid,Ada,good\n"
        + ",arm-03,pick cup,2026-09-01T11:00:00,20,Ada,good\n"
    )

    summary = EpisodeImportService.import_csv(db_session, csv_text)

    assert summary.imported_count == 1
    assert summary.skipped_count == 3
    assert "duplicate episode_id in file" in summary.reasons[0]
    assert "duration_seconds must be numeric" in summary.reasons[1]
    assert "missing episode_id" in summary.reasons[2]


def test_csv_import_endpoint_requires_operations_role_and_csv_body(client, db_session) -> None:
    AuthService.create_user(
        db_session,
        email="ops@example.com",
        password="StrongPass123!",
        role=UserRole.operator,
    )
    AuthService.create_user(
        db_session,
        email="client@example.com",
        password="StrongPass123!",
        role=UserRole.client,
    )
    denied = client.post("/api/episodes/import", content=CSV_HEADER + GOOD_ROW, headers={"Content-Type": "text/csv"})
    client_token = client.post(
        "/api/auth/login",
        json={"email": "client@example.com", "password": "StrongPass123!"},
    ).json()["access_token"]
    client_response = client.post(
        "/api/episodes/import",
        content=CSV_HEADER + GOOD_ROW,
        headers={"Content-Type": "text/csv", "Authorization": f"Bearer {client_token}"},
    )

    assert denied.status_code == 401
    assert client_response.status_code == 403

    operator_token = client.post(
        "/api/auth/login",
        json={"email": "ops@example.com", "password": "StrongPass123!"},
    ).json()["access_token"]
    imported = client.post(
        "/api/episodes/import",
        content=CSV_HEADER + GOOD_ROW,
        headers={"Content-Type": "text/csv", "Authorization": f"Bearer {operator_token}"},
    )

    assert imported.status_code == 200
    assert imported.json()["imported_count"] == 1
    assert imported.json()["skipped_count"] == 0
