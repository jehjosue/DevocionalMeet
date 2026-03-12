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
    }, [videoTrack, isLocal]);

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
                            width: '100%',
                            height: '100%',
                            overflow: 'hidden',
                            transform: isLocal ? 'scaleX(-1)' : 'none'
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
