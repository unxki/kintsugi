package docker

import (
	"bytes"
	"context"
	"fmt"
	"strconv"

	"github.com/docker/docker/api/types/container"
	"github.com/docker/docker/client"
	"github.com/docker/docker/pkg/stdcopy"
)

// FetchTailLogs retrieves the latest tail N log lines (stdout + stderr) for a container
func FetchTailLogs(ctx context.Context, cli *client.Client, containerID string, tailLines int) (string, error) {
	options := container.LogsOptions{
		ShowStdout: true,
		ShowStderr: true,
		Tail:       strconv.Itoa(tailLines),
		Timestamps: true,
	}

	reader, err := cli.ContainerLogs(ctx, containerID, options)
	if err != nil {
		return "", fmt.Errorf("failed to fetch container logs: %w", err)
	}
	defer reader.Close()

	var stdoutBuf, stderrBuf bytes.Buffer
	// Demultiplex docker log stream into stdout and stderr
	_, err = stdcopy.StdCopy(&stdoutBuf, &stderrBuf, reader)
	if err != nil {
		// Fallback: If stdcopy fails (e.g. TTY containers without multiplex headers)
		var plainBuf bytes.Buffer
		reader2, err2 := cli.ContainerLogs(ctx, containerID, options)
		if err2 == nil {
			defer reader2.Close()
			_, _ = plainBuf.ReadFrom(reader2)
			return plainBuf.String(), nil
		}
		return "", fmt.Errorf("failed to demux docker logs: %w", err)
	}

	// Combine stdout & stderr
	combined := stdoutBuf.String()
	if stderrBuf.Len() > 0 {
		if len(combined) > 0 {
			combined += "\n"
		}
		combined += stderrBuf.String()
	}

	return combined, nil
}
