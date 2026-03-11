'use client';

import { useState } from 'react';

interface TemplateSendModalProps {
  conversaId: number;
  nomeContato: string | null;
  onClose: () => void;
  onSent: () => void;
}

export default function TemplateSendModal({ conversaId, nomeContato, onClose, onSent }: TemplateSendModalProps) {
  const primeiroNome = nomeContato?.split(' ')[0] || '';
  const [nomePaciente, setNomePaciente] = useState(primeiroNome);
  const [data, setData] = useState('');
  const [hora, setHora] = useState('');
  const [nomeMedico, setNomeMedico] = useState('');
  const [procedimento, setProcedimento] = useState('');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState('');

  const canSend = nomePaciente.trim() && data.trim() && hora.trim() && nomeMedico.trim() && procedimento.trim();

  async function handleSend() {
    if (!canSend || sending) return;
    setSending(true);
    setError('');

    try {
      const res = await fetch('/api/mensagens/send-template', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          conversa_id: conversaId,
          nome_paciente: nomePaciente.trim(),
          data: data.trim(),
          hora: hora.trim(),
          nome_medico: nomeMedico.trim(),
          procedimento: procedimento.trim(),
        }),
      });

      if (!res.ok) {
        const body = await res.json().catch(() => ({ error: 'Erro desconhecido' }));
        setError(body.error || `Erro ${res.status}`);
        setSending(false);
        return;
      }

      onSent();
      onClose();
    } catch {
      setError('Erro de conexao');
      setSending(false);
    }
  }

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/50" onClick={onClose}>
      <div
        className="bg-white dark:bg-gray-900 rounded-xl shadow-2xl w-full max-w-md mx-4 overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-5 py-4 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between">
          <div>
            <h3 className="text-base font-semibold text-gray-900 dark:text-white">Enviar template</h3>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">Confirmacao de agendamento (Meta aprovado)</p>
          </div>
          <button onClick={onClose} className="p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Preview do template */}
        <div className="px-5 py-3 bg-gray-50 dark:bg-gray-800/50 border-b border-gray-200 dark:border-gray-700">
          <p className="text-[11px] text-gray-500 dark:text-gray-400 font-medium mb-1">Preview do template:</p>
          <div className="bg-green-100 dark:bg-green-900/30 rounded-lg p-3 text-xs text-gray-800 dark:text-gray-200 leading-relaxed">
            <p className="font-medium">Clinica Schappo - Confirmacao de Agendamento</p>
            <p className="mt-1">Ola, <span className="text-schappo-600 font-medium">{nomePaciente || '___'}</span>!</p>
            <p className="mt-1">
              &bull; Data: <span className="font-medium">{data || '___'}</span><br />
              &bull; Horario: <span className="font-medium">{hora || '___'}</span><br />
              &bull; Medico(a): <span className="font-medium">{nomeMedico || '___'}</span><br />
              &bull; Procedimento: <span className="font-medium">{procedimento || '___'}</span>
            </p>
            <p className="mt-1">Por favor, selecione uma opcao abaixo:</p>
            <div className="flex gap-2 mt-2">
              <span className="px-2 py-0.5 bg-white dark:bg-gray-700 rounded border border-gray-300 dark:border-gray-600 text-[10px]">Confirmar</span>
              <span className="px-2 py-0.5 bg-white dark:bg-gray-700 rounded border border-gray-300 dark:border-gray-600 text-[10px]">Desmarcar</span>
              <span className="px-2 py-0.5 bg-white dark:bg-gray-700 rounded border border-gray-300 dark:border-gray-600 text-[10px]">Reagendar</span>
            </div>
          </div>
        </div>

        {/* Campos */}
        <div className="px-5 py-4 space-y-3">
          <div>
            <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">Nome do paciente</label>
            <input
              type="text"
              value={nomePaciente}
              onChange={(e) => setNomePaciente(e.target.value)}
              className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:border-schappo-500 focus:ring-1 focus:ring-schappo-500 outline-none"
              placeholder="Ex: Bianca"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">Data</label>
              <input
                type="text"
                value={data}
                onChange={(e) => setData(e.target.value)}
                className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:border-schappo-500 focus:ring-1 focus:ring-schappo-500 outline-none"
                placeholder="Ex: 11/03/2026"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">Horario</label>
              <input
                type="text"
                value={hora}
                onChange={(e) => setHora(e.target.value)}
                className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:border-schappo-500 focus:ring-1 focus:ring-schappo-500 outline-none"
                placeholder="Ex: 13:10"
              />
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">Medico(a)</label>
            <input
              type="text"
              value={nomeMedico}
              onChange={(e) => setNomeMedico(e.target.value)}
              className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:border-schappo-500 focus:ring-1 focus:ring-schappo-500 outline-none"
              placeholder="Ex: Dra. Jullyanie"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">Procedimento</label>
            <input
              type="text"
              value={procedimento}
              onChange={(e) => setProcedimento(e.target.value)}
              className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:border-schappo-500 focus:ring-1 focus:ring-schappo-500 outline-none"
              placeholder="Ex: Consulta"
            />
          </div>
        </div>

        {/* Error */}
        {error && (
          <div className="mx-5 mb-3 px-3 py-2 bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800 rounded-lg text-xs text-red-600 dark:text-red-400">
            {error}
          </div>
        )}

        {/* Footer */}
        <div className="px-5 py-3 border-t border-gray-200 dark:border-gray-700 flex justify-end gap-2">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors"
          >
            Cancelar
          </button>
          <button
            onClick={handleSend}
            disabled={!canSend || sending}
            className="px-4 py-2 text-sm font-medium text-white bg-schappo-600 hover:bg-schappo-700 rounded-lg transition-colors disabled:bg-gray-300 dark:disabled:bg-gray-600 disabled:cursor-not-allowed flex items-center gap-2"
          >
            {sending ? (
              <>
                <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
                Enviando...
              </>
            ) : (
              'Enviar template'
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
