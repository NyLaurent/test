FROM python:3.12-slim

WORKDIR /app

COPY pyproject.toml ./
COPY backend/ ./backend/
COPY seed/users.json ./seed/users.json
RUN pip install --no-cache-dir .

CMD ["uvicorn", "app.main:app", "--app-dir", "backend", "--host", "0.0.0.0", "--port", "8000"]
