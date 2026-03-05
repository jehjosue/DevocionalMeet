import { useState, useEffect } from "react";
import { BrowserRouter, Routes, Route, Navigate, useParams } from "react-router-dom";
import Home from "./pages/Home";
import Room from "./pages/Room";
import { ThemeProvider } from "./context/ThemeContext";
import { useRoom } from "./hooks/useRoom";

function MeetingWrapper() {
  const { roomName } = useParams();
  const { room, participants, joinRoom, leaveRoom, socket } = useRoom();
  const [userName, setUserName] = useState(localStorage.getItem("dmeet_name") || "");
  const userId = localStorage.getItem("dmeet_userId") || crypto.randomUUID();

  useEffect(() => {
    localStorage.setItem("dmeet_userId", userId);
    if (roomName && userName && !room) {
      joinRoom(roomName, userId, userName);
    }
  }, [roomName, userName, room, joinRoom, userId]);

  if (!userName || !roomName) {
    return <Navigate to={`/?roomId=${roomName}`} replace />;
  }

  if (!room) return <div style={{ color: "#fff", padding: 20 }}>Carregando sala...</div>;

  return <Room initialRoom={room} initialParticipants={participants} userId={userId} userName={userName} socket={socket} />;
}

export default function App() {
  return (
    <ThemeProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/room/:roomName" element={<MeetingWrapper />} />
        </Routes>
      </BrowserRouter>
    </ThemeProvider>
  );
}
