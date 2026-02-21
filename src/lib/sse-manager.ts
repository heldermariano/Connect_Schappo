import { SSEEvent } from './types';

type SSEClient = {
  id: string;
  controller: ReadableStreamDefaultController;
};

// Singleton que gerencia conexoes SSE ativas
class SSEManager {
  private clients: Map<string, SSEClient> = new Map();

  addClient(id: string, controller: ReadableStreamDefaultController): void {
    this.clients.set(id, { id, controller });
  }

  removeClient(id: string): void {
    this.clients.delete(id);
  }

  get clientCount(): number {
    return this.clients.size;
  }

  // Envia evento para todos os clientes conectados
  broadcast(event: SSEEvent): void {
    const payload = `event: ${event.type}\ndata: ${JSON.stringify(event.data)}\n\n`;
    const encoder = new TextEncoder();
    const encoded = encoder.encode(payload);

    for (const [id, client] of this.clients) {
      try {
        client.controller.enqueue(encoded);
      } catch {
        // Cliente desconectou, remover
        this.clients.delete(id);
      }
    }
  }

  // Envia heartbeat para manter conexao viva
  heartbeat(): void {
    const payload = `: heartbeat\n\n`;
    const encoder = new TextEncoder();
    const encoded = encoder.encode(payload);

    for (const [id, client] of this.clients) {
      try {
        client.controller.enqueue(encoded);
      } catch {
        this.clients.delete(id);
      }
    }
  }
}

// Singleton global — sobrevive entre requests no mesmo processo
const globalForSSE = globalThis as unknown as { sseManager: SSEManager };
export const sseManager = globalForSSE.sseManager || new SSEManager();
if (process.env.NODE_ENV !== 'production') {
  globalForSSE.sseManager = sseManager;
}
