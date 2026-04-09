# Add turbometrics MCP Server

## Server Details

- **Name:** turbometrics
- **URL:** https://turbometrics.de/mcp
- **Transport:** Streamable HTTP / SSE
- **Auth:** Bearer Token (API key from turbometrics.de/profile/api)
- **Source:** https://github.com/[DEIN_GITHUB_USER]/wpperf-mcp

## Description

turbometrics is a website performance monitoring SaaS focused on WordPress sites.
This MCP server gives AI assistants direct access to performance data, scan results,
and real user monitoring metrics.

## Tools (9)

| Tool | Type | Description |
|------|------|-------------|
| `list_domains` | read | List all monitored URLs |
| `get_latest_scan` | read | Latest scan: score, findings, TTFB, CWV |
| `get_scan_history` | read | Score history up to 90 days |
| `get_findings` | read | Detailed findings for a scan |
| `list_alerts` | read | Open or resolved alerts |
| `get_rum_summary` | read | Real User Monitoring: Core Web Vitals p75 |
| `compare_domains` | read | Side-by-side domain comparison |
| `trigger_scan` | write | Start an immediate scan |
| `mark_alerts_read` | write | Mark alerts as read |

## Use Cases

- "Which of my domains has the worst performance score?"
- "Show me all warnings for turbopress.de"
- "How has the score of example.com changed over the last 30 days?"
- "Compare turbopress.de with turbometrics.de"
- "Start a new scan for example.com"
- "Show RUM Core Web Vitals for turbopress.de"

## Requirements

- turbometrics.de account (Starter plan or higher)
- API token from turbometrics.de/profile/api

## Category

`monitoring` `performance` `wordpress` `web-vitals`
