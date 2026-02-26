import express from "express";
import cors from "cors";
import { createServer as createViteServer } from "vite";
import http from "http";
import { Server } from "socket.io";
import dotenv from "dotenv";
dotenv.config();

const ALLOWED_ORIGINS = [
  "https://www.devocionalmeet.shop",
  "https://devocionalmeet.shop",
  "http://localhost:3000",
  "http://localhost:5173",
];

async function startServer() {
  const app = express();
  const PORT = process.env.PORT ? parseInt(process.env.PORT) : 3000;
  const httpServer = http.createServer(app);

  // CORS para requisições HTTP normais
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

  io.on("connection", (socket) => {
    // join-room agora recebe o nome do participante também
    socket.on("join-room", (roomId: string, userId: string, userName: string) => {
      // Sai de salas anteriores para evitar mistura
      const salasAnteriores = Array.from(socket.rooms).filter((r) => r !== socket.id);
      salasAnteriores.forEach((sala) => {
        socket.leave(sala);
        socket.to(sala).emit("user-disconnected", userId);
      });

      socket.join(roomId);

      // Avisa os outros com o nome de quem entrou
      socket.to(roomId).emit("user-joined", userId, userName || "Participante");

      socket.on("offer", (payload) => {
        io.to(payload.target).emit("offer", payload);
      });

      socket.on("answer", (payload) => {
        io.to(payload.target).emit("answer", payload);
      });

      socket.on("ice-candidate", (payload) => {
        if (payload.target) {
          io.to(payload.target).emit("ice-candidate", payload);
        } else {
          socket.broadcast.to(roomId).emit("ice-candidate", payload);
        }
      });

      socket.on("chat_message", (payload) => {
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
