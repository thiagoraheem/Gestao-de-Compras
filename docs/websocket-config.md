# Configuração de WebSocket em Produção

Este projeto usa WebSocket no caminho `/ws` compartilhando o mesmo servidor HTTP que atende a aplicação web. Em ambientes de produção com proxy (Nginx/IIS) ou portas distintas, configure a URL do WebSocket explicitamente via variável de ambiente.

## Variáveis de Ambiente

- `PORT`: porta onde o servidor Node/Express escuta. Se não definido, usa `3000`.
- `BASE_URL`: base para links enviados por e‑mail.
- `VITE_BASE_API_URL`: já mapeada a partir de `BASE_API_URL` pelo Vite.
- `WEBSOCKET_URL`: URL completa do WebSocket. Quando definido, o frontend usa esta URL; caso contrário, faz fallback para `ws(s)://{window.location.host}/ws`.

Exemplo de `.env` em produção:

```
NODE_ENV=production
PORT=5201
BASE_URL="http://54.232.194.197:5200"
BASE_API_URL="http://54.232.194.197:5001/api"
WEBSOCKET_URL=ws://54.232.194.197:5201/ws
```

## Roteamento / Proxy

Certifique-se de que o proxy (Nginx/IIS) encaminhe requisições para `/ws` com cabeçalhos `Upgrade` e `Connection: upgrade` para a porta real do Node (`PORT`).

Exemplo (Nginx):

```
location /ws {
  proxy_pass http://127.0.0.1:5201/ws;
  proxy_http_version 1.1;
  proxy_set_header Upgrade $http_upgrade;
  proxy_set_header Connection "upgrade";
  proxy_set_header Host $host;
}
```

## Checklist de Deploy

- Build do cliente: `npm run build`.
- Verificar `dist/public` existente no servidor.
- Garantir `.env` com `PORT`, `BASE_URL`, `BASE_API_URL` e `WEBSOCKET_URL` corretos.
- Reiniciar serviço após alteração de `.env`.

## Observações

- Se `WEBSOCKET_URL` não estiver definido, o cliente tentará conectar em `/ws` no mesmo host/porta do site. Em ambientes onde o site está em `5200` mas o Node escuta em `5201`, isso causará erro de conexão — defina `WEBSOCKET_URL` para apontar para a porta correta.