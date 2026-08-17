package docker

import (
	"context"
	"fmt"
	"log"

	"github.com/docker/docker/api/types"
	"github.com/docker/docker/api/types/container"
	"github.com/docker/docker/api/types/events"
	"github.com/docker/docker/api/types/filters"
	"github.com/docker/docker/client"
)

type DockerMonitor struct {
	Cli *client.Client
}

func NewMonitor() (*DockerMonitor, error) {
	cli, err := client.NewClientWithOpts(
		client.FromEnv,
		client.WithAPIVersionNegotiation(),
	)
	if err != nil {
		return nil, fmt.Errorf("failed to create Docker client: %w", err)
	}

	return &DockerMonitor{Cli: cli}, nil
}

// StreamEvents creates an event channel filtered for container events
func (dm *DockerMonitor) StreamEvents(ctx context.Context) (<-chan events.Message, <-chan error) {
	eventFilter := filters.NewArgs()
	eventFilter.Add("type", string(events.ContainerEventType))

	return dm.Cli.Events(ctx, events.ListOptions{
		Filters: eventFilter,
	})
}

// ListContainers returns active running containers for heartbeat telemetry
func (dm *DockerMonitor) ListContainers(ctx context.Context) ([]types.Container, error) {
	return dm.Cli.ContainerList(ctx, container.ListOptions{All: true})
}

// Ping tests docker socket connectivity
func (dm *DockerMonitor) Ping(ctx context.Context) error {
	_, err := dm.Cli.Ping(ctx)
	if err != nil {
		log.Printf("[WARN] Docker socket ping failed: %v", err)
	}
	return err
}

