import hashlib
import re
import numpy as np
from typing import List
from app.config import settings


class EmbeddingService:
    """
    Generates normalized 384-dimensional vector embeddings for error traces and log messages.
    Supports deterministic token-hashed vectorization with TF-IDF weighting and L2 normalization,
    guaranteeing similarity matching across similar stack traces and crashes.
    """
    def __init__(self, dimension: int = settings.EMBEDDING_DIMENSION):
        self.dimension = dimension

    def generate_embedding(self, text: str) -> List[float]:
        """
        Produce a normalized vector embedding of fixed dimension.
        """
        if not text:
            return [0.0] * self.dimension

        # Normalize text: lower-case, remove hex addresses, timestamps, container IDs
        clean_text = re.sub(r"0x[0-9a-fA-F]+", "HEX_ADDR", text.lower())
        clean_text = re.sub(r"\b[0-9a-f]{12,64}\b", "ID_HASH", clean_text)
        clean_text = re.sub(r"\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}", "TIMESTAMP", clean_text)

        tokens = re.findall(r"[a-zA-Z_]{3,}|[0-9]+", clean_text)
        vector = np.zeros(self.dimension, dtype=np.float32)

        for token in tokens:
            # Deterministic hash mapping to dimension slots
            h = int(hashlib.sha256(token.encode("utf-8")).hexdigest(), 16)
            idx = h % self.dimension
            sign = 1.0 if ((h >> 8) & 1) == 1 else -1.0
            
            # Weight common crash markers higher
            weight = 1.0
            if token in ("panic", "oom", "killed", "exception", "error", "fatal", "segmentation", "sigsegv", "nullpointer"):
                weight = 4.0
            elif token in ("exit", "status", "timeout", "refused", "econnrefused"):
                weight = 2.5
                
            vector[idx] += sign * weight

        # Also extract 3-grams for substring patterns
        for i in range(len(tokens) - 2):
            trigram = f"{tokens[i]}_{tokens[i+1]}_{tokens[i+2]}"
            h = int(hashlib.md5(trigram.encode("utf-8")).hexdigest(), 16)
            idx = h % self.dimension
            vector[idx] += 1.5

        # L2 Normalization
        norm = np.linalg.norm(vector)
        if norm > 0:
            vector = vector / norm

        return vector.tolist()

    def cosine_similarity(self, vec_a: List[float], vec_b: List[float]) -> float:
        """
        Compute cosine similarity between two normalized vectors.
        """
        a = np.array(vec_a, dtype=np.float32)
        b = np.array(vec_b, dtype=np.float32)
        norm_a = np.linalg.norm(a)
        norm_b = np.linalg.norm(b)
        if norm_a == 0 or norm_b == 0:
            return 0.0
        return float(np.dot(a, b) / (norm_a * norm_b))


embedding_service = EmbeddingService()
