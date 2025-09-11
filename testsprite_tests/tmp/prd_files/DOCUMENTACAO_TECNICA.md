# 📋 Documentação Técnica - Sistema de Gestão de Compras

## 📊 Visão Geral do Sistema

O Sistema de Gestão de Compras é uma aplicação web full-stack desenvolvida para gerenciar solicitações de compra através de um workflow Kanban com 8 fases bem definidas. O sistema foi projetado para ser operado tanto por usuários humanos quanto por agentes de IA automatizados.

### 🎯 Objetivo Principal
Automatizar e controlar o processo de compras empresariais desde a solicitação inicial até o recebimento do material, garantindo aprovações adequadas, cotações competitivas e rastreabilidade completa.

---

## 🏗️ Arquitetura do Sistema

### Frontend
- **Framework**: React 18 com TypeScript
- **Build Tool**: Vite para desenvolvimento rápido e builds otimizados
- **UI Library**: Shadcn/ui baseado em Radix UI primitives
- **Styling**: Tailwind CSS com variáveis CSS para temas
- **State Management**: TanStack Query para gerenciamento de estado do servidor
- **Routing**: Wouter para roteamento client-side leve
- **Form Handling**: React Hook Form com validação Zod
- **Drag & Drop**: @dnd-kit para funcionalidade Kanban

### Backend
- **Runtime**: Node.js com TypeScript
- **Framework**: Express.js para servidor API
- **Database**: PostgreSQL com Drizzle ORM
- **Database Provider**: Neon serverless PostgreSQL
- **Session Management**: PostgreSQL session store com connect-pg-simple
- **API Style**: RESTful endpoints com respostas JSON

### Banco de Dados
- **ORM**: Drizzle ORM com definições de schema TypeScript-first
- **Migrations**: Drizzle Kit para migrações de schema
- **Connection**: Pool de conexões WebSocket para compatibilidade serverless

---

## 🔄 Workflow do Sistema - 8 Fases Kanban

### 1. **Solicitação** (`solicitacao`)
- **Cor**: Azul (`hsl(207, 90%, 54%)`)
- **Descrição**: Criação inicial da solicitação de compra
- **Responsável**: Qualquer usuário autenticado
- **Campos Obrigatórios**:
  - Solicitante (usuário logado)
  - Empresa
  - Centro de Custo
  - Categoria (Produto/Serviço/Outros)
  - Grau de Urgência (Baixo/Médio/Alto)
  - Justificativa
  - Itens da solicitação
- **Campos Opcionais**:
  - Prazo ideal de entrega
  - Orçamento disponível
  - Informações adicionais

### 2. **Aprovação A1** (`aprovacao_a1`)
- **Cor**: Laranja (`hsl(38, 92%, 50%)`)
- **Descrição**: Primeira aprovação hierárquica
- **Responsável**: Usuários com permissão `isApproverA1`
- **Restrições**: Aprovadores só podem aprovar solicitações dos centros de custo associados
- **Ações Possíveis**:
  - Aprovar (move para Cotação)
  - Reprovar (volta para Solicitação)
- **Notificações**: E-mail automático para aprovadores A1

### 3. **Cotação (RFQ)** (`cotacao`)
- **Cor**: Roxo (`hsl(263, 70%, 50%)`)
- **Descrição**: Processo de cotação com fornecedores
- **Responsável**: Usuários com permissão `isBuyer`
- **Funcionalidades**:
  - Criação de RFQ (Request for Quotation)
  - Seleção de fornecedores
  - Envio automático de e-mails para fornecedores
  - Upload de propostas de fornecedores
  - Análise comparativa de cotações
  - Suporte a múltiplas versões de RFQ
  - Histórico completo de cotações

### 4. **Aprovação A2** (`aprovacao_a2`)
- **Cor**: Azul escuro (`hsl(231, 48%, 48%)`)
- **Descrição**: Segunda aprovação para valores e fornecedores
- **Responsável**: Usuários com permissão `isApproverA2`
- **Ações Possíveis**:
  - Aprovar (move para Pedido de Compra)
  - Reprovar com opções:
    - Arquivar definitivamente
    - Retornar para nova cotação
- **Badge Especial**: "Nec.Cotação" quando reprovado para recotação

### 5. **Pedido de Compra** (`pedido_compra`)
- **Cor**: Verde escuro (`hsl(180, 25%, 25%)`)
- **Descrição**: Geração e envio do pedido oficial
- **Responsável**: Usuários com permissão `isBuyer`
- **Funcionalidades**:
  - Geração automática de PDF do pedido
  - Dados dinâmicos da empresa
  - Assinaturas eletrônicas
  - Observações específicas do pedido
  - Controle de pendências

### 6. **Recebimento** (`recebimento`)
- **Cor**: Verde (`hsl(152, 81%, 43%)`)
- **Descrição**: Recebimento e conferência de materiais
- **Responsável**: Usuários com permissão `isReceiver`
- **Funcionalidades**:
  - Registro de recebimento
  - Controle de qualidade
  - Gestão de pendências
  - Possibilidade de retorno para Pedido de Compra

### 7. **Conclusão de Compra** (`conclusao_compra`)
- **Cor**: Verde claro (`hsl(142, 71%, 45%)`)
- **Descrição**: Finalização e análise do processo
- **Funcionalidades**:
  - Timeline completa do processo
  - Métricas de performance
  - Visualização de anexos
  - Relatório de conclusão
  - Função de impressão

### 8. **Arquivado** (`arquivado`)
- **Cor**: Cinza (`hsl(210, 12%, 47%)`)
- **Descrição**: Processo finalizado e arquivado
- **Acesso**: Somente leitura para auditoria

---

## 👥 Sistema de Usuários e Permissões

### Tipos de Usuário

#### **Administrador** (`isAdmin`)
- Acesso total ao sistema
- Gestão de usuários, empresas, departamentos
- Configurações do sistema
- Limpeza de dados

#### **Comprador** (`isBuyer`)
- Gestão de fornecedores
- Processo de cotação (RFQ)
- Geração de pedidos de compra
- Análise de propostas

#### **Aprovador A1** (`isApproverA1`)
- Primeira aprovação de solicitações
- Restrito aos centros de custo associados
- Recebe notificações automáticas

#### **Aprovador A2** (`isApproverA2`)
- Segunda aprovação (valores/fornecedores)
- Decisão sobre cotações
- Aprovação final para compra

#### **Gerente** (`isManager`)
- Acesso ao dashboard executivo
- Relatórios e métricas
- Visão geral dos processos
- Criação de solicitações para qualquer centro de custo

#### **Recebedor** (`isReceiver`)
- Recebimento de materiais
- Controle de qualidade
- Gestão de pendências

---

## 🗄️ Estrutura do Banco de Dados

### Tabelas Principais

#### **companies** - Empresas
```sql
- id (serial, PK)
- name (text, NOT NULL)
- trading_name (text)
- cnpj (text, UNIQUE)
- address, phone, email (text)
- logo_base64 (text) - Logo em base64
- active (boolean, default true)
- created_at, updated_at (timestamp)
```

#### **users** - Usuários
```sql
- id (serial, PK)
- username, email (text, UNIQUE)
- password (text, hashed)
- first_name, last_name (text)
- company_id (FK companies)
- department_id (FK departments)
- is_buyer, is_approver_a1, is_approver_a2 (boolean)
- is_admin, is_manager, is_receiver (boolean)
- password_reset_token, password_reset_expires
- created_at, updated_at (timestamp)
```

#### **purchase_requests** - Solicitações de Compra
```sql
- id (serial, PK)
- request_number (text, UNIQUE)
- requester_id (FK users)
- company_id (FK companies)
- cost_center_id (FK cost_centers)
- category (text) - produto/servico/outros
- urgency (text) - baixo/medio/alto
- justification (text, NOT NULL)
- ideal_delivery_date (timestamp)
- available_budget (decimal)
- current_phase (text, default 'solicitacao')
- [campos específicos por fase...]
- created_at, updated_at (timestamp)
```

#### **purchase_request_items** - Itens da Solicitação
```sql
- id (serial, PK)
- purchase_request_id (FK purchase_requests)
- description (text, NOT NULL)
- unit (text, NOT NULL)
- requested_quantity (decimal, NOT NULL)
- approved_quantity (decimal)
- technical_specification (text)
- created_at, updated_at (timestamp)
```

### Tabelas de Apoio

#### **departments** - Departamentos
#### **cost_centers** - Centros de Custo
#### **suppliers** - Fornecedores
#### **quotations** - Cotações (RFQ)
#### **supplier_quotations** - Propostas de Fornecedores
#### **attachments** - Anexos
#### **delivery_locations** - Locais de Entrega
#### **approval_history** - Histórico de Aprovações

---

## 🔌 API Endpoints Principais

### Autenticação
```
POST /api/auth/login
POST /api/auth/logout
POST /api/auth/forgot-password
POST /api/auth/reset-password
GET  /api/auth/me
```

### Solicitações de Compra
```
GET    /api/purchase-requests
POST   /api/purchase-requests
GET    /api/purchase-requests/:id
PATCH  /api/purchase-requests/:id
DELETE /api/purchase-requests/:id
POST   /api/purchase-requests/:id/send-to-approval
POST   /api/purchase-requests/:id/approve-a1
POST   /api/purchase-requests/:id/approve-a2
GET    /api/purchase-requests/:id/can-approve-a1
GET    /api/purchase-requests/:id/complete-timeline
```

### Cotações (RFQ)
```
GET    /api/quotations
POST   /api/quotations
GET    /api/quotations/:id
POST   /api/quotations/:id/send-to-suppliers
GET    /api/quotations/:id/supplier-quotations
POST   /api/quotations/:id/upload-supplier-file
GET    /api/quotations/:id/history
```

### Fornecedores
```
GET    /api/suppliers
POST   /api/suppliers
GET    /api/suppliers/:id
PUT    /api/suppliers/:id
DELETE /api/suppliers/:id
```

### Usuários e Permissões
```
GET    /api/users
POST   /api/users
GET    /api/users/:id
PUT    /api/users/:id
DELETE /api/users/:id
GET    /api/users/cost-centers
```

### Empresas e Estrutura
```
GET    /api/companies
POST   /api/companies
PUT    /api/companies/:id
GET    /api/departments
GET    /api/cost-centers
GET    /api/delivery-locations
```

---

## 📧 Sistema de Notificações

### E-mail Automático
- **Configuração**: SendGrid ou SMTP
- **Templates**: HTML responsivos
- **Triggers**:
  - Nova solicitação → Aprovadores A1
  - Aprovação A1 → Compradores
  - Cotação criada → Fornecedores
  - Aprovação A2 → Compradores
  - Pedido gerado → Recebedores

### Variáveis de Ambiente
```
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=seu-email@gmail.com
SMTP_PASS=sua-senha
FROM_EMAIL=sistema@empresa.com
```

---

## 📄 Sistema de Documentos

### Geração de PDF
- **Biblioteca**: html-pdf-node com Puppeteer
- **Documentos Gerados**:
  - Pedido de Compra
  - Relatório de Conclusão
  - RFQ para fornecedores

### Upload de Arquivos
- **Biblioteca**: Multer
- **Tipos Suportados**: PDF, DOC, DOCX, XLS, XLSX, TXT, PNG, JPG
- **Limite**: 10MB por arquivo
- **Armazenamento**: Sistema de arquivos local
- **Estrutura**:
  ```
  uploads/
  ├── purchase-requests/
  ├── supplier_quotations/
  └── company_logos/
  ```

---

## 🔒 Segurança

### Autenticação
- **Sessões**: PostgreSQL session store
- **Passwords**: bcryptjs hashing
- **Reset**: Token-based password reset
- **CSRF**: sameSite: 'lax' protection

### Autorização
- **Role-based**: Múltiplas permissões por usuário
- **Route Protection**: Middleware de verificação
- **Data Isolation**: Filtros por empresa/departamento

### Controle de Acesso

O controle de acesso é implementado em múltiplas camadas:

1. **Autenticação**: Verificação de credenciais
2. **Autorização**: Verificação de permissões por endpoint
3. **Filtros de Dados**: Usuários só veem dados relevantes
4. **Validação de Ações**: Verificação antes de executar operações

### Implementações Específicas de Permissões

#### Permissões de Gerente para Criação de Solicitações

**Arquivos Modificados:**
- `client/src/components/request-phase.tsx`
- `client/src/components/enhanced-new-request-modal.tsx`

**Lógica Implementada:**
```typescript
// Filtro de centros de custo baseado no perfil do usuário
const availableCostCenters = user?.isManager 
  ? costCenters // Gerentes veem todos os centros de custo
  : costCenters.filter(cc => 
      user?.costCenterIds?.includes(cc.id)
    ); // Outros usuários veem apenas centros associados
```

**Validação:**
- Frontend: Interface adaptativa baseada em `user.isManager`
- Backend: Validação mantida para segurança

#### Restrições de Aprovação A1 por Centro de Custo

**Arquivos Envolvidos:**
- `server/routes.ts` (middleware `canApproveRequest`)
- `client/src/components/approval-a1-phase.tsx`
- `client/src/components/purchase-card.tsx`

**Middleware de Validação (Backend):**
```typescript
// Verificação se o centro de custo da solicitação está 
// associado ao aprovador A1
const canApprove = user.costCenterIds?.includes(request.costCenterId);
```

**Verificação no Frontend:**
```typescript
// Consulta ao endpoint de verificação de permissões
const { data: canApproveThisRequest } = useQuery({
  queryKey: ['can-approve-a1', request.id],
  queryFn: () => fetch(`/api/purchase-requests/${request.id}/can-approve-a1`)
});
```

**Interface Adaptativa:**
- Botões de aprovação só aparecem com permissão válida
- Mensagem específica: "Você não tem permissão para aprovar este centro de custo"
- Validação em tempo real por solicitação

### Validação
- **Frontend**: Zod schemas
- **Backend**: Drizzle schema validation
- **File Upload**: Tipo e tamanho validados

---

## 🚀 Deployment

### Desenvolvimento
```bash
npm run dev  # Inicia servidor de desenvolvimento
```

### Produção
```bash
npm run build    # Build do frontend e backend
npm run start    # Inicia servidor de produção
```

### Variáveis de Ambiente Necessárias
```
NODE_ENV=production
DATABASE_URL=postgresql://user:pass@host:port/db
SESSION_SECRET=sua-chave-secreta
SMTP_HOST=smtp.servidor.com
SMTP_USER=usuario@email.com
SMTP_PASS=senha-email
FROM_EMAIL=sistema@empresa.com
```

### Estrutura de Deploy
```
dist/
├── index.js          # Servidor Express
├── client/           # Assets do React
└── uploads/          # Arquivos enviados
```

---

## 📊 Monitoramento e Logs

### Logs do Sistema
- **Express**: Logs de requisições HTTP
- **Database**: Logs de queries (desenvolvimento)
- **Email**: Logs de envio de notificações
- **Errors**: Stack traces completos

### Métricas Disponíveis
- Tempo total de processo por solicitação
- Taxa de aprovação por fase
- Performance de fornecedores
- Volume de solicitações por período

---

## 📝 Changelog e Atualizações Recentes

### Versão Atual - Implementações de Permissões Avançadas

#### Permissões Especiais para Gerentes (✅ Implementado)
**Data**: Dezembro 2024
**Descrição**: Implementação de permissões ampliadas para usuários com perfil de Gerente

**Mudanças Realizadas:**
- **Frontend**: Modificação dos componentes `request-phase.tsx` e `enhanced-new-request-modal.tsx`
- **Lógica**: Gerentes podem criar solicitações para qualquer centro de custo
- **Interface**: Adaptação automática baseada na propriedade `user.isManager`
- **Validação**: Mantida segurança no backend

**Impacto**: Facilita a gestão centralizada de compras por gerentes

#### Reforço das Restrições de Aprovação A1 (✅ Validado)
**Data**: Dezembro 2024
**Descrição**: Validação e documentação das restrições rigorosas por centro de custo

**Componentes Validados:**
- **Backend**: Middleware `canApproveRequest` em `server/routes.ts`
- **Frontend**: Componentes `approval-a1-phase.tsx` e `purchase-card.tsx`
- **API**: Endpoint `/api/purchase-requests/:id/can-approve-a1`

**Funcionalidades Confirmadas:**
- Validação automática de permissões por solicitação
- Interface adaptativa com mensagens específicas
- Dupla validação (frontend + backend)

#### Documentação Atualizada
**Data**: Dezembro 2024
**Descrição**: Atualização completa da documentação do sistema

**Arquivos Atualizados:**
- `DOCUMENTACAO_REQUISITOS.md`: Novos requisitos funcionais e regras de negócio
- `MANUAL_USUARIO.md`: Instruções para as novas funcionalidades
- `DOCUMENTACAO_TECNICA.md`: Detalhes técnicos das implementações

---

## 🔧 Manutenção

### Limpeza de Dados
- **Endpoint**: `/api/admin/cleanup`
- **Função**: Remove dados de teste/desenvolvimento
- **Ordem**: Respeita constraints de chave estrangeira
- **Acesso**: Apenas administradores

### Backup
- **Database**: Backup automático do PostgreSQL
- **Files**: Backup da pasta uploads/
- **Frequency**: Configurável por ambiente

### Migrations
```bash
npm run db:push  # Aplica mudanças no schema
```

---

## 📈 Roadmap Técnico

### Melhorias Planejadas
1. **Dashboard Analytics**: Métricas avançadas e relatórios
2. **API REST Completa**: Documentação OpenAPI/Swagger
3. **Webhooks**: Integração com sistemas externos
4. **Mobile App**: Aplicativo React Native
5. **Real-time**: WebSocket para atualizações em tempo real
6. **Audit Trail**: Log completo de todas as ações
7. **Multi-tenant**: Suporte a múltiplas empresas isoladas

### Otimizações
1. **Caching**: Redis para cache de queries frequentes
2. **CDN**: Distribuição de assets estáticos
3. **Database**: Índices otimizados e particionamento
4. **Monitoring**: APM e alertas automáticos