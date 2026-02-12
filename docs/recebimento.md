# Especificação Técnica — Integração Compras × Locador (Recebimento com NF e XML)

## 0. Contexto Geral

O sistema **Locador** (WinForms C# + SQL Server) é o sistema mestre de:
- Produtos
- Fornecedores
- Centro de Custo
- Plano de Contas
- Estoque
- Contas a Pagar

O módulo **Compras** (React + Node.js + PostgreSQL) é o sistema mestre de:
- Solicitações / Requisições
- Cotações
- Pedidos de Compra
- Processo de Recebimento

Esta especificação define tudo que é necessário para uma **IDE com agente de IA** implementar:

1. Adequação da **base de dados** do módulo Compras para suportar:
   - Importação de **XML de NF-e** de produtos;
   - Notas de **Serviço**;
   - **Recebimentos avulsos** sem NF;
   - Exibição e vínculo com **Centro de Custo** e **Plano de Contas** vindos do Locador.

2. Criação da **nova tela de Recebimento** no módulo Compras, incluindo:
   - Upload e leitura de XML;
   - Exibição dos dados da nota;
   - Seleção de Centro de Custo e Plano de Contas;
   - Preparação e envio dos dados para o Locador via API.

---

## 1. Escopo da Implementação

### 1.1. Incluso

- **Importar XML de NF-e (modelo 55) de produtos** no módulo Compras.
- **Cadastrar e gerenciar recebimentos de serviços** (NFS-e ou manual).
- **Cadastrar e gerenciar recebimentos avulsos** (sem nota).
- Sincronizar e exibir **Centro de Custo** e **Plano de Contas** do Locador no Compras.
- Criar uma **tela única** de Recebimento com três tipos:
  - NF de Produto (XML NF-e)
  - NF de Serviço
  - Recebimento Avulso (sem NF)
- Enviar os dados de recebimento para o Locador via **API REST**.

### 1.2. Fora de Escopo

- Devoluções, notas complementares, cartas de correção.
- Integração contábil avançada.
- Curva ABC e lógica de estoque mínimo (apenas preparar dados).
- Portal de fornecedores.

---

## 2. Arquitetura de Alto Nível

- **Frontend Compras:** React + Vite + Tailwind
- **Backend Compras:** Node.js + Express + TypeScript + PostgreSQL (Drizzle ORM)
- **Backend Locador:** API REST C# (.NET) + SQL Server

Fluxo:

1. Compras sincroniza **Centros de Custo** e **Plano de Contas** a partir da API do Locador.
2. Usuário acessa a **Tela de Recebimento**:
   - escolhe tipo de recebimento (Produto / Serviço / Avulso);
   - se Produto: **importa XML** de NF-e;
   - se Serviço: preenche dados da NFS-e / serviço;
   - se Avulso: preenche dados básicos.
3. Usuário seleciona **Centro de Custo** e **Plano de Contas** (obrigatório para serviço e avulso).
4. Backend Compras valida e armazena o recebimento.
5. Backend Compras envia os dados ao Locador via API:
   - XML bruto da NF-e (quando houver);
   - DTO com campos normalizados de cabeçalho, itens, totais, CC, PC etc.
6. Locador processa e responde com status.

---

## 3. Adequação da Base de Dados — Módulo Compras (PostgreSQL)

### 3.1. Tabela: `cost_centers` (Centros de Custo)

```sql
CREATE TABLE cost_centers (
  id              UUID PRIMARY KEY,
  external_id     VARCHAR(50) NOT NULL,  -- ID do Locador
  code            VARCHAR(50) NOT NULL,  -- Código CC (ex.: CC01)
  name            VARCHAR(200) NOT NULL,
  is_active       BOOLEAN NOT NULL DEFAULT TRUE,
  updated_at      TIMESTAMP NOT NULL DEFAULT NOW(),
  UNIQUE (external_id),
  UNIQUE (code)
);
```

### 3.2. Tabela: chart_of_accounts (Plano de Contas)

```sql
CREATE TABLE chart_of_accounts_erperp (
  id              UUID PRIMARY KEY,
  external_id     VARCHAR(50) NOT NULL,  -- ID do Locador
  code            VARCHAR(50) NOT NULL,  -- Ex.: 3.2.1.01
  description     VARCHAR(255) NOT NULL,
  is_active       BOOLEAN NOT NULL DEFAULT TRUE,
  updated_at      TIMESTAMP NOT NULL DEFAULT NOW(),
  UNIQUE (external_id),
  UNIQUE (code)
);
```
### 3.3. Tabela: `receipts` (Cabeçalho do Recebimento)

Tabela principal do processo de recebimento no Compras.

```sql
CREATE TYPE receipt_type AS ENUM ('produto', 'servico', 'avulso');
CREATE TYPE receipt_status AS ENUM (
  'rascunho',
  'validado_compras',
  'enviado_locador',
  'integrado_locador',
  'erro_integracao'
);

CREATE TABLE receipts (
  id                      UUID PRIMARY KEY,
  receipt_type            receipt_type NOT NULL,
  status                  receipt_status NOT NULL DEFAULT 'rascunho',

  -- Vínculos
  purchase_order_id       UUID NULL,           -- FK para tabela de pedidos do Compras
  supplier_id             UUID NULL,           -- FK para fornecedor no Compras (já integrado do Locador)
  locador_supplier_id     VARCHAR(50) NULL,    -- ID do fornecedor no Locador (se conhecido)

  -- Dados fiscais / documento
  document_number         VARCHAR(50) NULL,    -- número da NF/NFS/RPS ou doc avulso
  document_series         VARCHAR(20) NULL,
  document_key            VARCHAR(100) NULL,   -- chave NF-e, se houver
  document_issue_date     TIMESTAMP NULL,
  document_entry_date     TIMESTAMP NULL,      -- data de entrada / competência

  -- Dados financeiros
  total_amount            NUMERIC(18, 2) NOT NULL DEFAULT 0,
  installments_count      INT NULL,
  payment_terms           VARCHAR(200) NULL,   -- texto/condição de pagamento

  -- Integração CC e Plano de Contas
  cost_center_id          UUID NULL REFERENCES cost_centers(id),
  chart_of_accounts_id    UUID NULL REFERENCES chart_of_accounts(id),

  -- Integração com Locador
  locador_receipt_id      VARCHAR(50) NULL,    -- ID da nota/lancamento no Locador
  integration_message     TEXT NULL,

  -- Auditoria
  created_by              UUID NOT NULL,
  created_at              TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at              TIMESTAMP NOT NULL DEFAULT NOW()
);
```
### 3.4. Tabela: `receipt_nf_xmls` (XML da NF-e)

Armazena o XML bruto importado.

```sql
CREATE TABLE receipt_nf_xmls (
  id              UUID PRIMARY KEY,
  receipt_id      UUID NOT NULL REFERENCES receipts(id) ON DELETE CASCADE,
  xml_content     TEXT NOT NULL,          -- conteúdo bruto do XML
  xml_hash        VARCHAR(64) NOT NULL,   -- hash SHA-256 para integridade
  created_at      TIMESTAMP NOT NULL DEFAULT NOW(),
  UNIQUE (receipt_id),
  UNIQUE (xml_hash)
);
```
### 3.5. Tabela: `receipt_items` (Itens do Recebimento)

Itens de produto ou serviço.

```sql
CREATE TABLE receipt_items (
  id                          UUID PRIMARY KEY,
  receipt_id                  UUID NOT NULL REFERENCES receipts(id) ON DELETE CASCADE,

  -- Identificação do item
  line_number                 INT NOT NULL,              -- nItem
  description                 VARCHAR(300) NOT NULL,
  unit                        VARCHAR(20) NULL,
  quantity                    NUMERIC(18, 4) NOT NULL DEFAULT 0,
  unit_price                  NUMERIC(18, 6) NOT NULL DEFAULT 0,
  total_price                 NUMERIC(18, 2) NOT NULL DEFAULT 0,

  -- Mapeamento com produto (se tipo 'produto')
  locador_product_id          VARCHAR(50) NULL,          -- ID produto no Locador
  locador_product_code        VARCHAR(50) NULL,          -- código exibido ao usuário

  -- Mapeamento com item de pedido
  purchase_order_item_id      UUID NULL,                 -- item do pedido no Compras

  -- Dados fiscais básicos (produtos)
  ncm                         VARCHAR(20) NULL,
  cfop                        VARCHAR(10) NULL,
  icms_rate                   NUMERIC(5, 2) NULL,
  icms_amount                 NUMERIC(18, 2) NULL,
  ipi_rate                    NUMERIC(5, 2) NULL,
  ipi_amount                  NUMERIC(18, 2) NULL,
  pis_rate                    NUMERIC(5, 2) NULL,
  pis_amount                  NUMERIC(18, 2) NULL,
  cofins_rate                 NUMERIC(5, 2) NULL,
  cofins_amount               NUMERIC(18, 2) NULL
);
```

### 3.6. Tabela: `receipt_installments` (Parcelas / Duplicatas)
```sql
CREATE TABLE receipt_installments (
  id              UUID PRIMARY KEY,
  receipt_id      UUID NOT NULL REFERENCES receipts(id) ON DELETE CASCADE,
  installment_number   VARCHAR(50) NOT NULL,   -- nDup ou sequencial manual
  due_date        DATE NOT NULL,
  amount          NUMERIC(18, 2) NOT NULL
);
```

# 4. Adequação da Base de Dados — Locador (SQL Server)

Obs.: aqui é o mínimo necessário para integração. A implementação detalhada no Locador pode reaproveitar estruturas existentes de Notas, Estoque e Contas a Pagar.

## 4.1. Tabela de Staging: `Compras_Recebimentos_Importacao`
```sql
CREATE TABLE Compras_Recebimentos_Importacao (
    Id                      INT IDENTITY PRIMARY KEY,
    TipoDocumento           VARCHAR(20) NOT NULL,   -- 'produto' | 'servico' | 'avulso'
    ChaveNFe                VARCHAR(100) NULL,
    NumeroDocumento         VARCHAR(50) NULL,
    SerieDocumento          VARCHAR(20) NULL,
    DataEmissao             DATETIME NULL,
    DataEntrada             DATETIME NULL,
    CnpjFornecedor          VARCHAR(20) NULL,
    IdFornecedorLocador     INT NULL,
    ValorTotal              DECIMAL(18,2) NOT NULL,
    CentroCustoCodigo       VARCHAR(50) NULL,
    PlanoContasCodigo       VARCHAR(50) NULL,
    XmlConteudo             XML NULL,            -- XML NF-e, se houver
    JsonPayload             NVARCHAR(MAX) NULL,  -- DTO completo recebido
    StatusIntegracao        VARCHAR(20) NOT NULL DEFAULT 'pendente',
    MensagemIntegracao      NVARCHAR(MAX) NULL,
    DataCriacao             DATETIME NOT NULL DEFAULT GETDATE(),
    DataProcessamento       DATETIME NULL
);
```
A partir dessa tabela, procedures internas do Locador vão gerar: Notas, Estoque (se produto), Contas a Pagar, etc.

# 5. API Locador → Compras (Centro de Custo e Plano de Contas)

A IDE deve implementar consumo dessas APIs no módulo Compras.

## 5.1. Endpoint: Centros de Custo

```http
GET /api/v1/centros-custo
Authorization: Bearer {TOKEN}
```

Resposta (exemplo):
```json
[
  {
    "id": "123",              // ID interno Locador
    "codigo": "CC01",
    "nome": "Operacional"
  },
  {
    "id": "124",
    "codigo": "ADM01",
    "nome": "Administrativo"
  }
]
```

## 5.2. Endpoint: Plano de Contas

```http
GET /api/v1/plano-contas
Authorization: Bearer {TOKEN}
```

Resposta (exemplo):
```json
[
  {
    "id": "500",
    "codigo": "3.2.1.01",
    "descricao": "Despesas com Serviços Terceirizados"
  },
  {
    "id": "501",
    "codigo": "1.1.5.01",
    "descricao": "Materiais de Consumo"
  }
]
```

## 5.3. Lógica no Backend Compras

* Criar job/endpoint para sincronização:
   * Atualizar `cost_centers` e `chart_of_accounts` com base nessas APIs.
   * Marcar registros inativos se deixarem de existir no Locador.

# 6. API Compras → Locador (Envio do Recebimento)
## 6.1. Endpoint: Recebimentos

```http
POST /api/v1/recebimentos
Authorization: Bearer {TOKEN}
Content-Type: application/json
```

### 6.2. Corpo da requisição (JSON DTO)
```json
{
  "tipo_documento": "produto",     // "produto" | "servico" | "avulso"
  "identificacao": {
    "id_recebimento_compras": "UUID",
    "numero_documento": "12345",
    "serie_documento": "1",
    "chave_nfe": "35251112345678900011550010001234567890123456",
    "data_emissao": "2025-11-10T10:30:00Z",
    "data_entrada": "2025-11-10T14:00:00Z"
  },
  "fornecedor": {
    "cnpj": "12345678000199",
    "id_fornecedor_locador": "987"
  },
  "total": {
    "valor_total": 2079.00,
    "valor_produtos": 1980.00,
    "valor_descontos": 0.00,
    "valor_frete": 0.00,
    "valor_ipi": 99.00
  },
  "centro_custo": {
    "codigo": "CC01",
    "id_locador": "123"
  },
  "plano_contas": {
    "codigo": "3.2.1.01",
    "id_locador": "500"
  },
  "itens": [
    {
      "numero_item": 1,
      "descricao": "Cimento CP-II 50kg",
      "quantidade": 50,
      "unidade": "SC",
      "valor_unitario": 39.60,
      "valor_total": 1980.00,
      "codigo_produto_locador": "MAT001",
      "id_produto_locador": "321",
      "ncm": "25232910",
      "cfop": "1556",
      "icms": {
        "aliquota": 18.0,
        "valor": 356.40
      },
      "ipi": {
        "aliquota": 5.0,
        "valor": 99.00
      }
    }
  ],
  "parcelas": [
    {
      "numero": "1",
      "data_vencimento": "2025-12-10",
      "valor": 1039.50
    },
    {
      "numero": "2",
      "data_vencimento": "2026-01-10",
      "valor": 1039.50
    }
  ],
  "xml_nfe": "<xml>...</xml>"   // null quando tipo_documento = "avulso"
}
```

# 6.3. Resposta do Locador
```json
{
  "status_integracao": "integrada" | "erro",
  "id_recebimento_locador": "456",    // id da nota/recebimento no Locador
  "mensagem": "Processado com sucesso" 
}
```

# 7. Especificação da Nova Tela de Recebimento (Frontend React)
## 7.1. Rota

* Caminho sugerido: `/recebimentos/novo`
* Nome do componente: `ReceiptFormPage`

## 7.2. Layout geral

Seções da tela:

1. Tipo de Recebimento
2. Dados da Nota / Documento
3. Importação de XML (apenas para tipo Produto)
4. Itens
5. Centro de Custo e Plano de Contas
6. condições de Pagamento / Parcelas
7. Ações

## 7.3. Campos — Seção 1: Tipo de Recebimento

Componentes:

* `RadioGroup` ou `Select`:
  * Tipo de Recebimento (obrigatório)
      * `Produto (NF-e XML)`
      * `Serviço (NFS-e / Manual)`
      * `Avulso (sem documento fiscal)`

Comportamento:
* Se `Produto`: habilitar área de upload de XML.
* Se `Serviço`: esconder upload de XML, exibir campos manuais.
* Se `Avulso`: esconder upload de XML e campos fiscais, focar em CC/PC e valores.

## 7.4. Campos — Seção 2: Dados da Nota / Documento

Campos comuns:
* `Número do Documento` (texto)
* `Série` (texto)
* `Data de Emissão` (date/datetime)
* `Data de Entrada/Competência` (date/datetime)
* `Fornecedor` (select com busca; traz da base de fornecedores integrados)

Comportamento:
* Para tipo Produto:
    * esses campos são preenchidos automaticamente ao importar o XML, mas podem ser exibidos somente leitura (ou editáveis conforme regra).
* Para Serviço e Avulso:
    * usuário digita manualmente.

## 7.5. Seção 3: Importação de XML (somente Produto)

Componentes:
* Botão “Importar XML NF-e” com input `type="file"` aceitando `.xml`.

Comportamento:

1. Ao selecionar o arquivo, frontend envia para endpoint:
   * `POST /api/recebimentos/import-xml`
   * Body: `FormData` com o arquivo.
2. Backend:
   * valida se é XML de NF-e;
   * calcula hash;
   * parseia campos principais (cabeçalho, itens, totais, parcelas);
   * cria (ou atualiza, se estiver em rascunho) o registro em `receipts` + `receipt_nf_xmls` + `receipt_items` + `receipt_installments`.
3. Resposta inclui DTO da nota para popular a tela:
   * dados do cabeçalho;
   * itens;
   * totais;
   * parcelas.
4. Frontend preenche:
   * seção Dados da Nota;
   * seção Itens;
   * seção Parcelas;
   * total.

Validações do backend:
* Se chave NF-e já existente em outro `receipts`, retornar erro específico.
* Se o XML não for um layout válido de NF-e, retornar mensagem amigável.

## 7.6. Seção 4: Itens

Para tipo Produto (com XML):
* Tabela preenchida com os itens do XML.
* Colunas sugeridas:
   * (número linha)
   * Descrição
   * Quantidade
   * Unidade
   * Valor unitário
   * Valor total
   * Código Produto (Locador) — combo/pesquisa para mapear item a produto já cadastrado, se necessário.

Para tipo Serviço:
* Tabela com itens manuais:
   * Descrição do Serviço
   * Quantidade
   * Unidade (opcional)
   * Valor unitário
   * Valor total

Para Avulso:
* Pode ser um só item:
   * Descrição
   * Valor total

## 7.7. Aba Rateio: Centro de Custo e Plano de Contas

Campos:
- Centro de Custo (seleção em árvore)
- Plano de Contas (seleção em árvore)

Comportamento:
- Seleção exclusivamente nesta aba; os campos foram removidos da página principal.
- Componentes reutilizáveis em árvore: `CostCenterTreeSelect` e `ChartAccountTreeSelect`.
- Dados carregados via:
  - `GET /api/centros-custo` (backend Compras, consumindo o Locador)
  - `GET /api/plano-contas`
- Suporte a filtro por texto (código, nome/descrição).
- Persistência entre abas garantida (os valores selecionados permanecem ao navegar).

Validação:
- Pelo menos um rateio deve ser informado na aba Rateio.
- Cada item de rateio deve possuir Centro de Custo e Plano de Contas.
- A soma do rateio deve igualar ao total do recebimento (por valor ou percentual).
- Para `serviço` e `avulso`, o rateio (CC/PC) é obrigatório; para `produto`, segue a configuração/regra da empresa.
- Mensagens de erro são exibidas somente quando essas regras não são atendidas (sem rateio, item incompleto ou soma divergente).

## 7.8. Seção 6: Condições de Pagamento / Parcelas

Campos:
* Condição de Pagamento (texto ou select)
* Número de parcelas (int)
* Tabela de parcelas:
   * Nº
   * Data de vencimento
   * Valor

Para XML NF-e:
* Essas parcelas podem vir do `<cobr><dup>` ou `<pag>` e já serem preenchidas automaticamente.

## 7.9. Seção 7: Ações

Botões:

* Salvar Rascunho
    * Salva sem validar, status `rascunho`
* Validar Recebimento
    * Roda validações:
       * fornecedor existente;
       * campos obrigatórios;
       * CC/PC em serviços/avulsos;
       * consistência de totais;
    * Em caso de sucesso, status `validado_compras`.
* Enviar para Locador
    * Disponível somente com status `validado_compras`.
    * Chama endpoint backend:
       * `POST /api/recebimentos/{id}/enviar-locador`
    * Backend chama API do Locador, atualiza status `enviado_locador` / `integrado_locador` ou `erro_integracao`.

# 8. Backend Compras — Endpoints a Implementar
## 8.1. Importação de XML

```http
POST /api/recebimentos/import-xml
Content-Type: multipart/form-data
```

Entrada:
* Arquivo XML (`file`)
Saída (JSON):
* DTO de `receipt` com:
   * id
   * campos de cabeçalho
   * itens
   * parcelas
   * total

## 8.2. CRUD de Recebimentos

* `POST /api/recebimentos` — criar rascunho (serviço/avulso)
* `GET /api/recebimentos/{id}` — obter detalhes
* `PUT /api/recebimentos/{id}` — atualizar dados (exceto XML)
* `POST /api/recebimentos/{id}/validar` — aplicar regras de validação
* `POST /api/recebimentos/{id}/enviar-locador` — enviar DTO + XML para Locador

## 8.3. Sincronização de CC e Plano de Contas

* `POST /api/sync/centros-custo`
* `POST /api/sync/plano-contas`

# 9. Regras de Negócio Resumidas para o Agente de IA

1. Tipo Produto (NF-e XML)
   * XML obrigatório.
   * Pode gerar estoque no Locador.
   * CC/PC podem ser exigidos conforme configuração da empresa.

2. Tipo Serviço
   * Sem XML obrigatório (pode ser manual).
   * Não gera estoque.
   * CC e Plano de Contas são sempre obrigatórios.

3. Tipo Avulso
   * Sem documento fiscal.
   * Não gera estoque.
   * Gera apenas lançamento financeiro no Locador.
   * CC e Plano de Contas são sempre obrigatórios.
   * **Validação de Itens:** Ignora a validação de vínculo com itens do pedido (bypass). O sistema registra essa exceção no log de auditoria (`audit_logs`) para rastreabilidade.

4. Integração com Locador só ocorre se:
   * status = `validado_compras`;
   * fornecedor mapeado;
   * se produto, produtos mapeados ou regra alternativa;
   * se serviço/avulso, CC/PC obrigatórios preenchidos.

# 12. Fluxo de Validação e Tratamento de Erros

## 12.1. Validação de Recebimento
O processo de "Confirmar Conferência Fiscal" executa as seguintes validações:
1. **Verificação de Itens:**
   - Para tipos `produto` e `servico`, verifica se há itens vinculados e se as quantidades conferem.
   - Para tipo `avulso`, esta validação é ignorada (bypass), permitindo o recebimento sem vínculo detalhado de itens.
2. **Dados Financeiros:**
   - Valida totais e parcelas.
   - Valida preenchimento de Centro de Custo e Plano de Contas (obrigatório para serviço/avulso).

## 12.2. Tratamento de Erros na Integração ERP
Caso a integração com o ERP (Locador) falhe durante a confirmação:
1. **Status:** O status do recebimento **não** é alterado para `conferida`. Ele permanece no estado anterior (ex: `conf_fisica`).
2. **Logs:** O erro retornado pelo ERP é registrado no campo `observations` do recebimento, incluindo:
   - Data/hora da tentativa.
   - Mensagem de erro original.
   - Código de erro HTTP (se houver).
3. **Resposta da API:** O endpoint retorna status `400 Bad Request` com um JSON contendo os detalhes do erro, permitindo que o frontend exiba uma mensagem amigável ao usuário e habilite a opção de "Tentar Novamente".


# 10. Diretrizes para Implementação pela IDE/Agente de IA

* Backend:
   * Usar TypeScript com Express.
   * Centralizar lógica de parse de XML em módulo dedicado.
   * Usar Drizzle ORM para manutenção das tabelas propostas.
   * Garantir transações ao criar `receipts` + `receipt_nf_xmls` + `receipt_items` + `receipt_installments`.

* Frontend:
   * Utilizar componentes reutilizáveis para formulários.
   * Adotar estados de carregamento e erro visíveis ao usuário.
   * Tratar upload de XML com feedback visual (barra de progresso, mensagens de sucesso/erro).
   * Validar campos obrigatórios no frontend e no backend.

* Integração:
   * Centralizar chamadas ao Locador em serviço dedicado (`locadorIntegrationService`).
   * Padronizar logs de integração (request/response resumidos).

---

## 11. Decisões Técnicas Implementadas (Compras)

- Banco de dados (PostgreSQL) com Drizzle ORM atualizado para suportar Recebimento:
  - `receipts`: adicionados `receipt_type` e `receipt_status` como enums; campos fiscais (`document_number`, `document_series`, `document_key`, `document_issue_date`, `document_entry_date`, `total_amount`); vínculos opcionais com `purchase_orders`, `suppliers`, `cost_centers` e `chart_of_accounts`; índices em `document_key`, `document_number`, `supplier_id`, `status`.
  - `receipt_items`: suporte a itens de produto/serviço com mapeamentos fiscais (`ncm`, `cfop`, impostos ICMS/IPI/PIS/COFINS), valores e identificadores de produto do Locador.
  - `receipt_nf_xmls`: armazenamento do XML bruto com hash (`xml_hash`) e vínculo 1:N com `receipts`.
  - `receipt_installments`: parcelas/duplicatas de recebimentos.
  - `chart_of_accounts`: novo catálogo com `code`, `description`, `external_id`, `is_active` e `updated_at`.
  - `cost_centers`: ampliado com `external_id`, `is_active`, `updated_at`.

- Backend (Express + TypeScript):
  - Endpoint `POST /api/recebimentos/import-xml` com upload `.xml`, validações e parser compatível com NF-e (modelo 55); cria rascunho em `receipts` e popula itens/parcelas.
  - CRUD de recebimentos: `POST /api/recebimentos`, `GET /api/recebimentos/:id`, `PUT /api/recebimentos/:id`, `POST /api/recebimentos/:id/validar`, `POST /api/recebimentos/:id/enviar-locador` (stub de integração).
  - Master Data auxiliar: `GET /api/centros-custo` e `GET /api/plano-contas` para preencher selects da tela.

- Frontend (React + Design System existente):
  - Rota `/recebimentos/novo` com componente `ReceiptFormPage` incluindo:
    - seleção do tipo; upload/importação de XML; pré-visualização; formulário com campos comuns; selects de Centro de Custo e Plano de Contas; ação de salvar rascunho.

- Compatibilidade NF-e:
  - Parser dedicado suporta estruturas `NFe` e `nfeProc`, extraindo cabeçalho (`ide`, `emit`, `dest`, totais), itens (`det/prod` + `imposto`) e parcelas (`cobr/dup`, `pag/detPag`).

- Validações e erros:
  - Bloqueio de chave NF-e duplicada; mensagens amigáveis para XML inválido; obrigatoriedade de CC/PC para `servico` e `avulso` ao validar.
  - Tratamento especial para tipo `avulso`: ignora validação de itens no `confirm-fiscal` e gera registro explícito em `audit_logs` (bypass).

---

## 12. Manual de Utilização — Nova Tela de Recebimento

- Acesse `Compras` → `Recebimentos` → `Novo` ou diretamente `/recebimentos/novo`.
- Escolha o tipo:
  - `Produto (NF-e XML)`: selecione um arquivo `.xml`; após importado, os campos são preenchidos automaticamente; revise itens/parcelas e valores.
  - `Serviço`/`Avulso`: preencha manualmente os campos principais; informe obrigatoriamente `Centro de Custo` e `Plano de Contas`.
- Selecione `Centro de Custo` e `Plano de Contas` nos respectivos combos (dados sincronizados do Locador).
- Clique em `Salvar Rascunho` para guardar sem validação.
- Após revisar, use `Validar` (futuro botão) para aplicar regras; com sucesso, o status muda para `validado_compras`.
- Em seguida, use `Enviar para Locador` para integração (quando disponível), recebendo o status de processamento.
