import { NextRequest } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { sseManager } from '@/lib/sse-manager';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  // Obter atendente da sessao para associar ao client SSE
  const session = await getServerSession(authOptions);
  const atendenteId = session?.user?.id ? parseInt(session.user.id as string) : null;

  const clientId = `sse-${Date.now()}-${Math.random().toString(36).slice(2)}`;

  const stream = new ReadableStream({
    start(controller) {
      sseManager.addClient(clientId, controller);

      // Associar atendente ao client para deteccao de offline
      if (atendenteId) {
        sseManager.setClientAtendente(clientId, atendenteId);
      }

      // Envia evento inicial de conexao
      const encoder = new TextEncoder();
      controller.enqueue(
        encoder.encode(`event: connected\ndata: ${JSON.stringify({ clientId })}\n\n`),
      );
    },
    cancel() {
      sseManager.removeClient(clientId);
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
      'X-Accel-Buffering': 'no',
    },
  });
}
