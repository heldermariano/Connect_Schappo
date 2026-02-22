'use client';

interface CallControlsProps {
  isMuted: boolean;
  isOnHold: boolean;
  onToggleMute: () => void;
  onToggleHold: () => Promise<void>;
  showDtmfPad: boolean;
  onToggleDtmfPad: () => void;
}

export default function CallControls({
  isMuted,
  isOnHold,
  onToggleMute,
  onToggleHold,
  showDtmfPad,
  onToggleDtmfPad,
}: CallControlsProps) {
  return (
    <div className="flex justify-center gap-4 px-3 py-2 bg-gray-800">
      {/* Mudo */}
      <button
        onClick={onToggleMute}
        className={`flex flex-col items-center gap-1 p-2 rounded-lg transition-colors ${
          isMuted ? 'bg-red-500/20 text-red-400' : 'text-gray-300 hover:bg-gray-700'
        }`}
      >
        {isMuted ? (
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z" />
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2" />
          </svg>
        ) : (
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
          </svg>
        )}
        <span className="text-[10px]">{isMuted ? 'Mudo' : 'Mic'}</span>
      </button>

      {/* Espera */}
      <button
        onClick={onToggleHold}
        className={`flex flex-col items-center gap-1 p-2 rounded-lg transition-colors ${
          isOnHold ? 'bg-yellow-500/20 text-yellow-400' : 'text-gray-300 hover:bg-gray-700'
        }`}
      >
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 9v6m4-6v6m7-3a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
        <span className="text-[10px]">{isOnHold ? 'Retomar' : 'Espera'}</span>
      </button>

      {/* Teclado DTMF */}
      <button
        onClick={onToggleDtmfPad}
        className={`flex flex-col items-center gap-1 p-2 rounded-lg transition-colors ${
          showDtmfPad ? 'bg-schappo-500/20 text-schappo-400' : 'text-gray-300 hover:bg-gray-700'
        }`}
      >
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" />
        </svg>
        <span className="text-[10px]">Teclado</span>
      </button>
    </div>
  );
}
