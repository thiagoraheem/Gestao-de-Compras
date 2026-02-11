# Documentação de Migração: `approved_quotation_items`

Este documento descreve o processo de migração para popular a nova tabela `approved_quotation_items`, que serve como snapshot dos itens aprovados na fase de cotação.

## Visão Geral

O script de migração `migrations/populate_approved_items.sql` extrai dados históricos das tabelas de cotação de fornecedores (`supplier_quotations`) e insere na nova tabela de snapshot, respeitando as regras de negócio de seleção parcial.

### O que o script faz:
1.  **Seleciona Cotações Vencedoras:** Apenas cotações marcadas como `is_chosen = true`.
2.  **Filtra Itens Disponíveis:** Ignora itens onde `is_available = false` (casos de seleção parcial pelo usuário).
3.  **Resolve Quantidades:** Prioriza a quantidade disponível no fornecedor (`available_quantity`), usando a quantidade solicitada (`quantity`) como fallback.
4.  **Resolve Preços:** Usa o preço total com desconto (`discounted_total_price`) se disponível, senão o total original.
5.  **Garante Integridade:** Verifica duplicatas antes de inserir e usa transações (COMMIT/ROLLBACK) para garantir atomicidade.
6.  **Idempotência:** Limpa registros existentes para as cotações afetadas antes de inserir, permitindo múltiplas execuções seguras.

## Como Executar

### Pré-requisitos
- Node.js instalado
- Acesso ao banco de dados configurado no arquivo `.env`

### Passo a Passo

1.  **Executar via Script TypeScript (Recomendado):**
    
    Criamos um utilitário para facilitar a execução no ambiente atual.
    
    ```bash
    npx tsx scripts/migrate-approved-items.ts
    ```

2.  **Executar via Cliente SQL (Alternativo):**
    
    Você pode executar o conteúdo do arquivo `migrations/populate_approved_items.sql` diretamente no seu cliente SQL preferido (DBeaver, pgAdmin, psql).

## Verificação

Após a execução, você pode verificar o sucesso da migração rodando a seguinte query no banco de dados:

```sql
SELECT 
    COUNT(*) as total_items,
    COUNT(DISTINCT quotation_id) as total_quotations
FROM approved_quotation_items;
```

Para validar a integridade de uma cotação específica (exemplo ID 123):

```sql
SELECT * FROM approved_quotation_items WHERE quotation_id = 123;
```

## Logs de Execução

O script emite logs detalhados durante o processo. Exemplo de saída de sucesso:

```
Starting migration process...
Executing SQL script...
NOTICE:  Starting migration of approved quotation items...
NOTICE:  Found 1459 items to migrate.
NOTICE:  Success: Migrated 1459 items successfully.
Migration executed successfully!
Current record count in approved_quotation_items: 1459
```

## Rollback

O script roda dentro de uma transação. Se ocorrer qualquer erro durante a execução, o banco de dados fará o rollback automático e nenhuma alteração será persistida.

Caso precise reverter manualmente após um sucesso (apagar os dados migrados):

```sql
TRUNCATE TABLE approved_quotation_items;
```
