import { BrowserRouter, Routes, Route, Navigate, useParams } from "react-router-dom";
import Home from "./pages/Home";
import Room from "./pages/Room";
import { ThemeProvider } from "./context/ThemeContext";

// Componente que redireciona /room/:roomName (sem ?nome=) para /?roomId=...
function RoomGuard() {
  const { roomName } = useParams();
  const search = window.location.search;
  const params = new URLSearchParams(search);

  // Se já tem o nome, deixa entrar na sala
  if (params.get("nome")) {
    return <Room />;
  }

  // Se não tem nome, manda para a home com o roomId
  return <Navigate to={`/?roomId=${roomName}`} replace />;
}

export default function App() {
  return (
    <ThemeProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/room/:roomName" element={<RoomGuard />} />
        </Routes>
      </BrowserRouter>
    </ThemeProvider>
  );
}
