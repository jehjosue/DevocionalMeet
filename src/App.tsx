import { useState, useEffect } from "react";
import { BrowserRouter, Routes, Route, Navigate, useParams, useNavigate, useSearchParams } from "react-router-dom";
import Home from "./pages/Home";
import Room from "./pages/Room";
import { ThemeProvider } from "./context/ThemeContext";
import { useRoom } from "./hooks/useRoom";

function MeetingWrapper() {
  const { code } = useParams();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  const [userName] = useState(() => localStorage.getItem("dmeet_name") || "");
  const [userId] = useState(() => {
    const saved = localStorage.getItem("dmeet_userId");
    if (saved) return saved;
    const newId = crypto.randomUUID();
    localStorage.setItem("dmeet_userId", newId);
    return newId;
  });

  const role = localStorage.getItem("dmeet_role");
  const isHost = role === "leader" || searchParams.get("host") === "true";

  const { room, participants, joinRoom, socket } = useRoom();
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!code) return;

    if (!userName) {
      navigate(`/?roomId=${code}`, { replace: true });
      return;
    }

    if (isHost) {
      setReady(true);
      return;
    }

    // Convidado: usa socket do useRoom e entra direto
    if (socket && socket.connected) {
      socket.emit("room:join", { code, userId, userName });
      setReady(true);
    } else if (socket) {
      socket.once("connect", () => {
        socket.emit("room:join", { code, userId, userName });
        setReady(true);
      });
    }

    const timeout = setTimeout(() => {
      setReady(true); // entra mesmo sem confirmação após 3s
    }, 3000);

    return () => clearTimeout(timeout);
  }, [code, userName, socket]);

  if (!userName) {
    return <Navigate to={`/?roomId=${code}`} replace />;
  }

  if (error) {
    return (
      <div style={{
        width: "100vw", height: "100vh", background: "#000",
        display: "flex", flexDirection: "column",
        alignItems: "center", justifyContent: "center",
        color: "#fff", fontFamily: "system-ui", gap: 16
      }}>
        <div style={{ fontSize: "2rem" }}>❌</div>
        <p style={{ fontSize: "1rem", color: "#ff6b6b" }}>{error}</p>
        <button
          onClick={() => navigate("/")}
          style={{
            background: "#2563eb", color: "#fff", border: "none",
            borderRadius: 999, padding: "12px 28px",
            fontSize: "0.95rem", fontWeight: 700, cursor: "pointer"
          }}
        >
          Voltar ao início
        </button>
      </div>
    );
  }

  if (!ready) {
    return (
      <div style={{
        width: "100vw", height: "100vh", background: "#000",
        display: "flex", flexDirection: "column",
        alignItems: "center", justifyContent: "center",
        color: "#fff", fontFamily: "system-ui", gap: 16
      }}>
        <div style={{ fontSize: "2rem" }}>⏳</div>
        <p style={{ fontSize: "1rem" }}>Entrando na reunião...</p>
        <p style={{ fontSize: "0.8rem", color: "#555" }}>{code}</p>
      </div>
    );
  }

  return (
    <Room
      initialRoom={room || { code, hostId: isHost ? userId : null }}
      initialParticipants={participants}
      userId={userId}
      userName={userName}
      socket={socket}
    />
  );
}

export default function App() {
  return (
    <ThemeProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/room/:code" element={<MeetingWrapper />} />
          {/* Rota curinga para evitar tela branca */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </ThemeProvider>
  );
}
