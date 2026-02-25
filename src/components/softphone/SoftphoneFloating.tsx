'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { useSipPhone } from '@/hooks/useSipPhone';
import Softphone from './Softphone';

interface SoftphoneFloatingProps {
  operatorStatus?: string;
  open: boolean;
  onToggle: () => void;
}

export default function SoftphoneFloating({ operatorStatus, open, onToggle }: SoftphoneFloatingProps) {
  const phone = useSipPhone(operatorStatus);
  const popupRef = useRef<HTMLDivElement>(null);

  const isInCall = phone.callState === 'in-call' || phone.callState === 'on-hold' || phone.callState === 'calling';
  const isRinging = phone.callState === 'ringing';
  const isActive = isInCall || isRinging;

  // Abrir automaticamente ao receber chamada
  useEffect(() => {
    if (isRinging && !open) {
      onToggle();
    }
  }, [isRinging, open, onToggle]);

  // Fechar ao clicar fora (apenas se nao estiver em chamada)
  useEffect(() => {
    if (!open) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (popupRef.current && !popupRef.current.contains(e.target as Node)) {
        // Verificar se clicou no botao de toggle (nao fechar)
        const target = e.target as HTMLElement;
        if (target.closest('[data-softphone-toggle]')) return;
        if (!isActive) {
          onToggle();
        }
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [open, isActive, onToggle]);

  // Formatar duracao
  const formatDuration = useCallback((seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}:${s.toString().padStart(2, '0')}`;
  }, []);

  // Determinar cor do indicador SIP
  const sipColor = phone.registrationState === 'registered'
    ? 'bg-green-500'
    : phone.registrationState === 'error'
      ? 'bg-red-500'
      : 'bg-gray-400';

  return (
    <>
      {/* Popup do softphone */}
      {open && (
        <div ref={popupRef} className="absolute top-0 left-0 right-0 bottom-16 z-[9998] px-1 pt-1">
          <Softphone phone={phone} onClose={onToggle} />
        </div>
      )}

      {/* Audio elements sempre montados */}
      <audio id="sip-remote-audio" autoPlay style={{ display: 'none' }} />
      <audio id="sip-ringtone" src="/sounds/ringtone.wav" loop style={{ display: 'none' }} />
    </>
  );
}

// Exportar hook para estado do botao (usado no AppShell)
export function useSoftphoneButtonState(operatorStatus?: string) {
  const [open, setOpen] = useState(false);
  const toggle = useCallback(() => setOpen((prev) => !prev), []);
  return { open, toggle };
}
