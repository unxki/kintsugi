package main

import (
	"fmt"
	"time"
)

func main() {
	fmt.Println("⚡ [CHAOS SIMULATION] Starting memory leak workload...")
	fmt.Println("Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIn0.sampleSecretToken")
	fmt.Println("Connecting to postgresql://analytics_user:superSecretPassword99@db.internal:5432/analytics")

	var memoryHog [][]byte
	for i := 1; i <= 200; i++ {
		// Allocate 10MB chunks
		chunk := make([]byte, 10*1024*1024)
		for j := range chunk {
			chunk[j] = 1
		}
		memoryHog = append(memoryHog, chunk)
		fmt.Printf("[CHAOS] Allocated %d MB resident memory...\n", i*10)
		time.Sleep(100 * time.Millisecond)
	}

	fmt.Printf("Total allocated: %d MB\n", len(memoryHog)*10)
}
