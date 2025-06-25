import re
import time
from typing import List
from collections import Counter
import nltk
from config import config


def setup_nltk():
    """Download required NLTK data if not present"""
    try:
        nltk.data.find('tokenizers/punkt')
    except LookupError:
        nltk.download('punkt')

    try:
        nltk.data.find('corpora/stopwords')
    except LookupError:
        nltk.download('stopwords')


def clean_text(text: str) -> str:
    """Clean and normalize text"""
    return re.sub(r'\s+', ' ', text.strip())


def chunk_text(text: str, max_chunk_size: int = None) -> List[str]:
    """Split text into chunks for processing"""
    if max_chunk_size is None:
        max_chunk_size = config.max_chunk_size
        
    sentences = nltk.sent_tokenize(text)
    chunks = []
    current_chunk = ""
    
    for sentence in sentences:
        if len(current_chunk) + len(sentence) > max_chunk_size:
            if current_chunk:
                chunks.append(current_chunk.strip())
            current_chunk = sentence
        else:
            current_chunk += " " + sentence
    
    if current_chunk:
        chunks.append(current_chunk.strip())
    
    return chunks


def extract_keywords(text: str, min_length: int = 3) -> Counter:
    """Extract keywords from text using frequency analysis"""
    words = nltk.word_tokenize(text.lower())
    words = [w for w in words if w.isalnum() and len(w) > min_length]
    return Counter(words)


def measure_time(func):
    """Decorator to measure execution time"""
    def wrapper(*args, **kwargs):
        start_time = time.time()
        result = func(*args, **kwargs)
        execution_time = (time.time() - start_time) * 1000
        return result, execution_time
    return wrapper 