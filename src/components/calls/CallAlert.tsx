'use client';

import { Chamada } from '@/lib/types';

interface CallAlertProps {
  chamadas: Chamada[]; // Chamadas com status 'ringing'
}

export default function CallAlert({ chamadas }: CallAlertProps) {
  const ringing = chamadas.filter((c) => c.status === 'ringing');

  if (ringing.length === 0) return null;

  return (
    <div className="bg-yellow-50 border-b border-yellow-200 px-4 py-2">
      {ringing.map((chamada) => (
        <div key={chamada.id} className="flex items-center gap-3 text-sm">
          <span className="animate-pulse text-yellow-600 text-lg">{'\uD83D\uDD14'}</span>
          <div className="flex-1">
            <span className="font-medium text-yellow-800">
              {chamada.direcao === 'realizada' ? 'Ligando para' : 'Chamada recebida de'}
            </span>
            <span className="text-yellow-600 ml-2">
              {chamada.direcao === 'realizada'
                ? chamada.called_number || 'Desconhecido'
                : chamada.caller_number || 'Desconhecido'}
              {chamada.ramal_atendeu && ` \u2192 Ramal ${chamada.ramal_atendeu}`}
            </span>
          </div>
          <span className="text-[11px] text-yellow-500">
            {chamada.direcao === 'realizada' ? 'Click-to-Call' : chamada.origem === 'whatsapp' ? 'WhatsApp Voz' : 'Telefone'}
          </span>
        </div>
      ))}
    </div>
  );
}
