import { useState, useEffect, useRef, useCallback } from 'react';
import { SelfieSegmentation } from '@mediapipe/selfie_segmentation';

export function useBackgroundBlur() {
  const [isBlurEnabled, setIsBlurEnabled] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [blurredStream, setBlurredStream] = useState<MediaStream | null>(null);
  
  const selfieSegmentationRef = useRef<SelfieSegmentation | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const requestRef = useRef<number>();
  const originalStreamRef = useRef<MediaStream | null>(null);

  const onResults = useCallback((results: any) => {
    if (!canvasRef.current) return;
    const ctx = canvasRef.current.getContext('2d');
    if (!ctx) return;

    const { width, height } = canvasRef.current;

    ctx.save();
    ctx.clearRect(0, 0, width, height);

    // 1. Desenha a máscara de segmentação
    ctx.drawImage(results.segmentationMask, 0, 0, width, height);
    
    // 2. Aplica a máscara (só a pessoa fica visível)
    ctx.globalCompositeOperation = 'source-in';
    ctx.drawImage(results.image, 0, 0, width, height);

    // 3. Desfoca o fundo
    ctx.globalCompositeOperation = 'destination-atop';
    ctx.filter = 'blur(12px)';
    ctx.drawImage(results.image, 0, 0, width, height);

    ctx.restore();
  }, []);

  const startBlur = async (stream: MediaStream) => {
    if (!stream) return;
    setIsLoading(true);
    originalStreamRef.current = stream;

    if (!selfieSegmentationRef.current) {
      selfieSegmentationRef.current = new SelfieSegmentation({
        locateFile: (file) => `https://cdn.jsdelivr.net/npm/@mediapipe/selfie_segmentation/${file}`
      });

      selfieSegmentationRef.current.setOptions({
        modelSelection: window.innerWidth < 768 ? 0 : 1,
      });

      selfieSegmentationRef.current.onResults(onResults);
    }

    if (!videoRef.current) {
      videoRef.current = document.createElement('video');
    }
    videoRef.current.srcObject = stream;
    await videoRef.current.play();

    if (!canvasRef.current) {
      canvasRef.current = document.createElement('canvas');
    }
    canvasRef.current.width = videoRef.current.videoWidth;
    canvasRef.current.height = videoRef.current.videoHeight;

    const processFrame = async () => {
      if (videoRef.current && selfieSegmentationRef.current && isBlurEnabled) {
        await selfieSegmentationRef.current.send({ image: videoRef.current });
      }
      if (isBlurEnabled) {
        requestRef.current = requestAnimationFrame(processFrame);
      }
    };

    setIsBlurEnabled(true);
    setIsLoading(false);
    processFrame();

    const canvasStream = canvasRef.current.captureStream(window.innerWidth < 768 ? 24 : 30);
    setBlurredStream(canvasStream);
  };

  const stopBlur = () => {
    setIsBlurEnabled(false);
    if (requestRef.current) {
        cancelAnimationFrame(requestRef.current);
    }
    setBlurredStream(null);
  };

  const toggleBlur = async (stream: MediaStream) => {
    if (isBlurEnabled) {
      stopBlur();
    } else {
      await startBlur(stream);
    }
  };

  useEffect(() => {
    return () => {
      if (requestRef.current) cancelAnimationFrame(requestRef.current);
      if (selfieSegmentationRef.current) selfieSegmentationRef.current.close();
    };
  }, []);

  return { isBlurEnabled, toggleBlur, blurredStream, isLoading };
}
