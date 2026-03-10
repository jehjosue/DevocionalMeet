import { useState, useEffect } from "react";
import { BrowserRouter, Routes, Route, Navigate, useParams } from "react-router-dom";
import Home from "./pages/Home";
import Room from "./pages/Room";
import { ThemeProvider } from "./context/ThemeContext";
import { useRoom } from "./hooks/useRoom";

function MeetingWrapper() {
  const { code } = useParams();
  const { room, participants, joinRoom, leaveRoom, socket } = useRoom();
  const [userName] = useState(() => localStorage.getItem("dmeet_name") || "");

  const [userId] = useState(() => {
    const saved = localStorage.getItem("dmeet_userId");
    if (saved) return saved;
    const newId = crypto.randomUUID();
    localStorage.setItem("dmeet_userId", newId);
    return newId;
  });

  const role = localStorage.getItem("dmeet_role");
  const isHost = role === "leader" || new URLSearchParams(window.location.search).get("host") === "true";

  useEffect(() => {
    if (code && userName && !room) {
      if (isHost) {
        // Líder: sala já foi criada no Home.tsx, apenas conecta via socket
        socket?.emit("room:join", { code, userId, userName });
      } else {
        // Convidado: entra na sala via API
        joinRoom(code, userId, userName);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [code, userName, !!socket, isHost]);

  if ((!userName || !code) && !new URLSearchParams(window.location.search).get("roomId")) {
    return <Navigate to={`/?roomId=${code || ""}`} replace />;
  }

  if (!room && localStorage.getItem("dmeet_role") !== "leader") {
    return <div style={{ color: "#fff", padding: 20 }}>Carregando sala...</div>;
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
        </Routes>
      </BrowserRouter>
    </ThemeProvider>
  );
}
