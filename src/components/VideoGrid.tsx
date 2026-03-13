import React from 'react';
import ParticipantTile from './ParticipantTile';

interface Participant {
    userId: string;
    userName: string;
}

interface VideoGridProps {
    participants: Participant[];
    userId: string;
    remoteUsers: Record<string, any>; // Agora remote users with tracks
    localVideoTrack?: any;
    localVideoRef: React.RefObject<HTMLDivElement>;
}

export default function VideoGrid({ participants, userId, remoteUsers, localVideoTrack, localVideoRef }: VideoGridProps) {
    const count = participants.length;

    const getGridStyle = (): React.CSSProperties => {
        const isMobile = window.innerWidth < 768;

        if (count === 1) return { gridTemplateColumns: '1fr', gridTemplateRows: '1fr' };
        
        if (count === 2) {
            return {
                gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr',
                gridTemplateRows: isMobile ? '1fr 1fr' : '1fr',
            };
        }

        if (count === 3) {
            return {
                gridTemplateColumns: '1fr 1fr',
                gridTemplateRows: '1fr 1fr',
                gridTemplateAreas: isMobile ? '"a a" "b c"' : '"a a" "b c"',
            };
        }

        if (count === 4) return { gridTemplateColumns: 'repeat(2, 1fr)', gridTemplateRows: 'repeat(2, 1fr)' };
        
        if (count <= 6) {
            return {
                gridTemplateColumns: isMobile ? 'repeat(2, 1fr)' : 'repeat(3, 1fr)',
                gridTemplateRows: isMobile ? 'repeat(3, 1fr)' : 'repeat(2, 1fr)',
            };
        }

        // 7-9+ participantes
        const cols = isMobile ? 2 : 3;
        return {
            gridTemplateColumns: `repeat(${cols}, 1fr)`,
            gridAutoRows: '1fr',
        };
    };

    return (
        <div
            className="video-grid"
            style={{
                display: 'grid',
                ...getGridStyle(),
                gap: '8px',
                width: '100%',
                height: '100%',
                maxHeight: '100%',
                overflowY: count > 6 ? 'auto' : 'hidden',
                padding: '8px',
                boxSizing: 'border-box',
                transition: 'all 0.3s ease',
            }}
        >
            {participants.map((p, index) => {
                const isLocal = p.userId === userId || p.userId === "local";

                let specialStyle: React.CSSProperties = {
                    transition: 'all 0.3s ease',
                    aspectRatio: '16/9',
                    width: '100%',
                    height: '100%',
                    objectFit: 'cover',
                    borderRadius: '12px',
                    overflow: 'hidden'
                };

                if (count === 3) {
                    if (index === 0) specialStyle.gridArea = 'a';
                    else if (index === 1) specialStyle.gridArea = 'b';
                    else if (index === 2) specialStyle.gridArea = 'c';
                }

                const remoteUser = !isLocal ? remoteUsers[p.userId] : undefined;
                const videoTrack = isLocal ? localVideoTrack : remoteUser?.videoTrack;

                return (
                    <ParticipantTile
                        key={p.userId}
                        participant={p}
                        isLocal={isLocal}
                        videoTrack={videoTrack}
                        localVideoRef={isLocal ? localVideoRef : undefined}
                        style={specialStyle}
                    />
                );
            })}

            <style>{`
        @keyframes gridEntrance {
          from { opacity: 0; transform: scale(0.98); }
          to { opacity: 1; transform: scale(1); }
        }
        .video-grid::-webkit-scrollbar {
          width: 8px;
        }
        .video-grid::-webkit-scrollbar-track {
          background: transparent;
        }
        .video-grid::-webkit-scrollbar-thumb {
          background: #333;
          border-radius: 4px;
        }
      `}</style>
        </div>
    );
}
