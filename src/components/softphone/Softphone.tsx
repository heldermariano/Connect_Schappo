'use client';

import { useState, useCallback, useEffect } from 'react';
import { useSipPhone } from '@/hooks/useSipPhone';
import SipStatus from './SipStatus';
import CallDisplay from './CallDisplay';
import DialPad from './DialPad';
import CallControls from './CallControls';
import SipSettings from './SipSettings';

interface SoftphoneProps {
  operatorStatus?: string;
}

export default function Softphone({ operatorStatus }: SoftphoneProps) {
  const phone = useSipPhone(operatorStatus);
  const [showDtmfPad, setShowDtmfPad] = useState(false);

  const isInCall = phone.callState === 'in-call' || phone.callState === 'on-hold' || phone.callState === 'calling';
  const isRinging = phone.callState === 'ringing';
  const isActive = isInCall || isRinging;

  // Escutar evento customizado para preencher o dialpad externamente
  useEffect(() => {
    const handleDialEvent = (e: Event) => {
      const detail = (e as CustomEvent<{ number: string }>).detail;
      if (detail?.number) {
        phone.setDialNumber(detail.number.replace(/\D/g, ''));
      }
    };
    window.addEventListener('softphone-dial', handleDialEvent);
    return () => window.removeEventListener('softphone-dial', handleDialEvent);
  }, [phone]);

  const handleDial = useCallback(() => {
    if (phone.dialNumber) {
      phone.makeCall(phone.dialNumber);
    }
  }, [phone]);

  const handleDigit = useCallback((digit: string) => {
    phone.sendDTMF(digit);
  }, [phone]);

  return (
    <div className="w-72 shrink-0 border-l border-gray-200 bg-white flex flex-col">
      {/* Header */}
      <div className="h-14 flex items-center justify-center border-b border-gray-200 bg-gray-900">
        <div className="flex items-center gap-2">
          <svg className="w-5 h-5 text-schappo-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
          </svg>
          <span className="text-sm font-semibold text-white">Telefone</span>
        </div>
      </div>

      {/* Status de registro SIP */}
      <SipStatus state={phone.registrationState} error={phone.error} />

      {/* Display de chamada (quando ativa) */}
      <CallDisplay
        callState={phone.callState}
        number={phone.currentCallNumber}
        duration={phone.callDuration}
      />

      {/* Controles durante chamada */}
      {isActive && !isRinging && (
        <CallControls
          isMuted={phone.isMuted}
          isOnHold={phone.isOnHold}
          onToggleMute={phone.toggleMute}
          onToggleHold={phone.toggleHold}
          showDtmfPad={showDtmfPad}
          onToggleDtmfPad={() => setShowDtmfPad(!showDtmfPad)}
        />
      )}

      {/* Teclado numerico */}
      <div className="flex-1 flex flex-col justify-end">
        {(!isActive || showDtmfPad || isRinging) && (
          <DialPad
            number={phone.dialNumber}
            onNumberChange={phone.setDialNumber}
            onDial={handleDial}
            onHangup={phone.hangup}
            onDigit={handleDigit}
            isInCall={isInCall}
            isRinging={isRinging}
            onAnswer={phone.answerCall}
            disabled={phone.registrationState !== 'registered' && !isActive}
          />
        )}

        {/* Botao desligar centralizado quando em chamada sem teclado */}
        {isInCall && !showDtmfPad && (
          <div className="flex justify-center py-4">
            <button
              onClick={phone.hangup}
              className="w-14 h-14 rounded-full bg-red-500 hover:bg-red-600 text-white flex items-center justify-center transition-colors"
            >
              <svg className="w-6 h-6 rotate-[135deg]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
              </svg>
            </button>
          </div>
        )}
      </div>

      {/* Configuracoes SIP */}
      <SipSettings
        settings={phone.sipSettings}
        onSave={phone.saveSipSettings}
        registrationState={phone.registrationState}
        onRegister={phone.register}
        onUnregister={phone.unregister}
      />

      {/* Audio elements ocultos */}
      <audio id="sip-remote-audio" autoPlay style={{ display: 'none' }} />
      <audio id="sip-ringtone" src="/sounds/ringtone.wav" loop style={{ display: 'none' }} />
    </div>
  );
}
