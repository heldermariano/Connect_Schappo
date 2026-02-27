import { SSEEvent } from './types';

type SSEClient = {
  id: string;
  controller: ReadableStreamDefaultController;
  atendenteId: number | null;
};

// Singleton que gerencia conexoes SSE ativas
class SSEManager {
  private clients: Map<string, SSEClient> = new Map();

  addClient(id: string, controller: ReadableStreamDefaultController): void {
    this.clients.set(id, { id, controller, atendenteId: null });
  }

  setClientAtendente(clientId: string, atendenteId: number): void {
    const client = this.clients.get(clientId);
    if (client) {
      client.atendenteId = atendenteId;
    }
  }

  removeClient(id: string): void {
    const client = this.clients.get(id);
    const atendenteId = client?.atendenteId ?? null;
    this.clients.delete(id);

    // Verificar se atendente perdeu todas as conexoes
    if (atendenteId) {
      const stillConnected = this.isAtendenteConnected(atendenteId);
      if (!stillConnected) {
        this.markAtendenteOffline(atendenteId);
      }
    }
  }

  private isAtendenteConnected(atendenteId: number): boolean {
    for (const client of this.clients.values()) {
      if (client.atendenteId === atendenteId) return true;
    }
    return false;
  }

  private async markAtendenteOffline(atendenteId: number): Promise<void> {
    try {
      // Import dinamico para evitar dependencia circular
      const { default: pool } = await import('./db');
      const result = await pool.query(
        `UPDATE atd.atendentes SET status_presenca = 'offline', updated_at = NOW()
         WHERE id = $1 AND status_presenca != 'offline'
         RETURNING nome`,
        [atendenteId],
      );
      // Fechar pausas abertas ao ficar offline
      await pool.query(
        `UPDATE atd.atendente_pausas SET fim_at = NOW() WHERE atendente_id = $1 AND fim_at IS NULL`,
        [atendenteId],
      ).catch(() => {});
      if (result.rowCount && result.rowCount > 0) {
        console.log(`[SSE] Atendente ${atendenteId} (${result.rows[0].nome}) marcado offline (sem conexao SSE)`);
        this.broadcast({
          type: 'atendente_status',
          data: {
            atendente_id: atendenteId,
            nome: result.rows[0].nome,
            status: 'offline',
          },
        });
      }
    } catch (err) {
      console.error('[SSE] Erro ao marcar atendente offline:', err);
    }
  }

  getConnectedAtendenteIds(): Set<number> {
    const ids = new Set<number>();
    for (const client of this.clients.values()) {
      if (client.atendenteId) ids.add(client.atendenteId);
    }
    return ids;
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
