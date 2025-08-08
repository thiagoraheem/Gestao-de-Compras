# Integração com ERP - Configuração e Uso

## Visão Geral

O sistema de gestão de compras possui integração com sistemas ERP externos para busca de produtos. Esta integração permite que os usuários busquem produtos diretamente do ERP durante a criação de solicitações de compra.

## Configuração

### 1. Variáveis de Ambiente

Adicione as seguintes variáveis ao seu arquivo `.env`:

```bash
# Base URL da API do ERP
BASE_API_URL=http://54.232.194.197:5001/api

# Habilitar/desabilitar integração ERP
ERP_INTEGRATION_ENABLED=true
```

### 2. Configurações Disponíveis

No arquivo `server/config.ts`, você pode ajustar:

- **baseUrl**: URL base da API do ERP
- **productsEndpoint**: Endpoint específico para produtos (padrão: `/Produtos`)
- **timeout**: Timeout para requisições (padrão: 10 segundos)
- **enabled**: Se a integração está habilitada

## Como Funciona

### 1. Busca de Produtos

Quando um usuário digita no campo de busca de produtos:

1. O sistema faz uma requisição para `/api/products/search?q=termo_busca`
2. O endpoint verifica se a integração ERP está habilitada
3. Se habilitada, faz uma requisição para o ERP externo
4. Se desabilitada ou em caso de erro, retorna dados mock

### 2. Fallback Automático

O sistema possui um mecanismo de fallback robusto:

- **ERP indisponível**: Retorna dados mock automaticamente
- **Timeout**: Após 10 segundos, usa dados mock
- **Erro de rede**: Fallback para dados mock
- **Resposta inválida**: Tenta mapear ou usa dados mock

### 3. Mapeamento de Dados

O sistema mapeia automaticamente diferentes formatos de resposta do ERP:

```typescript
// Formato esperado pelo frontend
interface Product {
  codigo: string;
  descricao: string;
  unidade: string;
}

// Mapeamento automático de campos comuns
{
  codigo: item.codigo || item.code || item.id,
  descricao: item.descricao || item.description || item.name,
  unidade: item.unidade || item.unit || item.unitOfMeasure || 'Unidade'
}
```

## Endpoints da API

### 1. Buscar Produtos

```http
GET /api/products/search?q=termo_busca
```

**Parâmetros:**
- `q` (string): Termo de busca (mínimo 2 caracteres)

**Resposta:**
```json
[
  {
    "codigo": "PROD001",
    "descricao": "Papel A4 75g/m² Branco",
    "unidade": "Resma"
  }
]
```

### 2. Testar Conexão ERP

```http
GET /api/erp/test-connection
```

**Resposta:**
```json
{
  "success": true,
  "message": "ERP connection successful"
}
```

## Configuração do ERP Externo

### Formato Esperado da API

O ERP deve fornecer um endpoint que aceite:

```http
GET /api/Produtos?search=termo&limit=10
```

**Resposta esperada:**
```json
[
  {
    "codigo": "PROD001",
    "descricao": "Produto Exemplo",
    "unidade": "UN",
    "preco": 10.50,
    "categoria": "Escritório",
    "ativo": true
  }
]
```

### Campos Suportados

O sistema reconhece automaticamente os seguintes campos:

| Campo Frontend | Campos ERP Aceitos |
|---|---|
| `codigo` | `codigo`, `code`, `id` |
| `descricao` | `descricao`, `description`, `name` |
| `unidade` | `unidade`, `unit`, `unitOfMeasure` |

## Desenvolvimento e Testes

### 1. Modo Desenvolvimento

Para desenvolvimento, mantenha `ERP_INTEGRATION_ENABLED=false` para usar dados mock.

### 2. Dados Mock

O sistema inclui dados mock variados para testes:
- Produtos de escritório
- Equipamentos de TI
- Serviços
- Materiais de construção
- EPIs

### 3. Logs

O sistema registra logs detalhados:
- Tentativas de conexão com ERP
- Fallbacks para dados mock
- Erros de mapeamento
- Timeouts

## Solução de Problemas

### 1. ERP não responde

**Sintomas:** Sistema sempre retorna dados mock

**Soluções:**
1. Verificar se `ERP_INTEGRATION_ENABLED=true`
2. Testar conectividade: `GET /api/erp/test-connection`
3. Verificar URL do ERP em `BASE_API_URL`
4. Verificar logs do servidor

### 2. Produtos não aparecem

**Sintomas:** Busca retorna array vazio

**Soluções:**
1. Verificar se o termo tem pelo menos 2 caracteres
2. Verificar formato da resposta do ERP
3. Verificar logs de mapeamento
4. Testar com dados mock primeiro

### 3. Timeout frequente

**Sintomas:** Sempre fallback para mock

**Soluções:**
1. Aumentar timeout em `config.ts`
2. Verificar latência da rede
3. Otimizar consulta no ERP
4. Implementar cache local

## Exemplo de Implementação

### 1. Habilitando ERP

```bash
# .env
ERP_INTEGRATION_ENABLED=true
BASE_API_URL=https://seu-erp.com/api
```

### 2. Testando Integração

```javascript
// Testar conexão
fetch('/api/erp/test-connection')
  .then(res => res.json())
  .then(data => console.log(data));

// Buscar produtos
fetch('/api/products/search?q=papel')
  .then(res => res.json())
  .then(products => console.log(products));
```

## Segurança

### 1. Autenticação

- Todos os endpoints requerem autenticação
- Use headers de autenticação apropriados para o ERP

### 2. Validação

- Validação de entrada nos parâmetros
- Sanitização de dados do ERP
- Timeout para evitar travamentos

### 3. Rate Limiting

Considere implementar rate limiting para:
- Evitar sobrecarga do ERP
- Limitar requisições por usuário
- Cache de resultados frequentes

## Monitoramento

### 1. Métricas Importantes

- Taxa de sucesso das requisições ERP
- Tempo médio de resposta
- Frequência de fallback para mock
- Erros de mapeamento

### 2. Alertas

Configure alertas para:
- ERP indisponível por mais de X minutos
- Taxa de erro acima de Y%
- Timeout frequente

## Próximos Passos

1. **Cache**: Implementar cache Redis para resultados frequentes
2. **Sincronização**: Sincronização periódica de catálogo
3. **Analytics**: Métricas de uso e performance
4. **Multi-ERP**: Suporte a múltiplos ERPs
5. **Webhook**: Notificações de mudanças no ERP