FROM python:3.9-slim

WORKDIR /app

# Install system dependencies
RUN apt-get update && apt-get install -y \
    gcc \
    g++ \
    git \
    && rm -rf /var/lib/apt/lists/*

# Copy requirements and install Python dependencies
COPY requirements.txt .
RUN pip install --no-cache-dir --upgrade pip && \
    pip install --no-cache-dir -r requirements.txt

# Clone PaPaGei repository (if needed for imports)
# Note: Model weights should be mounted or downloaded separately
RUN git clone https://github.com/Nokia-Bell-Labs/papagei-foundation-model.git /tmp/papagei && \
    export PYTHONPATH=/tmp/papagei:$PYTHONPATH || true

# Copy application code
COPY . .

# Create weights directory
RUN mkdir -p weights

# Set environment variables
ENV PYTHONPATH=/app:/tmp/papagei
ENV MODEL_PATH=/app/weights/papagei_s.pt
ENV DEVICE=cpu

# Expose port
EXPOSE 8000

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
  CMD python -c "import requests; requests.get('http://localhost:8000/api/health')" || exit 1

# Run application
CMD ["python", "-m", "uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000"]
