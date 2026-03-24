/**
 * server.js — Entry point for the DentalFront AI Receptionist
 *
 * Bootstraps the Express application, registers all routes,
 * and starts the HTTP server.
 */

import 'dotenv/config';
import express from 'express';
import whatsappRouter from './routes/whatsapp.js';

const app = express();
const PORT = process.env.PORT || 3000;

// ── Middleware ────────────────────────────────────────────────────────────────
app.use(express.json()); // Parse incoming JSON payloads
app.use(express.urlencoded({ extended: true }));

// ── Health check ──────────────────────────────────────────────────────────────
app.get('/', (_req, res) => {
  res.json({ status: 'ok', service: 'DentalFront AI Receptionist' });
});

// ── Routes ────────────────────────────────────────────────────────────────────
app.use('/webhook', whatsappRouter);

// ── Global error handler ──────────────────────────────────────────────────────
app.use((err, _req, res, _next) => {
  console.error('[GlobalError]', err.message);
  res.status(500).json({ error: 'Internal server error' });
});

// ── Start server ──────────────────────────────────────────────────────────────
app.listen(PORT, () => {
  console.log(`✅ Server running on port ${PORT}`);
  console.log(`🔗 Webhook URL: http://localhost:${PORT}/webhook`);
});

export default app;
