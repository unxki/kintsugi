package dispatcher

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"log"
	"net/http"
	"time"
)

type IncidentPayload struct {
	ID                string                 `json:"id,omitempty"`
	ContainerID       string                 `json:"container_id"`
	ContainerName     string                 `json:"container_name"`
	Image             string                 `json:"image"`
	ExitCode          int                    `json:"exit_code"`
	TerminationReason string                 `json:"termination_reason"`
	SanitizedLog      string                 `json:"sanitized_log"`
	RawTailLog        string                 `json:"raw_tail_log,omitempty"`
	IsFlapping        bool                   `json:"is_flapping"`
	RestartCount      int                    `json:"restart_count"`
	Metadata          map[string]interface{} `json:"metadata,omitempty"`
}

type ContainerHeartbeat struct {
	ContainerID   string  `json:"container_id"`
	ContainerName string  `json:"container_name"`
	Image         string  `json:"image"`
	Status        string  `json:"status"`
	CPUPercent    float64 `json:"cpu_percent"`
	MemoryUsageMB float64 `json:"memory_usage_mb"`
	MemoryLimitMB float64 `json:"memory_limit_mb"`
	RestartCount  int     `json:"restart_count"`
}

type CoreDispatcher struct {
	endpoint   string
	httpClient *http.Client
}

func New(endpoint string) *CoreDispatcher {
	return &CoreDispatcher{
		endpoint: endpoint,
		httpClient: &http.Client{
			Timeout: 10 * time.Second,
		},
	}
}

// DispatchIncident sends an incident to Kintsugi Core for AI diagnosis and healing orchestration
func (cd *CoreDispatcher) DispatchIncident(ctx context.Context, payload IncidentPayload) error {
	url := fmt.Sprintf("%s/incidents", cd.endpoint)
	body, err := json.Marshal(payload)
	if err != nil {
		return fmt.Errorf("failed to marshal incident payload: %w", err)
	}

	req, err := http.NewRequestWithContext(ctx, http.MethodPost, url, bytes.NewBuffer(body))
	if err != nil {
		return fmt.Errorf("failed to create http request: %w", err)
	}
	req.Header.Set("Content-Type", "application/json")

	resp, err := cd.httpClient.Do(req)
	if err != nil {
		return fmt.Errorf("error dispatching incident to Kintsugi Core: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode < 200 || resp.StatusCode >= 300 {
		return fmt.Errorf("Kintsugi Core returned status %d for incident %s", resp.StatusCode, payload.ContainerName)
	}

	log.Printf("[DISPATCH] Successfully dispatched incident for container '%s' to Kintsugi Core", payload.ContainerName)
	return nil
}

// SendHeartbeat sends monitored containers state to Kintsugi Core
func (cd *CoreDispatcher) SendHeartbeat(ctx context.Context, hb ContainerHeartbeat) error {
	url := fmt.Sprintf("%s/containers/heartbeat", cd.endpoint)
	body, err := json.Marshal(hb)
	if err != nil {
		return err
	}

	req, err := http.NewRequestWithContext(ctx, http.MethodPost, url, bytes.NewBuffer(body))
	if err != nil {
		return err
	}
	req.Header.Set("Content-Type", "application/json")

	resp, err := cd.httpClient.Do(req)
	if err != nil {
		return err
	}
	defer resp.Body.Close()
	return nil
}
