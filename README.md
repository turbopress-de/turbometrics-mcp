# turbometrics MCP Server

Connect Claude and other AI tools directly to your [turbometrics.de](https://turbometrics.de) account.

## What you can do

Ask your AI assistant questions like:
- "Show all my monitored domains"
- "What's the performance score of turbopress.de?"
- "Which of my domains got worse this week?"
- "Compare turbopress.de with turbometrics.de"
- "Start a new scan for example.com"
- "Show RUM data for turbopress.de"
- "What findings does turbometrics.de have?"

## Requirements

- A turbometrics.de account (Starter plan or higher)
- An API token from [Profile → API](https://turbometrics.de/profile/api)

## Available Tools

| Tool | Description |
|------|-------------|
| `list_domains` | List all monitored URLs with schedule and status |
| `get_latest_scan` | Get the latest scan result for a domain including score, findings, and TTFB |
| `get_scan_history` | Get score history for a domain (up to 90 days) |
| `get_findings` | Get detailed findings for a specific scan |
| `list_alerts` | List open or resolved alerts |
| `get_rum_summary` | Get Real User Monitoring data: Core Web Vitals p75 values |
| `compare_domains` | Compare two domains side by side |
| `trigger_scan` | Start a new scan immediately |
| `mark_alerts_read` | Mark alerts as read |

## Authentication

Every request requires a Bearer token passed via the `Authorization` header.
Get your token at [turbometrics.de/profile/api](https://turbometrics.de/profile/api).

## Setup

### Claude Desktop (Mac)

1. Install Node.js: `brew install node`
2. Get your API token from [Profile → API](https://turbometrics.de/profile/api)
3. Edit `~/Library/Application Support/Claude/claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "turbometrics": {
      "command": "/opt/homebrew/bin/npx",
      "args": [
        "mcp-remote",
        "https://turbometrics.de/mcp",
        "--header",
        "Authorization: Bearer YOUR_API_TOKEN"
      ]
    }
  }
}
```

4. Restart Claude Desktop

### Other MCP Clients

Server URL: `https://turbometrics.de/mcp`  
Auth: `Authorization: Bearer YOUR_API_TOKEN`  
Transport: Streamable HTTP / SSE

## Plans

API access is available from the **Starter plan** and above.

| Plan | Daily API Limit |
|------|----------------|
| Starter | 1,000 requests |
| Pro | 5,000 requests |
| Agency | Unlimited |
