package main

import (
	"context"
	"log"
	"os"
	"os/signal"
	"syscall"
	"time"

	"github.com/kintsugi/sentinel/internal/config"
	"github.com/kintsugi/sentinel/internal/dispatcher"
	"github.com/kintsugi/sentinel/internal/docker"
	"github.com/kintsugi/sentinel/internal/guardrail"
	"github.com/kintsugi/sentinel/internal/remediation"
	"github.com/kintsugi/sentinel/internal/sanitizer"
	"github.com/kintsugi/sentinel/internal/server"
)

func main() {
	log.Println("==================================================")
	log.Println("⚡ KINTSUGI SENTINEL DAEMON — Autonomous Node SRE")
	log.Println("==================================================")

	cfg := config.Load()
	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()

	// 1. Initialize Subsystems
	san := sanitizer.New()
	flappingDetector := guardrail.NewFlappingDetector(cfg.FlapThreshold, cfg.FlapWindowDuration)
	coreClient := dispatcher.New(cfg.CoreAPIEndpoint)

	// 2. Connect to Docker Engine
	dockerMonitor, err := docker.NewMonitor()
	if err != nil {
		log.Fatalf("[FATAL] Failed to initialize Docker monitor: %v", err)
	}

	if err := dockerMonitor.Ping(ctx); err != nil {
		log.Printf("[WARN] Docker daemon unreachable initially. Will retry during event streaming: %v", err)
	} else {
		log.Println("[INFO] Connected successfully to Docker runtime socket.")
	}

	executor := remediation.NewExecutor(dockerMonitor.Cli)
	controlServer := server.New(cfg.ServerPort, executor)

	// 3. Start Local HTTP Control Server
	go func() {
		if err := controlServer.Start(); err != nil && err.Error() != "http: Server closed" {
			log.Printf("[ERROR] Control server encountered error: %v", err)
		}
	}()

	// 4. Start Container Heartbeat Loop
	go func() {
		ticker := time.NewTicker(cfg.HeartbeatInterval)
		defer ticker.Stop()

		for {
			select {
			case <-ctx.Done():
				return
			case <-ticker.C:
				containers, err := dockerMonitor.ListContainers(ctx)
				if err != nil {
					continue
				}
				for _, c := range containers {
					name := ""
					if len(c.Names) > 0 {
						name = c.Names[0]
					}
					_ = coreClient.SendHeartbeat(ctx, dispatcher.ContainerHeartbeat{
						ContainerID:   c.ID[:12],
						ContainerName: name,
						Image:         c.Image,
						Status:        c.State,
						CPUPercent:    1.2,
						MemoryUsageMB: 128.0,
						MemoryLimitMB: 512.0,
						RestartCount:  0,
					})
				}
			}
		}
	}()

	// 5. Start Real-time Docker Event Stream Listener
	go func() {
		log.Println("[SENTINEL] Actively listening for container failure events (die, oom, kill, unhealthy)...")
		eventChan, errChan := dockerMonitor.StreamEvents(ctx)

		for {
			select {
			case <-ctx.Done():
				return
			case err := <-errChan:
				if err != nil {
					log.Printf("[WARN] Docker event stream error: %v. Reconnecting in 3s...", err)
					time.Sleep(3 * time.Second)
					eventChan, errChan = dockerMonitor.StreamEvents(ctx)
				}
			case msg, ok := <-eventChan:
				if !ok {
					return
				}

				// Filter for abnormal termination
				failure, isFailure := docker.ParseEvent(msg)
				if !isFailure || failure == nil {
					continue
				}

				log.Printf("[ALERT] Container failure detected! Name: %s, Action: %s, ExitCode: %d",
					failure.ContainerName, failure.Action, failure.ExitCode)

				// Check Flapping Guardrail
				isFlapping, crashCount := flappingDetector.RecordCrash(failure.ContainerName)
				if isFlapping {
					log.Printf("[GUARDRAIL TRIPPED] Container '%s' has crashed %d times in sliding window. Flapping flag enabled.",
						failure.ContainerName, crashCount)
				}

				// Fetch Tail Logs
				tailLogs, err := docker.FetchTailLogs(ctx, dockerMonitor.Cli, failure.ContainerID, cfg.LogTailLines)
				if err != nil {
					log.Printf("[WARN] Could not retrieve tail logs for container %s: %v", failure.ContainerName, err)
					tailLogs = "[SENTINEL: Tail log extraction failed or container removed]"
				}

				// Sanitize Logs locally (strip tokens, keys, passwords)
				sanitized := san.Sanitize(tailLogs)

				// Dispatch to Kintsugi Core
				payload := dispatcher.IncidentPayload{
					ContainerID:       failure.ContainerID,
					ContainerName:     failure.ContainerName,
					Image:             failure.Image,
					ExitCode:          failure.ExitCode,
					TerminationReason: failure.Action,
					SanitizedLog:      sanitized,
					IsFlapping:        isFlapping,
					RestartCount:      crashCount,
					Metadata: map[string]interface{}{
						"attributes": failure.Attributes,
					},
				}

				go func(p dispatcher.IncidentPayload) {
					dispatchCtx, dispatchCancel := context.WithTimeout(context.Background(), 10*time.Second)
					defer dispatchCancel()
					if err := coreClient.DispatchIncident(dispatchCtx, p); err != nil {
						log.Printf("[ERROR] Failed to dispatch incident for %s: %v", p.ContainerName, err)
					}
				}(payload)
			}
		}
	}()

	// 6. Graceful Shutdown Signal Handling
	sigChan := make(chan os.Signal, 1)
	signal.Notify(sigChan, os.Interrupt, syscall.SIGTERM)
	<-sigChan

	log.Println("[SHUTDOWN] Received termination signal. Draining Sentinel daemon...")
	cancel()

	shutdownCtx, shutdownCancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer shutdownCancel()
	_ = controlServer.Shutdown(shutdownCtx)

	log.Println("[SHUTDOWN] Kintsugi Sentinel stopped cleanly.")
}
