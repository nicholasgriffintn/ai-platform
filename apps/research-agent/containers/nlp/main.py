import time
from fastapi import FastAPI, HTTPException
import uvicorn

from nlp_agent import NLPProcessor
from models import NLPTask, NLPResult, AgentResponse, SentimentResult, EntityResult, LanguageResult

app = FastAPI(
    title="NLP Agent", 
    description="Natural Language Processing Agent for AI Orchestrator",
    version="1.0.0"
)

nlp_processor = NLPProcessor()

@app.get("/")
async def root():
    return {
        "name": "NLP Agent",
        "version": "1.0.0",
        "description": "Natural Language Processing capabilities for the AI Agent Orchestrator",
        "capabilities": [
            "Text summarization",
            "Sentiment analysis",
            "Named entity recognition",
            "Language detection"
        ]
    }

@app.get("/health")
async def health_check():
    return {"status": "healthy", "timestamp": time.time()}

@app.post("/process", response_model=AgentResponse)
async def process_text(task: NLPTask):
    """Process text with requested NLP operations"""
    start_time = time.time()
    
    try:
        if not task.text or not task.text.strip():
            raise HTTPException(status_code=400, detail="Text is required")
        
        if not task.operations:
            raise HTTPException(status_code=400, detail="At least one operation is required")
        
        result = NLPResult()
        
        # Process each requested operation
        for operation in task.operations:
            if operation == "summarize":
                result.summary = nlp_processor.summarize_text(task.text)
            
            elif operation == "sentiment":
                sentiment_result = nlp_processor.analyze_sentiment(task.text)
                result.sentiment = SentimentResult(
                    score=sentiment_result.score,
                    label=sentiment_result.label,
                    confidence=sentiment_result.confidence
                )
            
            elif operation == "entities":
                entities = nlp_processor.extract_entities(task.text)
                result.entities = [
                    EntityResult(
                        text=entity.text,
                        label=entity.label,
                        confidence=entity.confidence
                    ) for entity in entities
                ]
            
            elif operation == "language":
                language_result = nlp_processor.detect_language(task.text)
                result.language = LanguageResult(
                    code=language_result.code,
                    confidence=language_result.confidence
                )
            
            else:
                raise HTTPException(
                    status_code=400, 
                    detail=f"Unknown operation: {operation}. Supported: summarize, sentiment, entities, language"
                )
        
        processing_time = (time.time() - start_time) * 1000
        
        return AgentResponse(
            success=True,
            data=result,
            processing_time_ms=processing_time
        )
        
    except HTTPException:
        raise
    except Exception as e:
        processing_time = (time.time() - start_time) * 1000
        return AgentResponse(
            success=False,
            error=f"NLP processing failed: {str(e)}",
            processing_time_ms=processing_time
        )

@app.post("/summarize")
async def summarize_only(text: str):
    """Quick summarization endpoint"""
    start_time = time.time()
    
    try:
        summary = nlp_processor.summarize_text(text)
        processing_time = (time.time() - start_time) * 1000
        
        return {
            "summary": summary,
            "processing_time_ms": processing_time
        }
    except Exception as e:
        return {
            "error": f"Summarization failed: {str(e)}",
            "processing_time_ms": (time.time() - start_time) * 1000
        }

@app.post("/sentiment")
async def analyze_sentiment_only(text: str):
    """Quick sentiment analysis endpoint"""
    start_time = time.time()
    
    try:
        sentiment = nlp_processor.analyze_sentiment(text)
        processing_time = (time.time() - start_time) * 1000
        
        return {
            "sentiment": {
                "score": sentiment.score,
                "label": sentiment.label,
                "confidence": sentiment.confidence
            },
            "processing_time_ms": processing_time
        }
    except Exception as e:
        return {
            "error": f"Sentiment analysis failed: {str(e)}",
            "processing_time_ms": (time.time() - start_time) * 1000
        }

if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=8080)