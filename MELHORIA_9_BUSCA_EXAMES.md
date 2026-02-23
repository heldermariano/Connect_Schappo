# Melhoria 9 (Futura): Busca de Resultados de Exames via #

> Status: 📋 Documentado — implementar após Melhorias 1-8

---

## Conceito

Atendente digita `#nome-do-paciente` na caixa de busca ou na conversa e o sistema busca em um banco PostgreSQL externo se existe resultado de exame para aquele paciente. Se encontrar, retorna o link/PDF para o atendente colar no chat e enviar ao paciente.

---

## Fluxo

```
1. Paciente envia: "Oi, gostaria de saber o resultado do meu exame"

2. Atendente digita na barra de comandos: #Barbara Queiroz

3. Sistema busca no banco externo (PostgreSQL, rede interna)

4. Resultado aparece como card no painel:
   ┌─────────────────────────────────────────────┐
   │ 🔍 Resultados para "Barbara Queiroz"        │
   ├─────────────────────────────────────────────┤
   │ 📋 Bárbara Queiroz Ignowsky                 │
   │    EEG — 21/02/2026 — ✅ Pronto             │
   │    🔗 https://resultados.clinica.../abc123   │
   │    [📋 Copiar link]                          │
   ├─────────────────────────────────────────────┤
   │ 📋 Bárbara Queiroz Ignowsky                 │
   │    EEG — 15/01/2026 — ✅ Pronto             │
   │    🔗 https://resultados.clinica.../def456   │
   │    [📋 Copiar link]                          │
   ├─────────────────────────────────────────────┤
   │ Nenhum outro resultado encontrado            │
   └─────────────────────────────────────────────┘

5. Atendente clica "Copiar link" → cola no chat → envia ao paciente
```

---

## Especificações Técnicas

### Banco externo

- **Tipo**: PostgreSQL
- **Localização**: Rede interna da clínica (acessível via IP)
- **Conexão**: Pool separado do banco principal (connect_schappo)

### Configuração (.env.local)

```env
# Banco de resultados de exames (externo)
EXAMES_DB_HOST=IP_DO_SERVIDOR
EXAMES_DB_PORT=5432
EXAMES_DB_NAME=nome_do_banco
EXAMES_DB_USER=usuario_leitura
EXAMES_DB_PASSWORD=senha
```

### Pool separado (src/lib/db-exames.ts)

```typescript
import { Pool } from 'pg';

const examesPool = new Pool({
  host: process.env.EXAMES_DB_HOST,
  port: parseInt(process.env.EXAMES_DB_PORT || '5432'),
  database: process.env.EXAMES_DB_NAME,
  user: process.env.EXAMES_DB_USER,
  password: process.env.EXAMES_DB_PASSWORD,
  max: 5,           // Poucas conexões (só leitura)
  idleTimeoutMillis: 30000,
});

export default examesPool;
```

### API

```
GET /api/exames/buscar?nome=barbara+queiroz

Resposta:
{
  "resultados": [
    {
      "paciente": "Bárbara Queiroz Ignowsky",
      "tipo_exame": "EEG",
      "data_exame": "2026-02-21",
      "status": "pronto",
      "link_resultado": "https://resultados.clinicaschappo.com/abc123"
    }
  ],
  "total": 1
}
```

### Permissões

- Apenas atendentes com `grupo_atendimento` = 'recepcao', 'eeg' ou 'todos'
- Acesso somente leitura ao banco externo

### Frontend

#### Componente: `src/components/chat/ExameSearch.tsx`

- Input com prefixo `#` detectado automaticamente
- Busca com debounce (300ms)
- Resultados em card/popup abaixo do input
- Botão "Copiar link" em cada resultado
- Botão "Nenhum resultado" com sugestão de busca diferente

#### Detecção do comando #

```typescript
// No input de mensagens (quando implementar envio — Fase 2+)
// Ou numa barra de comandos dedicada no header da conversa

const handleInput = (text: string) => {
  if (text.startsWith('#') && text.length > 2) {
    const searchTerm = text.slice(1).trim();
    debouncedSearch(searchTerm);
  }
};
```

---

## Query de exemplo (ajustar conforme schema real do banco externo)

```sql
-- A query real depende do schema do banco de resultados
-- Exemplo genérico:
SELECT 
    paciente_nome,
    tipo_exame,
    data_exame,
    status,
    link_resultado
FROM exames_resultados
WHERE LOWER(paciente_nome) LIKE LOWER('%' || $1 || '%')
  AND link_resultado IS NOT NULL
ORDER BY data_exame DESC
LIMIT 10;
```

⚠️ **IMPORTANTE**: Antes de implementar, será necessário:
1. Obter o IP e credenciais do banco externo
2. Mapear o schema real (tabelas, colunas, relações)
3. Testar conexão da rede interna
4. Criar um usuário READ-ONLY dedicado para o Connect Schappo

---

## Implementação

Quando for hora de implementar, criar comando no Claude Code:

```
/busca-exames
```

Com instruções para:
1. Criar `src/lib/db-exames.ts` (pool separado)
2. Criar `src/app/api/exames/buscar/route.ts`
3. Criar `src/components/chat/ExameSearch.tsx`
4. Integrar no painel de conversa
5. Testar com dados reais

---

*Documentado em: 22/02/2026*
*Prioridade: após melhorias 1-8*
*Dependência: Fase 2 (envio de mensagens) para fluxo completo*
