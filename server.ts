import express from "express";
import cors from "cors";
import { createServer as createViteServer } from "vite";
import http from "http";
import { Server } from "socket.io";
import dotenv from "dotenv";
import { randomBytes } from "crypto";
const nanoid = (size = 12) => randomBytes(size).toString('base64url').slice(0, size);
dotenv.config();

const ALLOWED_ORIGINS = [
  "https://www.devocionalmeet.shop",
  "https://devocionalmeet.shop",
  "http://localhost:3000",
  "http://localhost:5173",
];

// Banco em memória para salas e sessões de música
const rooms: Record<string, any> = {};
const musicSessions: Record<string, any> = {};

function generateRoomCode() {
  const chars = 'abcdefghijklmnopqrstuvwxyz';
  const seg = (n: number) => Array.from({ length: n }, () =>
    chars[Math.floor(Math.random() * chars.length)]).join('');
  return `${seg(3)}-${seg(4)}-${seg(3)}`;
}

async function startServer() {
  const app = express();
  const PORT = process.env.PORT ? parseInt(process.env.PORT) : 3000;
  const httpServer = http.createServer(app);

  app.use(
    cors({
      origin: ALLOWED_ORIGINS,
      methods: ["GET", "POST"],
      credentials: true,
    })
  );

  const io = new Server(httpServer, {
    cors: {
      origin: ALLOWED_ORIGINS,
      methods: ["GET", "POST"],
      credentials: true,
    },
  });

  app.use(express.json());

  // Rotas de Salas
  app.post('/rooms/create', (req, res) => {
    const { userId, userName } = req.body;
    if (!userId || !userName) return res.status(400).json({ error: 'userId e userName obrigatórios' });

    const code = generateRoomCode();
    const roomId = nanoid(12);
    const link = `${process.env.VITE_APP_BASE_URL || 'http://localhost:5173'}/room/${code}`;

    rooms[code] = {
      roomId,
      code,
      link,
      hostId: userId,
      hostName: userName,
      participants: [],
      createdAt: Date.now(),
      expiresAt: Date.now() + 24 * 60 * 60 * 1000,
    };

    res.json({ roomId, code, link, isHost: true });
  });

  app.get('/rooms/:code', (req, res) => {
    const room = rooms[req.params.code];
    if (!room) return res.status(404).json({ error: 'Sala não encontrada' });
    if (Date.now() > room.expiresAt) {
      delete rooms[req.params.code];
      return res.status(410).json({ error: 'Sala expirada' });
    }
    res.json(room);
  });

  io.on("connection", (socket) => {
    socket.on("join-room", (roomId: string, _clientId: string, userName: string) => {
      // Manter compatibilidade com a lógica anterior ou migrar para room:join
      socket.join(roomId);
      socket.to(roomId).emit("user-joined", socket.id, userName || "Participante");
    });

    // Novos eventos de Sala (Google Meet Style)
    socket.on('room:join', ({ code, userId, userName }) => {
      const room = rooms[code];
      if (!room) {
        socket.emit('room:error', { message: 'Sala não encontrada' });
        return;
      }
      socket.join(code);
      const participant = { userId, userName, socketId: socket.id, joinedAt: Date.now() };

      // Evita duplicados
      room.participants = room.participants.filter((p: any) => p.userId !== userId);
      room.participants.push(participant);

      io.to(code).emit('room:participantJoined', { participant, total: room.participants.length });
      socket.emit('room:synced', { participants: room.participants, hostId: room.hostId, code: room.code });
    });

    socket.on('room:leave', ({ code, userId }) => {
      const room = rooms[code];
      if (!room) return;
      room.participants = room.participants.filter((p: any) => p.userId !== userId);
      socket.leave(code);
      io.to(code).emit('room:participantLeft', { userId, total: room.participants.length });
    });

    // Eventos Spotify (Compartilhado)
    socket.on('music:join', ({ roomId }) => {
      socket.join(`music:${roomId}`);
      if (musicSessions[roomId]) {
        socket.emit('music:sync', musicSessions[roomId]);
      }
    });

    socket.on('music:play', ({ roomId, trackUri, position, userName }) => {
      musicSessions[roomId] = { trackUri, position, isPlaying: true, updatedAt: Date.now(), lastUser: userName };
      socket.to(`music:${roomId}`).emit('music:sync', musicSessions[roomId]);
    });

    socket.on('music:toggle', ({ roomId, isPlaying, position }) => {
      if (musicSessions[roomId]) {
        musicSessions[roomId].isPlaying = isPlaying;
        musicSessions[roomId].position = position;
        musicSessions[roomId].updatedAt = Date.now();
        socket.to(`music:${roomId}`).emit('music:sync', musicSessions[roomId]);
      }
    });

    socket.on('music:queue', ({ roomId, queue }) => {
      if (!musicSessions[roomId]) musicSessions[roomId] = { queue: [] };
      musicSessions[roomId].queue = queue;
      io.to(`music:${roomId}`).emit('music:queueUpdated', queue);
    });

    socket.on("chat_message", (payload) => {
      // Pode ser roomId (antigo) ou code (novo)
      const target = payload.room || payload.roomId || "global";
      io.to(target).emit("chat_message", payload);
    });

    socket.on("disconnect", () => {
      Object.keys(rooms).forEach(code => {
        const room = rooms[code];
        const before = room.participants.length;
        room.participants = room.participants.filter((p: any) => p.socketId !== socket.id);
        if (room.participants.length < before) {
          io.to(code).emit('room:participantLeft', { total: room.participants.length });
        }
      });
    });
  });

  app.use(express.json());

  app.get("/api/health", (req, res) => {
    res.json({ status: "ok" });
  });

  // Proxy Gemini para segurança (BUG 7)
  app.post("/api/gemini", async (req, res) => {
    const { prompt } = req.body;
    if (!process.env.GEMINI_API_KEY) {
      return res.status(500).json({ error: "GEMINI_API_KEY não configurada no servidor" });
    }

    try {
      const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${process.env.GEMINI_API_KEY}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }]
        })
      });

      const data = await response.json();
      res.json(data);
    } catch (err) {
      console.error("Erro no proxy Gemini:", err);
      res.status(500).json({ error: "Erro ao processar requisição Gemini" });
    }
  });

  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static("dist"));
  }

  httpServer.listen(PORT, "0.0.0.0", () => {
    console.log(`Servidor rodando em http://localhost:${PORT}`);
  });
}

startServer();
