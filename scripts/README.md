# Script de Migração para Amazon S3

Este script migra arquivos existentes e logos corporativas do armazenamento local para o Amazon S3.

## Pré-requisitos

1. **Configuração do S3**: Certifique-se de que as seguintes variáveis de ambiente estão configuradas:
   ```bash
   S3_ENABLED=true
   S3_ACCESS_KEY_ID=sua_access_key
   S3_SECRET_ACCESS_KEY=sua_secret_key
   S3_REGION=us-east-1
   S3_BUCKET_NAME=seu_bucket
   ```

2. **Dependências**: O script usa as dependências já instaladas no projeto (sqlite3, aws-sdk).

## Como Executar

### Método 1: Via npm script
```bash
npm run migrate-to-s3
```

### Método 2: Diretamente
```bash
node scripts/migrate-to-s3.js
```

## O que o Script Faz

### 1. Validação de Pré-requisitos
- Verifica se S3_ENABLED=true
- Valida configurações do S3
- Testa conexão com o bucket S3
- Verifica existência do banco de dados

### 2. Backup Automático
- Cria backup do banco de dados
- Cria diretório de backup com timestamp
- Salva logs detalhados da migração

### 3. Migração de Arquivos
- Migra arquivos dos diretórios:
  - `uploads/purchase-requests/`
  - `uploads/supplier_quotations/`
- Atualiza registros no banco de dados com `s3Key`
- Define `storageType` como 's3'

### 4. Migração de Logos Corporativas
- Converte logos base64 para arquivos S3
- Atualiza tabela `companies` com `s3Key`
- Mantém backup do base64 original

### 5. Relatórios e Logs
- Gera relatório detalhado em JSON
- Cria resumo em texto simples
- Logs coloridos no console
- Estatísticas de migração

## Estrutura de Backup

```
backups/migration-{timestamp}/
├── database.sqlite          # Backup do banco de dados
├── uploads/                 # Diretório para backup de arquivos
├── migration-report.json    # Relatório detalhado
└── migration-summary.txt    # Resumo da migração
```

## Rollback

Em caso de falha, o script automaticamente:
1. Restaura o banco de dados do backup
2. Registra todos os erros nos logs
3. Mantém os arquivos S3 já enviados (para evitar custos)

### Rollback Manual

Se necessário fazer rollback manual:
```bash
# Restaurar banco de dados
cp backups/migration-{timestamp}/database.sqlite database.sqlite

# Verificar logs
cat backups/migration-{timestamp}/migration-report.json
```

## Monitoramento

O script fornece logs em tempo real com:
- ✅ Sucessos (verde)
- ⚠️ Avisos (amarelo)
- ❌ Erros (vermelho)
- ℹ️ Informações (azul)

## Estatísticas Finais

Ao final, o script exibe:
- Número de arquivos processados/enviados/falharam
- Número de logos processadas/enviadas/falharam
- Tamanho total dos dados migrados
- Tempo total de execução
- Localização dos backups e relatórios

## Segurança

- ✅ Backup automático antes da migração
- ✅ Validação de integridade dos arquivos
- ✅ Rollback automático em caso de falha
- ✅ Logs detalhados para auditoria
- ✅ Não remove arquivos locais (apenas adiciona S3)

## Troubleshooting

### Erro: "S3 connection failed"
- Verifique as credenciais AWS
- Confirme se o bucket existe
- Verifique permissões IAM

### Erro: "Database not found"
- Certifique-se de estar no diretório raiz do projeto
- Verifique se o arquivo `database.sqlite` existe

### Erro: "Invalid base64 format"
- Algumas logos podem ter formato inválido
- O script continua com as outras logos
- Verifique os logs para detalhes

## Suporte

Para problemas ou dúvidas:
1. Verifique os logs em `backups/migration-{timestamp}/`
2. Consulte o relatório JSON para detalhes técnicos
3. Use o resumo em texto para visão geral