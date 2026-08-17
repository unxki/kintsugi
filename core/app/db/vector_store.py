from typing import List, Tuple, Optional
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from app.db.models import Incident, IncidentEmbedding
from app.services.embedding_service import embedding_service
from app.config import settings


class VectorStore:
    """
    Abstraction over pgvector and fallback in-memory similarity search for incident stack traces.
    """
    async def find_similar_incidents(
        self,
        db: AsyncSession,
        query_embedding: List[float],
        limit: int = 5,
        similarity_threshold: float = 0.65,
        exclude_incident_id: Optional[str] = None,
    ) -> List[Tuple[Incident, float]]:
        """
        Find historical incidents with similar error signatures.
        """
        # If using PostgreSQL with pgvector
        if "postgres" in settings.DATABASE_URL:
            try:
                # pgvector cosine distance operator is <=>
                # 1 - distance = cosine similarity
                stmt = (
                    select(
                        Incident,
                        (1 - IncidentEmbedding.embedding.cosine_distance(query_embedding)).label("similarity")
                    )
                    .join(IncidentEmbedding, Incident.id == IncidentEmbedding.incident_id)
                    .filter(Incident.status.in_(["RESOLVED", "REMEDIATING", "DETECTED"]))
                )
                if exclude_incident_id:
                    stmt = stmt.filter(Incident.id != exclude_incident_id)
                stmt = stmt.order_by(IncidentEmbedding.embedding.cosine_distance(query_embedding)).limit(limit)
                
                result = await db.execute(stmt)
                rows = result.all()
                return [(row[0], float(row[1])) for row in rows if float(row[1]) >= similarity_threshold]
            except Exception:
                # Fallback to in-memory evaluation
                pass

        # Fallback for SQLite / generic DB: retrieve embeddings and compute cosine similarity
        stmt = select(Incident, IncidentEmbedding).join(
            IncidentEmbedding, Incident.id == IncidentEmbedding.incident_id
        )
        if exclude_incident_id:
            stmt = stmt.filter(Incident.id != exclude_incident_id)

        result = await db.execute(stmt)
        rows = result.all()

        scored_incidents = []
        for inc, emb in rows:
            if emb and emb.embedding:
                score = embedding_service.cosine_similarity(query_embedding, emb.embedding)
                if score >= similarity_threshold:
                    scored_incidents.append((inc, score))

        scored_incidents.sort(key=lambda x: x[1], reverse=True)
        return scored_incidents[:limit]


vector_store = VectorStore()
