FROM python:3.11-slim

WORKDIR /app

# Install system dependencies
RUN apt-get update && apt-get install -y \
    gcc \
    g++ \
    && rm -rf /var/lib/apt/lists/*

# Copy requirements first for better caching
COPY nlp/requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Download NLTK data and spaCy model
RUN python -c "import nltk; nltk.download('punkt'); nltk.download('stopwords')"
RUN python -m spacy download en_core_web_sm

# Copy application code
COPY nlp/ .

EXPOSE 8080

CMD ["python", "main.py"]