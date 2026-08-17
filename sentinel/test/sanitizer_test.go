package test

import (
	"strings"
	"testing"

	"github.com/kintsugi/sentinel/internal/sanitizer"
)

func TestSanitizerMasksSensitiveData(t *testing.T) {
	san := sanitizer.New()

	tests := []struct {
		name     string
		input    string
		expected string
	}{
		{
			name:     "JWT Bearer Token",
			input:    "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkpvaG4gRG9lIn0.SflKxwRJSMeKKF2QT4fwpMeJf36POk6yJV_adQssw5c",
			expected: "Authorization: Bearer [REDACTED_JWT_TOKEN]",
		},
		{
			name:     "Database Connection String with Password",
			input:    "Connecting to postgresql://admin_user:super_secret_p@ssw0rd!@db-primary.internal:5432/production_db",
			expected: "Connecting to postgresql://admin_user:[REDACTED_PASSWORD]@db-primary.internal:5432/production_db",
		},
		{
			name:     "OpenAI API Key",
			input:    "Failed to authenticate with OpenAI key sk-abcdef1234567890abcdef1234567890",
			expected: "Failed to authenticate with OpenAI key [REDACTED_OPENAI_API_KEY]",
		},
		{
			name:     "AWS Access Key ID",
			input:    "AWS S3 Upload failed with credentials for AKIAIOSFODNN7EXAMPLE",
			expected: "AWS S3 Upload failed with credentials for [REDACTED_AWS_ACCESS_KEY]",
		},
		{
			name:     "Generic Password in Logs",
			input:    "Config parsed: host=0.0.0.0, port=8080, password=myVerySecretPassword123, retries=3",
			expected: "Config parsed: host=0.0.0.0, port=8080, password=[REDACTED_SECRET], retries=3",
		},
		{
			name: "RSA Private Key",
			input: `Loading certificate:
-----BEGIN RSA PRIVATE KEY-----
MIIEowIBAAKCAQEA0Y3w18kF4v2...
...some private key bytes...
-----END RSA PRIVATE KEY-----
Key loaded.`,
			expected: `Loading certificate:
[REDACTED_PRIVATE_KEY]
Key loaded.`,
		},
	}

	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			result := san.Sanitize(tc.input)
			if !strings.Contains(result, "[REDACTED") {
				t.Errorf("Expected redaction in output, got: %s", result)
			}
		})
	}
}
