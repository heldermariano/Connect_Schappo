# Layout e Mobile
> Usar quando: AppShell, Sidebar, BottomNav, Header, responsivo, safe-area, PWA, Capacitor

---

## Arquivos-Chave

| Arquivo | Funcao |
|---------|--------|
| `src/components/layout/AppShell.tsx` | Client: Sidebar(desktop) + BottomNav(mobile) + Softphone + ChatInterno |
| `src/components/layout/Sidebar.tsx` | Nav vertical desktop (hidden md:flex) |
| `src/components/layout/BottomNav.tsx` | Nav inferior mobile (md:hidden): 4 tabs + bottom-sheet |
| `src/components/layout/Header.tsx` | Busca + status presenca + usuario (responsivo) |
| `src/components/ui/Avatar.tsx` | Avatar com fallback iniciais + cor por hash |
| `src/components/ui/StatusBadge.tsx` | Badge presenca |
| `src/components/ui/StatusSelector.tsx` | Dropdown mudar status |
| `src/components/Logo.tsx` | Logo SVG (dark/light, sm/md/lg) |
| `src/components/Providers.tsx` | SessionProvider wrapper |
| `src/hooks/useIsMobile.ts` | Detecta breakpoint mobile (<768px) via matchMedia |
| `src/contexts/AppContext.tsx` | operatorStatus, isMobile compartilhados |
| `src/app/globals.css` | Tailwind + safe-area vars |
| `src/app/(app)/layout.tsx` | Server: force-dynamic + AppShell |
| `capacitor.config.ts` | Config Capacitor: URL remota, plugins |
| `public/manifest.json` | PWA manifest |

---

## Breakpoint Mobile

- **768px** (`md:` no Tailwind)
- `useIsMobile()` hook via `matchMedia`
- `isMobile` disponivel via `useAppContext()`
- **NAO usar media queries CSS** para logica de renderizacao condicional

---

## Layout Desktop vs Mobile

### Desktop (>= 768px)
```
┌──────────┬──────────────────────────┐
│ Sidebar  │ Header                   │
│ (nav)    ├──────────────────────────┤
│          │ Content                  │
│          │                          │
│          │                          │
│          ├──────────────────────────┤
│          │ Softphone (lateral)      │
└──────────┴──────────────────────────┘
```

### Mobile (< 768px)
```
┌──────────────────────────┐
│ Header (logo hidden)     │
├──────────────────────────┤
│ Content (lista OU detalhe│
│ nunca side-by-side)      │
│                          │
├──────────────────────────┤
│ BottomNav (4 tabs + Mais)│
└──────────────────────────┘
```

---

## Patterns Mobile

1. **Lista/detalhe** — Conversas e Chat Interno: lista OU detalhe (tipo WhatsApp), nunca lado-a-lado
2. **Fullscreen modals** — Softphone e Chat Interno: `fixed inset-0 z-[9999]` no mobile
3. **BottomNav** — 4 tabs visiveis + bottom-sheet "Mais..." (mesmas permissoes do Sidebar por role)
4. **Header responsivo** — Logo hidden mobile, busca full-width
5. **MessageView mobile** — Botao voltar + menu colapsado

---

## Safe Area CSS

```css
:root {
  --safe-area-top: env(safe-area-inset-top);
  --safe-area-bottom: env(safe-area-inset-bottom);
  --bottom-nav-height: 56px;
}
.pb-bottom-nav { padding-bottom: calc(var(--bottom-nav-height) + var(--safe-area-bottom)); }
```

---

## Capacitor

- **Config**: `capacitor.config.ts` — URL remota `https://connect.clinicaschappo.com`
- **webDir**: `public`
- App NAO empacota assets — mudancas no web refletem automaticamente
- **Android**: `npm run cap:sync && npm run cap:open:android`
- **iOS**: `npm run cap:sync && cd ios/App && pod install && npm run cap:open:ios`
- **Testar local**: Mudar `server.url` para `http://IP:3000` + `cleartext: true`

---

## Regras

1. **overflow-hidden** — AppShell usa no root flex. MessageView, MessageBubble, Header usam `min-w-0`
2. **isMobile via AppContext** — `const { isMobile } = useAppContext()` para condicionar layout
3. **BottomNav permissoes** — Mesma logica de role do Sidebar (admin tudo, supervisor sem tecnicos)
4. **force-dynamic** — Route group `(app)` com `force-dynamic` para evitar cache estatico
5. **Softphone dynamic import** — `next/dynamic` com `ssr: false` (sip.js usa APIs browser)
