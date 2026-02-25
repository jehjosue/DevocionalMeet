import { useEffect, useState, useCallback, useRef } from "react";
import { useParams, useNavigate, useSearchParams } from "react-router-dom";
import { JitsiMeeting } from "@jitsi/react-sdk";
import { Copy, LogOut, Shield, CheckCircle2 } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";

export default function Room() {
  const { roomName } = useParams();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [copied, setCopied] = useState(false);
  const [isReady, setIsReady] = useState(false);
  const jitsiApiRef = useRef<any>(null);

  const userName = localStorage.getItem("jitsi_user_name") || "Participante";
  const needsPassword = searchParams.get("pwd") === "true";

  const handleCopyLink = () => {
    const url = window.location.href.split('?')[0]; // Remove query params para o link compartilhado
    navigator.clipboard.writeText(url);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleApiReady = (api: any) => {
    jitsiApiRef.current = api;
    setIsReady(true);
    
    // Configurações iniciais
    api.executeCommand('displayName', userName);
    
    if (needsPassword) {
      // O Jitsi público exige que um moderador defina a senha após entrar
      // Mostramos um aviso para o usuário
    }
  };

  const handleReadyToClose = () => {
    navigate("/");
  };

  return (
    <div className="h-screen bg-zinc-950 flex flex-col overflow-hidden">
      {/* Header Minimalista */}
      <header className="bg-zinc-900/50 backdrop-blur-md border-b border-zinc-800 p-4 flex items-center justify-between z-10">
        <div className="flex items-center gap-4">
          <div className="bg-indigo-600 p-2 rounded-xl">
            <Shield className="w-5 h-5 text-white" />
          </div>
          <div>
            <h2 className="text-sm font-bold text-white truncate max-w-[150px] md:max-w-xs">
              {roomName}
            </h2>
            <p className="text-[10px] text-zinc-500 font-bold uppercase tracking-tighter">
              Devocional em andamento
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={handleCopyLink}
            className="flex items-center gap-2 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 px-4 py-2 rounded-xl text-xs font-bold transition-all active:scale-95"
          >
            {copied ? (
              <>
                <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                Copiado!
              </>
            ) : (
              <>
                <Copy className="w-4 h-4" />
                Convidar
              </>
            )}
          </button>

          <button
            onClick={() => navigate("/")}
            className="bg-red-500/10 hover:bg-red-500 text-red-500 hover:text-white p-2 rounded-xl transition-all active:scale-95 border border-red-500/20"
          >
            <LogOut className="w-5 h-5" />
          </button>
        </div>
      </header>

      {/* Container do Jitsi */}
      <main className="flex-1 relative bg-zinc-900">
        {!isReady && (
          <div className="absolute inset-0 flex flex-col items-center justify-center space-y-4 z-0">
            <div className="w-12 h-12 border-4 border-indigo-500/20 border-t-indigo-500 rounded-full animate-spin" />
            <p className="text-zinc-500 text-xs font-bold uppercase tracking-widest">Preparando Sala...</p>
          </div>
        )}
        
        <div className="w-full h-full">
          <JitsiMeeting
            domain="meet.jit.si"
            roomName={roomName || "devocional-geral"}
            configOverwrite={{
              startWithAudioMuted: true,
              disableModeratorIndicator: true,
              startScreenSharing: false,
              enableEmailInStats: false,
              prejoinPageEnabled: false, // Desabilitado para entrar mais rápido
              toolbarButtons: [
                'microphone', 'camera', 'closedcaptions', 'desktop', 'fullscreen',
                'fodeviceselection', 'hangup', 'profile', 'chat', 'recording',
                'livestreaming', 'etherpad', 'sharedvideo', 'settings', 'raisehand',
                'videoquality', 'filmstrip', 'invite', 'feedback', 'stats', 'shortcuts',
                'tileview', 'videobackgroundblur', 'download', 'help', 'mute-everyone',
                'security'
              ],
            }}
            interfaceConfigOverwrite={{
              DISABLE_JOIN_LEAVE_NOTIFICATIONS: true,
              SHOW_JITSI_WATERMARK: false,
              HIDE_DEEP_LINKING_LOGO: true,
            }}
            userInfo={{
              displayName: userName,
              email: '', // Email opcional mas exigido pela tipagem do SDK
            }}
            onApiReady={handleApiReady}
            onReadyToClose={handleReadyToClose}
            getIFrameRef={(iframeRef) => {
              iframeRef.style.height = '100%';
              iframeRef.style.width = '100%';
              iframeRef.style.border = 'none';
            }}
          />
        </div>
      </main>

      {/* Aviso de Senha */}
      <AnimatePresence>
        {needsPassword && isReady && (
          <motion.div 
            initial={{ y: 100, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 100, opacity: 0 }}
            className="fixed bottom-6 left-1/2 -translate-x-1/2 bg-amber-500 text-amber-950 px-6 py-3 rounded-2xl shadow-2xl flex items-center gap-3 z-50 font-bold text-sm"
          >
            <Shield className="w-5 h-5" />
            Lembre-se de definir uma senha nas "Opções de Segurança" do Jitsi!
            <button 
              onClick={() => navigate(window.location.pathname)} // Remove o aviso da URL
              className="bg-amber-950/10 hover:bg-amber-950/20 p-1 rounded-lg transition-colors"
            >
              <CheckCircle2 className="w-4 h-4" />
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
