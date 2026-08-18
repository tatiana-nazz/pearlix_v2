FROM python:3.13.2-slim

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PORT=8000 \
    DJANGO_SETTINGS_MODULE=config.settings.production \
    DEBUG=false \
    ALLOWED_HOSTS=.b4a.run \
    TIME_ZONE=Asia/Damascus \
    SUPABASE_S3_ENDPOINT_URL=https://nhxcuormtcnnauhhjedm.storage.supabase.co/storage/v1/s3 \
    SUPABASE_S3_REGION=eu-west-1 \
    SUPABASE_S3_BUCKET_NAME=pearlix-media \
    PEARLIX_ALLOW_MOCK_AI=false

WORKDIR /app

COPY requirements.txt ./requirements.txt
RUN python -m pip install --no-cache-dir --upgrade pip \
    && python -m pip install --no-cache-dir -r requirements.txt

COPY . .

EXPOSE 8000

CMD ["sh", "-c", "python manage.py collectstatic --noinput && python manage.py migrate && exec gunicorn config.wsgi:application --bind 0.0.0.0:${PORT:-8000} --workers 1 --threads 2 --timeout 120"]
