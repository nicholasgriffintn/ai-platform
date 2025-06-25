from typing import List
from textblob import TextBlob
import spacy
from transformers import pipeline

from models import SentimentResult, EntityResult, LanguageResult
from config import config
from utils import setup_nltk, clean_text, chunk_text, extract_keywords

# Initialize NLTK
setup_nltk()


class NLPProcessor:
    def __init__(self):
        self.nlp = None
        self.sentiment_analyzer = None
        self.summarizer = None
        self._initialize_models()

    def _initialize_models(self):
        """Initialize NLP models lazily"""
        try:
            self.nlp = spacy.load(config.spacy_model)
        except OSError:
            print(f"Warning: spaCy model {config.spacy_model} not found, using basic NLP")
            self.nlp = None

        try:
            self.sentiment_analyzer = pipeline(
                "sentiment-analysis",
                model=config.sentiment_model,
                return_all_scores=True
            )
        except Exception as e:
            print(f"Warning: Could not load sentiment analyzer: {e}")
            self.sentiment_analyzer = None

        try:
            self.summarizer = pipeline(
                "summarization",
                model=config.summarizer_config.name,
                max_length=config.summarizer_config.max_length,
                min_length=config.summarizer_config.min_length,
                do_sample=config.summarizer_config.do_sample
            )
        except Exception as e:
            print(f"Warning: Could not load summarizer: {e}")
            self.summarizer = None

    def summarize_text(self, text: str, max_length: int = None) -> str:
        """Generate a summary of the input text"""
        if max_length is None:
            max_length = config.summary_max_length
            
        if not text or len(text.strip()) < 50:
            return text

        text = clean_text(text)
        
        if self.summarizer and len(text) > 200:
            try:
                chunks = chunk_text(text)
                summaries = []
                
                for chunk in chunks[:3]:
                    result = self.summarizer(
                        chunk, 
                        max_length=min(max_length//len(chunks), 130), 
                        min_length=20
                    )
                    summaries.append(result[0]['summary_text'])
                
                return ' '.join(summaries)
            except Exception as e:
                print(f"Summarization failed: {e}")
                
        return self._extractive_summary(text, max_length)

    def _extractive_summary(self, text: str, max_length: int) -> str:
        """Simple extractive summarization using sentence ranking"""
        import nltk
        
        sentences = nltk.sent_tokenize(text)
        if len(sentences) <= 2:
            return text

        word_freq = extract_keywords(text)
        sentence_scores = {}
        
        for sentence in sentences:
            words = nltk.word_tokenize(sentence.lower())
            score = sum(word_freq[w] for w in words if w in word_freq)
            sentence_scores[sentence] = score

        top_sentences = sorted(sentence_scores.items(), key=lambda x: x[1], reverse=True)
        summary_sentences = [s[0] for s in top_sentences[:min(3, len(sentences)//2)]]
        
        summary = []
        for sentence in sentences:
            if sentence in summary_sentences:
                summary.append(sentence)
        
        summary_text = ' '.join(summary)
        if len(summary_text) > max_length:
            summary_text = summary_text[:max_length] + "..."
            
        return summary_text

    def analyze_sentiment(self, text: str) -> SentimentResult:
        """Analyze sentiment of the input text"""
        if not text:
            return SentimentResult(score=0.0, label="neutral", confidence=0.0)

        if self.sentiment_analyzer:
            try:
                results = self.sentiment_analyzer(text[:512])  # Limit input length
                
                # Convert transformer output to our format
                best_result = max(results[0], key=lambda x: x['score'])
                
                label = config.sentiment_label_mapping.get(
                    best_result['label'], 
                    best_result['label'].lower()
                )
                score = best_result['score']
                
                # Convert to -1 to 1 scale
                if label == 'negative':
                    score = -score
                elif label == 'neutral':
                    score = 0.0
                
                return SentimentResult(score=score, label=label, confidence=best_result['score'])
                
            except Exception as e:
                print(f"Transformer sentiment analysis failed: {e}")

        # Fallback to TextBlob
        blob = TextBlob(text)
        polarity = blob.sentiment.polarity
        
        if polarity > 0.1:
            label = "positive"
        elif polarity < -0.1:
            label = "negative"
        else:
            label = "neutral"
            
        return SentimentResult(
            score=polarity,
            label=label,
            confidence=abs(polarity)
        )

    def extract_entities(self, text: str) -> List[EntityResult]:
        """Extract named entities from text"""
        entities = []
        
        if self.nlp:
            try:
                doc = self.nlp(text[:1000])  # Limit input length
                for ent in doc.ents:
                    entities.append(EntityResult(
                        text=ent.text,
                        label=ent.label_,
                        confidence=0.9  # spaCy doesn't provide confidence scores
                    ))
                return entities
            except Exception as e:
                print(f"spaCy entity extraction failed: {e}")

        # Fallback to TextBlob
        blob = TextBlob(text)
        for noun_phrase in blob.noun_phrases:
            if len(noun_phrase) > 2 and noun_phrase.replace(' ', '').isalpha():
                entities.append(EntityResult(
                    text=noun_phrase,
                    label="NOUN_PHRASE",
                    confidence=0.7
                ))
        
        return entities[:config.max_entities]

    def detect_language(self, text: str) -> LanguageResult:
        """Detect the language of the input text"""
        try:
            blob = TextBlob(text)
            detected = blob.detect_language()
            return LanguageResult(code=detected, confidence=0.8)
        except Exception:
            return LanguageResult(code="en", confidence=0.5)

