FROM python:3.11-slim

WORKDIR /app/ml

COPY requirements.txt ./requirements.txt
RUN pip install --no-cache-dir -r requirements.txt

COPY artifacts ./artifacts
COPY service ./service
COPY train_export_recommender.py ./train_export_recommender.py
COPY smoke_test_artifact.py ./smoke_test_artifact.py

EXPOSE 8000

CMD ["uvicorn", "service.app:app", "--host", "0.0.0.0", "--port", "8000"]
