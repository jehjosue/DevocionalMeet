import React, { useState, useEffect, useRef } from 'react';
import { MicOff, User } from 'lucide-react';

interface ParticipantTileProps {
    key?: React.Key;
    participant: {
        userId: string;
        userName: string;
    };
    isLocal?: boolean;
    videoTrack?: any; // Agora Track
    localVideoRef?: React.RefObject<HTMLDivElement>;
    isSpeaking?: boolean;
    isMuted?: boolean;
    isCameraOff?: boolean;
    bgBlur?: boolean;
    style?: React.CSSProperties;
    className?: string;
}

export default function ParticipantTile({
    participant,
    isLocal,
    videoTrack,
    localVideoRef,
    isSpeaking,
    isMuted,
    isCameraOff,
    bgBlur,
    style,
    className
}: ParticipantTileProps) {
    const [hasError, setHasError] = useState(false);
    const remoteVideoRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (isLocal || !videoTrack || !remoteVideoRef.current) return;
        const container = remoteVideoRef.current;
        if (container.querySelector('video')) return;
        videoTrack.play(container);
        setTimeout(() => {
            const vid = container.querySelector('video') as HTMLVideoElement;
            if (vid) {
                vid.style.transform = 'none';
                vid.style.webkitTransform = 'none';
            }
            const wrap = container.querySelector('div');
            if (wrap) {
                wrap.style.transform = 'none';
                wrap.style.webkitTransform = 'none';
            }
        }, 150);
    }, [videoTrack, isLocal]);

    useEffect(() => {
        const container = isLocal
            ? localVideoRef?.current
            : remoteVideoRef.current;
        if (!container) return;

        const applyBlur = () => {
            const vid = container.querySelector('video') as HTMLVideoElement;
            if (!vid) return;

            if (bgBlur) {
                // Cria canvas sobreposto para efeito de desfoque no fundo
                vid.style.filter = 'none';
                vid.style.transform = isLocal ? 'scaleX(-1)' : 'none';

                // Desfoque via SVG filter (funciona em todos os browsers mobile)
                let blurDiv = container.querySelector('.blur-overlay') as HTMLElement;
                if (!blurDiv) {
                    blurDiv = document.createElement('div');
                    blurDiv.className = 'blur-overlay';
                    blurDiv.style.cssText = `
            position:absolute;inset:0;z-index:1;
            backdrop-filter:blur(16px);
            -webkit-backdrop-filter:blur(16px);
            pointer-events:none;
          `;
                    container.style.position = 'relative';
                    container.appendChild(blurDiv);
                }

                // Recorte central (rosto) sem desfoque
                blurDiv.style.cssText = `
          position:absolute;inset:0;z-index:1;
          background: transparent;
          pointer-events:none;
          --mask: radial-gradient(ellipse 55% 65% at 50% 40%, transparent 100%, black 100%);
          -webkit-mask-image: var(--mask);
          mask-image: var(--mask);
          backdrop-filter: blur(16px);
          -webkit-backdrop-filter: blur(16px);
        `;
            } else {
                // Remove desfoque
                const blurDiv = container.querySelector('.blur-overlay');
                if (blurDiv) blurDiv.remove();
            }
        };

        // Tenta aplicar imediatamente, retry se vídeo ainda não carregou
        applyBlur();
        const retry = setTimeout(applyBlur, 300);
        return () => clearTimeout(retry);
    }, [bgBlur, isLocal, localVideoRef]);

    return (
        <div
            className={`relative rounded-xl overflow-hidden bg-[#1C1C1C] border-2 transition-all duration-300 ${isSpeaking ? 'border-[#25D366]' : 'border-transparent'} ${className || ''}`}
            style={{
                ...style,
                animation: 'tileEnter 0.35s ease-out forwards',
            }}
        >
            {/* Video or Avatar */}
            <div className="w-full h-full flex items-center justify-center">
                {isCameraOff ? (
                    <div className="w-20 h-20 rounded-full bg-gray-700 flex items-center justify-center">
                        <User className="w-10 h-10 text-gray-400" />
                    </div>
                ) : (
                    <div
                        ref={isLocal ? localVideoRef : remoteVideoRef}
                        style={{
                            position: 'absolute',
                            inset: 0,
                            width: '100%',
                            height: '100%',
                        }}
                    />
                )}
            </div>

            {/* Info Bar */}
            <div
                className="absolute bottom-0 left-0 right-0 p-3 pt-8 pointer-events-none"
                style={{
                    background: 'linear-gradient(to top, rgba(0,0,0,0.8), transparent)'
                }}
            >
                <div className="flex items-center gap-2">
                    {isMuted && (
                        <div className="p-1 rounded-full bg-black/60 flex items-center justify-center">
                            <MicOff className="w-3.5 h-3.5 text-white" />
                        </div>
                    )}
                    <span className="text-white text-[0.75rem] font-medium font-sans">
                        {isLocal ? 'Você' : participant.userName}
                    </span>
                </div>
            </div>

            <style>{`
        @keyframes tileEnter {
          from { opacity: 0; transform: scale(0.9); }
          to { opacity: 1; transform: scale(1); }
        }
        @keyframes tileLeave {
          from { opacity: 1; transform: scale(1); }
          to { opacity: 0; transform: scale(0.9); }
        }
      `}</style>
        </div>
    );
}
