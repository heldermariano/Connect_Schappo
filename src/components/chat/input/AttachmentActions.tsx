'use client';

import { useRef } from 'react';
import LocationModal from '../LocationModal';
import SendContactModal from '../SendContactModal';

const ACCEPTED_TYPES = 'image/*,video/*,audio/*,.pdf,.doc,.docx,.xls,.xlsx';

interface AttachmentActionsProps {
  onFileSelect: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onStartRecording: () => void;
  onSendLocation: (data: { latitude: number; longitude: number; name?: string; address?: string }) => void;
  onSendContact: (data: { contact_name: string; contact_phone: string }) => void;
  sendingSpecial: boolean;
  hasMediaRecorder: boolean;
  disabled: boolean;
  sending: boolean;
  conversaId?: number;
  editingMsg: boolean;
  locationModalOpen: boolean;
  onLocationModalOpen: () => void;
  onLocationModalClose: () => void;
  contactModalOpen: boolean;
  onContactModalOpen: () => void;
  onContactModalClose: () => void;
}

export default function AttachmentActions({
  onFileSelect,
  onStartRecording,
  onSendLocation,
  onSendContact,
  sendingSpecial,
  hasMediaRecorder,
  disabled,
  sending,
  conversaId,
  editingMsg,
  locationModalOpen,
  onLocationModalOpen,
  onLocationModalClose,
  contactModalOpen,
  onContactModalOpen,
  onContactModalClose,
}: AttachmentActionsProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);

  return (
    <>
      {/* Botao anexar arquivo */}
      <button
        onClick={() => fileInputRef.current?.click()}
        disabled={disabled || sending || editingMsg}
        className="shrink-0 w-9 h-9 flex items-center justify-center rounded-full
                   text-gray-400 hover:text-schappo-600 hover:bg-gray-100
                   disabled:opacity-50 disabled:cursor-not-allowed
                   transition-colors"
        title="Anexar arquivo"
      >
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" />
        </svg>
      </button>
      <input
        ref={fileInputRef}
        type="file"
        accept={ACCEPTED_TYPES}
        onChange={onFileSelect}
        className="hidden"
      />

      {/* Botao microfone */}
      {hasMediaRecorder && (
        <button
          onClick={onStartRecording}
          disabled={disabled || sending || editingMsg}
          className="shrink-0 w-9 h-9 flex items-center justify-center rounded-full
                     text-gray-400 hover:text-red-500 hover:bg-gray-100
                     disabled:opacity-50 disabled:cursor-not-allowed
                     transition-colors"
          title="Gravar audio"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
          </svg>
        </button>
      )}

      {/* Botao localizacao */}
      <button
        onClick={onLocationModalOpen}
        disabled={disabled || sending || !conversaId || editingMsg}
        className="shrink-0 w-9 h-9 flex items-center justify-center rounded-full
                   text-gray-400 hover:text-green-600 hover:bg-gray-100
                   disabled:opacity-50 disabled:cursor-not-allowed
                   transition-colors"
        title="Enviar localizacao"
      >
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
        </svg>
      </button>

      {/* Botao enviar contato */}
      <button
        onClick={onContactModalOpen}
        disabled={disabled || sending || !conversaId || editingMsg}
        className="shrink-0 w-9 h-9 flex items-center justify-center rounded-full
                   text-gray-400 hover:text-blue-600 hover:bg-gray-100
                   disabled:opacity-50 disabled:cursor-not-allowed
                   transition-colors"
        title="Enviar contato"
      >
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
        </svg>
      </button>

      {/* Modal de localizacao */}
      <LocationModal
        open={locationModalOpen}
        onClose={onLocationModalClose}
        onSend={onSendLocation}
        sending={sendingSpecial}
      />

      {/* Modal de enviar contato */}
      <SendContactModal
        open={contactModalOpen}
        onClose={onContactModalClose}
        onSend={onSendContact}
        sending={sendingSpecial}
      />
    </>
  );
}
