import { useEffect, useRef, useState } from 'react';

export function useLocalVideo() {
    const videoRef = useRef<HTMLVideoElement>(null);
    const streamRef = useRef<MediaStream | null>(null);
    const [stream, setStream] = useState<MediaStream | null>(null);

    useEffect(() => {
        // Iniciar câmera e microfone
        const startStream = async () => {
            try {
                const mediaStream = await navigator.mediaDevices.getUserMedia({
                    video: { facingMode: 'user', width: { ideal: 1280 }, height: { ideal: 720 } },
                    audio: true,
                });
                streamRef.current = mediaStream;
                setStream(mediaStream);
                if (videoRef.current) {
                    videoRef.current.srcObject = mediaStream;
                }
            } catch (err) {
                console.error("Erro ao acessar câmera/microfone:", err);
            }
        };

        startStream();

        return () => {
            streamRef.current?.getTracks().forEach(t => t.stop());
        };
    }, []);

    // Ativar PiP quando usuário sai da aba (document.hidden)
    useEffect(() => {
        const handleVisibilityChange = async () => {
            if (document.hidden && videoRef.current) {
                try {
                    if (document.pictureInPictureEnabled &&
                        videoRef.current !== document.pictureInPictureElement &&
                        videoRef.current.readyState >= 2) {
                        await videoRef.current.requestPictureInPicture();
                    }
                } catch (e) {
                    console.warn('PiP não disponível (aba escondida):', e);
                }
            } else {
                // Voltar da aba: sair do PiP se estiver ativo
                if (document.pictureInPictureElement) {
                    try {
                        await document.exitPictureInPicture();
                    } catch (e) { }
                }
            }
        };

        document.addEventListener('visibilitychange', handleVisibilityChange);
        return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
    }, []);

    // Ativar PiP ao sair da página (blur na window)
    useEffect(() => {
        const handleBlur = async () => {
            if (videoRef.current && document.pictureInPictureEnabled && videoRef.current.readyState >= 2) {
                try {
                    if (videoRef.current !== document.pictureInPictureElement) {
                        await videoRef.current.requestPictureInPicture();
                    }
                } catch (e) {
                    console.warn('PiP não disponível (window blur):', e);
                }
            }
        };
        window.addEventListener('blur', handleBlur);
        return () => window.removeEventListener('blur', handleBlur);
    }, []);

    return { videoRef, stream };
}
