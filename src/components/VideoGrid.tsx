import React from 'react';
import ParticipantTile from './ParticipantTile';

interface Participant {
    userId: string;
    userName: string;
}

interface VideoGridProps {
    participants: Participant[];
    userId: string;
    remoteUsers: any; // Agora remote users with tracks
    localVideoTrack?: any;
    localVideoRef: React.RefObject<HTMLDivElement>;
}

export default function VideoGrid({ participants, userId, remoteUsers, localVideoTrack, localVideoRef }: VideoGridProps) {
    const count = participants.length;

    const getGridStyle = (): React.CSSProperties => {
        if (count === 2) return {
            gridTemplateColumns: '1fr 1fr',
            gridTemplateRows: '1fr',
        };
        if (count === 3) return {
            gridTemplateColumns: '1fr 1fr',
            gridTemplateRows: '1fr 1fr',
            gridTemplateAreas: '"a a" "b c"',
        };
        if (count === 4) return {
            gridTemplateColumns: '1fr 1fr',
            gridTemplateRows: '1fr 1fr',
        };
        if (count <= 6) return {
            gridTemplateColumns: 'repeat(3, 1fr)',
            gridTemplateRows: 'repeat(2, 1fr)',
        };
        return {
            gridTemplateColumns: '1fr 1fr',
            gridAutoRows: 'minmax(180px, 1fr)',
            overflowY: 'auto',
        };
    };

    return (
        <div
            className="video-grid bg-[#000] p-2 gap-2 w-full h-full"
            style={{
                display: 'grid',
                ...getGridStyle(),
                animation: 'gridEntrance 0.45s ease-out forwards',
            }}
        >
            {participants.map((p, index) => {
                const isLocal = p.userId === userId;

                // Layout especial para 3 participantes
                let specialStyle: React.CSSProperties = {};
                if (count === 3) {
                    if (index === 0) specialStyle = { gridArea: 'a' };
                    else if (index === 1) specialStyle = { gridArea: 'b' };
                    else if (index === 2) specialStyle = { gridArea: 'c' };
                }

                return (
                    <ParticipantTile
                        key={p.userId}
                        participant={p}
                        isLocal={isLocal}
                        videoTrack={isLocal ? localVideoTrack : remoteUsers[p.userId]?.videoTrack}
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
