import express from "express";
import cors from "cors";
import { createServer as createViteServer } from "vite";
import http from "http";
import { Server } from "socket.io";
import dotenv from "dotenv";
import { randomBytes } from "crypto";
import session from "express-session";
import axios from "axios";
import cookieParser from "cookie-parser";

const nanoid = (size = 12) => randomBytes(size).toString('base64url').slice(0, size);
dotenv.config();

const ALLOWED_ORIGINS = [
  'https://www.devocionalmeet.shop',
  'https://devocionalmeet.shop',
  'http://localhost:3000',
  'http://localhost:5173',
  'capacitor://localhost',   // iOS WebView
  'ionic://localhost',       // iOS WebView alternativo
];

const corsOptions = {
  origin: (origin: string | undefined, callback: Function) => {
    if (!origin) return callback(null, true); // Postman, mobile apps, SSR
    if (ALLOWED_ORIGINS.includes(origin)) return callback(null, true);
    console.warn('[CORS] Origem bloqueada:', origin);
    callback(new Error('CORS: origem não permitida'));
  },
  methods: ['GET', 'POST', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Accept', 'Authorization'],
  credentials: true,
};

// Spotify Config — MUST be set via environment variables, never hardcoded
const SPOTIFY_CLIENT_ID = process.env.SPOTIFY_CLIENT_ID!;
const SPOTIFY_CLIENT_SECRET = process.env.SPOTIFY_CLIENT_SECRET!;
const SPOTIFY_REDIRECT_URI = process.env.SPOTIFY_REDIRECT_URI || 'https://devocionalmeet.shop/callback';

// Banco em memória para salas e sessões de música
const rooms: Record<string, any> = {};
const socketToUser = new Map();
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

  app.use(cors(corsOptions));
  // Preflight explícito — Safari iOS exige resposta 200 ao OPTIONS
  app.options('*', cors(corsOptions));

  const io = new Server(httpServer, {
    cors: {
      origin: ALLOWED_ORIGINS,
      methods: ["GET", "POST"],
      credentials: true,
    },
  });

  app.use(express.json());
  app.use(cookieParser());
  app.use(session({
    secret: process.env.SESSION_SECRET || 'dmeet-secret-key-spotify',
    resave: false,
    saveUninitialized: false,
    cookie: {
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 24 * 60 * 60 * 1000 // 24 horas
    }
  }));

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
      socketToUser.set(socket.id, { userId, userName, code });
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
      const code = payload.room || payload.roomId || payload.code;
      if (code) {
        socket.to(code).emit("chat_message", payload);
      } else {
        socket.rooms.forEach(room => {
          if (room !== socket.id) socket.to(room).emit("chat_message", payload);
        });
      }
    });

    socket.on("announce-name", (code, agoraUid, userName) => {
      io.to(code).emit("user-name", agoraUid, userName);
    });

    socket.on("raise_hand", (data) => {
      const userRooms = [...socket.rooms].filter(r => r !== socket.id);
      userRooms.forEach(code => socket.to(code).emit("raise_hand", data));
    });

    socket.on("reaction", (emoji) => {
      const userInfo = socketToUser.get(socket.id);
      const userRooms = [...socket.rooms].filter(r => r !== socket.id);
      userRooms.forEach(code => socket.to(code).emit("reaction", { emoji, uid: userInfo?.userId || socket.id }));
    });

    socket.on('host:muteAll', ({ code, muted }) => {
      socket.to(code).emit('room:mutedByHost', { muted, all: true });
    });

    socket.on('host:muteOne', ({ code, userId, muted }) => {
      io.to(code).emit('room:mutedByHost', { userId, muted, all: false });
    });

    socket.on('host:disableVideoAll', ({ code, disabled }) => {
      socket.to(code).emit('room:videoDisabledByHost', { disabled, all: true });
    });

    socket.on('host:disableVideoOne', ({ code, userId, disabled }) => {
      io.to(code).emit('room:videoDisabledByHost', { userId, disabled, all: false });
    });

    // ── ACTIVITIES ──
    // In-memory activity state stored on the room object itself

    // Spotify
    socket.on('activity:spotify:set', ({ code, ...data }) => {
      if (rooms[code]) {
        if (!rooms[code].spotify) rooms[code].spotify = {};
        Object.assign(rooms[code].spotify, data);
      }
      io.to(code).emit('activity:spotify:sync', rooms[code].spotify);
    });

    // YouTube
    socket.on('activity:youtube:set', ({ code, videoId }) => {
      if (rooms[code]) rooms[code].youtube = { videoId, playing: false, time: 0, updatedAt: Date.now() };
      io.to(code).emit('activity:youtube:sync', rooms[code].youtube);
    });
    socket.on('activity:youtube:state', ({ code, playing, time }) => {
      if (rooms[code]?.youtube) {
        Object.assign(rooms[code].youtube, { playing, time, updatedAt: Date.now() });
      }
      socket.to(code).emit('activity:youtube:state', { playing, time });
    });

    // Poll
    socket.on('activity:poll:create', ({ code, question, options }) => {
      const votes: Record<number, string[]> = {};
      options.forEach((_: any, i: number) => votes[i] = []);
      if (rooms[code]) rooms[code].poll = { question, options, votes, closed: false };
      io.to(code).emit('activity:poll:state', rooms[code].poll);
    });
    socket.on('activity:poll:vote', ({ code, userId, optionIndex }) => {
      const poll = rooms[code]?.poll;
      if (!poll || poll.closed) return;
      // Remove previous vote from this user
      Object.values(poll.votes).forEach((arr: any) => {
        const idx = arr.indexOf(userId);
        if (idx !== -1) arr.splice(idx, 1);
      });
      poll.votes[optionIndex].push(userId);
      io.to(code).emit('activity:poll:state', poll);
    });
    socket.on('activity:poll:close', ({ code }) => {
      if (rooms[code]?.poll) rooms[code].poll.closed = true;
      io.to(code).emit('activity:poll:state', rooms[code].poll);
    });

    // Whiteboard
    socket.on('activity:whiteboard:draw', ({ code, stroke }) => {
      socket.to(code).emit('activity:whiteboard:draw', stroke);
    });
    socket.on('activity:whiteboard:clear', ({ code }) => {
      io.to(code).emit('activity:whiteboard:clear');
    });

    // Quiz
    socket.on('activity:quiz:create', ({ code, questions }) => {
      if (rooms[code]) rooms[code].quiz = { questions, current: 0, answers: {}, scores: {}, state: 'waiting' };
      io.to(code).emit('activity:quiz:state', rooms[code].quiz);
    });
    socket.on('activity:quiz:start', ({ code }) => {
      if (rooms[code]?.quiz) rooms[code].quiz.state = 'question';
      io.to(code).emit('activity:quiz:state', rooms[code].quiz);
    });
    socket.on('activity:quiz:answer', ({ code, userId, userName, questionIndex, optionIndex }) => {
      const quiz = rooms[code]?.quiz;
      if (!quiz) return;
      if (!quiz.answers[questionIndex]) quiz.answers[questionIndex] = {};
      if (quiz.answers[questionIndex][userId]) return; // already answered
      quiz.answers[questionIndex][userId] = optionIndex;
      const correct = quiz.questions[questionIndex]?.correct;
      if (optionIndex === correct) {
        quiz.scores[userId] = (quiz.scores[userId] || 0) + 1;
      }
      io.to(code).emit('activity:quiz:state', quiz);
    });
    socket.on('activity:quiz:next', ({ code }) => {
      const quiz = rooms[code]?.quiz;
      if (!quiz) return;
      quiz.current += 1;
      quiz.state = quiz.current < quiz.questions.length ? 'question' : 'done';
      io.to(code).emit('activity:quiz:state', quiz);
    });

    // Tasks
    socket.on('activity:tasks:update', ({ code, tasks }) => {
      if (rooms[code]) rooms[code].tasks = tasks;
      socket.to(code).emit('activity:tasks:state', tasks);
    });
    socket.on('activity:tasks:sync', ({ code }) => {
      if (rooms[code]?.tasks) socket.emit('activity:tasks:state', rooms[code].tasks);
    });

    // Activity: join (get current state)
    socket.on('activity:join', ({ code }) => {
      const room = rooms[code];
      if (!room) return;
      if (room.spotify) socket.emit('activity:spotify:sync', room.spotify);
      if (room.youtube) socket.emit('activity:youtube:sync', room.youtube);
      if (room.poll) socket.emit('activity:poll:state', room.poll);
      if (room.tasks) socket.emit('activity:tasks:state', room.tasks);
      if (room.quiz) socket.emit('activity:quiz:state', room.quiz);
    });

    socket.on("disconnect", () => {
      const userInfo = socketToUser.get(socket.id);
      socketToUser.delete(socket.id);
      Object.keys(rooms).forEach(code => {
        const room = rooms[code];
        const leaving = room.participants.find((p: any) => p.socketId === socket.id);
        room.participants = room.participants.filter((p: any) => p.socketId !== socket.id);
        if (leaving) {
          io.to(code).emit('room:participantLeft', { userId: leaving.userId, total: room.participants.length });
        }
      });
    });
  });

  // ── Spotify OAuth ──
  app.get('/auth/spotify', (req, res) => {
    const scope = "streaming user-read-email user-read-private user-modify-playback-state user-read-playback-state";
    const state = randomBytes(16).toString('hex');
    const params = new URLSearchParams({
      response_type: "code",
      client_id: SPOTIFY_CLIENT_ID,
      scope,
      redirect_uri: SPOTIFY_REDIRECT_URI,
      state,
    });

    const spotifyUrl = `https://accounts.spotify.com/authorize/?${params.toString()}`;

    // Se for requisição fetch (Accept: application/json), retorna JSON
    if (req.headers.accept?.includes('application/json')) {
      return res.json({ url: spotifyUrl });
    }

    // Caso contrário redireciona direto
    res.redirect(spotifyUrl);
  });

  app.get('/callback', async (req, res) => {
    const code = req.query.code;
    try {
      const response = await axios({
        method: 'POST',
        url: 'https://accounts.spotify.com/api/token',
        data: new URLSearchParams({
          code: code as string,
          redirect_uri: SPOTIFY_REDIRECT_URI,
          grant_type: 'authorization_code',
        }).toString(),
        headers: {
          'Authorization': 'Basic ' + Buffer.from(
            SPOTIFY_CLIENT_ID + ':' + SPOTIFY_CLIENT_SECRET
          ).toString('base64'),
          'Content-Type': 'application/x-www-form-urlencoded',
        }
      });

      if (response.status === 200) {
        (req.session as any).spotify_access_token = response.data.access_token;
        (req.session as any).spotify_refresh_token = response.data.refresh_token;

        // Fecha popup OU volta para a sala no mobile
        res.send(`
          <html><body>
            <script>
              if (window.opener) {
                window.opener.postMessage('spotify-connected', '*');
                window.close();
              } else {
                // Mobile: volta para onde estava
                const returnUrl = sessionStorage.getItem('spotify_return') || '/';
                sessionStorage.removeItem('spotify_return');
                window.location.href = returnUrl;
              }
            </script>
            <p>Conectado ao Spotify!</p>
          </body></html>
        `);
      }
    } catch (error) {
      res.send(`
        <html><body>
          <script>
            if (window.opener) {
              window.close();
            } else {
              window.location.href = '/?error=spotify_auth_failed';
            }
          </script>
          <p>Erro ao conectar. Tente novamente.</p>
        </body></html>
      `);
    }
  });

  app.get('/auth/spotify/token', (req, res) => {
    const token = (req.session as any).spotify_access_token;
    res.json({ access_token: token || null });
  });

  app.get('/auth/spotify/refresh', async (req, res) => {
    const refresh_token = (req.session as any).spotify_refresh_token;
    if (!refresh_token) return res.status(400).json({ error: 'No refresh token' });

    try {
      const response = await axios({
        method: 'POST',
        url: 'https://accounts.spotify.com/api/token',
        data: new URLSearchParams({
          grant_type: 'refresh_token',
          refresh_token: refresh_token
        }).toString(),
        headers: {
          'Authorization': 'Basic ' + Buffer.from(SPOTIFY_CLIENT_ID + ':' + SPOTIFY_CLIENT_SECRET).toString('base64'),
          'Content-Type': 'application/x-www-form-urlencoded'
        }
      });

      if (response.status === 200) {
        (req.session as any).spotify_access_token = response.data.access_token;
        res.json({ access_token: response.data.access_token });
      } else {
        res.status(400).json({ error: 'Refresh failed' });
      }
    } catch (error) {
      console.error('Spotify Refresh error:', error);
      res.status(500).json({ error: 'Server error during refresh' });
    }
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
