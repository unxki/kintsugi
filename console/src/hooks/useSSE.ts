import { useState, useEffect, useRef, useCallback } from "react";
import { TelemetryEvent } from "../types/incident";

interface UseSSEReturn {
  isConnected: boolean;
  lastEvent: TelemetryEvent | null;
  reconnectAttempts: number;
  connectionError: string | null;
}

export function useSSE(
  url: string = "/api/v1/telemetry/stream",
  onEvent?: (event: TelemetryEvent) => void
): UseSSEReturn {
  const [isConnected, setIsConnected] = useState<boolean>(false);
  const [lastEvent, setLastEvent] = useState<TelemetryEvent | null>(null);
  const [reconnectAttempts, setReconnectAttempts] = useState<number>(0);
  const [connectionError, setConnectionError] = useState<string | null>(null);

  const onEventRef = useRef(onEvent);
  onEventRef.current = onEvent;

  const eventSourceRef = useRef<EventSource | null>(null);
  const reconnectTimeoutRef = useRef<number | null>(null);

  const connect = useCallback(() => {
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
    }

    try {
      const es = new EventSource(url);
      eventSourceRef.current = es;

      es.onopen = () => {
        setIsConnected(true);
        setConnectionError(null);
        setReconnectAttempts(0);
      };

      const handleRawMessage = (e: MessageEvent, type: string) => {
        try {
          const parsed = JSON.parse(e.data);
          const telemetryEvent: TelemetryEvent = {
            event_type: type || parsed.event_type || "message",
            incident_id: parsed.incident_id,
            timestamp: parsed.timestamp || new Date().toISOString(),
            data: parsed.data || parsed,
          };
          setLastEvent(telemetryEvent);
          if (onEventRef.current) {
            onEventRef.current(telemetryEvent);
          }
        } catch (err) {
          console.warn("[SSE] Failed to parse message event:", e.data);
        }
      };

      // Register standard and custom event listeners
      const eventTypes = [
        "incident.detected",
        "incident.diagnosing",
        "incident.diagnosed",
        "incident.remediating",
        "incident.resolved",
        "incident.failed",
        "incident.escalated",
        "connection.established",
        "node.heartbeat",
        "stats.update",
      ];

      eventTypes.forEach((evtType) => {
        es.addEventListener(evtType, (e: Event) => {
          handleRawMessage(e as MessageEvent, evtType);
        });
      });

      es.onmessage = (e: MessageEvent) => {
        handleRawMessage(e, "message");
      };

      es.onerror = () => {
        setIsConnected(false);
        setConnectionError("Connection lost. Retrying in background...");
        es.close();

        // Reconnect with backoff
        const delay = Math.min(1000 * Math.pow(1.5, reconnectAttempts), 10000);
        setReconnectAttempts((prev) => prev + 1);

        if (reconnectTimeoutRef.current) {
          clearTimeout(reconnectTimeoutRef.current);
        }
        reconnectTimeoutRef.current = window.setTimeout(() => {
          connect();
        }, delay);
      };
    } catch (err) {
      setIsConnected(false);
      setConnectionError(String(err));
    }
  }, [url, reconnectAttempts]);

  useEffect(() => {
    connect();
    return () => {
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
      }
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }
    };
  }, [url]);

  return {
    isConnected,
    lastEvent,
    reconnectAttempts,
    connectionError,
  };
}
