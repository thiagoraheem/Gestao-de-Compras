import { S3Client, PutObjectCommand, DeleteObjectCommand, GetObjectCommand } from '@aws-sdk/client-s3';
import { Upload } from '@aws-sdk/lib-storage';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

export class S3Service {
  private s3Client: S3Client;
  private bucketName: string;
  private enabled: boolean;

  constructor() {
    this.enabled = process.env.S3_ENABLED === 'true';
    
    if (this.enabled) {
      this.s3Client = new S3Client({
        region: process.env.AWS_REGION || 'us-east-1',
        credentials: {
          accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
          secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
        },
      });
      this.bucketName = process.env.AWS_S3_BUCKET!;
    }
  }

  /**
   * Verifica se o S3 está habilitado
   */
  isEnabled(): boolean {
    return this.enabled;
  }

  /**
   * Faz upload de um arquivo para o S3
   * @param file Buffer do arquivo
   * @param key Chave/caminho do arquivo no S3
   * @param contentType Tipo de conteúdo do arquivo
   * @returns URL do arquivo no S3
   */
  async uploadFile(file: Buffer, key: string, contentType: string): Promise<string> {
    if (!this.enabled) {
      throw new Error('S3 service is not enabled');
    }

    try {
      const upload = new Upload({
        client: this.s3Client,
        params: {
          Bucket: this.bucketName,
          Key: key,
          Body: file,
          ContentType: contentType,
        },
      });

      const result = await upload.done();
      return `https://${this.bucketName}.s3.${process.env.AWS_REGION}.amazonaws.com/${key}`;
    } catch (error) {
      console.error('Erro ao fazer upload para S3:', error);
      throw new Error('Falha no upload para S3');
    }
  }

  /**
   * Gera uma URL assinada para acesso temporário ao arquivo
   * @param key Chave do arquivo no S3
   * @param expiresIn Tempo de expiração em segundos (padrão: 1 hora)
   * @returns URL assinada
   */
  async getSignedUrl(key: string, expiresIn: number = 3600): Promise<string> {
    if (!this.enabled) {
      throw new Error('S3 service is not enabled');
    }

    try {
      const command = new GetObjectCommand({
        Bucket: this.bucketName,
        Key: key,
      });

      return await getSignedUrl(this.s3Client, command, { expiresIn });
    } catch (error) {
      console.error('Erro ao gerar URL assinada:', error);
      throw new Error('Falha ao gerar URL assinada');
    }
  }

  /**
   * Exclui um arquivo do S3
   * @param key Chave do arquivo no S3
   */
  async deleteFile(key: string): Promise<void> {
    if (!this.enabled) {
      throw new Error('S3 service is not enabled');
    }

    try {
      const command = new DeleteObjectCommand({
        Bucket: this.bucketName,
        Key: key,
      });

      await this.s3Client.send(command);
    } catch (error) {
      console.error('Erro ao excluir arquivo do S3:', error);
      throw new Error('Falha ao excluir arquivo do S3');
    }
  }

  /**
   * Gera uma chave única para o arquivo baseada no tipo, ID e nome do arquivo
   * @param type Tipo do upload (purchase-requests, supplier-quotations, company-logos)
   * @param id ID do registro relacionado
   * @param filename Nome original do arquivo
   * @returns Chave formatada para o S3
   */
  generateKey(type: string, id: string, filename: string): string {
    const timestamp = Date.now();
    const randomSuffix = Math.random().toString(36).substring(2, 15);
    const sanitizedFilename = filename.replace(/[^a-zA-Z0-9.-]/g, '_');
    
    switch (type) {
      case 'purchase-requests':
        return `purchase-requests/${id}/anexos/${timestamp}-${randomSuffix}-${sanitizedFilename}`;
      case 'supplier-quotations':
        return `supplier-quotations/${id}/propostas/${timestamp}-${randomSuffix}-${sanitizedFilename}`;
      case 'company-logos':
        return `company-logos/${id}/${timestamp}-${randomSuffix}-${sanitizedFilename}`;
      default:
        return `uploads/${type}/${id}/${timestamp}-${randomSuffix}-${sanitizedFilename}`;
    }
  }

  /**
   * Extrai informações da chave do S3
   * @param key Chave do arquivo no S3
   * @returns Objeto com informações extraídas
   */
  parseKey(key: string): { type: string; id: string; filename: string } {
    const parts = key.split('/');
    
    if (parts.length >= 3) {
      const type = parts[0];
      const id = parts[1];
      const filename = parts[parts.length - 1];
      
      // Remove timestamp e sufixo aleatório do filename
      const originalFilename = filename.replace(/^\d+-[a-z0-9]+-/, '');
      
      return { type, id, filename: originalFilename };
    }
    
    throw new Error('Formato de chave S3 inválido');
  }

  /**
   * Lista arquivos de um diretório específico no S3
   * @param prefix Prefixo para filtrar arquivos
   * @returns Lista de chaves dos arquivos
   */
  async listFiles(prefix: string): Promise<string[]> {
    if (!this.enabled) {
      throw new Error('S3 service is not enabled');
    }

    try {
      const { ListObjectsV2Command } = await import('@aws-sdk/client-s3');
      const command = new ListObjectsV2Command({
        Bucket: this.bucketName,
        Prefix: prefix,
      });

      const response = await this.s3Client.send(command);
      return response.Contents?.map(obj => obj.Key!) || [];
    } catch (error) {
      console.error('Erro ao listar arquivos do S3:', error);
      throw new Error('Falha ao listar arquivos do S3');
    }
  }
}

// Instância singleton do serviço S3
export const s3Service = new S3Service();