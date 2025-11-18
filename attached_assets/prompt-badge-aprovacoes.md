# 📌 PROMPT PARA A IDE / AGENTE

**Você é um desenvolvedor sênior full-stack (NodeJS + React/PWA) responsável por implementar “badges” e notificações de aprovações (A1 e A2) no nosso sistema de Compras. Siga tudo abaixo com qualidade de produção.**

## Objetivo
1) Exibir um **badge no ícone do app instalado** (PWA) com a **soma** de solicitações pendentes em **Aprovação A1 + Aprovação A2** do usuário autenticado.  
2) Enviar **notificação** quando **surgirem novas** solicitações de aprovação (foreground e via Web Push).  
3) Funcionamento por plataforma:
   - **iOS/iPadOS (e desktop Chrome/Edge):** usar **Badging API** (`navigator.setAppBadge` / `navigator.clearAppBadge`).
   - **Android:** o badge do ícone depende de **notificações pendentes**. Portanto, manter uma **notificação agregada** (“Você tem X aprovações pendentes”) quando houver pendências, atualizando-a a cada mudança. Incluir o número no título/corpo da notificação para o usuário ver o total com clareza.

> Observação: quando não houver suporte à Badging API, fazer *graceful fallback* mantendo o contador dentro da UI (ex.: badge no ícone do menu).

## Requisitos Funcionais
- Contabilizar **A1 + A2** (inteiro ≥ 0).  
- Atualizar badge/notificação:
  - Ao **logar**, ao **abrir o app**, ao **voltar ao foco/visibilidade**, ao **processar um push**, e **periodicamente** (ex.: a cada 60s apenas enquanto a aba está ativa).
- Enviar notificação **somente** se:
  - O usuário deu **permissão** de notificação **e**
  - O **novo total** for **maior** que o último total conhecido (para evitar spam).  
- **Limpar** badge e **fechar**/substituir a notificação agregada quando o total cair para **0**.  
- **Segurança**: endpoints protegidos por token (ex.: Bearer/JWT); nada de dados sensíveis em payloads de push (usar IDs mínimos ou apenas contagem).  
- **Acessibilidade**: textos de notificação claros, localizados (pt-BR), e *fallback* de UI com badge visível no app.

## Back-end (NodeJS/Express)
### Novos endpoints
1. `GET /api/approvals/pending-count`  
   - Autenticado.  
   - Resposta:
     ```json
     { "a1": number, "a2": number, "total": number, "ts": string }
     ```
   - Implementar serviço que busca no banco as pendências por usuário logado.

2. `POST /api/notifications/subscribe`  
   - Salvar **Web Push subscription** (VAPID) por usuário. Evitar duplicatas.  
   - Esquema: `{ endpoint, keys:{p256dh, auth} }`.

3. (Opcional) `POST /api/approvals/push-refresh` (interno/admin/cron)  
   - Dispara push para usuários quando detectado aumento de pendências. Payload mínimo:
     ```json
     { "type": "approvals_update", "total": number, "a1": number, "a2": number }
     ```

### Web Push
- Configurar VAPID (chaves, variáveis de ambiente `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`).  
- Função utilitária `pushApprovalsUpdate(userId, { total, a1, a2 })` que envia para todas as subscriptions do usuário.  
- **Não** enviar dados sensíveis; apenas contagens e, opcionalmente, um limite de IDs para posterior *fetch* no cliente.

## Front-end (React + PWA)
### 1) Service Worker (ex.: `src/sw.js` ou `public/sw.js`)
- Listener de **push**:
  ```js
  self.addEventListener('push', (event) => {
    const data = event.data?.json() || {};
    if (data.type === 'approvals_update') {
      const total = Number(data.total || 0);
      const title = total > 0
        ? `Você tem ${total} aprovações pendentes`
        : 'Atualização de aprovações';
      const body = total > 0
        ? `Soma de A1 + A2: ${total}. Toque para revisar.`
        : 'Sem pendências no momento.';

      // Notificação "agregada" com tag fixa para substituir/atualizar
      event.waitUntil(
        self.registration.showNotification(title, {
          body,
          tag: 'approvals-badge',
          renotify: true,
          data: { total },
          // icon, badge e outros se disponíveis nos assets
          icon: '/icons/icon-192.png',
          badge: '/icons/badge-72.png' // opcional; alguns sistemas usam
        })
      );
    }
  });
  ```

- Clique na notificação:
  ```js
  self.addEventListener('notificationclick', (event) => {
    event.notification.close();
    event.waitUntil((async () => {
      const allClients = await clients.matchAll({ includeUncontrolled: true, type: 'window' });
      const url = '/aprovacoes'; // rota da tela de aprovações
      const existing = allClients.find(c => c.url.includes(url));
      if (existing) return existing.focus();
      return clients.openWindow(url);
    })());
  });
  ```

### 2) Utilitários de Badge (ex.: `src/utils/badging.ts`)
```ts
export async function setAppBadge(total: number) {
  try {
    if ('setAppBadge' in navigator && typeof (navigator as any).setAppBadge === 'function') {
      await (navigator as any).setAppBadge(Math.max(0, Math.floor(total)));
      return true;
    }
  } catch {}
  return false;
}

export async function clearAppBadge() {
  try {
    if ('clearAppBadge' in navigator && typeof (navigator as any).clearAppBadge === 'function') {
      await (navigator as any).clearAppBadge();
      return true;
    }
  } catch {}
  return false;
}
```

### 3) Hook de Estado das Aprovações (ex.: `src/hooks/useApprovalsBadge.ts`)
- Responsabilidades:
  - Buscar `/api/approvals/pending-count`.
  - **Comparar** com último total (em memória + `localStorage`).
  - Atualizar **badge** (iOS/desktop) via `setAppBadge/clearAppBadge`.
  - Em **Android** (ou quando Badging API indisponível), **solicitar permissão** e manter **uma notificação agregada** se `total > 0`:
    - Tentar usar `registration.getNotifications({ tag: 'approvals-badge' })` para substituir/garantir 1 notificação.
    - Exibir/atualizar com `showNotification` quando necessário.
  - Assinar **push** (salvar subscription em `/api/notifications/subscribe`).
  - Atualizar em eventos: `visibilitychange`, `focus`, **timer** (60s ativo), e quando receber **message** do SW (opcional).

**Exemplo (resumo do hook):**
```ts
import { useEffect, useRef } from 'react';
import { setAppBadge, clearAppBadge } from '@/utils/badging';

async function fetchPending() {
  const r = await fetch('/api/approvals/pending-count', { credentials: 'include' });
  if (!r.ok) throw new Error('Erro ao buscar pendências');
  return r.json() as Promise<{ a1: number; a2: number; total: number; ts: string }>;
}

async function ensurePushSubscription() {
  if (!('serviceWorker' in navigator) || !('PushManager' in window)) return null;
  const reg = await navigator.serviceWorker.ready;
  const sub = await reg.pushManager.getSubscription();
  if (sub) return sub;
  const perm = await Notification.requestPermission();
  if (perm !== 'granted') return null;
  return reg.pushManager.subscribe({
    userVisibleOnly: true,
    applicationServerKey: (window as any).VAPID_PUBLIC_KEY_BASE64URL
  });
}

export function useApprovalsBadge() {
  const lastTotalRef = useRef<number>(Number(localStorage.getItem('lastApprovalsTotal') || 0));

  useEffect(() => {
    let timer: any;

    const update = async (reason: string) => {
      try {
        const { total } = await fetchPending();

        // iOS/desktop: Badging API
        if (total > 0) await setAppBadge(total); else await clearAppBadge();

        // Android / fallback: notificação agregada
        if ('serviceWorker' in navigator) {
          const reg = await navigator.serviceWorker.ready;
          if (Notification.permission === 'granted') {
            // Substitui notificação anterior pela mesma tag
            if (total > 0) {
              await reg.showNotification(`Você tem ${total} aprovações pendentes`, {
                body: `Soma de A1 + A2: ${total}. Toque para revisar.`,
                tag: 'approvals-badge',
                renotify: true,
                icon: '/icons/icon-192.png',
                badge: '/icons/badge-72.png',
                data: { total }
              });
            } else {
              const list = await reg.getNotifications({ tag: 'approvals-badge' });
              list.forEach(n => n.close());
            }
          }
        }

        // Notificação apenas quando houver AUMENTO
        const prev = lastTotalRef.current;
        if (Notification.permission === 'granted' && total > prev) {
          const reg = await navigator.serviceWorker.ready;
          await reg.showNotification(`Novas aprovações: ${total - prev}`, {
            body: `Total pendente agora: ${total}.`,
            tag: 'approvals-new',
            renotify: false,
            icon: '/icons/icon-192.png',
            badge: '/icons/badge-72.png',
            data: { total }
          });
        }

        lastTotalRef.current = total;
        localStorage.setItem('lastApprovalsTotal', String(total));
      } catch (e) {
        // silencioso; não interromper UX
      }
    };

    const start = async () => {
      // Assinar push se possível
      const sub = await ensurePushSubscription();
      if (sub) {
        await fetch('/api/notifications/subscribe', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify(sub)
        });
      }

      await update('init');

      // Atualizações ao focar/visibilidade
      const onVis = () => document.visibilityState === 'visible' && update('visibility');
      window.addEventListener('visibilitychange', onVis);
      window.addEventListener('focus', () => update('focus'));

      // Poll leve enquanto ativo
      timer = setInterval(() => {
        if (document.visibilityState === 'visible') update('interval');
      }, 60000);

      // Cleanup
      return () => {
        window.removeEventListener('visibilitychange', onVis);
        window.removeEventListener('focus', () => update('focus'));
        if (timer) clearInterval(timer);
      };
    };

    start();
  }, []);
}
```

### 4) Integração no App
- Injetar `useApprovalsBadge()` no nível do layout após login (ex.: `App.tsx` quando o usuário está autenticado).  
- Exibir botão/fluxo para **permitir notificações** (se ainda não permitido).  
- Garantir que o **manifest.json** e **service worker** estejam corretos para instalação PWA.

### 5) UI Fallback
- Componente de ícone/menu exibindo badge **dentro do app** com `total` para navegadores sem suporte.

## Testes & Critérios de Aceite
- [ ] Endpoint `/api/approvals/pending-count` retorna `a1`, `a2`, `total` corretos por usuário.  
- [ ] Em iOS/desktop com suporte, o **badge do ícone** mostra `total`, limpa quando `0`.  
- [ ] Em Android, quando `total > 0`, existe **exatamente 1 notificação agregada** com tag `approvals-badge`; o ícone do app mostra badge/dot e o texto da notificação exibe o **número total**. Quando `total = 0`, a notificação é removida.  
- [ ] Ao surgir nova pendência (aumento de `total`), é exibida **notificação de novas aprovações** (se permitido).  
- [ ] Atualizações acontecem ao abrir/voltar ao app, em foco, via push e no poll leve.  
- [ ] Sem erros em consoles; *feature detection* funcionando; sem spam de notificações.  
- [ ] Código tipado (TS quando aplicável), com tratamento de erros e comentários sucintos.

## Arquivos a criar/alterar (exemplo)
- **Backend:**  
  - `src/routes/approvals.ts` (novo)  
  - `src/routes/notifications.ts` (novo)  
  - `src/services/approvalsService.ts` (novo)  
  - `src/services/pushService.ts` (novo)  
  - Registrar rotas no `app.ts`/`server.ts`.
- **Frontend:**  
  - `public/manifest.json` (confirmar PWA)  
  - `public/sw.js` (ou `src/sw.js` + build)  
  - `src/utils/badging.ts` (novo)  
  - `src/hooks/useApprovalsBadge.ts` (novo)  
  - `src/App.tsx` ou layout autenticado (usar o hook)  
  - `src/components/NotificationsPermission.tsx` (botão para pedir permissão)  
  - Ícones: `public/icons/icon-192.png`, `public/icons/badge-72.png` (opcional)

## Observações Finais
- Colocar **VAPID_PUBLIC_KEY** disponível no cliente (expor versão base64url segura).  
- Tratar usuários **deslogados** (não buscar contagem / não inscrever push).  
- Mantê-lo idempotente e resiliente (ex.: SW atualiza por tag, *graceful fallback* no app).  
- Escrever *README curto* explicando como testar localmente (gerar chaves VAPID, iniciar SW, simular pendências, etc.).

**Entregue o código completo, tipado e pronto para rodar, incluindo ajustes de build do service worker, scripts de npm e validações.**
