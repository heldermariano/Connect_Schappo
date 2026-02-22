'use client';

import { useState, useRef } from 'react';

interface ImportCsvModalProps {
  open: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

interface ImportResult {
  imported: number;
  updated: number;
  skipped: number;
  errors: string[];
}

export default function ImportCsvModal({ open, onClose, onSuccess }: ImportCsvModalProps) {
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [result, setResult] = useState<ImportResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  if (!open) return null;

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;
    setFile(f);
    setResult(null);
    setError(null);

    // Preview das primeiras 5 linhas
    const text = await f.text();
    const lines = text.split(/\r?\n/).filter((l) => l.trim());
    setPreview(lines.slice(0, 6));
  };

  const handleImport = async () => {
    if (!file) return;

    try {
      setLoading(true);
      setError(null);
      setProgress(30);

      const formData = new FormData();
      formData.append('file', file);

      setProgress(50);

      const res = await fetch('/api/contatos/import-csv', {
        method: 'POST',
        body: formData,
      });

      setProgress(90);

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Erro na importacao');
      }

      const data: ImportResult = await res.json();
      setResult(data);
      setProgress(100);
      onSuccess();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro desconhecido');
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    setFile(null);
    setPreview([]);
    setResult(null);
    setError(null);
    setProgress(0);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/50" onClick={handleClose} />

      <div className="relative bg-white rounded-lg shadow-xl w-full max-w-lg mx-4 p-6 max-h-[90vh] overflow-y-auto">
        <h2 className="text-lg font-semibold text-gray-900 mb-2">Importar Contatos CSV</h2>
        <p className="text-xs text-gray-500 mb-4">
          Formato esperado: <code className="bg-gray-100 px-1 rounded">id,name,email,phone_number</code> (exportado do Chatwoot)
        </p>

        {/* File input */}
        <div className="mb-4">
          <input
            ref={inputRef}
            type="file"
            accept=".csv"
            onChange={handleFileChange}
            className="hidden"
          />
          <button
            onClick={() => inputRef.current?.click()}
            className="w-full border-2 border-dashed border-gray-300 rounded-lg py-6 px-4 text-center hover:border-schappo-400 transition-colors"
          >
            {file ? (
              <div>
                <p className="text-sm font-medium text-gray-900">{file.name}</p>
                <p className="text-xs text-gray-500 mt-1">{(file.size / 1024).toFixed(1)} KB</p>
              </div>
            ) : (
              <div>
                <svg className="w-8 h-8 mx-auto text-gray-400 mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                </svg>
                <p className="text-sm text-gray-600">Clique para selecionar arquivo CSV</p>
              </div>
            )}
          </button>
        </div>

        {/* Preview */}
        {preview.length > 0 && (
          <div className="mb-4">
            <p className="text-xs font-medium text-gray-600 mb-1">Preview:</p>
            <div className="bg-gray-50 rounded-lg p-2 overflow-x-auto">
              {preview.map((line, i) => (
                <div key={i} className={`text-[11px] font-mono truncate ${i === 0 ? 'text-schappo-600 font-semibold' : 'text-gray-600'}`}>
                  {line}
                </div>
              ))}
              {preview.length >= 6 && (
                <div className="text-[11px] text-gray-400 mt-1">...</div>
              )}
            </div>
          </div>
        )}

        {/* Progress bar */}
        {loading && (
          <div className="mb-4">
            <div className="w-full bg-gray-200 rounded-full h-2">
              <div
                className="bg-schappo-500 h-2 rounded-full transition-all duration-300"
                style={{ width: `${progress}%` }}
              />
            </div>
            <p className="text-xs text-gray-500 mt-1 text-center">Importando...</p>
          </div>
        )}

        {/* Result */}
        {result && (
          <div className="mb-4 p-3 bg-green-50 rounded-lg">
            <p className="text-sm font-medium text-green-800 mb-1">Importacao concluida!</p>
            <div className="text-xs text-green-700 space-y-0.5">
              <p>{result.imported} novos contatos importados</p>
              <p>{result.updated} contatos atualizados</p>
              {result.skipped > 0 && <p>{result.skipped} linhas ignoradas</p>}
              {result.errors.length > 0 && (
                <div className="mt-2 text-red-600">
                  {result.errors.map((e, i) => <p key={i}>{e}</p>)}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Error */}
        {error && <p className="text-sm text-red-500 mb-4">{error}</p>}

        {/* Actions */}
        <div className="flex gap-3 justify-end">
          <button
            type="button"
            onClick={handleClose}
            className="px-4 py-2 text-sm text-gray-600 hover:text-gray-800 transition-colors"
          >
            {result ? 'Fechar' : 'Cancelar'}
          </button>
          {!result && (
            <button
              onClick={handleImport}
              disabled={!file || loading}
              className="px-4 py-2 text-sm font-medium text-white bg-schappo-500 rounded-lg hover:bg-schappo-600 disabled:opacity-50 transition-colors"
            >
              {loading ? 'Importando...' : 'Importar'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
