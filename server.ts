import express from "express";
import { createServer as createViteServer } from "vite";
import http from "http";
import { Server } from "socket.io";
import dotenv from "dotenv";

dotenv.config();

async function startServer() {
  const app = express();
  const PORT = process.env.PORT ? parseInt(process.env.PORT) : 3000;
  const httpServer = http.createServer(app);

  // Inicialização do Socket.io para Signaling WebRTC
  const io = new Server(httpServer, {
    cors: { origin: "*" } // Ajuste o CORS conforme necessidade no ambiente produtivo
  });

  io.on("connection", (socket) => {
    socket.on("join-room", (roomId, userId) => {
      socket.join(roomId);
      // Avisa aos outros da sala que um novo usuário entrou
      socket.to(roomId).emit("user-joined", userId);

      socket.on("offer", (payload) => {
        // Envia a oferta para o destino específico ou transmite na sala
        io.to(payload.target).emit("offer", payload);
      });

      socket.on("answer", (payload) => {
        io.to(payload.target).emit("answer", payload);
      });

      socket.on("ice-candidate", (payload) => {
        // Transmite o candidato ICE para a sala toda (exceto o rementente) ou alvo específico se payload.target
        if (payload.target) {
          io.to(payload.target).emit("ice-candidate", payload);
        } else {
          socket.broadcast.to(roomId).emit("ice-candidate", payload);
        }
      });

      socket.on("chat_message", (payload) => {
        // Chat simples na mesma sala Socket.io
        io.to(roomId).emit("chat_message", payload);
      });

      socket.on("disconnect", () => {
        socket.to(roomId).emit("user-disconnected", userId);
      });
    });
  });

  app.use(express.json());

  app.get("/api/health", (req, res) => {
    res.json({ status: "ok" });
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
