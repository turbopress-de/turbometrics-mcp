# Add turbometrics MCP Server

## Server Details

- **Name:** turbometrics
- **URL:** https://turbometrics.de/mcp
- **Transport:** Streamable HTTP / SSE
- **Auth:** Bearer Token (API key from turbometrics.de/profile/api)
- **Source:** https://github.com/turbopress-de/turbometrics-mcp

## Description

turbometrics is a website performance monitoring SaaS focused on WordPress sites.
This MCP server gives AI assistants direct access to performance data, scan results,
and real user monitoring metrics.

## Tools (12)

| Tool | Type | Description |
|------|------|-------------|
| `list_domains` | read | List all monitored URLs |
| `get_latest_scan` | read | Latest scan: score, findings, TTFB, CWV |
| `get_scan_history` | read | Score history — works for new and monitored domains |
| `get_findings` | read | Detailed findings for a scan |
| `list_alerts` | read | Open or resolved alerts |
| `get_rum_summary` | read | Real User Monitoring: Core Web Vitals p75 |
| `get_rum_metric_history` | read | Daily trend for LCP/CLS/INP/FCP/TTFB |
| `get_rum_pages` | read | Slowest pages per metric |
| `compare_domains` | read | Side-by-side domain comparison |
| `trigger_scan` | write | Start a scan for any URL (new or monitored), with region/force/auth support |
| `mark_alerts_read` | write | Mark alerts as read |
| `get_account_info` | read | Plan, API limits, RUM status |

## Use Cases

- "Which of my domains has the worst performance score?"
- "Show me all warnings for turbopress.de"
- "How has the score of example.com changed over the last 30 days?"
- "Compare turbopress.de with turbometrics.de"
- "Scan https://new-client-site.com and show me the findings"
- "Show RUM Core Web Vitals for turbopress.de"
- "Which pages on turbopress.de have the worst LCP?"
- "How has the LCP trend developed over the last 90 days?"

## Requirements

- turbometrics.de account (Starter plan or higher)
- API token from turbometrics.de/profile/api

## Category

`monitoring` `performance` `wordpress` `web-vitals`
