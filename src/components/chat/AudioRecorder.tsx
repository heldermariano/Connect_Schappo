'use client';

import { useState, useRef, useEffect, useCallback } from 'react';

interface AudioRecorderProps {
  onRecordingComplete: (file: File) => void;
  onCancel: () => void;
  disabled?: boolean;
}

const MAX_DURATION = 5 * 60; // 5 minutos

function formatTimer(seconds: number): string {
  const m = Math.floor(seconds / 60).toString().padStart(2, '0');
  const s = (seconds % 60).toString().padStart(2, '0');
  return `${m}:${s}`;
}

// Formato de gravacao: priorizar ogg (aceito nativamente pelo WhatsApp)
// Firefox suporta ogg. Chrome suporta webm (convertido no server via ffmpeg).
// MP4 do MediaRecorder NAO e compativel com WhatsApp (aceita upload mas nao entrega).
function getBestMimeType(): { mimeType: string; ext: string } {
  const candidates = [
    { mime: 'audio/ogg;codecs=opus', ext: 'ogg' },
    { mime: 'audio/ogg', ext: 'ogg' },
    { mime: 'audio/webm;codecs=opus', ext: 'webm' },
    { mime: 'audio/webm', ext: 'webm' },
  ];
  for (const c of candidates) {
    if (MediaRecorder.isTypeSupported(c.mime)) {
      return { mimeType: c.mime, ext: c.ext };
    }
  }
  return { mimeType: '', ext: 'webm' };
}

export default function AudioRecorder({ onRecordingComplete, onCancel, disabled }: AudioRecorderProps) {
  const [recording, setRecording] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const streamRef = useRef<MediaStream | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const mountedRef = useRef(false);

  const stopStream = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  const startRecording = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;

      const { mimeType, ext } = getBestMimeType();

      const recorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);
      mediaRecorderRef.current = recorder;
      chunksRef.current = [];

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };

      recorder.onstop = () => {
        const actualMime = recorder.mimeType || mimeType || 'audio/webm';
        const blob = new Blob(chunksRef.current, { type: actualMime });
        const now = new Date();
        const ts = now.toISOString().replace(/[-:T]/g, '').slice(0, 15);
        const file = new File([blob], `audio_${ts}.${ext}`, { type: actualMime });
        onRecordingComplete(file);
      };

      recorder.start(1000);
      setRecording(true);
      setElapsed(0);
      setError(null);

      timerRef.current = setInterval(() => {
        setElapsed((prev) => {
          if (prev + 1 >= MAX_DURATION) {
            recorder.stop();
            return prev + 1;
          }
          return prev + 1;
        });
      }, 1000);
    } catch {
      setError('Permissao de microfone negada');
    }
  }, [onRecordingComplete]);

  // Iniciar gravacao ao montar — guard contra React Strict Mode (double mount)
  useEffect(() => {
    if (mountedRef.current) return; // Ja iniciou na primeira montagem
    mountedRef.current = true;

    if (!disabled) startRecording();

    return () => {
      stopStream();
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const handleStop = useCallback(() => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop();
    }
    stopStream();
    setRecording(false);
  }, [stopStream]);

  const handleCancel = useCallback(() => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.onstop = null;
      mediaRecorderRef.current.stop();
    }
    stopStream();
    setRecording(false);
    onCancel();
  }, [stopStream, onCancel]);

  if (error) {
    return (
      <div className="flex items-center gap-3 px-4 py-3 bg-red-50 text-red-600 text-sm">
        <span>{error}</span>
        <button onClick={onCancel} className="ml-auto text-red-400 hover:text-red-600 text-xs underline">
          Fechar
        </button>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-3 px-4 py-3 bg-red-50">
      {/* Indicador pulsante */}
      <div className="flex items-center gap-2">
        <span className="w-3 h-3 rounded-full bg-red-500 animate-pulse" />
        <span className="text-sm font-medium text-red-700">Gravando</span>
      </div>

      {/* Timer */}
      <span className="text-sm font-mono text-red-600">{formatTimer(elapsed)}</span>

      <div className="flex-1" />

      {/* Cancelar */}
      <button
        onClick={handleCancel}
        className="p-2 text-gray-400 hover:text-red-500 transition-colors"
        title="Cancelar gravacao"
        type="button"
      >
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
        </svg>
      </button>

      {/* Enviar */}
      {recording && (
        <button
          onClick={handleStop}
          className="p-2 bg-schappo-600 text-white rounded-full hover:bg-schappo-700 transition-colors"
          title="Parar e enviar audio"
          type="button"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
          </svg>
        </button>
      )}
    </div>
  );
}
