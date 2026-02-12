# locador-compras

## Integração Locador (runtime)

O frontend React não chama o Locador diretamente. Todas as chamadas passam pelo backend (Node/Express), que:

- Lê `locador.baseUrl`, `locador.endpoints.*` e credenciais técnicas do banco (PostgreSQL).
- Mantém cache em memória com TTL (sem precisar reiniciar o app).
- Gerencia `Authorization: Bearer {token}` no backend, com refresh automático.

## Pré-requisitos

- Aplicar a migration: [0018_create_app_settings.sql](file:///c:/Projetos/Locador/webapps/Gestao-de-Compras/migrations/0018_create_app_settings.sql)
- Definir `CONFIG_ENCRYPTION_KEY` no `.env` (32 bytes em base64 ou hex). Veja [.env.example](file:///c:/Projetos/Locador/webapps/Gestao-de-Compras/.env.example)

## Chaves no banco (app_settings)

- `locador.config` (não secreto): `{ enabled, sendEnabled, baseUrl, endpoints }`
- `locador.credentials` (secreto): `{ login, senha }` (armazenado criptografado)

## API interna de Config

- `GET /api/config/locador` (admin)  
  Retorna a configuração atual com `senha` mascarada.
- `PUT /api/config/locador` (admin)  
  Atualiza a configuração no banco (com validação).
- `POST /api/config/locador/reload` (admin)  
  Invalida cache e recarrega.

### Exemplo de payload (PUT /api/config/locador)

```json
{
  "enabled": true,
  "sendEnabled": true,
  "baseUrl": "http://localhost:5225/api",
  "endpoints": {
    "combo": {
      "fornecedor": "/Fornecedor",
      "centroCusto": "/CostCenter",
      "planoContas": "/ChartOfAccounts",
      "empresa": "/Empresa",
      "formaPagamento": "/FormaPagamento"
    },
    "post": {
      "enviarSolicitacao": "/Purchase/PurchaseRequest",
      "recebimento": "/Purchase/PurchaseReceive"
    }
  },
  "credentials": {
    "login": "seu_login_tecnico",
    "senha": "sua_senha_tecnica"
  }
}
```

## API interna de Integração (proxy)

Combos:

- `GET /api/integration/locador/combos/fornecedores`
- `GET /api/integration/locador/combos/centros-custo`
- `GET /api/integration/locador/combos/planos-conta`
- `GET /api/integration/locador/combos/empresas`
- `GET /api/integration/locador/combos/formas-pagamento`

Ações:

- `POST /api/integration/locador/solicitacoes`
- `POST /api/integration/locador/recebimentos`

Saúde:

- `GET /api/integration/locador/health`

## Tela Admin (opcional)

O frontend inclui uma tela simples para editar a configuração e executar Reload:

- `GET /admin/locador-config`

## Segurança

- Token do Locador nunca vai para o browser.
- Segredos (`locador.credentials`) ficam no banco criptografados com `CONFIG_ENCRYPTION_KEY`.

## Controle de Envio ao ERP

Foi adicionada uma flag de configuração `sendEnabled` (UI: "Envio de Dados para ERP") que permite desativar *apenas* o envio de informações (POST) para o ERP, mantendo as consultas (GET) ativas.

- **Ativo (true)**: Comportamento padrão. O sistema envia dados ao ERP (Solicitações, Recebimentos).
- **Inativo (false)**: O sistema bloqueia o envio, registra um log de auditoria com status "ENVIO_DESABILITADO_POR_CONFIGURACAO" e define o status do recebimento como "erro_integracao" (com mensagem explicativa), permitindo que o processo continue sem travar, mas sinalizando que a integração de escrita foi pulada.

Isso é útil para manutenção, testes ou quando o ERP está instável para gravações, mas disponível para leituras.
