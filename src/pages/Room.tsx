import { useEffect, useState, useRef } from \"react\";
import { useParams, useNavigate, useSearchParams } from \"react-router-dom\";
import { Copy, LogOut, Shield, CheckCircle2, Mic, MicOff, Video, VideoOff } from \"lucide-react\";

declare const AgoraRTC: any;

export default function Room() {
  const { roomName } = useParams();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [copied, setCopied] = useState(false);
  const [joined, setJoined] = useState(false);

  const clientRef = useRef<any>(null);
  const localTracksRef = useRef<any[]>([]);
  const videoContainerRef = useRef<HTMLDivElement>(null);

  const userName = localStorage.getItem(\"devocional_user_name\") || \"Participante\";
  const appId = import.meta.env.VITE_AGORA_APP_ID;

  const [micOn, setMicOn] = useState(true);
  const [videoOn, setVideoOn] = useState(true);

  useEffect(() => {
    const initAgora = async () => {
      if (!appId || !roomName) return;

      try {
        clientRef.current = AgoraRTC.createClient({
          mode: \"rtc\", codec: \"vp8\" });
        await clientRef.current.join(appId, roomName, null, null);

          const [audioTrack, videoTrack] = await AgoraRTC.createMicrophoneAndCameraTracks();
          localTracksRef.current = [audioTrack, videoTrack];

          const localPlayer = document.createElement(\"div\");
        localPlayer.className = \"video-player local\";
        localPlayer.id = \"local-player\";
        videoContainerRef.current?.append(localPlayer);
          videoTrack.play(localPlayer);

          await clientRef.current.publish(localTracksRef.current);
          setJoined(true);

        clientRef.current.on(\"user-published\", async (user: any, mediaType: string) => {
          await clientRef.current.subscribe(user, mediaType);
          if(mediaType === \"video\") {
            const remotePlayer = document.createElement(\"div\");
            remotePlayer.className = \"video-player\";
            remotePlayer.id = user.uid.toString();
        videoContainerRef.current?.append(remotePlayer);
        user.videoTrack.play(remotePlayer);
      }
          if (mediaType === \"audio\") {
      user.audioTrack.play();
    }
  });

  clientRef.current.on(\"user-unpublished\", (user: any) => {
          const remotePlayer = document.getElementById(user.uid.toString());
  remotePlayer?.remove();
});

      } catch (err) {
  console.error(\"Agora init error:\", err);
      }
    };

initAgora();

return () => {
  localTracksRef.current.forEach(t => {
    t.stop();
    t.close();
  });
  clientRef.current?.leave();
  if (videoContainerRef.current) videoContainerRef.current.innerHTML = \"\";
};
  }, [roomName, appId]);

const toggleMic = async () => {
  if (localTracksRef.current[0]) {
    await localTracksRef.current[0].setEnabled(!micOn);
    setMicOn(!micOn);
  }
};

const toggleVideo = async () => {
  if (localTracksRef.current[1]) {
    await localTracksRef.current[1].setEnabled(!videoOn);
    setVideoOn(!videoOn);
  }
};

const handleCopyLink = () => {
  navigator.clipboard.writeText(window.location.href);
  setCopied(true);
  setTimeout(() => setCopied(false), 2000);
};

return (
  <div className=\"h-screen flex flex-col\" style={{ background: \"#05060a\", color: \"#f0f4ff\" }}>
    < header className =\"p-4 flex items-center justify-between border-b border-blue-900/30 backdrop-blur-md\">
      < div className =\"flex items-center gap-4\">
        < div className =\"p-2 rounded-xl bg-blue-600 shadow-lg shadow-blue-900/40\">
          < Shield className =\"w-5 h-5 text-white\" />
          </div >
          <div>
            <h2 className=\"text-sm font-bold truncate\">{roomName}</h2>
            <p className=\"text-[10px] opacity-40 uppercase tracking-tighter font-bold\">Sala de Devocional</p>
          </div >
        </div >

  <div className=\"flex items-center gap-2\">
    < button onClick = { handleCopyLink } className = {`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all ${copied ? 'bg-blue-600 text-white' : 'bg-white/5 border border-blue-900/30 text-white/70'}`}>
      {
        copied?<CheckCircle2 className =\"w-4 h-4\" /> : <Copy className=\"w-4 h-4\" />}
            {
            copied?\"Copiado!\" : \"Convidar\"}
          </button>
          <button onClick={() => navigate(\"/\")} className=\"p-2 rounded-xl bg-red-500/10 border border-red-500/20 text-red-500 hover:bg-red-500 hover:text-white\">
            <LogOut className=\"w-5 h-5\" />
          </button>
        </div>
      </header>

      <main className=\"flex-1 relative bg-[#0d0e14]\">
        <div ref={videoContainerRef} className=\"w-full h-full grid grid-cols-1 md:grid-cols-2 gap-4 p-4\" />
        
        {!joined && (
          <div className=\"absolute inset-0 flex flex-col items-center justify-center gap-4 z-40 bg-[#05060a]\">
            <div className=\"w-10 h-10 border-4 border-blue-600 border-t-transparent rounded-full animate-spin\" />
            <p className=\"text-xs font-bold uppercase tracking-widest opacity-30\">Entrando...</p>
          </div>
        )}

        <div className=\"absolute bottom-8 left-1/2 -translate-x-1/2 flex items-center gap-4 p-3 bg-black/40 backdrop-blur-xl border border-white/10 rounded-2xl shadow-2xl z-50\">
          <button onClick = { toggleMic } className = {`p-4 rounded-xl transition-all ${!micOn ? 'bg-red-500' : 'bg-white/10 hover:bg-white/20'}`}>
          {
            micOn?<Mic className =\"w-5 h-5\" /> : <MicOff className=\"w-5 h-5\" />}
          </button>
            <button onClick={toggleVideo} className={`p-4 rounded-xl transition-all ${!videoOn ? 'bg-red-500' : 'bg-white/10 hover:bg-white/20'}`}>
              {videoOn ? <Video className=\"w-5 h-5\" /> : <VideoOff className=\"w-5 h-5\" />}
            </button>
        </div >
      </main >

  <style>{`
        .video-player { width: 100%; aspect-ratio: 16/9; background: #000; border-radius: 16px; border: 1px solid rgba(255,255,255,0.1); overflow: hidden; }
        .video-player.local { order: -1; border-color: rgba(37,99,235,0.4); }
        video { object-fit: cover !important; }
      `}</style>
    </div >
  );
}
