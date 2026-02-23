'use client';

import { useState, useEffect, useCallback, useRef } from 'react';

interface ImageLightboxProps {
  src: string;
  alt?: string;
  onClose: () => void;
}

export default function ImageLightbox({ src, alt, onClose }: ImageLightboxProps) {
  const [scale, setScale] = useState(1);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const dragStart = useRef({ x: 0, y: 0 });
  const posStart = useRef({ x: 0, y: 0 });

  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    if (e.key === 'Escape') onClose();
    if (e.key === '+' || e.key === '=') setScale(s => Math.min(s + 0.5, 5));
    if (e.key === '-') setScale(s => Math.max(s - 0.5, 0.5));
    if (e.key === '0') { setScale(1); setPosition({ x: 0, y: 0 }); }
  }, [onClose]);

  useEffect(() => {
    document.addEventListener('keydown', handleKeyDown);
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = '';
    };
  }, [handleKeyDown]);

  const handleWheel = useCallback((e: React.WheelEvent) => {
    e.stopPropagation();
    const delta = e.deltaY > 0 ? -0.25 : 0.25;
    setScale(s => Math.min(Math.max(s + delta, 0.5), 5));
  }, []);

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    if (scale <= 1) return;
    e.preventDefault();
    setIsDragging(true);
    dragStart.current = { x: e.clientX, y: e.clientY };
    posStart.current = { ...position };
  }, [scale, position]);

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (!isDragging) return;
    setPosition({
      x: posStart.current.x + (e.clientX - dragStart.current.x),
      y: posStart.current.y + (e.clientY - dragStart.current.y),
    });
  }, [isDragging]);

  const handleMouseUp = useCallback(() => {
    setIsDragging(false);
  }, []);

  const zoomIn = () => setScale(s => Math.min(s + 0.5, 5));
  const zoomOut = () => setScale(s => Math.max(s - 0.5, 0.5));
  const resetZoom = () => { setScale(1); setPosition({ x: 0, y: 0 }); };

  const handleDownload = async () => {
    try {
      const resp = await fetch(src);
      const blob = await resp.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = alt || 'imagem';
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      window.open(src, '_blank');
    }
  };

  const handleBackdropClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget && !isDragging) onClose();
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/90"
      onClick={handleBackdropClick}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseUp}
    >
      {/* Barra de controles no topo */}
      <div className="absolute top-4 left-1/2 -translate-x-1/2 flex items-center gap-1 z-10 bg-black/50 rounded-full px-2 py-1">
        {/* Zoom out */}
        <button
          onClick={(e) => { e.stopPropagation(); zoomOut(); }}
          className="w-9 h-9 flex items-center justify-center rounded-full hover:bg-white/20 text-white transition-colors"
          title="Diminuir zoom (−)"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 12H4" />
          </svg>
        </button>

        {/* Indicador de zoom */}
        <button
          onClick={(e) => { e.stopPropagation(); resetZoom(); }}
          className="px-2 text-white text-sm font-mono min-w-[52px] text-center hover:bg-white/20 rounded transition-colors"
          title="Resetar zoom (0)"
        >
          {Math.round(scale * 100)}%
        </button>

        {/* Zoom in */}
        <button
          onClick={(e) => { e.stopPropagation(); zoomIn(); }}
          className="w-9 h-9 flex items-center justify-center rounded-full hover:bg-white/20 text-white transition-colors"
          title="Aumentar zoom (+)"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
        </button>

        <div className="w-px h-6 bg-white/30 mx-1" />

        {/* Download */}
        <button
          onClick={(e) => { e.stopPropagation(); handleDownload(); }}
          className="w-9 h-9 flex items-center justify-center rounded-full hover:bg-white/20 text-white transition-colors"
          title="Baixar imagem"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
          </svg>
        </button>

        {/* Fechar */}
        <button
          onClick={onClose}
          className="w-9 h-9 flex items-center justify-center rounded-full hover:bg-white/20 text-white transition-colors"
          title="Fechar (Esc)"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      {/* Imagem com zoom e pan */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={src}
        alt={alt || 'Imagem'}
        className="max-w-[90vw] max-h-[90vh] object-contain select-none"
        style={{
          transform: `translate(${position.x}px, ${position.y}px) scale(${scale})`,
          cursor: scale > 1 ? (isDragging ? 'grabbing' : 'grab') : 'default',
          transition: isDragging ? 'none' : 'transform 0.2s ease',
        }}
        onClick={(e) => e.stopPropagation()}
        onMouseDown={handleMouseDown}
        onWheel={handleWheel}
        onDoubleClick={(e) => {
          e.stopPropagation();
          if (scale === 1) { setScale(2); } else { resetZoom(); }
        }}
        draggable={false}
      />
    </div>
  );
}
