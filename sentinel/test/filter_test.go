package test

import (
	"testing"

	"github.com/docker/docker/api/types/events"
	"github.com/kintsugi/sentinel/internal/docker"
)

func TestParseEvent(t *testing.T) {
	// Clean exit (Exit 0) should be ignored
	msgClean := events.Message{
		Type:   events.ContainerEventType,
		Action: "die",
		Actor: events.Actor{
			ID: "c1",
			Attributes: map[string]string{
				"name":     "/web-app",
				"image":    "nginx:alpine",
				"exitCode": "0",
			},
		},
	}
	_, isFailure := docker.ParseEvent(msgClean)
	if isFailure {
		t.Errorf("Expected clean exit 0 to not be marked as failure")
	}

	// Abnormal exit (Exit 137 / OOM) should be caught
	msgOOM := events.Message{
		Type:   events.ContainerEventType,
		Action: "oom",
		Actor: events.Actor{
			ID: "c2",
			Attributes: map[string]string{
				"name":  "/analytics-engine",
				"image": "analytics:latest",
			},
		},
	}
	event, isFailure := docker.ParseEvent(msgOOM)
	if !isFailure || event.ExitCode != 137 || event.Action != "oom" {
		t.Errorf("Expected OOM failure event, got: %+v, isFailure: %v", event, isFailure)
	}

	// Abnormal die (Exit 2) should be caught
	msgPanic := events.Message{
		Type:   events.ContainerEventType,
		Action: "die",
		Actor: events.Actor{
			ID: "c3",
			Attributes: map[string]string{
				"name":     "/auth-service",
				"image":    "auth:v2",
				"exitCode": "2",
			},
		},
	}
	event, isFailure = docker.ParseEvent(msgPanic)
	if !isFailure || event.ExitCode != 2 {
		t.Errorf("Expected panic failure event, got: %+v", event)
	}
}
