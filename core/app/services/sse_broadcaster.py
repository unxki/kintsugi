import asyncio
import json
import logging
from typing import Set, AsyncGenerator
from app.schemas.telemetry import TelemetryEvent

logger = logging.getLogger(__name__)


class SSEBroadcaster:
    """
    Manages active SSE client connections and broadcasts telemetry events asynchronously.
    """
    def __init__(self):
        self.connections: Set[asyncio.Queue] = set()
        self._lock = asyncio.Lock()

    async def register(self) -> asyncio.Queue:
        queue: asyncio.Queue = asyncio.Queue(maxsize=100)
        async with self._lock:
            self.connections.add(queue)
        logger.info(f"Client connected to SSE telemetry stream. Total active: {len(self.connections)}")
        return queue

    async def unregister(self, queue: asyncio.Queue):
        async with self._lock:
            self.connections.discard(queue)
        logger.info(f"Client disconnected from SSE telemetry stream. Total active: {len(self.connections)}")

    async def broadcast(self, event: TelemetryEvent):
        """
        Broadcast an event to all subscribed SSE clients.
        """
        payload = {
            "event_type": event.event_type,
            "incident_id": event.incident_id,
            "timestamp": event.timestamp,
            "data": event.data,
        }
        json_data = json.dumps(payload)
        sse_message = f"event: {event.event_type}\ndata: {json_data}\n\n"

        async with self._lock:
            dead_queues = []
            for queue in self.connections:
                try:
                    queue.put_nowait(sse_message)
                except asyncio.QueueFull:
                    dead_queues.append(queue)
            for dead in dead_queues:
                self.connections.discard(dead)

    async def event_generator(self, queue: asyncio.Queue) -> AsyncGenerator[str, None]:
        """
        Yields messages from the queue and sends periodic keep-alive comments.
        """
        try:
            # Send initial connection handshake
            init_event = TelemetryEvent(
                event_type="connection.established",
                data={"message": "Kintsugi Telemetry Stream Active", "status": "CONNECTED"}
            )
            yield f"event: connection.established\ndata: {json.dumps(init_event.model_dump())}\n\n"

            while True:
                try:
                    # Wait for next event or send ping every 15 seconds
                    message = await asyncio.wait_for(queue.get(), timeout=15.0)
                    yield message
                except asyncio.TimeoutError:
                    # Heartbeat comment to keep connection alive
                    yield ": ping\n\n"
        except asyncio.CancelledError:
            pass
        finally:
            await self.unregister(queue)


# Singleton instance
sse_broadcaster = SSEBroadcaster()
