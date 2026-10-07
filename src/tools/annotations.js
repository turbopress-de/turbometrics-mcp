/**
 * Werkzeug-Hinweise nach MCP (ToolAnnotations).
 *
 * Beide Verzeichnisse verlangen sie ausdruecklich an jedem Werkzeug: Anthropic
 * (Claude Connectors Directory) title, readOnlyHint und destructiveHint,
 * OpenAI (ChatGPT-Plugin-Verzeichnis) zusaetzlich openWorldHint. Ein
 * weggelassener Hinweis zaehlt dort als Fehler, nicht als Standardwert —
 * deshalb setzt jedes Werkzeug alle vier, und test/toolAnnotations.test.js
 * haelt das fest.
 *
 * openWorldHint: true heisst nach OpenAIs Lesart, dass das Werkzeug ueber das
 * eigene Konto hinaus wirkt — bei uns nur trigger_scan, das beliebige fremde
 * Websites abruft. Alles andere liest oder aendert ausschliesslich Daten im
 * eigenen turbometrics-Konto.
 */
export const READ_ONLY = Object.freeze({
  readOnlyHint: true,
  destructiveHint: false,
  idempotentHint: true,
  openWorldHint: false,
});
