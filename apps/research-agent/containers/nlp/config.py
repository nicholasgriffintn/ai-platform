from dataclasses import dataclass
from typing import Dict, Any


@dataclass
class ModelConfig:
    name: str
    max_length: int = 512
    min_length: int = 30
    do_sample: bool = False


@dataclass
class NLPConfig:
    spacy_model: str = "en_core_web_sm"
    sentiment_model: str = "cardiffnlp/twitter-roberta-base-sentiment-latest"
    summarization_model: str = "facebook/bart-large-cnn"
    
    # Processing limits
    max_text_length: int = 5000
    max_chunk_size: int = 1000
    max_entities: int = 10
    summary_max_length: int = 150
    
    # Model configurations
    summarizer_config: ModelConfig = ModelConfig(
        name="facebook/bart-large-cnn",
        max_length=150,
        min_length=30,
        do_sample=False
    )
    
    # Label mappings
    sentiment_label_mapping: Dict[str, str] = None
    
    def __post_init__(self):
        if self.sentiment_label_mapping is None:
            self.sentiment_label_mapping = {
                'LABEL_0': 'negative',
                'LABEL_1': 'neutral', 
                'LABEL_2': 'positive',
                'NEGATIVE': 'negative',
                'NEUTRAL': 'neutral',
                'POSITIVE': 'positive'
            }


config = NLPConfig() 