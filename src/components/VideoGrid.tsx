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
    bgBlur?: boolean;
}

export default function VideoGrid({ 
    participants, 
    userId, 
    remoteUsers, 
    localVideoTrack, 
    localVideoRef,
    bgBlur
}: VideoGridProps) {
    const count = participants.length;

    const getGridStyle = (): React.CSSProperties => {
        const isMobile = window.innerWidth < 768;
        const isTablet = window.innerWidth >= 768 && window.innerWidth < 1200;
        const isDesktop = window.innerWidth >= 1200;

        if (count === 1) return {
            gridTemplateColumns: '1fr',
            gridTemplateRows: '1fr',
        };

        if (count === 2) return {
            gridTemplateColumns: isMobile ? '1fr 1fr' : '1fr 1fr',
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

        if (count <= 6) {
            if (isMobile) return { gridTemplateColumns: 'repeat(2, 1fr)', gridAutoRows: '1fr' };
            return { gridTemplateColumns: 'repeat(3, 1fr)', gridTemplateRows: 'repeat(2, 1fr)' };
        }

        if (count <= 9) {
            if (isMobile) return { gridTemplateColumns: 'repeat(2, 1fr)', gridAutoRows: 'minmax(120px, 1fr)' };
            return { gridTemplateColumns: 'repeat(3, 1fr)', gridAutoRows: '1fr' };
        }

        if (count <= 12) {
            if (isMobile) return { gridTemplateColumns: 'repeat(2, 1fr)', gridAutoRows: 'minmax(100px, 1fr)' };
            if (isTablet) return { gridTemplateColumns: 'repeat(3, 1fr)', gridAutoRows: '1fr' };
            return { gridTemplateColumns: 'repeat(4, 1fr)', gridAutoRows: '1fr' };
        }

        if (count <= 16) {
            if (isMobile) return { gridTemplateColumns: 'repeat(2, 1fr)', gridAutoRows: 'minmax(90px, 1fr)' };
            if (isTablet) return { gridTemplateColumns: 'repeat(4, 1fr)', gridAutoRows: '1fr' };
            return { gridTemplateColumns: 'repeat(4, 1fr)', gridAutoRows: '1fr' };
        }

        if (count <= 25) {
            if (isMobile) return { gridTemplateColumns: 'repeat(3, 1fr)', gridAutoRows: 'minmax(80px, 1fr)' };
            if (isTablet) return { gridTemplateColumns: 'repeat(4, 1fr)', gridAutoRows: '1fr' };
            return { gridTemplateColumns: 'repeat(5, 1fr)', gridAutoRows: '1fr' };
        }

        if (count <= 36) {
            if (isMobile) return { gridTemplateColumns: 'repeat(3, 1fr)', gridAutoRows: 'minmax(70px, 1fr)' };
            if (isTablet) return { gridTemplateColumns: 'repeat(5, 1fr)', gridAutoRows: '1fr' };
            return { gridTemplateColumns: 'repeat(6, 1fr)', gridAutoRows: '1fr' };
        }

        // 37-50 pessoas
        if (isMobile) return { gridTemplateColumns: 'repeat(3, 1fr)', gridAutoRows: 'minmax(60px, 1fr)' };
        if (isTablet) return { gridTemplateColumns: 'repeat(6, 1fr)', gridAutoRows: '1fr' };
        return { gridTemplateColumns: 'repeat(7, 1fr)', gridAutoRows: '1fr' };
    };

    return (
        <div
            className="video-grid bg-[#000] p-2 gap-2 w-full h-full"
            style={{
                display: 'grid',
                ...getGridStyle(),
                gap: count > 16 ? '4px' : '8px',
                width: '100%',
                height: '100%',
                maxHeight: '100%',
                overflowY: count > 9 ? 'auto' : 'hidden',
                overflowX: 'hidden',
                padding: count > 16 ? '4px' : '8px',
                boxSizing: 'border-box',
                animation: 'gridEntrance 0.45s ease-out forwards',
            }}
        >
            {participants.map((p, index) => {
                const isLocal = p.userId === userId || p.userId === "local";

                // Layout especial para 3 participantes
                let specialStyle: React.CSSProperties = {};
                if (count === 3) {
                    if (index === 0) specialStyle = { gridArea: 'a' };
                    else if (index === 1) specialStyle = { gridArea: 'b' };
                    else if (index === 2) specialStyle = { gridArea: 'c' };
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
                        bgBlur={isLocal ? bgBlur : false}
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
