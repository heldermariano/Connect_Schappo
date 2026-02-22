'use client';

import { useState, useRef, useCallback, useEffect } from 'react';
import {
  UserAgent,
  Registerer,
  Inviter,
  SessionState,
  RegistererState,
  type Invitation,
  type Session,
} from 'sip.js';
import type { SipSettings, SipRegistrationState, SipCallState } from '@/lib/types';

interface UseSipPhoneReturn {
  // Registration
  registrationState: SipRegistrationState;
  register: () => Promise<void>;
  unregister: () => Promise<void>;
  // Call
  callState: SipCallState;
  currentCallNumber: string;
  callDuration: number;
  isMuted: boolean;
  isOnHold: boolean;
  // Actions
  makeCall: (number: string) => Promise<void>;
  answerCall: () => Promise<void>;
  hangup: () => void;
  toggleMute: () => void;
  toggleHold: () => Promise<void>;
  sendDTMF: (digit: string) => void;
  // Settings
  sipSettings: SipSettings | null;
  saveSipSettings: (settings: SipSettings) => Promise<void>;
  loadSettings: () => Promise<void>;
  // Errors
  error: string | null;
  // External dial
  setDialNumber: (number: string) => void;
  dialNumber: string;
}

export function useSipPhone(operatorStatus?: string): UseSipPhoneReturn {
  const [registrationState, setRegistrationState] = useState<SipRegistrationState>('unregistered');
  const [callState, setCallState] = useState<SipCallState>('idle');
  const [currentCallNumber, setCurrentCallNumber] = useState('');
  const [callDuration, setCallDuration] = useState(0);
  const [isMuted, setIsMuted] = useState(false);
  const [isOnHold, setIsOnHold] = useState(false);
  const [sipSettings, setSipSettings] = useState<SipSettings | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [dialNumber, setDialNumber] = useState('');

  const userAgentRef = useRef<UserAgent | null>(null);
  const registererRef = useRef<Registerer | null>(null);
  const sessionRef = useRef<Session | null>(null);
  const durationTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const remoteAudioRef = useRef<HTMLAudioElement | null>(null);
  const ringtoneRef = useRef<HTMLAudioElement | null>(null);

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
    if (!peerConnection) return;

    // Escutar tracks remotos
    peerConnection.ontrack = (event) => {
      if (event.streams[0]) {
        remoteAudio.srcObject = event.streams[0];
      }
    };

    // Se ja tem streams, conectar
    const receivers = peerConnection.getReceivers();
    if (receivers.length > 0) {
      const stream = new MediaStream();
      receivers.forEach((r) => {
        if (r.track) stream.addTrack(r.track);
      });
      remoteAudio.srcObject = stream;
    }
  }, [getRemoteAudio]);

  // Cleanup sessao
  const cleanupSession = useCallback(() => {
    stopDurationTimer();
    setCallState('idle');
    setCurrentCallNumber('');
    setCallDuration(0);
    setIsMuted(false);
    setIsOnHold(false);
    sessionRef.current = null;
    const remoteAudio = getRemoteAudio();
    remoteAudio.srcObject = null;
    const ringtone = getRingtone();
    ringtone.pause();
    ringtone.currentTime = 0;
  }, [stopDurationTimer, getRemoteAudio, getRingtone]);

  // Observar mudancas de estado da sessao
  const watchSession = useCallback((session: Session) => {
    session.stateChange.addListener((state) => {
      switch (state) {
        case SessionState.Establishing:
          setCallState('calling');
          break;
        case SessionState.Established:
          setCallState('in-call');
          setupSessionMedia(session);
          startDurationTimer();
          getRingtone().pause();
          break;
        case SessionState.Terminating:
        case SessionState.Terminated:
          cleanupSession();
          break;
      }
    });
  }, [setupSessionMedia, startDurationTimer, cleanupSession, getRingtone]);

  // Handler para chamadas recebidas
  const handleIncomingCall = useCallback((invitation: Invitation) => {
    // Se operador nao esta disponivel, rejeitar com 486
    if (operatorStatus && operatorStatus !== 'disponivel') {
      invitation.reject({ statusCode: 486 });
      return;
    }

    // Se ja tem chamada ativa, rejeitar
    if (sessionRef.current) {
      invitation.reject({ statusCode: 486 });
      return;
    }

    sessionRef.current = invitation;
    const callerUri = invitation.remoteIdentity.uri.user || 'Desconhecido';
    setCurrentCallNumber(callerUri);
    setCallState('ringing');
    watchSession(invitation);

    // Tocar ringtone
    const ringtone = getRingtone();
    ringtone.play().catch(() => {});
  }, [operatorStatus, watchSession, getRingtone]);

  // Carregar configuracoes SIP
  const loadSettings = useCallback(async () => {
    try {
      const res = await fetch('/api/atendentes/sip');
      if (!res.ok) return;
      const data: SipSettings = await res.json();
      setSipSettings(data);
    } catch {
      // Silently fail
    }
  }, []);

  // Salvar configuracoes SIP
  const saveSipSettings = useCallback(async (settings: SipSettings) => {
    try {
      setError(null);
      const res = await fetch('/api/atendentes/sip', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(settings),
      });
      if (!res.ok) throw new Error('Erro ao salvar');
      setSipSettings(settings);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao salvar configuracoes');
    }
  }, []);

  // Registrar no SIP
  const register = useCallback(async () => {
    if (!sipSettings || !sipSettings.sip_server || !sipSettings.sip_username) {
      setError('Configure o servidor SIP primeiro');
      return;
    }

    try {
      setError(null);
      setRegistrationState('registering');

      // Limpar UA anterior
      if (userAgentRef.current) {
        try { await userAgentRef.current.stop(); } catch {}
      }

      const scheme = sipSettings.sip_transport === 'wss' ? 'wss' : 'ws';
      const wsServer = `${scheme}://${sipSettings.sip_server}:${sipSettings.sip_port}/ws`;

      const ua = new UserAgent({
        uri: UserAgent.makeURI(`sip:${sipSettings.sip_username}@${sipSettings.sip_server}`),
        transportOptions: {
          server: wsServer,
        },
        authorizationUsername: sipSettings.sip_username,
        authorizationPassword: sipSettings.sip_password,
        displayName: sipSettings.sip_username,
        delegate: {
          onInvite: handleIncomingCall,
        },
      });

      userAgentRef.current = ua;

      await ua.start();

      const registerer = new Registerer(ua);
      registererRef.current = registerer;

      registerer.stateChange.addListener((state) => {
        switch (state) {
          case RegistererState.Registered:
            setRegistrationState('registered');
            setError(null);
            break;
          case RegistererState.Unregistered:
            setRegistrationState('unregistered');
            break;
          case RegistererState.Terminated:
            setRegistrationState('unregistered');
            break;
        }
      });

      await registerer.register();
    } catch (err) {
      setRegistrationState('error');
      setError(err instanceof Error ? err.message : 'Erro ao registrar');
    }
  }, [sipSettings, handleIncomingCall]);

  // Desregistrar
  const unregister = useCallback(async () => {
    try {
      if (registererRef.current) {
        await registererRef.current.unregister();
      }
      if (userAgentRef.current) {
        await userAgentRef.current.stop();
      }
      setRegistrationState('unregistered');
    } catch {
      setRegistrationState('unregistered');
    }
  }, []);

  // Fazer chamada
  const makeCall = useCallback(async (number: string) => {
    if (!userAgentRef.current || registrationState !== 'registered') {
      setError('Nao registrado no SIP');
      return;
    }
    if (operatorStatus && operatorStatus !== 'disponivel') {
      setError('Mude o status para Disponivel para fazer chamadas');
      return;
    }
    if (sessionRef.current) {
      setError('Ja existe uma chamada ativa');
      return;
    }

    try {
      setError(null);
      const target = UserAgent.makeURI(`sip:${number}@${sipSettings?.sip_server}`);
      if (!target) {
        setError('Numero invalido');
        return;
      }

      const inviter = new Inviter(userAgentRef.current, target, {
        sessionDescriptionHandlerOptions: {
          constraints: { audio: true, video: false },
        },
      });

      sessionRef.current = inviter;
      setCurrentCallNumber(number);
      setCallState('calling');
      watchSession(inviter);

      await inviter.invite();
    } catch (err) {
      cleanupSession();
      setError(err instanceof Error ? err.message : 'Erro ao ligar');
    }
  }, [registrationState, operatorStatus, sipSettings, watchSession, cleanupSession]);

  // Atender chamada recebida
  const answerCall = useCallback(async () => {
    const session = sessionRef.current;
    if (!session || callState !== 'ringing') return;

    try {
      await (session as Invitation).accept({
        sessionDescriptionHandlerOptions: {
          constraints: { audio: true, video: false },
        },
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao atender');
    }
  }, [callState]);

  // Desligar
  const hangup = useCallback(() => {
    const session = sessionRef.current;
    if (!session) return;

    try {
      switch (session.state) {
        case SessionState.Initial:
        case SessionState.Establishing:
          if (session instanceof Inviter) {
            session.cancel();
          } else {
            (session as Invitation).reject();
          }
          break;
        case SessionState.Established:
          session.bye();
          break;
        default:
          break;
      }
    } catch {
      // Force cleanup
    }
    cleanupSession();
  }, [cleanupSession]);

  // Mudo
  const toggleMute = useCallback(() => {
    const session = sessionRef.current;
    if (!session || callState !== 'in-call') return;

    const pc = (session as unknown as { sessionDescriptionHandler?: { peerConnection?: RTCPeerConnection } }).sessionDescriptionHandler?.peerConnection;
    if (!pc) return;

    const senders = pc.getSenders();
    senders.forEach((sender) => {
      if (sender.track?.kind === 'audio') {
        sender.track.enabled = isMuted;
      }
    });
    setIsMuted(!isMuted);
  }, [callState, isMuted]);

  // Espera (hold)
  const toggleHold = useCallback(async () => {
    const session = sessionRef.current;
    if (!session || callState !== 'in-call' && callState !== 'on-hold') return;

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
  }, [callState, isOnHold]);

  // DTMF
  const sendDTMF = useCallback((digit: string) => {
    const session = sessionRef.current;
    if (!session || callState !== 'in-call') return;

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
  }, [callState]);

  // Integrar com status do operador
  useEffect(() => {
    if (operatorStatus === 'offline' && registrationState === 'registered') {
      unregister();
    }
    // Nao auto-registrar ao voltar para disponivel - deixar manual
  }, [operatorStatus, registrationState, unregister]);

  // Carregar settings ao montar
  useEffect(() => {
    loadSettings();
  }, [loadSettings]);

  // Cleanup ao desmontar
  useEffect(() => {
    return () => {
      stopDurationTimer();
      if (userAgentRef.current) {
        try { userAgentRef.current.stop(); } catch {}
      }
    };
  }, [stopDurationTimer]);

  return {
    registrationState,
    register,
    unregister,
    callState,
    currentCallNumber,
    callDuration,
    isMuted,
    isOnHold,
    makeCall,
    answerCall,
    hangup,
    toggleMute,
    toggleHold,
    sendDTMF,
    sipSettings,
    saveSipSettings,
    loadSettings,
    error,
    setDialNumber,
    dialNumber,
  };
}
