# Documentação de Migração: Integração de Fornecedores com ERP

## 1. Resumo Executivo

Este documento descreve o processo de migração para implementação das tabelas de integração de fornecedores com sistemas ERP externos, incluindo a análise de problemas encontrados, soluções aplicadas e procedimentos seguros para execução.

## 2. Problema Identificado

### 2.1 Erro Original
Durante a execução do script de migração `migration_integracao_fornecedores.sql`, foi encontrado o seguinte erro:

```
Error occurred during SQL script execution
Razão: Erro SQL [42804]: ERRO: restrição de chave estrangeira "supplier_integration_history_supplier_id_fkey" não pode ser implementada
Detalhe: Colunas chave "supplier_id" e "id" são de tipos incompatíveis: uuid e integer.
```

### 2.2 Análise da Causa Raiz
O erro ocorreu devido à incompatibilidade de tipos de dados entre as tabelas existentes e as novas tabelas de integração:

- **Tabelas existentes**: `suppliers.id` e `users.id` são do tipo `INTEGER`
- **Script de migração original**: Definia as chaves estrangeiras como `UUID`

### 2.3 Tabelas Afetadas
- `supplier_integration_history.supplier_id`
- `supplier_integration_queue.local_supplier_id`
- `supplier_integration_history.created_by`

## 3. Solução Implementada

### 3.1 Script de Migração Corrigido
Foi criado o arquivo `db_scripts/migration_integracao_fornecedores_fixed.sql` com as seguintes correções:

```sql
-- Tabelas de integração com tipos compatíveis
CREATE TABLE IF NOT EXISTS supplier_integration_control (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    integration_type VARCHAR(50) NOT NULL,
    status VARCHAR(20) NOT NULL,
    total_suppliers INTEGER DEFAULT 0,
    processed_suppliers INTEGER DEFAULT 0,
    created_suppliers INTEGER DEFAULT 0,
    updated_suppliers INTEGER DEFAULT 0,
    error_count INTEGER DEFAULT 0,
    started_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    completed_at TIMESTAMP WITH TIME ZONE,
    created_by INTEGER REFERENCES users(id),
    error_log TEXT
);

CREATE TABLE IF NOT EXISTS supplier_integration_history (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    integration_id UUID NOT NULL,
    operation_type VARCHAR(50) NOT NULL,
    supplier_id INTEGER REFERENCES suppliers(id),
    erp_supplier_id VARCHAR(100),
    supplier_name VARCHAR(255),
    action_taken VARCHAR(50) NOT NULL,
    status VARCHAR(20) NOT NULL,
    error_message TEXT,
    processed_data JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_by INTEGER REFERENCES users(id)
);

CREATE TABLE IF NOT EXISTS supplier_integration_queue (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    integration_id UUID NOT NULL,
    erp_supplier_id VARCHAR(100) NOT NULL,
    supplier_data JSONB NOT NULL,
    comparison_result VARCHAR(50) NOT NULL,
    action_required VARCHAR(50) NOT NULL,
    local_supplier_id INTEGER REFERENCES suppliers(id),
    status VARCHAR(20) DEFAULT 'pending',
    processed_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```

### 3.2 Ajustes Adicionais
- Correção da função `cleanup_old_integrations()` para evitar erro de `GET DIAGNOSTICS`
- Adição de `COMMIT` ao final do script para garantir persistência das alterações
- Verificação de existência de roles antes de conceder permissões

## 4. Procedimentos de Execução Segura

### 4.1 Pré-requisitos
1. **Backup do banco de dados**: Sempre execute backup antes de aplicar migrações
2. **Verificação do ambiente**: Confirme se está executando no ambiente correto (dev/prod)
3. **Validação do script**: Teste o script em ambiente de desenvolvimento primeiro

### 4.2 Execução da Migração

#### Opção 1: Usando o Script Node.js (Recomendado)
```bash
# Executar o script de migração corrigido
node scripts/execute-supplier-integration-migration.cjs

# Verificar logs de execução
cat scripts/migration-logs/supplier-integration-*.log
```

#### Opção 2: Execução Manual via psql
```bash
# Conectar ao banco de dados
psql $DATABASE_URL_DEV

# Executar o script corrigido
\i db_scripts/migration_integracao_fornecedores_fixed.sql
```

### 4.3 Verificação Pós-Migração

#### 4.3.1 Verificar Criação das Tabelas
```sql
-- Listar novas tabelas
SELECT table_name 
FROM information_schema.tables 
WHERE table_name LIKE 'supplier_integration_%';

-- Verificar estrutura das tabelas
\d supplier_integration_control
\d supplier_integration_history
\d supplier_integration_queue
```

#### 4.3.2 Validar Chaves Estrangeiras
```sql
-- Verificar constraints de chave estrangeira
SELECT 
    tc.constraint_name, 
    tc.table_name, 
    kcu.column_name, 
    ccu.table_name AS foreign_table_name,
    ccu.column_name AS foreign_column_name
FROM 
    information_schema.table_constraints AS tc
    JOIN information_schema.key_column_usage AS kcu
      ON tc.constraint_name = kcu.constraint_name
      AND tc.table_schema = kcu.table_schema
    JOIN information_schema.constraint_column_usage AS ccu
      ON ccu.constraint_name = tc.constraint_name
      AND ccu.table_schema = tc.table_schema
WHERE tc.constraint_type = 'FOREIGN KEY' 
AND tc.table_name LIKE 'supplier_integration_%';
```

#### 4.3.3 Testar Funcionalidades
```bash
# Testar endpoints de integração
curl -X GET http://localhost:5201/api/erp-integration/history
curl -X GET http://localhost:5201/api/erp-integration/control
curl -X POST http://localhost:5201/api/erp-integration/suppliers/fetch
```

## 5. Procedimentos de Rollback

### 5.1 Rollback Completo
```sql
-- Remover tabelas de integração (ordem importante devido a FKs)
DROP TABLE IF EXISTS supplier_integration_queue;
DROP TABLE IF EXISTS supplier_integration_history;
DROP TABLE IF EXISTS supplier_integration_control;

-- Remover campo adicional da tabela suppliers (se necessário)
ALTER TABLE suppliers DROP COLUMN IF EXISTS idsuppliererp;

-- Remover funções auxiliares
DROP FUNCTION IF EXISTS cleanup_old_integrations();
DROP FUNCTION IF EXISTS get_integration_stats(UUID);
```

### 5.2 Rollback Parcial
```sql
-- Remover apenas dados (mantendo estrutura)
TRUNCATE TABLE supplier_integration_queue;
TRUNCATE TABLE supplier_integration_history;
TRUNCATE TABLE supplier_integration_control;
```

## 6. Schema do Banco de Dados Atualizado

### 6.1 Tabelas de Integração

#### supplier_integration_control
- **Propósito**: Controle e monitoramento de processos de integração
- **Campos principais**: `id`, `integration_type`, `status`, `total_suppliers`, `error_count`
- **Relacionamentos**: `created_by` → `users.id`

#### supplier_integration_history
- **Propósito**: Histórico de todas as operações de integração
- **Campos principais**: `id`, `integration_id`, `operation_type`, `supplier_id`, `action_taken`
- **Relacionamentos**: `supplier_id` → `suppliers.id`, `created_by` → `users.id`

#### supplier_integration_queue
- **Propósito**: Fila de fornecedores a serem processados
- **Campos principais**: `id`, `integration_id`, `erp_supplier_id`, `comparison_result`, `action_required`
- **Relacionamentos**: `local_supplier_id` → `suppliers.id`

### 6.2 Modificações na Tabela suppliers
- **Campo adicionado**: `idsuppliererp VARCHAR(100) UNIQUE`
- **Propósito**: Armazenar o ID do fornecedor no sistema ERP externo

## 7. Melhores Práticas para Futuras Migrações

### 7.1 Validação de Tipos
1. **Sempre verifique os tipos de dados existentes** antes de criar chaves estrangeiras
2. **Use o comando** `\d nome_tabela` para inspecionar estruturas existentes
3. **Teste compatibilidade** em ambiente de desenvolvimento primeiro

### 7.2 Desenvolvimento de Scripts
1. **Use tipos explícitos** em vez de depender de defaults
2. **Adicione verificações de existência** (`IF NOT EXISTS`, `DO $$`)
3. **Inclua transações** (`BEGIN`, `COMMIT`) para garantir atomicidade
4. **Documente com comentários** (`COMMENT ON`)

### 7.3 Testes e Validação
1. **Crie scripts de verificação** para pós-migração
2. **Teste todos os endpoints** afetados
3. **Valide dados de exemplo** nas novas tabelas
4. **Monitore logs** por pelo menos 24 horas após migração

### 7.4 Segurança e Permissões
1. **Conceda permissões mínimas necessárias**
2. **Verifique existência de roles** antes de aplicar GRANTs
3. **Documente permissões concedidas**
4. **Use RLS (Row Level Security)** quando apropriado

## 8. Referências e Arquivos

### 8.1 Arquivos de Script
- `db_scripts/migration_integracao_fornecedores.sql` - Script original (com erro de tipos)
- `db_scripts/migration_integracao_fornecedores_fixed.sql` - Script corrigido
- `scripts/execute-supplier-integration-migration.cjs` - Executor Node.js com logs

### 8.2 Arquivos de Schema
- `shared/schema.ts` - Definições Drizzle ORM atualizadas
- `server/services/erp-integration-service.ts` - Serviço de integração

### 8.3 Documentação Adicional
- Verifique `README.md` para configuração do ambiente
- Consulte `.env.example` para variáveis de ambiente necessárias
- Acesse `http://localhost:5201/api/docs` para documentação de API (se disponível)

## 9. Suporte e Troubleshooting

### 9.1 Erros Comuns
- **"relation does not exist"**: Tabelas não foram criadas - execute a migração
- **"permission denied"**: Verifique GRANTs e roles do usuário
- **"foreign key constraint"**: Confirme tipos de dados e existência de registros referenciados

### 9.2 Obter Ajuda
1. Verifique logs em `scripts/migration-logs/`
2. Consulte este documento para procedimentos padrão
3. Teste em ambiente de desenvolvimento antes de produção
4. Mantenha backups recentes para rollback rápido

---

**Última atualização**: $(date)
**Versão**: 1.0
**Responsável**: Equipe de Desenvolvimento