import { redirect } from 'next/navigation';

// Redireciona para a pagina principal de conversas
// A selecao de conversa e feita via estado no client
export default function ConversaPage() {
  redirect('/conversas');
}
