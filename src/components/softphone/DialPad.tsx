'use client';

import { useRef, useCallback } from 'react';

interface DialPadProps {
  number: string;
  onNumberChange: (number: string) => void;
  onDial: () => void;
  onHangup: () => void;
  onDigit?: (digit: string) => void;
  isInCall: boolean;
  isRinging: boolean;
  onAnswer?: () => void;
  disabled: boolean;
}

const KEYS = [
  ['1', '2', '3'],
  ['4', '5', '6'],
  ['7', '8', '9'],
  ['*', '0', '#'],
];

const KEY_LABELS: Record<string, string> = {
  '1': '',
  '2': 'ABC',
  '3': 'DEF',
  '4': 'GHI',
  '5': 'JKL',
  '6': 'MNO',
  '7': 'PQRS',
  '8': 'TUV',
  '9': 'WXYZ',
  '*': '',
  '0': '+',
  '#': '',
};

// Frequencias DTMF padrao (Hz): cada tecla = combinacao de frequencia baixa + alta
const DTMF_FREQ: Record<string, [number, number]> = {
  '1': [697, 1209], '2': [697, 1336], '3': [697, 1477],
  '4': [770, 1209], '5': [770, 1336], '6': [770, 1477],
  '7': [852, 1209], '8': [852, 1336], '9': [852, 1477],
  '*': [941, 1209], '0': [941, 1336], '#': [941, 1477],
};

export default function DialPad({
  number,
  onNumberChange,
  onDial,
  onHangup,
  onDigit,
  isInCall,
  isRinging,
  onAnswer,
  disabled,
}: DialPadProps) {
  const audioCtxRef = useRef<AudioContext | null>(null);

  const playDTMFTone = useCallback((digit: string) => {
    const freqs = DTMF_FREQ[digit];
    if (!freqs) return;

    try {
      if (!audioCtxRef.current) {
        audioCtxRef.current = new AudioContext();
      }
      const ctx = audioCtxRef.current;

      const gain = ctx.createGain();
      gain.gain.value = 0.15;
      gain.connect(ctx.destination);

      const osc1 = ctx.createOscillator();
      osc1.frequency.value = freqs[0];
      osc1.type = 'sine';
      osc1.connect(gain);

      const osc2 = ctx.createOscillator();
      osc2.frequency.value = freqs[1];
      osc2.type = 'sine';
      osc2.connect(gain);

      const now = ctx.currentTime;
      osc1.start(now);
      osc2.start(now);
      osc1.stop(now + 0.15);
      osc2.stop(now + 0.15);

      // Fade out suave
      gain.gain.setValueAtTime(0.15, now + 0.12);
      gain.gain.linearRampToValueAtTime(0, now + 0.15);
    } catch {
      // Audio nao disponivel
    }
  }, []);

  const handleKeyPress = (digit: string) => {
    playDTMFTone(digit);
    if (isInCall && onDigit) {
      onDigit(digit);
    } else {
      onNumberChange(number + digit);
    }
  };

  const handleBackspace = () => {
    if (!isInCall) {
      onNumberChange(number.slice(0, -1));
    }
  };

  return (
    <div className="px-3 py-2">
      {/* Campo de numero */}
      {!isInCall && (
        <div className="relative mb-3">
          <input
            type="text"
            value={number}
            onChange={(e) => onNumberChange(e.target.value.replace(/[^0-9*#]/g, ''))}
            placeholder="Digite o numero"
            className="w-full text-center text-lg font-mono py-2 px-8 bg-gray-50 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-schappo-500 focus:border-transparent"
          />
          {number && (
            <button
              onClick={handleBackspace}
              className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-gray-400 hover:text-gray-600"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2M3 12l6.414-6.414a2 2 0 011.414-.586H19a2 2 0 012 2v10a2 2 0 01-2 2h-8.172a2 2 0 01-1.414-.586L3 12z" />
              </svg>
            </button>
          )}
        </div>
      )}

      {/* Grid de teclas */}
      <div className="grid grid-cols-3 gap-2 mb-3">
        {KEYS.map((row) =>
          row.map((key) => (
            <button
              key={key}
              onClick={() => handleKeyPress(key)}
              disabled={disabled}
              className="flex flex-col items-center justify-center h-12 rounded-lg bg-gray-100 hover:bg-gray-200 active:bg-gray-300 transition-colors disabled:opacity-50"
            >
              <span className="text-lg font-medium text-gray-800">{key}</span>
              {KEY_LABELS[key] && (
                <span className="text-[8px] text-gray-400 leading-none">{KEY_LABELS[key]}</span>
              )}
            </button>
          ))
        )}
      </div>

      {/* Botoes de acao */}
      <div className="flex gap-2 justify-center">
        {isRinging && onAnswer ? (
          <>
            <button
              onClick={onAnswer}
              className="flex-1 h-12 rounded-full bg-green-500 hover:bg-green-600 text-white flex items-center justify-center gap-2 transition-colors"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
              </svg>
              <span className="text-sm font-medium">Atender</span>
            </button>
            <button
              onClick={onHangup}
              className="flex-1 h-12 rounded-full bg-red-500 hover:bg-red-600 text-white flex items-center justify-center gap-2 transition-colors"
            >
              <svg className="w-5 h-5 rotate-[135deg]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
              </svg>
              <span className="text-sm font-medium">Rejeitar</span>
            </button>
          </>
        ) : isInCall ? (
          <button
            onClick={onHangup}
            className="w-14 h-14 rounded-full bg-red-500 hover:bg-red-600 text-white flex items-center justify-center transition-colors"
          >
            <svg className="w-6 h-6 rotate-[135deg]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
            </svg>
          </button>
        ) : (
          <button
            onClick={onDial}
            disabled={disabled || !number}
            className="w-14 h-14 rounded-full bg-green-500 hover:bg-green-600 disabled:bg-gray-300 text-white flex items-center justify-center transition-colors"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
            </svg>
          </button>
        )}
      </div>
    </div>
  );
}
