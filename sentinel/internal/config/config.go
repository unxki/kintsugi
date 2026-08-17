package config

import (
	"os"
	"strconv"
	"time"
)

type Config struct {
	DockerSocket       string
	CoreAPIEndpoint    string
	ServerPort         int
	LogTailLines       int
	FlapThreshold      int
	FlapWindowDuration time.Duration
	HeartbeatInterval  time.Duration
}

func Load() *Config {
	serverPort, _ := strconv.Atoi(getEnv("PORT", "8081"))
	logTailLines, _ := strconv.Atoi(getEnv("LOG_TAIL_LINES", "100"))
	flapThreshold, _ := strconv.Atoi(getEnv("FLAP_THRESHOLD", "3"))
	flapWindowSec, _ := strconv.Atoi(getEnv("FLAP_WINDOW_SECONDS", "60"))
	heartbeatSec, _ := strconv.Atoi(getEnv("HEARTBEAT_INTERVAL_SECONDS", "10"))

	return &Config{
		DockerSocket:       getEnv("DOCKER_HOST", "unix:///var/run/docker.sock"),
		CoreAPIEndpoint:    getEnv("CORE_API_ENDPOINT", "http://localhost:8000/api/v1"),
		ServerPort:         serverPort,
		LogTailLines:       logTailLines,
		FlapThreshold:      flapThreshold,
		FlapWindowDuration: time.Duration(flapWindowSec) * time.Second,
		HeartbeatInterval:  time.Duration(heartbeatSec) * time.Second,
	}
}

func getEnv(key, defaultVal string) string {
	if val := os.Getenv(key); val != "" {
		return val
	}
	return defaultVal
}
