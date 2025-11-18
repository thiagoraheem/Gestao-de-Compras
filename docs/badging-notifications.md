# Badges e Notificações de Aprovações (A1+A2)

- Endpoints: `GET /api/approvals/pending-count`, `POST /api/notifications/subscribe`, `GET /api/notifications/vapid-public-key`, `POST /api/approvals/push-refresh`.
- Ambiente: definir `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT` no `.env`.
- Service Worker: `client/public/sw.js` gerencia push e clique para abrir o app.
- PWA: `client/public/manifest.json` e registro do SW em `client/src/main.tsx`.
- Badge: iOS/desktop via Badging API; Android via notificação agregada.

## Backend

- Rotas registradas em `server/routes/index.ts`.
- Contagem de pendências por usuário: `server/routes/approvals.ts`.
- Web Push: `server/services/pushService.ts` com VAPID e tabela `push_subscriptions` em `shared/schema.ts`.

## Frontend

- Hook: `client/src/hooks/useApprovalsBadge.ts` faz fetch, atualiza badge, notifica aumento e gerencia push subscription.
- Util: `client/src/utils/badging.ts` encapsula Badging API.
- Permissão: `client/src/components/NotificationsPermission.tsx` solicita autorização.
- Fallback UI: `client/src/components/approvals-inline-badge.tsx` mostra contador dentro do app.
- Integração: `client/src/App.tsx` injeta o hook após login.

## Testes

- Executar servidor (`npm run dev`) e rodar scripts em `tests/approvals-pending-count.js` e `tests/notifications-subscribe.js`.

## Configuração

- `.env`: respeitar `PORT` existente; caso ausente usar `3000`.
- Expor `VAPID_PUBLIC_KEY` ao cliente pelo endpoint `/api/notifications/vapid-public-key`.