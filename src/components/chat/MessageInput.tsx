'use client';

import { useState, useRef, useCallback, useEffect, KeyboardEvent } from 'react';
import AttachmentPreview from './AttachmentPreview';
import ExameSearch from './ExameSearch';
import MentionAutocomplete, { Participant } from './MentionAutocomplete';
import QuickReplyAutocomplete from './QuickReplyAutocomplete';
import EmojiPickerButton from './EmojiPickerButton';
import AudioRecorder from './AudioRecorder';
import QuotedMessage from './QuotedMessage';
import LocationModal from './LocationModal';
import SendContactModal from './SendContactModal';
import { Mensagem, RespostaPronta } from '@/lib/types';

interface MessageInputProps {
  onSend: (conteudo: string, mencoes?: string[], quotedMsgId?: string) => Promise<void>;
  conversaId?: number;
  disabled?: boolean;
  chatId?: string;
  tipoConversa?: string;
  replyingTo?: Mensagem | null;
  onCancelReply?: () => void;
  editingMsg?: Mensagem | null;
  onCancelEdit?: () => void;
  onEdit?: (msgId: number, conteudo: string) => Promise<void>;
}

const ACCEPTED_TYPES = 'image/*,video/*,audio/*,.pdf,.doc,.docx,.xls,.xlsx';

export default function MessageInput({ onSend, conversaId, disabled, chatId, tipoConversa, replyingTo, onCancelReply, editingMsg, onCancelEdit, onEdit }: MessageInputProps) {
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [attachments, setAttachments] = useState<File[]>([]);
  const [exameSearch, setExameSearch] = useState<string | null>(null);
  const [mentionQuery, setMentionQuery] = useState<string | null>(null);
  const [mentionedPhones, setMentionedPhones] = useState<string[]>([]);
  const [mentionedLids, setMentionedLids] = useState<string[]>([]);
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [isRecording, setIsRecording] = useState(false);
  const [locationModalOpen, setLocationModalOpen] = useState(false);
  const [contactModalOpen, setContactModalOpen] = useState(false);
  const [sendingSpecial, setSendingSpecial] = useState(false);
  const [slashQuery, setSlashQuery] = useState<string | null>(null);
  const [quickReplies, setQuickReplies] = useState<RespostaPronta[]>([]);
  const quickRepliesLoadedRef = useRef(false);
  const mentionStartRef = useRef<number>(-1);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const isGroup = tipoConversa === 'grupo';
  const hasMediaRecorder = typeof window !== 'undefined' && typeof MediaRecorder !== 'undefined';

  // Fetch participantes quando abre conversa de grupo
  useEffect(() => {
    if (!isGroup || !chatId) {
      setParticipants([]);
      return;
    }
    fetch(`/api/participantes/${encodeURIComponent(chatId)}`)
      .then((r) => (r.ok ? r.json() : { participantes: [] }))
      .then((data) => setParticipants(data.participantes || []))
      .catch(() => setParticipants([]));
  }, [chatId, isGroup]);

  // Preencher textarea quando entrar em modo edicao
  useEffect(() => {
    if (editingMsg) {
      setText(editingMsg.conteudo || '');
      requestAnimationFrame(() => {
        const textarea = textareaRef.current;
        if (textarea) {
          textarea.focus();
          textarea.style.height = 'auto';
          textarea.style.height = Math.min(textarea.scrollHeight, 120) + 'px';
          textarea.setSelectionRange(textarea.value.length, textarea.value.length);
        }
      });
    }
  }, [editingMsg]);

  // Limpar mencoes ao mudar de conversa
  useEffect(() => {
    setMentionedPhones([]);
    setMentionedLids([]);
    setMentionQuery(null);
    setSlashQuery(null);
  }, [conversaId]);

  // Carregar respostas prontas (1x, lazy)
  const loadQuickReplies = useCallback(() => {
    if (quickRepliesLoadedRef.current) return;
    quickRepliesLoadedRef.current = true;
    fetch('/api/respostas-prontas')
      .then((r) => (r.ok ? r.json() : { respostas: [] }))
      .then((data) => setQuickReplies(data.respostas || []))
      .catch(() => {});
  }, []);

  const handleSend = useCallback(async () => {
    if (sending) return;

    // Modo edicao: chamar onEdit em vez de onSend
    if (editingMsg && onEdit) {
      const trimmed = text.trim();
      if (!trimmed) return;
      setSending(true);
      setError(null);
      try {
        await onEdit(editingMsg.id, trimmed);
        setText('');
        if (textareaRef.current) {
          textareaRef.current.style.height = 'auto';
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Erro ao editar mensagem');
      } finally {
        setSending(false);
        textareaRef.current?.focus();
      }
      return;
    }

    // Enviar midia se tem arquivos anexados
    if (attachments.length > 0 && conversaId) {
      setSending(true);
      setError(null);

      try {
        // Enviar cada arquivo sequencialmente
        for (let i = 0; i < attachments.length; i++) {
          const file = attachments[i];
          const formData = new FormData();
          formData.append('conversa_id', String(conversaId));
          formData.append('file', file);
          // Caption apenas no primeiro arquivo
          if (i === 0 && text.trim()) {
            formData.append('caption', text.trim());
          }

          const res = await fetch('/api/mensagens/send-media', {
            method: 'POST',
            body: formData,
          });

          if (!res.ok) {
            const data = await res.json().catch(() => ({ error: 'Erro ao enviar midia' }));
            throw new Error(data.error || `Erro ao enviar ${file.name}`);
          }
        }

        setText('');
        setAttachments([]);
        setMentionedPhones([]);
        setMentionedLids([]);
        if (textareaRef.current) {
          textareaRef.current.style.height = 'auto';
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Erro ao enviar midia');
      } finally {
        setSending(false);
        textareaRef.current?.focus();
      }
      return;
    }

    // Enviar texto
    const trimmed = text.trim();
    if (!trimmed) return;

    setSending(true);
    setError(null);

    try {
      // Enviar LIDs se disponiveis (UAZAPI precisa de LID para notificar corretamente)
      const mencoes = mentionedLids.length > 0
        ? [...mentionedLids]
        : mentionedPhones.length > 0 ? [...mentionedPhones] : undefined;
      const quotedMsgId = replyingTo?.wa_message_id || undefined;
      await onSend(trimmed, mencoes, quotedMsgId);
      setText('');
      setMentionedPhones([]);
      setMentionedLids([]);
      if (textareaRef.current) {
        textareaRef.current.style.height = 'auto';
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao enviar mensagem');
    } finally {
      setSending(false);
      textareaRef.current?.focus();
    }
  }, [text, sending, onSend, attachments, conversaId, mentionedPhones, mentionedLids, replyingTo, editingMsg, onEdit]);

  const handleKeyDown = useCallback(
    (e: KeyboardEvent<HTMLTextAreaElement>) => {
      // Se autocomplete de mencao ou slash aberto, deixar ele tratar ArrowUp/Down/Enter/Esc
      if (mentionQuery !== null || slashQuery !== null) {
        if (['ArrowUp', 'ArrowDown', 'Enter', 'Escape'].includes(e.key)) {
          return;
        }
      }
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        handleSend();
      }
    },
    [handleSend, mentionQuery, slashQuery],
  );

  // Detectar @ no texto para autocomplete de mencao
  const detectMention = useCallback((value: string, cursorPos: number) => {
    if (!isGroup) {
      setMentionQuery(null);
      return;
    }

    // Procurar @ antes do cursor
    const before = value.slice(0, cursorPos);
    const atIndex = before.lastIndexOf('@');

    if (atIndex === -1) {
      setMentionQuery(null);
      return;
    }

    // Verificar se @ esta no inicio ou apos espaco/newline
    if (atIndex > 0 && !/\s/.test(before[atIndex - 1])) {
      setMentionQuery(null);
      return;
    }

    // Texto entre @ e cursor (sem quebra de linha)
    const query = before.slice(atIndex + 1);
    if (query.includes('\n')) {
      setMentionQuery(null);
      return;
    }

    mentionStartRef.current = atIndex;
    setMentionQuery(query);
  }, [isGroup]);

  // Auto-resize do textarea + deteccao de busca de exames (#) e mencoes (@)
  const handleInput = useCallback((e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const value = e.target.value;
    setText(value);
    const el = e.target;
    el.style.height = 'auto';
    el.style.height = Math.min(el.scrollHeight, 120) + 'px';

    if (value.startsWith('#') && value.length > 1) {
      setExameSearch(value.slice(1).trim());
    } else {
      setExameSearch(null);
    }

    // Detectar / no inicio para respostas prontas
    if (value.startsWith('/')) {
      loadQuickReplies();
      setSlashQuery(value.slice(1));
    } else {
      setSlashQuery(null);
    }

    detectMention(value, el.selectionStart);
  }, [detectMention, loadQuickReplies]);

  const handleMentionSelect = useCallback((participant: Participant) => {
    const start = mentionStartRef.current;
    if (start === -1) return;

    const textarea = textareaRef.current;
    const cursorPos = textarea?.selectionStart ?? text.length;
    const before = text.slice(0, start);
    const after = text.slice(cursorPos);
    const newText = `${before}@${participant.nome} ${after}`;

    setText(newText);
    setMentionQuery(null);
    mentionStartRef.current = -1;

    // Adicionar telefone a lista de mencionados (sem duplicatas)
    setMentionedPhones((prev) =>
      prev.includes(participant.phone) ? prev : [...prev, participant.phone],
    );

    // Adicionar LID se disponivel (UAZAPI usa LID para notificar o usuario)
    if (participant.lid) {
      setMentionedLids((prev) =>
        prev.includes(participant.lid!) ? prev : [...prev, participant.lid!],
      );
    }

    // Reposicionar cursor apos o nome inserido
    const newCursorPos = start + participant.nome.length + 2; // @Nome + espaco
    requestAnimationFrame(() => {
      if (textarea) {
        textarea.focus();
        textarea.setSelectionRange(newCursorPos, newCursorPos);
      }
    });
  }, [text]);

  const handleQuickReplySelect = useCallback((resposta: RespostaPronta) => {
    setText(resposta.conteudo);
    setSlashQuery(null);
    requestAnimationFrame(() => {
      const textarea = textareaRef.current;
      if (textarea) {
        textarea.focus();
        textarea.style.height = 'auto';
        textarea.style.height = Math.min(textarea.scrollHeight, 120) + 'px';
        // Cursor no final do texto
        textarea.setSelectionRange(resposta.conteudo.length, resposta.conteudo.length);
      }
    });
  }, []);

  const handleEmojiInsert = useCallback((emoji: string) => {
    const textarea = textareaRef.current;
    const cursorPos = textarea?.selectionStart ?? text.length;
    const before = text.slice(0, cursorPos);
    const after = text.slice(cursorPos);
    const newText = `${before}${emoji}${after}`;
    setText(newText);

    const newCursorPos = cursorPos + emoji.length;
    requestAnimationFrame(() => {
      if (textarea) {
        textarea.focus();
        textarea.setSelectionRange(newCursorPos, newCursorPos);
        // Resize textarea
        textarea.style.height = 'auto';
        textarea.style.height = Math.min(textarea.scrollHeight, 120) + 'px';
      }
    });
  }, [text]);

  const handleFileSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 16 * 1024 * 1024) {
        setError('Arquivo muito grande (max 16MB)');
        return;
      }
      setAttachments([file]);
      setError(null);
    }
    e.target.value = '';
  }, []);

  const removeAttachment = useCallback((index: number) => {
    setAttachments((prev) => prev.filter((_, i) => i !== index));
  }, []);

  const handleSendAudio = useCallback(async (file: File) => {
    if (!conversaId) return;
    setIsRecording(false);
    setSending(true);
    setError(null);

    try {
      const formData = new FormData();
      formData.append('conversa_id', String(conversaId));
      formData.append('file', file);

      const res = await fetch('/api/mensagens/send-media', {
        method: 'POST',
        body: formData,
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({ error: 'Erro ao enviar audio' }));
        throw new Error(data.error || 'Erro ao enviar audio');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao enviar audio');
    } finally {
      setSending(false);
    }
  }, [conversaId]);

  const handleSendLocation = useCallback(async (data: { latitude: number; longitude: number; name?: string; address?: string }) => {
    if (!conversaId) return;
    setSendingSpecial(true);
    setError(null);
    try {
      const res = await fetch('/api/mensagens/send-location', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ conversa_id: conversaId, ...data }),
      });
      if (!res.ok) {
        const d = await res.json().catch(() => ({ error: 'Erro ao enviar localizacao' }));
        throw new Error(d.error || 'Erro ao enviar localizacao');
      }
      setLocationModalOpen(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao enviar localizacao');
    } finally {
      setSendingSpecial(false);
    }
  }, [conversaId]);

  const handleSendContact = useCallback(async (data: { contact_name: string; contact_phone: string }) => {
    if (!conversaId) return;
    setSendingSpecial(true);
    setError(null);
    try {
      const res = await fetch('/api/mensagens/send-contact', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ conversa_id: conversaId, ...data }),
      });
      if (!res.ok) {
        const d = await res.json().catch(() => ({ error: 'Erro ao enviar contato' }));
        throw new Error(d.error || 'Erro ao enviar contato');
      }
      setContactModalOpen(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao enviar contato');
    } finally {
      setSendingSpecial(false);
    }
  }, [conversaId]);

  const canSend = attachments.length > 0 || text.trim().length > 0;

  // Se gravando, mostrar AudioRecorder em vez do input normal
  if (isRecording) {
    return (
      <div className="border-t border-gray-200 dark:border-gray-800 bg-white dark:bg-black shrink-0">
        <AudioRecorder
          onRecordingComplete={handleSendAudio}
          onCancel={() => setIsRecording(false)}
          disabled={disabled}
        />
      </div>
    );
  }

  return (
    <div className="relative border-t border-gray-200 dark:border-gray-800 bg-white dark:bg-black shrink-0">
      {error && (
        <div className="mx-4 mt-2 px-3 py-1.5 bg-red-50 text-red-600 text-xs rounded-md flex items-center gap-2">
          <svg className="w-3.5 h-3.5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <span>{error}</span>
          <button onClick={() => setError(null)} className="ml-auto text-red-400 hover:text-red-600">
            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      )}

      {/* Preview de edicao */}
      {editingMsg && onCancelEdit && (
        <div className="flex items-center gap-2 mx-4 mt-2 px-3 py-2 bg-amber-50 dark:bg-amber-900/20 border-l-4 border-amber-400 rounded-r-lg">
          <svg className="w-4 h-4 text-amber-600 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
          </svg>
          <span className="text-xs text-amber-700 dark:text-amber-400 font-medium flex-1">Editando mensagem</span>
          <button
            onClick={() => {
              onCancelEdit();
              setText('');
              if (textareaRef.current) textareaRef.current.style.height = 'auto';
            }}
            className="text-amber-500 hover:text-amber-700 dark:hover:text-amber-300"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      )}

      {/* Preview da mensagem sendo respondida */}
      {!editingMsg && replyingTo && onCancelReply && (
        <QuotedMessage mensagem={replyingTo} onCancel={onCancelReply} />
      )}

      {/* Preview dos arquivos anexados */}
      {attachments.length > 0 && (
        <div className="pt-2 space-y-1">
          {attachments.map((file, i) => (
            <AttachmentPreview key={i} file={file} onRemove={() => removeAttachment(i)} />
          ))}
        </div>
      )}

      {/* Popup busca de exames (ativado por #) */}
      {exameSearch !== null && exameSearch.length >= 2 && (
        <ExameSearch
          searchTerm={exameSearch}
          onClose={() => setExameSearch(null)}
          onAttachFiles={(files: File[]) => {
            setAttachments(files);
            setExameSearch(null);
            setText('');
            if (textareaRef.current) {
              textareaRef.current.style.height = 'auto';
            }
          }}
        />
      )}

      {/* Autocomplete de respostas prontas (ativado por /) */}
      {slashQuery !== null && quickReplies.length > 0 && (
        <QuickReplyAutocomplete
          query={slashQuery}
          respostas={quickReplies}
          onSelect={handleQuickReplySelect}
          onClose={() => setSlashQuery(null)}
        />
      )}

      {/* Autocomplete de mencoes (ativado por @ em grupos) */}
      {mentionQuery !== null && isGroup && participants.length > 0 && (
        <MentionAutocomplete
          query={mentionQuery}
          participants={participants}
          onSelect={handleMentionSelect}
          onClose={() => setMentionQuery(null)}
        />
      )}

      <div className="flex items-end gap-2 px-4 py-2">
        <button
          onClick={() => fileInputRef.current?.click()}
          disabled={disabled || sending || !!editingMsg}
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
          onChange={handleFileSelect}
          className="hidden"
        />

        {/* Botao microfone */}
        {hasMediaRecorder && (
          <button
            onClick={() => setIsRecording(true)}
            disabled={disabled || sending || !!editingMsg}
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
          onClick={() => setLocationModalOpen(true)}
          disabled={disabled || sending || !conversaId || !!editingMsg}
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
          onClick={() => setContactModalOpen(true)}
          disabled={disabled || sending || !conversaId || !!editingMsg}
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

        <textarea
          ref={textareaRef}
          value={text}
          onChange={handleInput}
          onKeyDown={handleKeyDown}
          placeholder={editingMsg ? 'Editar mensagem...' : attachments.length > 0 ? 'Legenda (opcional)...' : 'Digite sua mensagem...'}
          disabled={disabled || sending}
          spellCheck={true}
          lang="pt-BR"
          rows={1}
          className="flex-1 resize-none rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 px-3 py-2 text-sm
                     focus:outline-none focus:ring-2 focus:ring-schappo-500 focus:border-transparent
                     disabled:bg-gray-100 dark:disabled:bg-gray-600 disabled:text-gray-400
                     placeholder:text-gray-400 dark:placeholder:text-gray-500"
          style={{ maxHeight: '120px' }}
        />

        {/* Emoji picker */}
        <EmojiPickerButton onEmojiSelect={handleEmojiInsert} disabled={disabled || sending} />

        <button
          onClick={handleSend}
          disabled={disabled || sending || !canSend}
          className="shrink-0 w-9 h-9 flex items-center justify-center rounded-full
                     bg-schappo-600 text-white hover:bg-schappo-700
                     disabled:bg-gray-300 disabled:cursor-not-allowed
                     transition-colors"
          title="Enviar mensagem"
        >
          {sending ? (
            <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
            </svg>
          ) : (
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
            </svg>
          )}
        </button>
      </div>
      <div className="text-[10px] text-gray-300 dark:text-gray-600 px-4 pb-1 text-right">
        Enter para enviar &middot; Shift+Enter para quebra de linha
      </div>

      {/* Modal de localizacao */}
      <LocationModal
        open={locationModalOpen}
        onClose={() => setLocationModalOpen(false)}
        onSend={handleSendLocation}
        sending={sendingSpecial}
      />

      {/* Modal de enviar contato */}
      <SendContactModal
        open={contactModalOpen}
        onClose={() => setContactModalOpen(false)}
        onSend={handleSendContact}
        sending={sendingSpecial}
      />
    </div>
  );
}
