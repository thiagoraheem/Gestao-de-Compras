# Configuração AWS S3 - Sistema de Gestão de Compras

## Visão Geral

O sistema suporta armazenamento híbrido de arquivos, permitindo usar tanto armazenamento local quanto Amazon S3. Esta funcionalidade oferece:

- **Fallback automático**: Se S3 falhar, usa armazenamento local
- **Migração automática**: Arquivos locais são migrados para S3 em background
- **Compatibilidade**: Funciona com arquivos existentes sem interrupção

## Configuração

### 1. Variáveis de Ambiente

Adicione as seguintes variáveis ao seu arquivo `.env`:

```env
# AWS S3 Configuration
S3_ENABLED=true
AWS_ACCESS_KEY_ID=sua_access_key_aqui
AWS_SECRET_ACCESS_KEY=sua_secret_key_aqui
AWS_REGION=us-east-1
AWS_S3_BUCKET=seu-bucket-nome
```

### 2. Configuração AWS

#### Criando um Bucket S3

1. Acesse o Console AWS S3
2. Clique em "Create bucket"
3. Configure:
   - **Nome do bucket**: Único globalmente (ex: `gestao-compras-anexos-prod`)
   - **Região**: Escolha a mais próxima dos usuários
   - **Configurações de acesso**: Mantenha bloqueio de acesso público

#### Configurando IAM User

1. Acesse IAM no Console AWS
2. Crie um novo usuário para a aplicação
3. Anexe a seguinte política:

```json
{
    "Version": "2012-10-17",
    "Statement": [
        {
            "Effect": "Allow",
            "Action": [
                "s3:GetObject",
                "s3:PutObject",
                "s3:DeleteObject",
                "s3:ListBucket"
            ],
            "Resource": [
                "arn:aws:s3:::seu-bucket-nome",
                "arn:aws:s3:::seu-bucket-nome/*"
            ]
        }
    ]
}
```

4. Gere as credenciais de acesso (Access Key ID e Secret Access Key)

### 3. Configuração de CORS (se necessário)

Se a aplicação frontend precisar acessar diretamente o S3:

```json
[
    {
        "AllowedHeaders": ["*"],
        "AllowedMethods": ["GET", "PUT", "POST", "DELETE"],
        "AllowedOrigins": ["https://seu-dominio.com"],
        "ExposeHeaders": ["ETag"]
    }
]
```

## Funcionalidades

### Upload Híbrido

- **S3 Habilitado**: Arquivos são enviados para S3 com fallback local
- **S3 Desabilitado**: Arquivos são armazenados localmente
- **Falha no S3**: Sistema automaticamente usa armazenamento local

### Migração Automática

- Executa em background a cada 5 minutos
- Migra até 10 arquivos por vez
- Remove arquivos locais após migração bem-sucedida
- Logs detalhados de progresso

### Download Inteligente

- **Arquivos S3**: Gera URLs assinadas temporárias (1 hora)
- **Arquivos Locais**: Serve diretamente do sistema de arquivos
- **Fallback**: Se S3 falhar, tenta servir localmente

## Monitoramento

### Endpoints Administrativos

#### Status da Migração
```http
GET /api/admin/migration/status
```

Retorna:
```json
{
  "localFiles": 15,
  "s3Files": 142,
  "migrationInProgress": false,
  "s3Enabled": true
}
```

#### Forçar Migração
```http
POST /api/admin/migration/force
```

Retorna:
```json
{
  "message": "Migration completed",
  "result": {
    "success": 12,
    "errors": 3,
    "total": 15
  }
}
```

### Logs

O sistema gera logs detalhados:

```
🔄 Iniciando migração automática de arquivos para S3...
📁 Encontrados 5 arquivos para migração
✅ Arquivo migrado: cotacao-fornecedor-1.pdf
✅ Arquivo migrado: logo-empresa.jpg
❌ Erro ao migrar arquivo documento.docx: Access denied
🎯 Migração concluída: 4 sucessos, 1 erros
```

## Estrutura de Arquivos S3

Os arquivos são organizados por tipo:

```
bucket-name/
├── supplier-quotations/
│   ├── 2024/01/cotacao-123-20240115.pdf
│   └── 2024/01/proposta-456-20240116.xlsx
├── company-logos/
│   ├── logo-empresa-1-20240115.jpg
│   └── logo-empresa-2-20240116.png
└── purchase-requests/
    ├── 2024/01/requisicao-789-20240115.pdf
    └── 2024/01/anexo-101112-20240116.docx
```

## Migração de Dados Existentes

### Automática

1. Habilite S3 nas variáveis de ambiente
2. Reinicie a aplicação
3. A migração acontece automaticamente em background

### Manual

```bash
# Via endpoint administrativo
curl -X POST http://localhost:5000/api/admin/migration/force \
  -H "Authorization: Bearer seu-token-admin"

# Ou via script (se implementado)
node scripts/migrate-to-s3.js
```

## Troubleshooting

### Problemas Comuns

#### 1. Erro de Credenciais
```
Error: The AWS Access Key Id you provided does not exist in our records
```
**Solução**: Verifique AWS_ACCESS_KEY_ID e AWS_SECRET_ACCESS_KEY

#### 2. Erro de Permissões
```
Error: Access Denied
```
**Solução**: Verifique as políticas IAM do usuário

#### 3. Bucket Não Encontrado
```
Error: The specified bucket does not exist
```
**Solução**: Verifique AWS_S3_BUCKET e AWS_REGION

#### 4. Arquivos Não Migram
```
⚠️ Arquivo local não encontrado: /path/to/file.pdf
```
**Solução**: Arquivo foi movido ou deletado, remova entrada do banco

### Logs de Debug

Para mais detalhes, habilite logs de debug:

```env
DEBUG=s3-service,upload-service,migration-middleware
```

## Segurança

### Boas Práticas

1. **Credenciais**:
   - Use IAM roles em produção (EC2/ECS)
   - Nunca commite credenciais no código
   - Rotacione chaves regularmente

2. **Bucket**:
   - Mantenha acesso público bloqueado
   - Use versionamento para arquivos críticos
   - Configure lifecycle policies

3. **URLs Assinadas**:
   - Tempo de expiração curto (1 hora)
   - Monitore uso de bandwidth

### Backup

Configure replicação cross-region para arquivos críticos:

```json
{
    "Role": "arn:aws:iam::account:role/replication-role",
    "Rules": [{
        "Status": "Enabled",
        "Prefix": "important/",
        "Destination": {
            "Bucket": "arn:aws:s3:::backup-bucket",
            "StorageClass": "STANDARD_IA"
        }
    }]
}
```

## Custos

### Estimativa Mensal

Para 1000 arquivos (100MB total):

- **Armazenamento**: ~$0.023/mês
- **Requests**: ~$0.004/mês (GET/PUT)
- **Transfer**: Varia por região

### Otimização

1. Use **Intelligent Tiering** para arquivos antigos
2. Configure **Lifecycle policies** para arquivar/deletar
3. Monitore custos via AWS Cost Explorer

## Roadmap

- [ ] Compressão automática de imagens
- [ ] CDN integration (CloudFront)
- [ ] Backup automático para Glacier
- [ ] Interface administrativa para gestão de arquivos
- [ ] Relatórios de uso e custos