/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { BrowserRouter, Routes, Route } from "react-router-dom";
import Home from "./pages/Home";
import Room from "./pages/Room";
import LobbyPage from "./pages/LobbyPage";
import { ThemeProvider } from "./context/ThemeContext";

export default function App() {
  return (
    <ThemeProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/room/:roomName" element={<Room />} />
          <Route path="/pre/:roomName" element={<LobbyPage />} />
        </Routes>
      </BrowserRouter>
    </ThemeProvider>
  );
}
