import express from 'express';
import { createMcpTransport } from './server.js';

const PORT = process.env.PORT || 3001;
const app = express();

app.use(express.json());

app.post('/mcp', async (req, res) => {
  try {
    const transport = createMcpTransport(req);
    await transport.handleRequest(req, res, req.body);
  } catch (err) {
    const status = err.status ?? 500;
    if (!res.headersSent) {
      res.status(status).json({ error: err.message });
    }
  }
});

app.get('/mcp', async (req, res) => {
  try {
    const transport = createMcpTransport(req);
    await transport.handleRequest(req, res);
  } catch (err) {
    const status = err.status ?? 500;
    if (!res.headersSent) {
      res.status(status).json({ error: err.message });
    }
  }
});

app.delete('/mcp', async (req, res) => {
  try {
    const transport = createMcpTransport(req);
    await transport.handleRequest(req, res);
  } catch (err) {
    const status = err.status ?? 500;
    if (!res.headersSent) {
      res.status(status).json({ error: err.message });
    }
  }
});

app.get('/health', (_req, res) => {
  res.json({ status: 'ok' });
});

app.listen(PORT, () => {
  console.log(`wpperf-mcp läuft auf Port ${PORT}`);
});
