FROM python:3.11-slim

WORKDIR /app

# Instalar dependencias del sistema mínimas
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    && rm -rf /var/lib/apt/lists/*

# Copiar e instalar requirements
COPY requirements-cloudrun.txt .
RUN pip install --no-cache-dir -r requirements-cloudrun.txt

# Copiar el código fuente
COPY server.py .

# Cloud Run setea $PORT automáticamente (8080 por defecto)
ENV PORT=8080
EXPOSE 8080

# Arrancar con uvicorn, usando $PORT como require Cloud Run
CMD exec uvicorn server:app --host 0.0.0.0 --port ${PORT}
