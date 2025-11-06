# IIS: Proxy de WebSocket para Node/Express

Este guia configura o IIS para encaminhar conexões WebSocket do site em `:5200` para o servidor Node/Express em `:5201` no caminho `/ws`.

## Pré‑requisitos

- IIS com os módulos:
  - Application Request Routing (ARR)
  - URL Rewrite
  - WebSocket Protocol (Funções do Windows)

## Passo 1 — Habilitar ARR como Proxy

1. Abra o IIS Manager.
2. Clique no servidor (nível raiz) > "Application Request Routing Cache".
3. Em "Server Proxy Settings…", marque "Enable Proxy" e aplique.

## Passo 2 — Habilitar WebSocket no site

1. Selecione o site que atende o frontend (porta `5200`).
2. Abra "WebSocket Protocol" e garanta que está habilitado.

## Passo 3 — Regra de URL Rewrite para `/ws`

Crie uma regra para encaminhar apenas o caminho `/ws` para o Node na porta `5201` com upgrade de conexão.

### Opção A — Usando `web.config` na raiz do site (porta 5200)

Crie/edite o arquivo `web.config` do site com o conteúdo abaixo:

```xml
<?xml version="1.0" encoding="utf-8"?>
<configuration>
  <system.webServer>
    <rewrite>
      <rules>
        <!-- Encaminha WebSocket para o Node/Express em 5201 -->
        <rule name="WebSocketProxy" stopProcessing="true">
          <match url="^ws$" />
          <action type="Rewrite" url="http://127.0.0.1:5201/ws" appendQueryString="true" />
          <serverVariables>
            <set name="HTTP_UPGRADE" value="{HTTP_UPGRADE}" />
            <set name="HTTP_CONNECTION" value="Upgrade" />
            <set name="HTTP_HOST" value="{HTTP_HOST}" />
          </serverVariables>
        </rule>
      </rules>
    </rewrite>

    <!-- Garante suporte a WebSocket -->
    <webSocket enabled="true" />

    <!-- Configurações ARR para manter conexão upgrade -->
    <proxy>
      <reverseRewriteHostInResponseHeaders enabled="false" />
    </proxy>
  </system.webServer>
</configuration>
```

Notas:
- A regra corresponde ao caminho exato `/ws`. Se seu app usa `/ws/…`, ajuste o `match` para `^ws(.*)$` e a `action` para `http://127.0.0.1:5201/{R:0}`.
- Se o Node estiver em outro host, substitua `127.0.0.1` pelo IP/hostname.

### Opção B — Criando regra via UI do IIS

1. No site (porta 5200), abra "URL Rewrite" > "Add Rule(s)…" > "Blank rule".
2. Defina:
   - Name: `WebSocketProxy`
   - Requested URL: `Matches the Pattern`
   - Pattern: `^ws$`
   - Using: `Regular Expressions`
3. Em "Action":
   - Action type: `Rewrite`
   - Rewrite URL: `http://127.0.0.1:5201/ws`
   - Enable "Append query string"
4. Em "Server Variables": adicionar:
   - `HTTP_UPGRADE` = `{HTTP_UPGRADE}`
   - `HTTP_CONNECTION` = `Upgrade`
   - `HTTP_HOST` = `{HTTP_HOST}`
5. Aplicar.

## Passo 4 — Verificar `.env` e build

No servidor Node/Express:

- `.env` deve conter:
  - `PORT=5201`
  - `BASE_URL=http://seu-host:5200`
  - `BASE_API_URL=http://seu-host:5001/api` (ajuste conforme seu backend)
  - `WEBSOCKET_URL` pode ficar vazio quando usar proxy, pois o cliente fará fallback para `ws(s)://{window.location.host}/ws`.
- Rode `npm run build` e reinicie o serviço do Node.

## Testes

- Abra o site em `http://seu-host:5200`.
- No Console do navegador, confirme que a conexão vai para `ws://seu-host:5200/ws` e que o status muda para "Conectado".

## Alternativa sem proxy: usar `WEBSOCKET_URL`

Se não quiser configurar o proxy no IIS, defina explicitamente a URL do WebSocket no `.env` para apontar ao Node na porta `5201`:

```
WEBSOCKET_URL=ws://seu-host:5201/ws
```

Com isso, o frontend usará a URL definida e se conectará direto ao Node/Express.

## Problemas comuns

- Erro de conexão persistente:
  - Verifique se o site (5200) tem `webSocket enabled="true"`.
  - Confirme que ARR está com "Enable Proxy" marcado.
  - Garanta que firewall permite tráfego em `5201` se usar a alternativa sem proxy.
  - Cheque logs do Node para confirmar que o servidor anexou o WebSocket em `/ws`.