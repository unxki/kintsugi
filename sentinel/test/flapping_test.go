package test

import (
	"testing"
	"time"

	"github.com/kintsugi/sentinel/internal/guardrail"
)

func TestFlappingDetector(t *testing.T) {
	threshold := 3
	window := 500 * time.Millisecond
	fd := guardrail.NewFlappingDetector(threshold, window)

	container := "payment-worker"

	// 1st crash: not flapping
	isFlapping, count := fd.RecordCrash(container)
	if isFlapping || count != 1 {
		t.Errorf("Crash 1: expected (false, 1), got (%v, %d)", isFlapping, count)
	}

	// 2nd crash: not flapping
	isFlapping, count = fd.RecordCrash(container)
	if isFlapping || count != 2 {
		t.Errorf("Crash 2: expected (false, 2), got (%v, %d)", isFlapping, count)
	}

	// 3rd crash: FLAPPING!
	isFlapping, count = fd.RecordCrash(container)
	if !isFlapping || count != 3 {
		t.Errorf("Crash 3: expected (true, 3), got (%v, %d)", isFlapping, count)
	}

	// Wait for window to expire
	time.Sleep(600 * time.Millisecond)

	// 4th crash after window: should reset and count as 1
	isFlapping, count = fd.RecordCrash(container)
	if isFlapping || count != 1 {
		t.Errorf("Crash after window: expected (false, 1), got (%v, %d)", isFlapping, count)
	}
}
