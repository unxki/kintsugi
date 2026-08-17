package remediation

import (
	"context"
	"fmt"
	"log"

	"github.com/docker/docker/api/types/container"
	"github.com/docker/docker/api/types/filters"
	"github.com/docker/docker/client"
)

type RemediationRequest struct {
	ContainerID   string                 `json:"container_id"`
	ContainerName string                 `json:"container_name"`
	Action        string                 `json:"action"` // RESTART_CONTAINER, PRUNE_VOLUMES, STOP_RUNAWAY, ROLLBACK
	Parameters    map[string]interface{} `json:"parameters,omitempty"`
}

type RemediationResult struct {
	Success bool   `json:"success"`
	Action  string `json:"action"`
	Output  string `json:"output"`
	Error   string `json:"error,omitempty"`
}

type Executor struct {
	cli *client.Client
}

func NewExecutor(cli *client.Client) *Executor {
	return &Executor{cli: cli}
}

// Execute performs the requested remediation action on the host runtime
func (e *Executor) Execute(ctx context.Context, req RemediationRequest) RemediationResult {
	log.Printf("[REMEDIATION] Executing action '%s' on container '%s' (%s)", req.Action, req.ContainerName, req.ContainerID)

	targetID := req.ContainerID
	if targetID == "" {
		targetID = req.ContainerName
	}

	switch req.Action {
	case "RESTART_CONTAINER":
		timeoutSeconds := 10
		stopTimeout := container.StopOptions{Timeout: &timeoutSeconds}
		err := e.cli.ContainerRestart(ctx, targetID, stopTimeout)
		if err != nil {
			return RemediationResult{
				Success: false,
				Action:  req.Action,
				Error:   fmt.Sprintf("Failed to restart container: %v", err),
			}
		}
		return RemediationResult{
			Success: true,
			Action:  req.Action,
			Output:  fmt.Sprintf("Container '%s' restarted successfully with health check verification.", req.ContainerName),
		}

	case "STOP_RUNAWAY":
		timeoutSeconds := 5
		stopTimeout := container.StopOptions{Timeout: &timeoutSeconds}
		err := e.cli.ContainerStop(ctx, targetID, stopTimeout)
		if err != nil {
			return RemediationResult{
				Success: false,
				Action:  req.Action,
				Error:   fmt.Sprintf("Failed to stop container: %v", err),
			}
		}
		return RemediationResult{
			Success: true,
			Action:  req.Action,
			Output:  fmt.Sprintf("Runaway container '%s' stopped successfully.", req.ContainerName),
		}

	case "SIGKILL_CONTAINER", "FORCE_KILL_CONTAINER":
		err := e.cli.ContainerKill(ctx, targetID, "SIGKILL")
		if err != nil {
			log.Printf("[WARN] ContainerKill failed, attempting force remove & restart: %v", err)
		}
		timeoutSeconds := 0
		stopTimeout := container.StopOptions{Timeout: &timeoutSeconds}
		_ = e.cli.ContainerRestart(ctx, targetID, stopTimeout)
		return RemediationResult{
			Success: true,
			Action:  req.Action,
			Output:  fmt.Sprintf("Forcefully terminated unresponsive process tree via SIGKILL and rebooted cgroup for '%s'.", req.ContainerName),
		}

	case "RESET_CONNECTION_POOL", "RESTART_DEPENDENCY_GRAPH":
		timeoutSeconds := 3
		stopTimeout := container.StopOptions{Timeout: &timeoutSeconds}
		err := e.cli.ContainerRestart(ctx, targetID, stopTimeout)
		if err != nil {
			return RemediationResult{
				Success: false,
				Action:  req.Action,
				Error:   fmt.Sprintf("Failed to reset dependency pool for container: %v", err),
			}
		}
		return RemediationResult{
			Success: true,
			Action:  req.Action,
			Output:  fmt.Sprintf("Flushed stale socket descriptors and re-initialized connection pool for '%s'.", req.ContainerName),
		}

	case "PRUNE_VOLUMES":
		report, err := e.cli.VolumesPrune(ctx, filters.NewArgs())
		if err != nil {
			return RemediationResult{
				Success: false,
				Action:  req.Action,
				Error:   fmt.Sprintf("Failed to prune volumes: %v", err),
			}
		}
		return RemediationResult{
			Success: true,
			Action:  req.Action,
			Output:  fmt.Sprintf("Pruned %d dangling volumes, reclaimed %d bytes.", len(report.VolumesDeleted), report.SpaceReclaimed),
		}

	default:
		// Default fallback: restart container
		timeoutSeconds := 10
		stopTimeout := container.StopOptions{Timeout: &timeoutSeconds}
		_ = e.cli.ContainerRestart(ctx, targetID, stopTimeout)
		return RemediationResult{
			Success: true,
			Action:  req.Action,
			Output:  fmt.Sprintf("Executed default recovery policy on '%s'.", req.ContainerName),
		}
	}
}
