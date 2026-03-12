'use client';

import { useState, useRef, useCallback, useEffect } from 'react';
import {
  UserAgent,
  Registerer,
  RegistererState,
  type Invitation,
} from 'sip.js';
import type { SipSettings, SipRegistrationState } from '@/lib/types';

export interface UseSipRegistrationReturn {
  sipSettings: SipSettings | null;
  registrationState: SipRegistrationState;
  error: string | null;
  register: () => Promise<void>;
  unregister: () => Promise<void>;
  loadSettings: () => Promise<void>;
  saveSipSettings: (settings: SipSettings) => Promise<void>;
}

export function useSipRegistration(
  operatorStatus: string | undefined,
  onInvite: (invitation: Invitation) => void,
  userAgentRef: React.MutableRefObject<UserAgent | null>,
  registererRef: React.MutableRefObject<Registerer | null>,
): UseSipRegistrationReturn {
  const [sipSettings, setSipSettings] = useState<SipSettings | null>(null);
  const [registrationState, setRegistrationState] = useState<SipRegistrationState>('unregistered');
  const [error, setError] = useState<string | null>(null);

  const autoRegisteredRef = useRef(false);

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
      console.log('[SIP] Conectando a:', wsServer);
      console.log('[SIP] Usuario:', sipSettings.sip_username);

      const ua = new UserAgent({
        uri: UserAgent.makeURI(`sip:${sipSettings.sip_username}@${sipSettings.sip_server}`),
        transportOptions: {
          server: wsServer,
        },
        authorizationUsername: sipSettings.sip_username,
        authorizationPassword: sipSettings.sip_password,
        displayName: sipSettings.sip_username,
        logLevel: 'warn',
        delegate: {
          onInvite,
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
            autoRegisteredRef.current = false;
            break;
        }
      });

      await registerer.register();
    } catch (err) {
      setRegistrationState('error');
      setError(err instanceof Error ? err.message : 'Erro ao registrar');
    }
  }, [sipSettings, onInvite, userAgentRef, registererRef]);

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
  }, [userAgentRef, registererRef]);

  // Auto-registro: quando sipSettings carrega com sip_enabled=true, registrar automaticamente
  useEffect(() => {
    if (
      sipSettings &&
      sipSettings.sip_enabled &&
      sipSettings.sip_server &&
      sipSettings.sip_username &&
      sipSettings.sip_password &&
      !autoRegisteredRef.current &&
      registrationState === 'unregistered' &&
      operatorStatus !== 'offline'
    ) {
      autoRegisteredRef.current = true;
      register();
    }
  }, [sipSettings, registrationState, operatorStatus, register]);

  // Integrar com status do operador
  useEffect(() => {
    if (operatorStatus === 'offline' && registrationState === 'registered') {
      autoRegisteredRef.current = false;
      unregister();
    }
  }, [operatorStatus, registrationState, unregister]);

  // Re-registrar ao voltar de offline
  useEffect(() => {
    if (
      operatorStatus &&
      operatorStatus !== 'offline' &&
      sipSettings?.sip_enabled &&
      sipSettings?.sip_server &&
      sipSettings?.sip_username &&
      sipSettings?.sip_password &&
      registrationState === 'unregistered' &&
      !autoRegisteredRef.current
    ) {
      autoRegisteredRef.current = true;
      register();
    }
  }, [operatorStatus, sipSettings, registrationState, register]);

  // Carregar settings ao montar
  useEffect(() => {
    loadSettings();
  }, [loadSettings]);

  return {
    sipSettings,
    registrationState,
    error,
    register,
    unregister,
    loadSettings,
    saveSipSettings,
  };
}
