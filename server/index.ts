import express from 'express';
import cors from 'cors';
import http from 'http';
import path from 'path';
import fs from 'fs';
import { WebSocketServer, WebSocket } from 'ws';
import dotenv from 'dotenv';
import { db } from './db/database.js';
import { seedDatabase } from './db/seed.js';
import { apiRouter } from './routes/api.js';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(express.json());

// Seed initial multi-hospital and doctor data
seedDatabase(db);

// Mount API routes
app.use('/api', apiRouter);

// Serve frontend static build if dist exists
const distPath = path.resolve(process.cwd(), 'dist');
if (fs.existsSync(distPath)) {
  app.use(express.static(distPath));
  app.get('*', (req, res, next) => {
    if (req.path.startsWith('/api') || req.path.startsWith('/ws')) {
      return next();
    }
    res.sendFile(path.join(distPath, 'index.html'));
  });
}

// Create HTTP and WebSocket server for real-time voice & event streaming (PRD Section 10 & 11)
const server = http.createServer(app);
const wss = new WebSocketServer({ server, path: '/ws' });

const connectedClients: Set<WebSocket> = new Set();

wss.on('connection', (ws: WebSocket) => {
  connectedClients.add(ws);
  console.log('[WebSocket] Client connected for real-time voice/event stream');

  ws.send(JSON.stringify({
    type: 'CONNECTED',
    message: 'OmniHealth AI Real-Time Streaming Channel Online',
    timestamp: new Date().toISOString()
  }));

  ws.on('message', (data: string) => {
    try {
      const msg = JSON.parse(data.toString());
      // Real-time barge-in / interruption signal
      if (msg.type === 'BARGE_IN') {
        console.log('[WebSocket] 🛑 Patient Barge-In event detected, canceling pending audio synthesis');
        ws.send(JSON.stringify({ type: 'BARGE_IN_ACK', status: 'AUDIO_STOPPED' }));
      }
      // Audio level ping for waveform visualization
      if (msg.type === 'AUDIO_PULSE') {
        ws.send(JSON.stringify({ type: 'AUDIO_PULSE_ECHO', level: msg.level }));
      }
    } catch (e) {
      console.warn('[WebSocket] Error parsing incoming client frame:', e);
    }
  });

  ws.on('close', () => {
    connectedClients.delete(ws);
    console.log('[WebSocket] Client disconnected');
  });
});

// Broadcast helper for real-time dashboard events
export function broadcastEvent(eventType: string, payload: any) {
  const payloadStr = JSON.stringify({ type: eventType, payload, timestamp: new Date().toISOString() });
  for (const client of connectedClients) {
    if (client.readyState === WebSocket.OPEN) {
      client.send(payloadStr);
    }
  }
}

server.listen(PORT, () => {
  console.log(`🏥 OmniHealth AI Platform Server running on http://localhost:${PORT}`);
  console.log(`🎙️ Real-time voice WebSocket active on ws://localhost:${PORT}/ws`);
});
