'use client';

interface AttachmentPreviewProps {
  file: File;
  onRemove: () => void;
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export default function AttachmentPreview({ file, onRemove }: AttachmentPreviewProps) {
  const isImage = file.type.startsWith('image/');
  const previewUrl = isImage ? URL.createObjectURL(file) : null;

  return (
    <div className="flex items-center gap-2 px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg mx-4 mb-2">
      {isImage && previewUrl ? (
        // Thumbnail para imagens
        <div className="w-12 h-12 rounded overflow-hidden shrink-0 bg-gray-200">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={previewUrl}
            alt={file.name}
            className="w-full h-full object-cover"
            onLoad={() => URL.revokeObjectURL(previewUrl)}
          />
        </div>
      ) : (
        // Icone para documentos
        <div className="w-12 h-12 rounded bg-schappo-50 flex items-center justify-center shrink-0">
          <svg className="w-6 h-6 text-schappo-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          </svg>
        </div>
      )}

      {/* Info do arquivo */}
      <div className="flex-1 min-w-0">
        <div className="text-xs font-medium text-gray-700 truncate">{file.name}</div>
        <div className="text-[10px] text-gray-400">{formatSize(file.size)}</div>
      </div>

      {/* Botao remover */}
      <button
        onClick={onRemove}
        className="w-6 h-6 flex items-center justify-center rounded-full text-gray-400 hover:text-red-500 hover:bg-red-50 transition-colors shrink-0"
        title="Remover arquivo"
      >
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
        </svg>
      </button>
    </div>
  );
}
