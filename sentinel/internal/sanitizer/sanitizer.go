package sanitizer

import (
	"regexp"
)

type RedactionRule struct {
	Pattern     *regexp.Regexp
	Replacement string
}

type Sanitizer struct {
	rules []RedactionRule
}

func New() *Sanitizer {
	rules := []RedactionRule{
		// Private Keys (RSA, OpenSSH, EC, PGP)
		{
			Pattern:     regexp.MustCompile(`(?s)-----BEGIN [A-Z ]*PRIVATE KEY-----.*?-----END [A-Z ]*PRIVATE KEY-----`),
			Replacement: "[REDACTED_PRIVATE_KEY]",
		},
		// Bearer / JWT Tokens
		{
			Pattern:     regexp.MustCompile(`(?i)(bearer\s+)[a-zA-Z0-9\-_=]+\.[a-zA-Z0-9\-_=]+\.?[a-zA-Z0-9\-_=]*`),
			Replacement: "${1}[REDACTED_JWT_TOKEN]",
		},
		// Database Connection Strings with Passwords (e.g. postgres://user:password@host:5432/db)
		{
			Pattern:     regexp.MustCompile(`(?i)([a-z0-9+]+://[a-zA-Z0-9_.-]+:)([^@/\s]+)(@[a-zA-Z0-9_.:-]+)`),
			Replacement: "${1}[REDACTED_PASSWORD]${3}",
		},
		// OpenAI API Keys (sk-...)
		{
			Pattern:     regexp.MustCompile(`\bsk-[a-zA-Z0-9]{20,}\b`),
			Replacement: "[REDACTED_OPENAI_API_KEY]",
		},
		// AWS Access Key IDs
		{
			Pattern:     regexp.MustCompile(`\bAKIA[0-9A-Z]{16}\b`),
			Replacement: "[REDACTED_AWS_ACCESS_KEY]",
		},
		// Generic key-value passwords / tokens / secrets in logs or queries
		{
			Pattern:     regexp.MustCompile(`(?i)(password|passwd|pwd|secret|api_key|apikey|auth_token|token|access_token)(["']?\s*[:=]\s*["']?)([^"'\s,;]+)`),
			Replacement: "${1}${2}[REDACTED_SECRET]",
		},
		// GitHub Personal Access Tokens (ghp_...)
		{
			Pattern:     regexp.MustCompile(`\bghp_[a-zA-Z0-9]{36}\b`),
			Replacement: "[REDACTED_GITHUB_TOKEN]",
		},
	}

	return &Sanitizer{rules: rules}
}

// Sanitize scans and redacts sensitive credentials from log text
func (s *Sanitizer) Sanitize(input string) string {
	if input == "" {
		return ""
	}
	output := input
	for _, rule := range s.rules {
		output = rule.Pattern.ReplaceAllString(output, rule.Replacement)
	}
	return output
}
