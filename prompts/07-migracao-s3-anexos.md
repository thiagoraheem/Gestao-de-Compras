
# Prompt: Migração de Anexos para Amazon S3

## Objetivo
Migrar o sistema de armazenamento de anexos do sistema local para o Amazon S3, aproveitando a conta AWS existente da empresa.

## Contexto Atual
Atualmente o sistema armazena anexos localmente em:
- `uploads/purchase-requests/` - Anexos de solicitações de compra
- `uploads/supplier_quotations/` - Arquivos de cotação de fornecedores  
- `uploads/company_logos/` - Logos das empresas

## Implementação Necessária

### 1. Configuração do AWS S3

#### 1.1 Instalar Dependências
```bash
npm install aws-sdk @aws-sdk/client-s3 @aws-sdk/lib-storage multer-s3
```

#### 1.2 Configurar Variáveis de Ambiente
Adicionar ao `.env`:
```env
# AWS S3 Configuration
AWS_ACCESS_KEY_ID=your_access_key
AWS_SECRET_ACCESS_KEY=your_secret_key
AWS_REGION=us-east-1
AWS_S3_BUCKET=seu-bucket-compras
AWS_S3_ENDPOINT=https://s3.amazonaws.com
```

#### 1.3 Criar Serviço S3
Criar arquivo `server/s3-service.ts`:
```typescript
import { S3Client, PutObjectCommand, GetObjectCommand, DeleteObjectCommand } from '@aws-sdk/client-s3';
import { Upload } from '@aws-sdk/lib-storage';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

class S3Service {
  private s3Client: S3Client;
  private bucketName: string;

  constructor() {
    this.s3Client = new S3Client({
      region: process.env.AWS_REGION!,
      credentials: {
        accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
      },
    });
    this.bucketName = process.env.AWS_S3_BUCKET!;
  }

  async uploadFile(file: Buffer, key: string, contentType: string): Promise<string> {
    const upload = new Upload({
      client: this.s3Client,
      params: {
        Bucket: this.bucketName,
        Key: key,
        Body: file,
        ContentType: contentType,
      },
    });

    await upload.done();
    return `s3://${this.bucketName}/${key}`;
  }

  async getSignedUrl(key: string, expiresIn: number = 3600): Promise<string> {
    const command = new GetObjectCommand({
      Bucket: this.bucketName,
      Key: key,
    });

    return await getSignedUrl(this.s3Client, command, { expiresIn });
  }

  async deleteFile(key: string): Promise<void> {
    const command = new DeleteObjectCommand({
      Bucket: this.bucketName,
      Key: key,
    });

    await this.s3Client.send(command);
  }

  generateKey(type: 'purchase-request' | 'supplier-quotation' | 'company-logo', id: string, filename: string): string {
    const timestamp = Date.now();
    const sanitizedFilename = filename.replace(/[^a-zA-Z0-9.-]/g, '_');
    return `${type}/${id}/${timestamp}_${sanitizedFilename}`;
  }
}

export const s3Service = new S3Service();
```

### 2. Atualizar Schema do Banco

#### 2.1 Migração de Schema
Adicionar campos para URLs S3 nas tabelas existentes:
```sql
-- Adicionar colunas para URLs S3
ALTER TABLE purchase_request_attachments ADD COLUMN s3_key VARCHAR(500);
ALTER TABLE quotation_supplier_files ADD COLUMN s3_key VARCHAR(500);
ALTER TABLE companies ADD COLUMN logo_s3_key VARCHAR(500);

-- Índices para performance
CREATE INDEX idx_purchase_attachments_s3_key ON purchase_request_attachments(s3_key);
CREATE INDEX idx_quotation_files_s3_key ON quotation_supplier_files(s3_key);
```

#### 2.2 Atualizar Schema TypeScript
```typescript
// Em shared/schema.ts
export const purchaseRequestAttachments = pgTable('purchase_request_attachments', {
  // campos existentes...
  s3Key: varchar('s3_key', { length: 500 }),
});

export const quotationSupplierFiles = pgTable('quotation_supplier_files', {
  // campos existentes...
  s3Key: varchar('s3_key', { length: 500 }),
});

export const companies = pgTable('companies', {
  // campos existentes...
  logoS3Key: varchar('logo_s3_key', { length: 500 }),
});
```

### 3. Atualizar Rotas de Upload

#### 3.1 Configurar Multer para S3
```typescript
// Em server/routes.ts
import multer from 'multer';
import multerS3 from 'multer-s3';
import { s3Service } from './s3-service';

const uploadToS3 = multer({
  storage: multerS3({
    s3: s3Service['s3Client'],
    bucket: process.env.AWS_S3_BUCKET!,
    key: function (req, file, cb) {
      const type = req.route.path.includes('purchase-requests') ? 'purchase-request' :
                   req.route.path.includes('quotations') ? 'supplier-quotation' : 'company-logo';
      const id = req.params.id || 'default';
      const key = s3Service.generateKey(type, id, file.originalname);
      cb(null, key);
    }
  }),
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB
  fileFilter: (req, file, cb) => {
    const allowedTypes = /jpeg|jpg|png|gif|pdf|doc|docx|xls|xlsx|txt/;
    const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
    const mimetype = allowedTypes.test(file.mimetype);
    
    if (mimetype && extname) {
      return cb(null, true);
    } else {
      cb(new Error('Tipo de arquivo não permitido'));
    }
  }
});
```

#### 3.2 Atualizar Rotas de Upload
```typescript
// Upload de anexos de solicitação
app.post('/api/purchase-requests/:id/attachments', 
  authenticateToken, 
  uploadToS3.single('file'), 
  async (req, res) => {
    try {
      const file = req.file as any;
      const purchaseRequestId = parseInt(req.params.id);
      
      const attachment = await db.insert(purchaseRequestAttachments).values({
        purchaseRequestId,
        filename: file.originalname,
        fileSize: file.size,
        mimeType: file.mimetype,
        filePath: file.location, // URL S3
        s3Key: file.key,
        uploadedBy: req.user.id,
      }).returning();
      
      res.json(attachment[0]);
    } catch (error) {
      res.status(500).json({ message: 'Erro ao fazer upload' });
    }
  }
);

// Upload de arquivos de cotação
app.post('/api/quotations/:id/upload-supplier-file',
  authenticateToken,
  uploadToS3.single('file'),
  async (req, res) => {
    try {
      const file = req.file as any;
      const quotationId = parseInt(req.params.id);
      
      await db.insert(quotationSupplierFiles).values({
        quotationId,
        filename: file.originalname,
        filePath: file.location,
        s3Key: file.key,
        uploadedAt: new Date(),
        uploadedBy: req.user.id,
      });
      
      res.json({ message: 'Arquivo enviado com sucesso', url: file.location });
    } catch (error) {
      res.status(500).json({ message: 'Erro ao fazer upload' });
    }
  }
);
```

### 4. Atualizar Rotas de Download

#### 4.1 Rota para Servir Arquivos S3
```typescript
// Download de anexos
app.get('/api/purchase-requests/:id/attachments/:attachmentId/download',
  authenticateToken,
  async (req, res) => {
    try {
      const attachment = await db.select()
        .from(purchaseRequestAttachments)
        .where(eq(purchaseRequestAttachments.id, parseInt(req.params.attachmentId)))
        .then(rows => rows[0]);
      
      if (!attachment) {
        return res.status(404).json({ message: 'Anexo não encontrado' });
      }
      
      if (attachment.s3Key) {
        // Arquivo no S3
        const signedUrl = await s3Service.getSignedUrl(attachment.s3Key);
        res.redirect(signedUrl);
      } else {
        // Arquivo local (compatibilidade)
        const filePath = path.join(__dirname, '..', attachment.filePath);
        res.download(filePath, attachment.filename);
      }
    } catch (error) {
      res.status(500).json({ message: 'Erro ao baixar arquivo' });
    }
  }
);

// Download de arquivos de cotação
app.get('/api/quotations/supplier-files/:fileId/download',
  authenticateToken,
  async (req, res) => {
    try {
      const file = await db.select()
        .from(quotationSupplierFiles)
        .where(eq(quotationSupplierFiles.id, parseInt(req.params.fileId)))
        .then(rows => rows[0]);
      
      if (!file) {
        return res.status(404).json({ message: 'Arquivo não encontrado' });
      }
      
      if (file.s3Key) {
        const signedUrl = await s3Service.getSignedUrl(file.s3Key);
        res.redirect(signedUrl);
      } else {
        const filePath = path.join(__dirname, '..', file.filePath);
        res.download(filePath, file.filename);
      }
    } catch (error) {
      res.status(500).json({ message: 'Erro ao baixar arquivo' });
    }
  }
);
```

### 5. Script de Migração

#### 5.1 Migrar Arquivos Existentes
Criar `migrate-to-s3.js`:
```javascript
import fs from 'fs';
import path from 'path';
import { db } from './server/db.ts';
import { s3Service } from './server/s3-service.ts';
import { purchaseRequestAttachments, quotationSupplierFiles, companies } from './shared/schema.ts';
import { eq } from 'drizzle-orm';

async function migrateToS3() {
  console.log('Iniciando migração para S3...');
  
  try {
    // Migrar anexos de solicitações
    const attachments = await db.select().from(purchaseRequestAttachments);
    for (const attachment of attachments) {
      if (!attachment.s3Key && attachment.filePath) {
        const localPath = path.join(__dirname, attachment.filePath);
        if (fs.existsSync(localPath)) {
          const fileBuffer = fs.readFileSync(localPath);
          const s3Key = s3Service.generateKey('purchase-request', attachment.purchaseRequestId.toString(), attachment.filename);
          
          const s3Url = await s3Service.uploadFile(fileBuffer, s3Key, attachment.mimeType);
          
          await db.update(purchaseRequestAttachments)
            .set({ s3Key, filePath: s3Url })
            .where(eq(purchaseRequestAttachments.id, attachment.id));
          
          console.log(`Migrado: ${attachment.filename}`);
        }
      }
    }
    
    // Migrar arquivos de cotação
    const quotationFiles = await db.select().from(quotationSupplierFiles);
    for (const file of quotationFiles) {
      if (!file.s3Key && file.filePath) {
        const localPath = path.join(__dirname, file.filePath);
        if (fs.existsSync(localPath)) {
          const fileBuffer = fs.readFileSync(localPath);
          const s3Key = s3Service.generateKey('supplier-quotation', file.quotationId.toString(), file.filename);
          
          const s3Url = await s3Service.uploadFile(fileBuffer, s3Key, 'application/octet-stream');
          
          await db.update(quotationSupplierFiles)
            .set({ s3Key, filePath: s3Url })
            .where(eq(quotationSupplierFiles.id, file.id));
          
          console.log(`Migrado: ${file.filename}`);
        }
      }
    }
    
    // Migrar logos de empresas
    const companiesWithLogos = await db.select().from(companies).where(isNotNull(companies.logoBase64));
    for (const company of companiesWithLogos) {
      if (!company.logoS3Key && company.logoBase64) {
        const matches = company.logoBase64.match(/^data:([A-Za-z-+\/]+);base64,(.+)$/);
        if (matches) {
          const mimeType = matches[1];
          const base64Data = matches[2];
          const buffer = Buffer.from(base64Data, 'base64');
          
          const s3Key = s3Service.generateKey('company-logo', company.id.toString(), `logo.${mimeType.split('/')[1]}`);
          const s3Url = await s3Service.uploadFile(buffer, s3Key, mimeType);
          
          await db.update(companies)
            .set({ logoS3Key: s3Key })
            .where(eq(companies.id, company.id));
          
          console.log(`Migrado logo da empresa: ${company.name}`);
        }
      }
    }
    
    console.log('Migração concluída com sucesso!');
  } catch (error) {
    console.error('Erro na migração:', error);
  }
}

migrateToS3();
```

### 6. Configuração de Segurança

#### 6.1 Políticas de Bucket S3
Configurar políticas IAM adequadas:
```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": [
        "s3:GetObject",
        "s3:PutObject",
        "s3:DeleteObject"
      ],
      "Resource": "arn:aws:s3:::seu-bucket-compras/*"
    },
    {
      "Effect": "Allow",
      "Action": [
        "s3:ListBucket"
      ],
      "Resource": "arn:aws:s3:::seu-bucket-compras"
    }
  ]
}
```

#### 6.2 CORS Configuration
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

### 7. Atualização do Frontend

#### 7.1 Atualizar Componentes de Upload
Os componentes de upload existentes (`file-upload.tsx`, `logo-upload.tsx`) não precisam de mudanças significativas, pois continuam usando as mesmas APIs.

#### 7.2 Atualizar Visualizadores
Componentes como `attachments-viewer.tsx` continuam funcionando, mas agora com URLs S3.

## Benefícios da Migração

1. **Escalabilidade**: Armazenamento ilimitado no S3
2. **Backup**: Redundância automática do S3
3. **Performance**: CDN global da AWS
4. **Segurança**: URLs assinadas com expiração
5. **Custo**: Pagamento por uso efetivo
6. **Manutenção**: Menor overhead do servidor

## Cronograma de Implementação

1. **Fase 1**: Configurar S3 e implementar novos uploads (1-2 dias)
2. **Fase 2**: Atualizar rotas de download para suportar ambos (1 dia)
3. **Fase 3**: Migrar arquivos existentes (1 dia)
4. **Fase 4**: Remover código legado e arquivos locais (1 dia)

## Rollback

Manter compatibilidade com arquivos locais durante período de transição, permitindo rollback se necessário.

## Considerações

- Manter backup dos arquivos locais antes da migração
- Testar em ambiente de desenvolvimento primeiro
- Configurar monitoramento de custos AWS
- Implementar logs detalhados para troubleshooting
