Leia `CLAUDE.md` e `docs/MELHORIAS_FASE2.md` (seção "Melhoria 1: Logo + Identidade Visual").

A logo original da clínica está em `public/logo-clinica.jpg`. As cores são: laranja #F58220, preto #1A1A1A, cinza #6B6B6B.

Execute:

1. **tailwind.config.ts** — adicionar paleta `schappo` (50-900) com laranja #F58220 como cor 500
2. **Criar logo SVG** em `src/components/Logo.tsx` — texto "Connect" em laranja + "Schappo" em cinza/branco, com onda EEG como underline. Componente React que aceita props de tamanho e variante (dark/light)
3. **Gerar favicon** — criar `public/favicon.svg` simples com "CS" em laranja
4. **Atualizar `src/app/layout.tsx`** — metadata com título "Connect Schappo", favicon
5. **Atualizar Header** — fundo laranja #F58220, texto branco, logo à esquerda
6. **Atualizar Sidebar** — fundo escuro #1A1A1A, ícones laranja quando ativo, cinza quando inativo
7. **Atualizar CategoryFilter** — tabs com underline laranja quando ativo
8. **Atualizar ConversaItem** — badge de não lidas em bg-schappo-500
9. **Atualizar botões** — primários em bg-schappo-500 hover:bg-schappo-600
10. **globals.css** — remover estilos conflitantes, usar cores Tailwind customizadas
11. Teste visual e commit

O design deve ser profissional, limpo, seguindo a identidade da clínica. Responda em português.
