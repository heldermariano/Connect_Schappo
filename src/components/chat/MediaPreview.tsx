'use client';

interface MediaPreviewProps {
  tipo: string;
  url: string | null;
  mimetype: string | null;
  filename: string | null;
}

export default function MediaPreview({ tipo, url, mimetype, filename }: MediaPreviewProps) {
  // Sem URL, mostrar placeholder
  if (!url) {
    return (
      <div className="bg-gray-100 rounded p-2 mb-1 text-xs text-gray-500 flex items-center gap-2">
        {tipo === 'image' && (
          <>
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
            Imagem
          </>
        )}
        {tipo === 'audio' && (
          <>
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
            </svg>
            Audio
          </>
        )}
        {tipo === 'video' && (
          <>
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
            </svg>
            Video
          </>
        )}
        {tipo === 'document' && (
          <>
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            {filename || 'Documento'}
          </>
        )}
        {tipo === 'sticker' && (
          <>
            <span className="text-lg">&#127914;</span>
            Sticker
          </>
        )}
        {!['image', 'audio', 'video', 'document', 'sticker'].includes(tipo) && (
          <span>Midia ({mimetype || tipo})</span>
        )}
      </div>
    );
  }

  // Com URL — renderizar preview
  if (tipo === 'image') {
    return (
      <div className="mb-1">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={url} alt="Imagem" className="max-w-full rounded" loading="lazy" />
      </div>
    );
  }

  if (tipo === 'audio') {
    return (
      <div className="mb-1">
        <audio controls src={url} className="max-w-full" />
      </div>
    );
  }

  if (tipo === 'video') {
    return (
      <div className="mb-1">
        <video controls src={url} className="max-w-full rounded" />
      </div>
    );
  }

  if (tipo === 'document') {
    return (
      <a
        href={url}
        target="_blank"
        rel="noopener noreferrer"
        className="flex items-center gap-2 bg-gray-100 rounded p-2 mb-1 text-xs text-schappo-600 hover:underline"
      >
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3M3 17V7a2 2 0 012-2h6l2 2h6a2 2 0 012 2v8a2 2 0 01-2 2H5a2 2 0 01-2-2z" />
        </svg>
        {filename || 'Baixar documento'}
      </a>
    );
  }

  return null;
}
