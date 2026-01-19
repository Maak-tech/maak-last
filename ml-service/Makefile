# Makefile for PPG ML Service

.PHONY: help setup install test run clean download-model

help:
	@echo "PPG ML Service - Available commands:"
	@echo "  make setup          - Set up virtual environment and install dependencies"
	@echo "  make install        - Install Python dependencies"
	@echo "  make download-model - Download PaPaGei model weights"
	@echo "  make test           - Run test suite"
	@echo "  make run            - Start the service"
	@echo "  make clean          - Clean up generated files"
	@echo "  make docker-build   - Build Docker image"
	@echo "  make docker-run     - Run Docker container"

setup:
	@echo "Setting up PPG ML Service..."
	@python3 -m venv venv || python -m venv venv
	@. venv/bin/activate && pip install --upgrade pip && pip install -r requirements.txt
	@mkdir -p weights
	@echo "✅ Setup complete!"
	@echo "Run 'make download-model' to download model weights"

install:
	@. venv/bin/activate && pip install -r requirements.txt

download-model:
	@python download_model.py

test:
	@. venv/bin/activate && python test_service.py

run:
	@. venv/bin/activate && python main.py

clean:
	@echo "Cleaning up..."
	@rm -rf __pycache__ */__pycache__ */*/__pycache__
	@rm -rf *.pyc */*.pyc */*/*.pyc
	@rm -rf .pytest_cache .coverage htmlcov
	@echo "✅ Clean complete"

docker-build:
	@echo "Building Docker image..."
	@docker build -t ppg-ml-service .
	@echo "✅ Docker image built"

docker-run:
	@echo "Running Docker container..."
	@docker run -p 8000:8000 -v $(PWD)/weights:/app/weights ppg-ml-service
