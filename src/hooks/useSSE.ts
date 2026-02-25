'use client';

import { useEffect, useRef, useCallback } from 'react';

type SSEHandler = (event: string, data: unknown) => void;

export function useSSE(onEvent: SSEHandler) {
  const eventSourceRef = useRef<EventSource | null>(null);
  const handlerRef = useRef(onEvent);
  handlerRef.current = onEvent;

  const connect = useCallback(() => {
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
    }

    const es = new EventSource('/api/events');
    eventSourceRef.current = es;

    const eventTypes = [
      'connected',
      'nova_mensagem',
      'conversa_atualizada',
      'chamada_nova',
      'chamada_atualizada',
      'ramal_status',
      'atendente_status',
      'chat_interno_mensagem',
    ];

    for (const type of eventTypes) {
      es.addEventListener(type, (e: MessageEvent) => {
        try {
          const data = JSON.parse(e.data);
          handlerRef.current(type, data);
        } catch {
          handlerRef.current(type, e.data);
        }
      });
    }

    es.onerror = () => {
      es.close();
      // Reconectar apos 3 segundos
      setTimeout(connect, 3000);
    };
  }, []);

  useEffect(() => {
    connect();
    return () => {
      eventSourceRef.current?.close();
    };
  }, [connect]);
}
