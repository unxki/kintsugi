package docker

import (
	"strconv"
	"strings"

	"github.com/docker/docker/api/types/events"
)

type FailureEvent struct {
	ContainerID   string
	ContainerName string
	Image         string
	Action        string // die, oom, kill, health_status
	ExitCode      int
	IsFailure     bool
	Attributes    map[string]string
}

// ParseEvent checks if a Docker event signifies an abnormal container termination or failure
func ParseEvent(msg events.Message) (*FailureEvent, bool) {
	if msg.Type != events.ContainerEventType {
		return nil, false
	}

	containerID := msg.Actor.ID
	containerName := strings.TrimPrefix(msg.Actor.Attributes["name"], "/")
	image := msg.Actor.Attributes["image"]

	actionStr := string(msg.Action)

	// Handle OOM
	if actionStr == "oom" {
		return &FailureEvent{
			ContainerID:   containerID,
			ContainerName: containerName,
			Image:         image,
			Action:        "oom",
			ExitCode:      137,
			IsFailure:     true,
			Attributes:    msg.Actor.Attributes,
		}, true
	}

	// Handle Health Status Change
	if strings.HasPrefix(actionStr, "health_status") {
		if strings.Contains(actionStr, "unhealthy") {
			return &FailureEvent{
				ContainerID:   containerID,
				ContainerName: containerName,
				Image:         image,
				Action:        "unhealthy",
				ExitCode:      1,
				IsFailure:     true,
				Attributes:    msg.Actor.Attributes,
			}, true
		}
		return nil, false
	}

	// Handle Container Die
	if actionStr == "die" {
		exitCodeStr := msg.Actor.Attributes["exitCode"]
		exitCode, err := strconv.Atoi(exitCodeStr)
		if err != nil {
			exitCode = 1
		}

		// ExitCode 0 is a clean, intentional graceful shutdown -> Ignore
		if exitCode == 0 {
			return nil, false
		}

		return &FailureEvent{
			ContainerID:   containerID,
			ContainerName: containerName,
			Image:         image,
			Action:        "die",
			ExitCode:      exitCode,
			IsFailure:     true,
			Attributes:    msg.Actor.Attributes,
		}, true
	}

	// Handle Container Kill
	if msg.Action == "kill" {
		signal := msg.Actor.Attributes["signal"]
		// SIGKILL (9) or SIGTERM non-graceful
		if signal == "9" || signal == "SIGKILL" {
			return &FailureEvent{
				ContainerID:   containerID,
				ContainerName: containerName,
				Image:         image,
				Action:        "kill",
				ExitCode:      137,
				IsFailure:     true,
				Attributes:    msg.Actor.Attributes,
			}, true
		}
	}

	return nil, false
}
