package main

import (
	"fmt"
	"time"
)

type WorkerSession struct {
	SessionID string
	Handler   *struct{ Name string }
}

func main() {
	fmt.Println("⚡ [CHAOS SIMULATION] Auth Service Booting...")
	fmt.Println("Config loaded with API Key sk-proj993848201849201849281928")
	time.Sleep(500 * time.Millisecond)

	var session *WorkerSession = nil
	fmt.Println("[CHAOS] Processing user authentication request...")
	// Deliberate nil pointer dereference
	fmt.Printf("Session Name: %s\n", session.Handler.Name)
}
