'use client';

import { useState, useRef, useCallback, useEffect } from 'react';
import type { UserAgent, Registerer, Session } from 'sip.js';
import { useSipAudio } from './sip/useSipAudio';
import { useSipCall } from './sip/useSipCall';
import { useSipRegistration } from './sip/useSipRegistration';
import type { SipSettings, SipRegistrationState, SipCallState } from '@/lib/types';

export interface UseSipPhoneReturn {
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
  // UI-only state
  const [dialNumber, setDialNumber] = useState('');
  const [callError, setCallError] = useState<string | null>(null);

  // Shared callState — single source of truth, used by both audio and call sub-hooks
  const [callState, _setCallState] = useState<SipCallState>('idle');
  const callStateRef = useRef<SipCallState>('idle');
  const setCallState = useCallback((state: SipCallState) => {
    callStateRef.current = state;
    _setCallState(state);
  }, []);

  // Shared refs — owned by orchestrator, passed down to break circular deps
  const sessionRef = useRef<Session | null>(null);
  const userAgentRef = useRef<UserAgent | null>(null);
  const registererRef = useRef<Registerer | null>(null);
  const registrationStateRef = useRef<SipRegistrationState>('unregistered');
  const sipSettingsRef = useRef<SipSettings | null>(null);

  // 1) Audio sub-hook
  const audio = useSipAudio(sessionRef, callStateRef, setCallState);

  // 2) Call sub-hook
  const call = useSipCall(
    sessionRef,
    userAgentRef,
    callStateRef,
    setCallState,
    registrationStateRef,
    sipSettingsRef,
    operatorStatus,
    setCallError,
    {
      setupSessionMedia: audio.setupSessionMedia,
      startDurationTimer: audio.startDurationTimer,
      cleanupAudio: audio.cleanupAudio,
      getRingtone: audio.getRingtone,
    },
  );

  // 3) Registration sub-hook
  const registration = useSipRegistration(
    operatorStatus,
    call.handleIncomingCall,
    userAgentRef,
    registererRef,
  );

  // Keep refs synced with registration state so useSipCall reads current values via refs
  registrationStateRef.current = registration.registrationState;
  sipSettingsRef.current = registration.sipSettings;

  // Cleanup ao desmontar
  useEffect(() => {
    return () => {
      audio.stopDurationTimer();
      if (userAgentRef.current) {
        try { userAgentRef.current.stop(); } catch {}
      }
    };
  }, [audio.stopDurationTimer]);

  return {
    registrationState: registration.registrationState,
    register: registration.register,
    unregister: registration.unregister,
    callState,
    currentCallNumber: call.currentCallNumber,
    callDuration: audio.callDuration,
    isMuted: audio.isMuted,
    isOnHold: audio.isOnHold,
    makeCall: call.makeCall,
    answerCall: call.answerCall,
    hangup: call.hangup,
    toggleMute: audio.toggleMute,
    toggleHold: audio.toggleHold,
    sendDTMF: audio.sendDTMF,
    sipSettings: registration.sipSettings,
    saveSipSettings: registration.saveSipSettings,
    loadSettings: registration.loadSettings,
    error: callError || registration.error,
    setDialNumber,
    dialNumber,
  };
}
