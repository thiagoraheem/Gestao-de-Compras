
# Prompt: Implementação de Cadastro de Empresas

## Objetivo
Implementar o cadastro de empresas para suportar múltiplas empresas do grupo, permitindo seleção desde a criação da solicitação e segmentação completa dos dados.

## Funcionalidades Necessárias

### 1. Nova Tabela no Banco de Dados
Criar tabela `companies` no arquivo `shared/schema.ts`:

```sql
companies:
- id (serial, primary key)
- name (text, not null) - "Empresa A Ltda"
- trading_name (text) - Nome fantasia
- cnpj (text, unique) - CNPJ da empresa
- address (text) - Endereço completo
- phone (text) - Telefone principal
- email (text) - Email principal
- logo_url (text) - URL do logo (opcional)
- active (boolean, default true)
- created_at (timestamp)
- updated_at (timestamp)
```

### 2. Relacionamentos com Tabelas Existentes
Adicionar `company_id` nas seguintes tabelas:
- `purchase_requests` - Solicitação vinculada à empresa
- `users` - Usuários podem pertencer a empresas específicas
- `departments` - Departamentos por empresa
- `cost_centers` - Centros de custo por empresa
- `suppliers` - Fornecedores podem ser específicos por empresa

### 3. Backend - Storage (server/storage.ts)
Implementar métodos CRUD:
- `getCompanies()` - Listar empresas ativas
- `getCompany(id)` - Buscar por ID
- `createCompany(data)` - Criar nova empresa
- `updateCompany(id, data)` - Atualizar empresa
- `deleteCompany(id)` - Desativar empresa

**Modificar consultas existentes** para filtrar por empresa:
- `getPurchaseRequests(companyId?)` - Filtrar por empresa
- `getDepartments(companyId?)` - Departamentos da empresa
- `getCostCenters(companyId?)` - Centros de custo da empresa
- `getSuppliers(companyId?)` - Fornecedores da empresa

### 4. Backend - Routes (server/routes.ts)
Criar endpoints:
- `GET /api/companies` - Listar empresas
- `POST /api/companies` - Criar empresa
- `PUT /api/companies/:id` - Atualizar empresa
- `DELETE /api/companies/:id` - Desativar empresa

**Modificar endpoints existentes** para aceitar filtro por empresa:
- Adicionar query parameter `?company_id=` nos endpoints relevantes
- Implementar middleware de validação de acesso por empresa

### 5. Frontend - Controle de Acesso
Modificar `client/src/hooks/useAuth.ts`:
- Incluir `companyId` no contexto do usuário logado
- Filtrar dados automaticamente pela empresa do usuário
- Implementar verificação de permissões por empresa

### 6. Frontend - Seleção de Empresa
Modificar `client/src/components/enhanced-new-request-modal.tsx`:
- Adicionar select de empresa no topo do formulário
- Buscar empresas disponíveis para o usuário
- Filtrar departamentos/centros de custo pela empresa selecionada
- Tornar campo obrigatório

### 7. Frontend - Tela de Administração de Empresas
Criar `client/src/pages/companies.tsx`:
- Listagem com informações principais
- Formulário de criação/edição
- Upload de logo da empresa
- Gestão de status ativo/inativo
- Validação de CNPJ

### 8. Frontend - Filtros Globais
Modificar todas as telas de listagem:
- `client/src/pages/kanban.tsx` - Filtrar solicitações por empresa
- `client/src/pages/dashboard.tsx` - Métricas por empresa
- `client/src/pages/suppliers.tsx` - Fornecedores por empresa
- Adicionar seletor de empresa no header (para super admins)

### 9. PDF Service - Dados da Empresa
Modificar `server/pdf-service.ts`:
- Buscar dados da empresa da solicitação
- Incluir logo, nome e dados da empresa no cabeçalho
- Personalizar rodapé com informações da empresa
- Adaptar layout conforme a empresa

### 10. Sistema de Permissões
Implementar níveis de acesso:
- **Super Admin**: Acesso a todas as empresas
- **Admin da Empresa**: Acesso apenas à sua empresa
- **Usuário**: Acesso limitado à sua empresa e departamento

### 11. Migração de Dados
Estratégia para dados existentes:
1. Criar empresa padrão "Matriz"
2. Associar todos os dados existentes à empresa padrão
3. Permitir redistribuição posterior
4. Manter compatibilidade com sistema atual

## Implementação por Fases

### Fase 1: Estrutura Base
- Criar tabela companies
- Adicionar relacionamentos
- Implementar CRUD básico

### Fase 2: Integração Frontend
- Seleção de empresa na criação
- Filtros automáticos
- Tela de administração

### Fase 3: Segmentação Completa
- Filtros em todas as telas
- Permissões por empresa
- PDFs personalizados

### Fase 4: Funcionalidades Avançadas
- Upload de logos
- Relatórios por empresa
- Configurações específicas

## Considerações Importantes

### Segurança
- Validar acesso por empresa em todas as operações
- Implementar middleware de segurança
- Logs de auditoria por empresa

### Performance
- Indexar campos company_id
- Cache de dados por empresa
- Otimizar consultas com joins

### UX/UI
- Indicador visual da empresa ativa
- Transição suave entre empresas
- Consistência visual por empresa

### Dados Legados
- Estratégia de migração sem downtime
- Backup antes da migração
- Rollback plan se necessário

Implemente esta funcionalidade seguindo os padrões do projeto, garantindo que a segmentação por empresa seja completa e consistente em todo o sistema.
