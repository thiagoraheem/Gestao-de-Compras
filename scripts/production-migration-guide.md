# Guia de Migração para Produção - Purchase Orders

## Resumo das Alterações

Este guia contém as instruções para aplicar manualmente as alterações relacionadas à funcionalidade de **Purchase Orders** no banco de dados de produção.

## ⚠️ IMPORTANTE - Backup

**SEMPRE faça backup do banco de produção antes de aplicar qualquer migração!**

```sql
-- Comando para backup (ajuste conforme seu ambiente)
pg_dump -h [HOST] -U [USER] -d [DATABASE] > backup_before_purchase_orders_$(date +%Y%m%d_%H%M%S).sql
```

## 📋 Verificações Pré-Migração

Antes de aplicar a migração, verifique se as tabelas `purchase_orders` e `purchase_order_items` já existem:

```sql
-- Verificar se as tabelas existem
SELECT table_name 
FROM information_schema.tables 
WHERE table_schema = 'public' 
AND table_name IN ('purchase_orders', 'purchase_order_items');
```

**Resultado esperado:** Ambas as tabelas devem existir (criadas na migração inicial).

## 🚀 Aplicação da Migração

### Passo 1: Aplicar Índices de Performance

Execute o seguinte SQL no banco de produção:

```sql
-- Migration: Add indexes for purchase_orders and purchase_order_items tables
-- This migration adds useful indexes to improve query performance

-- Add index on purchase_orders.purchase_request_id for faster lookups
CREATE INDEX IF NOT EXISTS "idx_purchase_orders_purchase_request_id" 
ON "purchase_orders" ("purchase_request_id");

-- Add index on purchase_orders.supplier_id for supplier-based queries
CREATE INDEX IF NOT EXISTS "idx_purchase_orders_supplier_id" 
ON "purchase_orders" ("supplier_id");

-- Add index on purchase_orders.created_by for user-based queries
CREATE INDEX IF NOT EXISTS "idx_purchase_orders_created_by" 
ON "purchase_orders" ("created_by");

-- Add index on purchase_orders.status for status-based filtering
CREATE INDEX IF NOT EXISTS "idx_purchase_orders_status" 
ON "purchase_orders" ("status");

-- Add index on purchase_orders.created_at for date-based queries
CREATE INDEX IF NOT EXISTS "idx_purchase_orders_created_at" 
ON "purchase_orders" ("created_at");

-- Add index on purchase_order_items.purchase_order_id for faster item lookups
CREATE INDEX IF NOT EXISTS "idx_purchase_order_items_purchase_order_id" 
ON "purchase_order_items" ("purchase_order_id");

-- Add index on purchase_order_items.cost_center_id for cost center reporting
CREATE INDEX IF NOT EXISTS "idx_purchase_order_items_cost_center_id" 
ON "purchase_order_items" ("cost_center_id");

-- Add comment to document the purpose of this migration
COMMENT ON INDEX "idx_purchase_orders_purchase_request_id" IS 'Index para melhorar performance de consultas por purchase_request_id';
COMMENT ON INDEX "idx_purchase_orders_supplier_id" IS 'Index para melhorar performance de consultas por fornecedor';
COMMENT ON INDEX "idx_purchase_orders_created_by" IS 'Index para melhorar performance de consultas por usuário criador';
COMMENT ON INDEX "idx_purchase_orders_status" IS 'Index para melhorar performance de filtros por status';
COMMENT ON INDEX "idx_purchase_orders_created_at" IS 'Index para melhorar performance de consultas por data';
COMMENT ON INDEX "idx_purchase_order_items_purchase_order_id" IS 'Index para melhorar performance de consultas de itens por pedido';
COMMENT ON INDEX "idx_purchase_order_items_cost_center_id" IS 'Index para melhorar performance de relatórios por centro de custo';
```

### Passo 2: Verificar Aplicação dos Índices

```sql
-- Verificar se os índices foram criados corretamente
SELECT 
  indexname,
  tablename,
  indexdef
FROM pg_indexes 
WHERE tablename IN ('purchase_orders', 'purchase_order_items')
AND indexname LIKE 'idx_%'
ORDER BY tablename, indexname;
```

**Resultado esperado:** Deve mostrar 7 índices criados.

### Passo 3: Verificar Estrutura das Tabelas

```sql
-- Verificar estrutura das tabelas
SELECT 
  table_name,
  column_name,
  data_type,
  is_nullable,
  column_default
FROM information_schema.columns 
WHERE table_name IN ('purchase_orders', 'purchase_order_items')
ORDER BY table_name, ordinal_position;
```

## 🔄 Deploy da Aplicação

Após aplicar a migração no banco:

1. **Faça deploy do código atualizado** que inclui:
   - Novas funções em `server/storage.ts`
   - Endpoint atualizado `/api/purchase-requests/:id/create-purchase-order`
   - Novos endpoints para consulta de purchase orders

2. **Reinicie a aplicação** para carregar as novas funcionalidades

## ✅ Verificações Pós-Deploy

### Teste 1: Verificar Endpoints

```bash
# Testar se os novos endpoints estão funcionando
curl -X GET "https://[SEU_DOMINIO]/api/purchase-orders/1"
curl -X GET "https://[SEU_DOMINIO]/api/purchase-requests/1/purchase-order"
```

### Teste 2: Criar Purchase Order

1. Acesse a interface da aplicação
2. Navegue até uma solicitação de compra aprovada
3. Clique em "Criar Pedido de Compra"
4. Verifique se o pedido é criado sem erros

### Teste 3: Verificar Dados no Banco

```sql
-- Verificar se os dados estão sendo inseridos
SELECT COUNT(*) as total_purchase_orders FROM purchase_orders;
SELECT COUNT(*) as total_purchase_order_items FROM purchase_order_items;

-- Ver detalhes dos purchase orders criados
SELECT 
  po.id,
  po.order_number,
  po.status,
  po.total_amount,
  po.created_at,
  pr.title as purchase_request_title
FROM purchase_orders po
JOIN purchase_requests pr ON po.purchase_request_id = pr.id
ORDER BY po.created_at DESC
LIMIT 5;
```

## 🚨 Rollback (Se Necessário)

Caso seja necessário fazer rollback:

```sql
-- Remover índices criados
DROP INDEX IF EXISTS "idx_purchase_orders_purchase_request_id";
DROP INDEX IF EXISTS "idx_purchase_orders_supplier_id";
DROP INDEX IF EXISTS "idx_purchase_orders_created_by";
DROP INDEX IF EXISTS "idx_purchase_orders_status";
DROP INDEX IF EXISTS "idx_purchase_orders_created_at";
DROP INDEX IF EXISTS "idx_purchase_order_items_purchase_order_id";
DROP INDEX IF EXISTS "idx_purchase_order_items_cost_center_id";

-- Limpar dados das tabelas (CUIDADO!)
-- DELETE FROM purchase_order_items;
-- DELETE FROM purchase_orders;
```

## 📞 Suporte

Em caso de problemas durante a migração:

1. **Pare a aplicação imediatamente**
2. **Restaure o backup** se necessário
3. **Verifique os logs** da aplicação e do banco
4. **Documente o erro** para análise

---

**Data da Migração:** $(date)
**Versão:** 0005_add_purchase_order_indexes
**Responsável:** [SEU_NOME]