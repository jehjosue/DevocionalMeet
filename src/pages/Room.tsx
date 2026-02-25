import { useEffect, useState, useRef } from "react";
import { useParams, useNavigate, useSearchParams } from "react-router-dom";
import { JitsiMeeting } from "@jitsi/react-sdk";
import { Copy, LogOut, Shield, CheckCircle2, MicOff } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";

export default function Room() {
  const { roomName } = useParams();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [copied, setCopied] = useState(false);
  const [isReady, setIsReady] = useState(false);
  const jitsiApiRef = useRef<any>(null);

  const userName = localStorage.getItem("jitsi_user_name") || "Participante";
  // pwd agora contém a senha real (string) ou está vazio
  const roomPassword = searchParams.get("pwd") || "";
  const needsPassword = roomPassword.length > 0;

  const handleCopyLink = () => {
    const url = window.location.href.split("?")[0];
    navigator.clipboard.writeText(url);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleApiReady = (api: any) => {
    jitsiApiRef.current = api;
    setIsReady(true);

    // Garante que o nome seja aplicado imediatamente
    api.executeCommand("displayName", userName);

    // Aplica senha personalizada quando o usuário vira moderador
    if (needsPassword) {
      api.addEventListener("participantRoleChanged", (event: any) => {
        if (event.role === "moderator") {
          api.executeCommand("password", roomPassword);
        }
      });
    }
  };

  useEffect(() => {
    const timer = setTimeout(() => {
      alert("Devocional encerrando em 5 minutos.");
    }, 40 * 60 * 1000);
    return () => clearTimeout(timer);
  }, []);

  const handleReadyToClose = () => {
    navigate("/");
  };

  return (
    <div className="h-screen flex flex-col overflow-hidden" style={{ background: "#05060a" }}>
      {/* ── HEADER ── */}
      <header
        className="backdrop-blur-md p-4 flex items-center justify-between z-10"
        style={{
          background: "rgba(5,6,10,0.85)",
          borderBottom: "1px solid rgba(37,99,235,0.18)",
        }}
      >
        <div className="flex items-center gap-4">
          <div
            className="p-2 rounded-xl"
            style={{
              background: "linear-gradient(135deg, #0b3d91, #2563eb)",
              boxShadow: "0 0 18px rgba(37,99,235,0.35)",
            }}
          >
            <Shield className="w-5 h-5 text-white" />
          </div>
          <div>
            <h2 className="text-sm font-bold text-white truncate max-w-[150px] md:max-w-xs">
              {roomName}
            </h2>
            <p
              className="text-[10px] font-bold uppercase tracking-tighter"
              style={{ color: "rgba(255,255,255,0.35)" }}
            >
              Devocional em andamento
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* Copiar link */}
          <button
            onClick={handleCopyLink}
            className="flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all duration-200 active:scale-95"
            style={{
              background: copied
                ? "linear-gradient(135deg, #0b3d91, #2563eb)"
                : "rgba(255,255,255,0.05)",
              border: "1px solid rgba(37,99,235,0.25)",
              color: copied ? "#fff" : "rgba(255,255,255,0.7)",
            }}
          >
            {copied ? (
              <>
                <CheckCircle2 className="w-4 h-4" style={{ color: "#93c5fd" }} />
                Copiado!
              </>
            ) : (
              <>
                <Copy className="w-4 h-4" />
                Convidar
              </>
            )}
          </button>

          {/* Sair */}
          <button
            onClick={() => navigate("/")}
            className="p-2 rounded-xl transition-all duration-200 active:scale-95"
            style={{
              background: "rgba(239,68,68,0.08)",
              border: "1px solid rgba(239,68,68,0.2)",
              color: "#f87171",
            }}
            onMouseEnter={(e) => {
              (e.currentTarget as HTMLButtonElement).style.background = "#ef4444";
              (e.currentTarget as HTMLButtonElement).style.color = "#fff";
            }}
            onMouseLeave={(e) => {
              (e.currentTarget as HTMLButtonElement).style.background = "rgba(239,68,68,0.08)";
              (e.currentTarget as HTMLButtonElement).style.color = "#f87171";
            }}
          >
            <LogOut className="w-5 h-5" />
          </button>
        </div>
      </header>

      {/* ── JITSI ── */}
      <main className="flex-1 relative" style={{ background: "#0d0e14" }}>
        {!isReady && (
          <div className="absolute inset-0 flex flex-col items-center justify-center space-y-4 z-0">
            <div
              className="w-12 h-12 border-4 rounded-full animate-spin"
              style={{
                borderColor: "rgba(37,99,235,0.15)",
                borderTopColor: "#2563eb",
              }}
            />
            <p
              className="text-xs font-bold uppercase tracking-widest"
              style={{ color: "rgba(255,255,255,0.3)" }}
            >
              Preparando Sala...
            </p>
          </div>
        )}

        {/* ── BANNER PARA ESPECTADORES ── */}
        <div
          className="flex items-center justify-center gap-3 py-2 px-4 shadow-lg z-10"
          style={{ background: "rgba(37,99,235,0.08)", borderBottom: "1px solid rgba(37,99,235,0.15)" }}
        >
          <MicOff className="w-4 h-4 text-blue-400" />
          <p className="text-[11px] font-bold text-blue-100 uppercase tracking-wider">
            Se estiver só assistindo, mantenha o microfone desligado.
          </p>
        </div>

        <div className="w-full h-full">
          <JitsiMeeting
            domain="meet.jit.si"
            roomName={roomName || "devocional-geral"}
            configOverwrite={{
              prejoinPageEnabled: false,
              startWithAudioMuted: true,
              startWithVideoMuted: true,
              disableModeratorIndicator: true,
              startScreenSharing: false,
              enableEmailInStats: false,
              disableDeepLinking: true,
              disableReactions: true,
              disablePolls: true,
              // Apenas botões essenciais
              toolbarButtons: [
                "microphone",
                "camera",
                "desktop",
                "chat",
                "participants-pane",
                "hangup",
                "fullscreen",
              ],
            }}
            interfaceConfigOverwrite={{
              SHOW_JITSI_WATERMARK: false,
              SHOW_WATERMARK_FOR_GUESTS: false,
              HIDE_DEEP_LINKING_LOGO: true,
              SHOW_BRAND_WATERMARK: false,
              SHOW_POWERED_BY: false,
              DISABLE_JOIN_LEAVE_NOTIFICATIONS: true,
              DISABLE_FOCUS_INDICATOR: true,
              DEFAULT_BACKGROUND: "#05060a",
              TOOLBAR_ALWAYS_VISIBLE: false,
            }}
            userInfo={{ displayName: userName, email: "" }}
            onApiReady={handleApiReady}
            onReadyToClose={handleReadyToClose}
            getIFrameRef={(iframeRef) => {
              iframeRef.style.height = "100%";
              iframeRef.style.width = "100%";
              iframeRef.style.border = "none";
            }}
          />
        </div>
      </main>

      {/* ── AVISO SENHA ── */}
      <AnimatePresence>
        {needsPassword && isReady && (
          <motion.div
            initial={{ y: 100, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 100, opacity: 0 }}
            className="fixed bottom-6 left-1/2 -translate-x-1/2 px-6 py-3 rounded-2xl shadow-2xl flex items-center gap-3 z-50 font-bold text-sm"
            style={{
              background: "linear-gradient(135deg, #0b3d91, #1e3a8a)",
              color: "#fff",
              border: "1px solid rgba(37,99,235,0.4)",
            }}
          >
            <Shield className="w-5 h-5 text-blue-300" />
            Lembre-se de definir uma senha nas "Opções de Segurança" do Jitsi!
            <button
              onClick={() => navigate(window.location.pathname)}
              className="p-1 rounded-lg transition-colors"
              style={{ background: "rgba(255,255,255,0.1)" }}
            >
              <CheckCircle2 className="w-4 h-4" />
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
