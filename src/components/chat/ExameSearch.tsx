'use client';

import { useState, useEffect, useRef, useCallback } from 'react';

interface ArquivoExame {
  tipo: string;  // laudo, tracado, laudo_tracado
  nome: string;
  path: string;
}

interface ExameResultado {
  paciente: string;
  tipo_exame: string;
  data_exame: string;
  status: string;
  local: string | null;
  arquivos: ArquivoExame[];
}

interface ExameSearchProps {
  searchTerm: string;
  onClose: () => void;
}

export default function ExameSearch({ searchTerm, onClose }: ExameSearchProps) {
  const [resultados, setResultados] = useState<ExameResultado[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  // Fechar ao clicar fora
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        onClose();
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [onClose]);

  // Buscar com debounce
  useEffect(() => {
    if (searchTerm.length < 2) {
      setResultados([]);
      setError(null);
      return;
    }

    const timer = setTimeout(async () => {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch(`/api/exames/buscar?nome=${encodeURIComponent(searchTerm)}`);
        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          throw new Error(data.error || `Erro ${res.status}`);
        }
        const data = await res.json();
        setResultados(data.resultados);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Erro ao buscar');
        setResultados([]);
      } finally {
        setLoading(false);
      }
    }, 300);

    return () => clearTimeout(timer);
  }, [searchTerm]);

  const copyToClipboard = useCallback(async (text: string, key: string) => {
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      const textarea = document.createElement('textarea');
      textarea.value = text;
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand('copy');
      document.body.removeChild(textarea);
    }
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(null), 2000);
  }, []);

  if (searchTerm.length < 2) return null;

  return (
    <div
      ref={panelRef}
      className="absolute bottom-full left-0 right-0 mb-1 mx-4 bg-white border border-gray-200 rounded-lg shadow-lg z-50 max-h-96 overflow-y-auto"
    >
      {/* Header */}
      <div className="sticky top-0 flex items-center justify-between px-3 py-2 border-b border-gray-100 bg-gray-50 rounded-t-lg">
        <div className="flex items-center gap-2 text-sm font-medium text-gray-700">
          <svg className="w-4 h-4 text-schappo-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          Exames de &quot;{searchTerm}&quot;
        </div>
        <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      {/* Loading */}
      {loading && (
        <div className="px-3 py-4 text-center text-sm text-gray-400">
          <svg className="w-5 h-5 animate-spin mx-auto mb-1" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
          </svg>
          Buscando no Neuro Schappo...
        </div>
      )}

      {/* Erro */}
      {error && !loading && (
        <div className="px-3 py-3 text-sm text-red-500">{error}</div>
      )}

      {/* Resultados */}
      {!loading && !error && resultados.length > 0 && (
        <div className="divide-y divide-gray-100">
          {resultados.map((r, idx) => {
            const st = statusLabel(r.status);
            return (
              <div key={idx} className="px-3 py-2.5 hover:bg-gray-50/50">
                {/* Info do exame */}
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <div className="text-sm font-medium text-gray-900 truncate">{r.paciente}</div>
                    <div className="flex items-center gap-1.5 mt-0.5 text-xs text-gray-500 flex-wrap">
                      <span>{r.tipo_exame}</span>
                      <span>&middot;</span>
                      <span>{formatDate(r.data_exame)}</span>
                      {r.local && (
                        <>
                          <span>&middot;</span>
                          <span>{r.local}</span>
                        </>
                      )}
                      <span className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${st.className}`}>
                        {st.text}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Arquivos PDF */}
                {r.arquivos.length > 0 ? (
                  <div className="mt-1.5 flex flex-wrap gap-1.5">
                    {r.arquivos.map((arq, aidx) => {
                      const key = `${idx}-${aidx}`;
                      const isCopied = copiedKey === key;
                      return (
                        <button
                          key={aidx}
                          onClick={() => copyToClipboard(arq.nome, key)}
                          className="inline-flex items-center gap-1 px-2 py-1 text-[11px] font-medium rounded border transition-colors
                                     text-schappo-600 border-schappo-200 bg-schappo-50 hover:bg-schappo-100"
                          title={`Copiar nome: ${arq.nome}`}
                        >
                          {isCopied ? (
                            <span className="text-green-600">Copiado!</span>
                          ) : (
                            <>
                              <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                              </svg>
                              {arquivoLabel(arq.tipo)}
                            </>
                          )}
                        </button>
                      );
                    })}
                  </div>
                ) : (
                  <div className="mt-1 text-[11px] text-gray-400 italic">
                    Sem arquivos de laudo disponíveis
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Sem resultados */}
      {!loading && !error && resultados.length === 0 && searchTerm.length >= 2 && (
        <div className="px-3 py-4 text-center text-sm text-gray-400">
          Nenhum exame encontrado para &quot;{searchTerm}&quot;
        </div>
      )}
    </div>
  );
}

function formatDate(dateStr: string): string {
  try {
    const d = new Date(dateStr + 'T00:00:00');
    return d.toLocaleDateString('pt-BR');
  } catch {
    return dateStr;
  }
}

function statusLabel(status: string): { text: string; className: string } {
  switch (status) {
    case 'entregue':
      return { text: 'Laudo Entregue', className: 'text-green-700 bg-green-100' };
    case 'assinado':
      return { text: 'Laudo Assinado', className: 'text-green-600 bg-green-50' };
    case 'em_laudo':
      return { text: 'Em Laudo', className: 'text-yellow-700 bg-yellow-100' };
    case 'realizado':
      return { text: 'Realizado', className: 'text-blue-600 bg-blue-50' };
    case 'registrado':
      return { text: 'Registrado', className: 'text-gray-600 bg-gray-100' };
    default:
      return { text: status, className: 'text-gray-600 bg-gray-100' };
  }
}

function arquivoLabel(tipo: string): string {
  switch (tipo) {
    case 'laudo': return 'Laudo';
    case 'tracado': return 'Tracado';
    case 'laudo_tracado': return 'Laudo+Tracado';
    default: return tipo;
  }
}
