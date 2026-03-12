'use client';

import { useState, useCallback } from 'react';
import {
  UserAgent,
  Inviter,
  SessionState,
  type Invitation,
  type Session,
} from 'sip.js';
import type { SipSettings, SipRegistrationState, SipCallState } from '@/lib/types';

export interface UseSipCallReturn {
  currentCallNumber: string;
  makeCall: (number: string) => Promise<void>;
  answerCall: () => Promise<void>;
  hangup: () => void;
  handleIncomingCall: (invitation: Invitation) => void;
}

export function useSipCall(
  sessionRef: React.MutableRefObject<Session | null>,
  userAgentRef: React.MutableRefObject<UserAgent | null>,
  callStateRef: React.MutableRefObject<SipCallState>,
  setCallState: (state: SipCallState) => void,
  registrationStateRef: React.MutableRefObject<SipRegistrationState>,
  sipSettingsRef: React.MutableRefObject<SipSettings | null>,
  operatorStatus: string | undefined,
  setError: (error: string | null) => void,
  audio: {
    setupSessionMedia: (session: Session) => void;
    startDurationTimer: () => void;
    cleanupAudio: () => void;
    getRingtone: () => HTMLAudioElement;
  },
): UseSipCallReturn {
  const [currentCallNumber, setCurrentCallNumber] = useState('');

  // Cleanup sessao
  const cleanupSession = useCallback(() => {
    audio.cleanupAudio();
    setCallState('idle');
    setCurrentCallNumber('');
    sessionRef.current = null;
  }, [audio, sessionRef, setCallState]);

  // Observar mudancas de estado da sessao
  const watchSession = useCallback((session: Session) => {
    session.stateChange.addListener((state) => {
      console.log('[SIP] Session state mudou:', state);
      switch (state) {
        case SessionState.Establishing:
          setCallState('calling');
          break;
        case SessionState.Established:
          console.log('[SIP] Chamada ESTABELECIDA - configurando midia');
          setCallState('in-call');
          audio.setupSessionMedia(session);
          audio.startDurationTimer();
          audio.getRingtone().pause();
          break;
        case SessionState.Terminating:
          console.log('[SIP] Chamada TERMINANDO');
          cleanupSession();
          break;
        case SessionState.Terminated:
          console.log('[SIP] Chamada TERMINADA');
          cleanupSession();
          break;
      }
    });

    // Log SDP para debug
    const sdh = (session as unknown as { sessionDescriptionHandler?: { on?: (event: string, cb: () => void) => void } }).sessionDescriptionHandler;
    if (sdh && typeof sdh.on === 'function') {
      sdh.on('sdp', () => console.log('[SIP] SDP event'));
    }
  }, [audio, cleanupSession, setCallState]);

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
    const ringtone = audio.getRingtone();
    ringtone.play().catch(() => {});
  }, [operatorStatus, sessionRef, watchSession, audio, setCallState]);

  // Fazer chamada
  const makeCall = useCallback(async (number: string) => {
    if (!userAgentRef.current || registrationStateRef.current !== 'registered') {
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
      const sipSettings = sipSettingsRef.current;
      const target = UserAgent.makeURI(`sip:${number}@${sipSettings?.sip_server}`);
      if (!target) {
        setError('Numero invalido');
        return;
      }

      console.log('[SIP] Iniciando chamada para:', number);
      console.log('[SIP] URI destino:', `sip:${number}@${sipSettings?.sip_server}`);

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
      console.log('[SIP] INVITE enviado com sucesso');
    } catch (err) {
      cleanupSession();
      setError(err instanceof Error ? err.message : 'Erro ao ligar');
    }
  }, [operatorStatus, userAgentRef, sessionRef, registrationStateRef, sipSettingsRef, watchSession, cleanupSession, setError, setCallState]);

  // Atender chamada recebida
  const answerCall = useCallback(async () => {
    const session = sessionRef.current;
    if (!session || callStateRef.current !== 'ringing') return;

    try {
      await (session as Invitation).accept({
        sessionDescriptionHandlerOptions: {
          constraints: { audio: true, video: false },
        },
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao atender');
    }
  }, [sessionRef, callStateRef, setError]);

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
  }, [sessionRef, cleanupSession]);

  return {
    currentCallNumber,
    makeCall,
    answerCall,
    hangup,
    handleIncomingCall,
  };
}
