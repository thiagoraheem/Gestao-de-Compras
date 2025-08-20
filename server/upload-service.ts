import { s3Service } from './s3-service';
import { config } from './config';
import fs from 'fs';
import path from 'path';

export interface UploadResult {
  success: boolean;
  filePath: string;
  fileName: string;
  fileSize: number;
  contentType: string;
  storage: 'local' | 's3';
  s3Key?: string;
  error?: string;
}

export class UploadService {
  /**
   * Processa upload de arquivo com fallback automático
   * @param file Arquivo do multer (pode ser buffer ou arquivo local)
   * @param uploadType Tipo do upload para organização
   * @param entityId ID da entidade relacionada
   * @param originalName Nome original do arquivo
   * @returns Resultado do upload
   */
  async processUpload(
    file: Express.Multer.File,
    uploadType: 'purchase-requests' | 'supplier-quotations' | 'company-logos',
    entityId: string,
    originalName?: string
  ): Promise<UploadResult> {
    const fileName = originalName || file.originalname;
    const contentType = file.mimetype;
    const fileSize = file.size;

    // Se S3 estiver habilitado, tentar upload para S3 primeiro
    if (config.s3.enabled && s3Service.isEnabled()) {
      try {
        const s3Key = s3Service.generateKey(uploadType, entityId, fileName);
        const fileBuffer = file.buffer || fs.readFileSync(file.path);
        
        const s3Url = await s3Service.uploadFile(fileBuffer, s3Key, contentType);
        
        // Se upload para S3 foi bem-sucedido, remover arquivo local (se existir)
        if (file.path && fs.existsSync(file.path)) {
          fs.unlinkSync(file.path);
        }
        
        return {
          success: true,
          filePath: s3Url,
          fileName,
          fileSize,
          contentType,
          storage: 's3',
          s3Key
        };
      } catch (error) {
        console.warn('Falha no upload para S3, usando fallback local:', error);
        // Continuar para fallback local
      }
    }

    // Fallback para armazenamento local
    return this.processLocalUpload(file, uploadType, entityId, fileName, contentType, fileSize);
  }

  /**
   * Processa upload local
   */
  private processLocalUpload(
    file: Express.Multer.File,
    uploadType: string,
    entityId: string,
    fileName: string,
    contentType: string,
    fileSize: number
  ): UploadResult {
    try {
      let localPath: string;
      
      if (file.path) {
        // Arquivo já foi salvo pelo multer
        localPath = file.path;
      } else if (file.buffer) {
        // Arquivo está em memória, precisa salvar
        const uploadDir = this.getLocalUploadDir(uploadType);
        if (!fs.existsSync(uploadDir)) {
          fs.mkdirSync(uploadDir, { recursive: true });
        }
        
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        const ext = path.extname(fileName);
        const localFileName = `${file.fieldname || 'file'}-${uniqueSuffix}${ext}`;
        localPath = path.join(uploadDir, localFileName);
        
        fs.writeFileSync(localPath, file.buffer);
      } else {
        throw new Error('Arquivo não encontrado nem em buffer nem em disco');
      }

      return {
        success: true,
        filePath: localPath,
        fileName,
        fileSize,
        contentType,
        storage: 'local'
      };
    } catch (error) {
      return {
        success: false,
        filePath: '',
        fileName,
        fileSize,
        contentType,
        storage: 'local',
        error: error instanceof Error ? error.message : 'Erro desconhecido no upload local'
      };
    }
  }

  /**
   * Obtém o diretório local baseado no tipo de upload
   */
  private getLocalUploadDir(uploadType: string): string {
    switch (uploadType) {
      case 'purchase-requests':
        return './uploads/purchase-requests';
      case 'supplier-quotations':
        return './uploads/supplier_quotations';
      case 'company-logos':
        return './uploads/company_logos';
      default:
        return './uploads/misc';
    }
  }

  /**
   * Gera URL para acesso ao arquivo
   * @param filePath Caminho do arquivo (local ou S3)
   * @param storage Tipo de armazenamento
   * @param s3Key Chave S3 (se aplicável)
   * @returns URL de acesso
   */
  async getFileUrl(filePath: string, storage: 'local' | 's3', s3Key?: string): Promise<string> {
    if (storage === 's3' && s3Key && config.s3.enabled) {
      try {
        return await s3Service.getSignedUrl(s3Key);
      } catch (error) {
        console.error('Erro ao gerar URL assinada do S3:', error);
        // Fallback para URL local se disponível
      }
    }

    // Retornar URL local
    if (filePath.startsWith('http')) {
      return filePath; // Já é uma URL completa
    }
    
    // Construir URL local baseada no caminho
    const relativePath = filePath.replace(/^\.\//, '').replace(/\\/g, '/');
    return `/api/files/${relativePath}`;
  }

  /**
   * Exclui arquivo do armazenamento
   * @param filePath Caminho do arquivo
   * @param storage Tipo de armazenamento
   * @param s3Key Chave S3 (se aplicável)
   */
  async deleteFile(filePath: string, storage: 'local' | 's3', s3Key?: string): Promise<void> {
    if (storage === 's3' && s3Key && config.s3.enabled) {
      try {
        await s3Service.deleteFile(s3Key);
        return;
      } catch (error) {
        console.error('Erro ao excluir arquivo do S3:', error);
        // Continuar para tentar exclusão local como fallback
      }
    }

    // Excluir arquivo local
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }
  }

  /**
   * Migra arquivo local para S3
   * @param localPath Caminho local do arquivo
   * @param uploadType Tipo do upload
   * @param entityId ID da entidade
   * @param fileName Nome do arquivo
   * @returns Resultado da migração
   */
  async migrateToS3(
    localPath: string,
    uploadType: string,
    entityId: string,
    fileName: string
  ): Promise<{ success: boolean; s3Url?: string; s3Key?: string; error?: string }> {
    if (!config.s3.enabled || !s3Service.isEnabled()) {
      return { success: false, error: 'S3 não está habilitado' };
    }

    try {
      if (!fs.existsSync(localPath)) {
        return { success: false, error: 'Arquivo local não encontrado' };
      }

      const fileBuffer = fs.readFileSync(localPath);
      const contentType = this.getContentType(fileName);
      const s3Key = s3Service.generateKey(uploadType, entityId, fileName);
      
      const s3Url = await s3Service.uploadFile(fileBuffer, s3Key, contentType);
      
      // Remover arquivo local após migração bem-sucedida
      fs.unlinkSync(localPath);
      
      return { success: true, s3Url, s3Key };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Erro desconhecido na migração'
      };
    }
  }

  /**
   * Determina o content-type baseado na extensão do arquivo
   */
  private getContentType(fileName: string): string {
    const ext = path.extname(fileName).toLowerCase();
    const mimeTypes: { [key: string]: string } = {
      '.pdf': 'application/pdf',
      '.doc': 'application/msword',
      '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      '.xls': 'application/vnd.ms-excel',
      '.xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      '.txt': 'text/plain',
      '.png': 'image/png',
      '.jpg': 'image/jpeg',
      '.jpeg': 'image/jpeg',
    };
    
    return mimeTypes[ext] || 'application/octet-stream';
  }
}

// Instância singleton do serviço de upload
export const uploadService = new UploadService();