import { useState, useEffect, useCallback } from 'react';
import { io, Socket } from 'socket.io-client';
import { SOCKET_URL } from '../config';

export function useRoom() {
    const [room, setRoom] = useState<any>(null);
    const [participants, setParticipants] = useState<any[]>([]);
    const [isCreating, setIsCreating] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [socket, setSocket] = useState<Socket | null>(null);

    useEffect(() => {
        const s = io(SOCKET_URL, { transports: ["websocket", "polling"] });
        setSocket(s);

        s.on('room:synced', ({ participants }) => {
            setParticipants(participants);
        });

        s.on('room:participantJoined', ({ participant }) => {
            setParticipants(p => {
                if (p.find(x => x.userId === participant.userId)) return p;
                return [...p, participant];
            });
        });

        s.on('room:participantLeft', ({ userId }) => {
            setParticipants(p => p.filter(x => x.userId !== userId));
        });

        s.on('room:error', ({ message }) => {
            setError(message);
        });

        return () => {
            s.disconnect();
        };
    }, []);

    const createRoom = useCallback(async (userId: string, userName: string) => {
        setIsCreating(true);
        setError(null);
        try {
            const res = await fetch(`${SOCKET_URL}/rooms/create`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ userId, userName }),
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error);
            setRoom(data);
            return data;
        } catch (err: any) {
            setError(err.message);
            return null;
        } finally {
            setIsCreating(false);
        }
    }, [socket]);

  const joinRoom = useCallback(async (code: string, userId: string, userName: string) => {
    setError(null);
    try {
      const API = 'https://api.devocionalmeet.shop';
      const res = await fetch(`${API}/rooms/${code}`);
      
      if (!res.ok) {
        // Sala pode não existir ainda, tenta entrar via socket mesmo assim
        socket?.emit('room:join', { code, userId, userName });
        setRoom({ code, hostId: null });
        return { code };
      }
      
      const data = await res.json();
      setRoom({ ...data, code });
      socket?.emit('room:join', { code, userId, userName });
      return data;
    } catch (err: any) {
      // Se API falhar, entra via socket mesmo assim
      socket?.emit('room:join', { code, userId, userName });
      setRoom({ code, hostId: null });
      return { code };
    }
  }, [socket]);

    const leaveRoom = useCallback((code: string, userId: string) => {
        socket?.emit('room:leave', { code, userId });
        setRoom(null);
        setParticipants([]);
    }, [socket]);

    return { room, participants, isCreating, error, createRoom, joinRoom, leaveRoom, socket };
}
