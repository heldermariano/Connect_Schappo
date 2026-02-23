'use client';

import { useState, useEffect, useRef, useCallback } from 'react';

interface ArquivoExame {
  tipo: string;
  nome: string;
  download_url: string;
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
  onAttachFiles: (files: File[]) => void;
}

export default function ExameSearch({ searchTerm, onClose, onAttachFiles }: ExameSearchProps) {
  const [resultados, setResultados] = useState<ExameResultado[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [downloadingIdx, setDownloadingIdx] = useState<number | null>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        onClose();
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [onClose]);

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

  // Baixar TODOS os arquivos do exame e anexar
  const handleDownloadAll = useCallback(async (r: ExameResultado, idx: number) => {
    if (r.arquivos.length === 0) return;

    setDownloadingIdx(idx);
    setError(null);
    try {
      const files: File[] = [];
      for (const arq of r.arquivos) {
        const res = await fetch(`/api/exames/download?url=${encodeURIComponent(arq.download_url)}`);
        if (!res.ok) {
          throw new Error(`Erro ao baixar ${arq.nome}: ${res.status}`);
        }
        const blob = await res.blob();
        files.push(new File([blob], arq.nome, { type: 'application/pdf' }));
      }
      onAttachFiles(files);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao baixar arquivos');
    } finally {
      setDownloadingIdx(null);
    }
  }, [onAttachFiles, onClose]);

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

      {loading && (
        <div className="px-3 py-4 text-center text-sm text-gray-400">
          <svg className="w-5 h-5 animate-spin mx-auto mb-1" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
          </svg>
          Buscando no Neuro Schappo...
        </div>
      )}

      {error && !loading && (
        <div className="px-3 py-3 text-sm text-red-500">{error}</div>
      )}

      {!loading && !error && resultados.length > 0 && (
        <div className="divide-y divide-gray-100">
          {resultados.map((r, idx) => {
            const st = statusLabel(r.status);
            const isDownloading = downloadingIdx === idx;
            const hasFiles = r.arquivos.length > 0;
            // Listar tipos de arquivo disponiveis
            const tiposArquivo = r.arquivos.map((a) => arquivoLabel(a.tipo));

            return (
              <div key={idx} className="px-3 py-2.5 hover:bg-gray-50/50">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <div className="text-sm font-medium text-gray-900 truncate">{r.paciente}</div>
                    <div className="flex items-center gap-1.5 mt-0.5 text-xs text-gray-500 flex-wrap">
                      <span>{r.tipo_exame}</span>
                      {r.data_exame && (
                        <>
                          <span>&middot;</span>
                          <span>{formatDate(r.data_exame)}</span>
                        </>
                      )}
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
                    {/* Nomes dos arquivos */}
                    {hasFiles && (
                      <div className="mt-1 text-[10px] text-gray-400 space-y-0.5">
                        {r.arquivos.map((arq, i) => (
                          <div key={i} className="truncate">{arq.nome}</div>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Botao unico: baixa todos os arquivos do exame */}
                  {hasFiles ? (
                    <button
                      onClick={() => handleDownloadAll(r, idx)}
                      disabled={isDownloading}
                      className="shrink-0 px-2.5 py-1.5 text-xs font-medium rounded-md border transition-colors
                                 text-schappo-600 border-schappo-200 bg-schappo-50 hover:bg-schappo-100
                                 disabled:opacity-60 disabled:cursor-wait"
                      title={`Anexar: ${tiposArquivo.join(' + ')}`}
                    >
                      {isDownloading ? (
                        <span className="flex items-center gap-1">
                          <svg className="w-3.5 h-3.5 animate-spin" fill="none" viewBox="0 0 24 24">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                          </svg>
                          Baixando...
                        </span>
                      ) : (
                        <span className="flex items-center gap-1">
                          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                          </svg>
                          {tiposArquivo.join(' + ')}
                        </span>
                      )}
                    </button>
                  ) : (
                    <span className="shrink-0 px-2 py-1.5 text-[10px] text-gray-400 italic">
                      Sem arquivos
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {!loading && !error && resultados.length === 0 && searchTerm.length >= 2 && (
        <div className="px-3 py-4 text-center text-sm text-gray-400">
          Nenhum exame encontrado para &quot;{searchTerm}&quot;
        </div>
      )}
    </div>
  );
}

function formatDate(dateStr: string): string {
  if (!dateStr) return '';
  try {
    const parts = dateStr.split('-');
    if (parts.length === 3) return `${parts[2]}/${parts[1]}/${parts[0]}`;
    return dateStr;
  } catch {
    return dateStr;
  }
}

function statusLabel(status: string): { text: string; className: string } {
  switch (status) {
    case 'entregue': return { text: 'Laudo Entregue', className: 'text-green-700 bg-green-100' };
    case 'assinado': return { text: 'Laudo Assinado', className: 'text-green-600 bg-green-50' };
    case 'em_laudo': return { text: 'Em Laudo', className: 'text-yellow-700 bg-yellow-100' };
    case 'realizado': return { text: 'Realizado', className: 'text-blue-600 bg-blue-50' };
    case 'registrado': return { text: 'Registrado', className: 'text-gray-600 bg-gray-100' };
    default: return { text: status, className: 'text-gray-600 bg-gray-100' };
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
