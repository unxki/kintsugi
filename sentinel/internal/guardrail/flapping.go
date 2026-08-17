package guardrail

import (
	"sync"
	"time"
)

type FlappingDetector struct {
	mu             sync.Mutex
	crashHistory   map[string][]time.Time
	threshold      int
	windowDuration time.Duration
}

func NewFlappingDetector(threshold int, windowDuration time.Duration) *FlappingDetector {
	return &FlappingDetector{
		crashHistory:   make(map[string][]time.Time),
		threshold:      threshold,
		windowDuration: windowDuration,
	}
}

// RecordCrash records a crash event for a container and checks if it exceeds the flapping threshold.
// Returns (isFlapping bool, totalCrashesInWindow int).
func (fd *FlappingDetector) RecordCrash(containerName string) (bool, int) {
	fd.mu.Lock()
	defer fd.mu.Unlock()

	now := time.Now()
	cutoff := now.Add(-fd.windowDuration)

	// Filter out stale crash records older than windowDuration
	var validTimes []time.Time
	for _, t := range fd.crashHistory[containerName] {
		if t.After(cutoff) {
			validTimes = append(validTimes, t)
		}
	}

	// Add current crash
	validTimes = append(validTimes, now)
	fd.crashHistory[containerName] = validTimes

	crashCount := len(validTimes)
	isFlapping := crashCount >= fd.threshold

	return isFlapping, crashCount
}

// Reset clears the crash history for a container (e.g. after successful manual resolution)
func (fd *FlappingDetector) Reset(containerName string) {
	fd.mu.Lock()
	defer fd.mu.Unlock()
	delete(fd.crashHistory, containerName)
}
