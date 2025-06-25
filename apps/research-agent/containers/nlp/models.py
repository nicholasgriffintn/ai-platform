from dataclasses import dataclass
from typing import List, Optional
from pydantic import BaseModel, Field


@dataclass
class SentimentResult:
    score: float
    label: str
    confidence: float


@dataclass
class EntityResult:
    text: str
    label: str
    confidence: float


@dataclass
class LanguageResult:
    code: str
    confidence: float


class NLPTask(BaseModel):
    text: str = Field(..., description="Text to process")
    operations: List[str] = Field(..., description="Operations to perform: summarize, sentiment, entities, language")


class NLPResult(BaseModel):
    summary: Optional[str] = None
    sentiment: Optional[SentimentResult] = None
    entities: Optional[List[EntityResult]] = None
    language: Optional[LanguageResult] = None


class AgentResponse(BaseModel):
    success: bool
    data: Optional[NLPResult] = None
    error: Optional[str] = None
    processing_time_ms: float 