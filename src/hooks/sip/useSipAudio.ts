'use client';

import { useState, useRef, useCallback } from 'react';
import type { Session } from 'sip.js';
import type { SipCallState } from '@/lib/types';

export interface UseSipAudioReturn {
  isMuted: boolean;
  isOnHold: boolean;
  callDuration: number;
  toggleMute: () => void;
  toggleHold: () => Promise<void>;
  sendDTMF: (digit: string) => void;
  getRemoteAudio: () => HTMLAudioElement;
  getRingtone: () => HTMLAudioElement;
  startDurationTimer: () => void;
  stopDurationTimer: () => void;
  setupSessionMedia: (session: Session) => void;
  cleanupAudio: () => void;
}

export function useSipAudio(
  sessionRef: React.MutableRefObject<Session | null>,
  callStateRef: React.MutableRefObject<SipCallState>,
  setCallState: (state: SipCallState) => void,
): UseSipAudioReturn {
  const [isMuted, setIsMuted] = useState(false);
  const [isOnHold, setIsOnHold] = useState(false);
  const [callDuration, setCallDuration] = useState(0);

  const remoteAudioRef = useRef<HTMLAudioElement | null>(null);
  const ringtoneRef = useRef<HTMLAudioElement | null>(null);
  const durationTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Inicializar audio elements (lazy)
  const getRemoteAudio = useCallback(() => {
    if (!remoteAudioRef.current) {
      remoteAudioRef.current = document.getElementById('sip-remote-audio') as HTMLAudioElement;
      if (!remoteAudioRef.current) {
        const el = document.createElement('audio');
        el.id = 'sip-remote-audio';
        el.autoplay = true;
        el.style.display = 'none';
        document.body.appendChild(el);
        remoteAudioRef.current = el;
      }
    }
    return remoteAudioRef.current;
  }, []);

  const getRingtone = useCallback(() => {
    if (!ringtoneRef.current) {
      ringtoneRef.current = document.getElementById('sip-ringtone') as HTMLAudioElement;
      if (!ringtoneRef.current) {
        const el = document.createElement('audio');
        el.id = 'sip-ringtone';
        el.src = '/sounds/ringtone.wav';
        el.loop = true;
        el.style.display = 'none';
        document.body.appendChild(el);
        ringtoneRef.current = el;
      }
    }
    return ringtoneRef.current;
  }, []);

  // Iniciar timer de duracao
  const startDurationTimer = useCallback(() => {
    setCallDuration(0);
    durationTimerRef.current = setInterval(() => {
      setCallDuration((prev) => prev + 1);
    }, 1000);
  }, []);

  const stopDurationTimer = useCallback(() => {
    if (durationTimerRef.current) {
      clearInterval(durationTimerRef.current);
      durationTimerRef.current = null;
    }
  }, []);

  // Setup media para sessao ativa
  const setupSessionMedia = useCallback((session: Session) => {
    const remoteAudio = getRemoteAudio();

    const peerConnection = (session as unknown as { sessionDescriptionHandler?: { peerConnection?: RTCPeerConnection } }).sessionDescriptionHandler?.peerConnection;
    if (!peerConnection) {
      console.warn('[SIP] setupSessionMedia: peerConnection nao encontrado');
      return;
    }

    console.log('[SIP] setupSessionMedia: configurando midia');
    console.log('[SIP] ICE connectionState:', peerConnection.iceConnectionState);
    console.log('[SIP] ICE gatheringState:', peerConnection.iceGatheringState);
    console.log('[SIP] signaling state:', peerConnection.signalingState);

    // Monitorar estado ICE
    peerConnection.oniceconnectionstatechange = () => {
      console.log('[SIP] ICE connectionState mudou:', peerConnection.iceConnectionState);
    };
    peerConnection.onconnectionstatechange = () => {
      console.log('[SIP] connectionState mudou:', peerConnection.connectionState);
    };
    peerConnection.onicegatheringstatechange = () => {
      console.log('[SIP] ICE gatheringState mudou:', peerConnection.iceGatheringState);
    };
    peerConnection.onicecandidate = (event) => {
      if (event.candidate) {
        console.log('[SIP] ICE candidate:', event.candidate.candidate);
      } else {
        console.log('[SIP] ICE gathering completo');
      }
    };

    // Escutar tracks remotos
    peerConnection.ontrack = (event) => {
      console.log('[SIP] ontrack recebido:', event.track.kind, 'readyState:', event.track.readyState);
      if (event.streams[0]) {
        remoteAudio.srcObject = event.streams[0];
        console.log('[SIP] remoteAudio.srcObject configurado, tracks:', event.streams[0].getTracks().map(t => `${t.kind}:${t.readyState}`));
      }
    };

    // Se ja tem streams, conectar
    const receivers = peerConnection.getReceivers();
    console.log('[SIP] receivers existentes:', receivers.length);
    if (receivers.length > 0) {
      const stream = new MediaStream();
      receivers.forEach((r) => {
        if (r.track) {
          stream.addTrack(r.track);
          console.log('[SIP] track adicionada:', r.track.kind, 'enabled:', r.track.enabled, 'readyState:', r.track.readyState);
        }
      });
      remoteAudio.srcObject = stream;
    }

    // Log senders (audio local)
    const senders = peerConnection.getSenders();
    console.log('[SIP] senders:', senders.length);
    senders.forEach((s) => {
      if (s.track) {
        console.log('[SIP] sender track:', s.track.kind, 'enabled:', s.track.enabled, 'readyState:', s.track.readyState);
      }
    });
  }, [getRemoteAudio]);

  // Cleanup audio state
  const cleanupAudio = useCallback(() => {
    stopDurationTimer();
    setCallDuration(0);
    setIsMuted(false);
    setIsOnHold(false);
    const remoteAudio = getRemoteAudio();
    remoteAudio.srcObject = null;
    const ringtone = getRingtone();
    ringtone.pause();
    ringtone.currentTime = 0;
  }, [stopDurationTimer, getRemoteAudio, getRingtone]);

  // Mudo
  const toggleMute = useCallback(() => {
    const session = sessionRef.current;
    if (!session || callStateRef.current !== 'in-call') return;

    const pc = (session as unknown as { sessionDescriptionHandler?: { peerConnection?: RTCPeerConnection } }).sessionDescriptionHandler?.peerConnection;
    if (!pc) return;

    const senders = pc.getSenders();
    senders.forEach((sender) => {
      if (sender.track?.kind === 'audio') {
        sender.track.enabled = isMuted;
      }
    });
    setIsMuted(!isMuted);
  }, [isMuted, sessionRef, callStateRef]);

  // Espera (hold)
  const toggleHold = useCallback(async () => {
    const session = sessionRef.current;
    const currentCallState = callStateRef.current;
    if (!session || currentCallState !== 'in-call' && currentCallState !== 'on-hold') return;

    const pc = (session as unknown as { sessionDescriptionHandler?: { peerConnection?: RTCPeerConnection } }).sessionDescriptionHandler?.peerConnection;
    if (!pc) return;

    if (isOnHold) {
      // Unhold: reabilitar audio
      pc.getSenders().forEach((s) => { if (s.track) s.track.enabled = true; });
      pc.getReceivers().forEach((r) => { if (r.track) r.track.enabled = true; });
      setIsOnHold(false);
      setCallState('in-call');
    } else {
      // Hold: desabilitar audio
      pc.getSenders().forEach((s) => { if (s.track) s.track.enabled = false; });
      pc.getReceivers().forEach((r) => { if (r.track) r.track.enabled = false; });
      setIsOnHold(true);
      setCallState('on-hold');
    }
  }, [isOnHold, sessionRef, callStateRef, setCallState]);

  // DTMF
  const sendDTMF = useCallback((digit: string) => {
    const session = sessionRef.current;
    if (!session || callStateRef.current !== 'in-call') return;

    try {
      const body = {
        contentDisposition: 'render',
        contentType: 'application/dtmf-relay',
        content: `Signal=${digit}\r\nDuration=100`,
      };
      session.info({ requestOptions: { body } });
    } catch {
      // Fallback: RFC 2833 via RTP (nao suportado em todos os browsers)
    }
  }, [sessionRef, callStateRef]);

  return {
    isMuted,
    isOnHold,
    callDuration,
    toggleMute,
    toggleHold,
    sendDTMF,
    getRemoteAudio,
    getRingtone,
    startDurationTimer,
    stopDurationTimer,
    setupSessionMedia,
    cleanupAudio,
  };
}
