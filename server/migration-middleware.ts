import { Request, Response, NextFunction } from 'express';
import { db } from './db';
import { attachments } from '../shared/schema';
import { eq, and, isNull } from 'drizzle-orm';
import { uploadService } from './upload-service';
import { s3Service } from './s3-service';
import { config } from './config';
import fs from 'fs';
import path from 'path';

/**
 * Middleware para migração automática de arquivos locais para S3
 * Este middleware verifica se há arquivos locais que precisam ser migrados para S3
 * e executa a migração de forma assíncrona em background
 */
export class MigrationMiddleware {
  private static migrationInProgress = false;
  private static lastMigrationCheck = 0;
  private static readonly MIGRATION_CHECK_INTERVAL = 5 * 60 * 1000; // 5 minutos

  /**
   * Middleware principal que verifica e executa migrações quando necessário
   */
  static async checkAndMigrate(req: Request, res: Response, next: NextFunction) {
    try {
      // Continua com a requisição normalmente
      next();

      // Executa verificação de migração em background se necessário
      const now = Date.now();
      if (
        config.s3.enabled &&
        !MigrationMiddleware.migrationInProgress &&
        (now - MigrationMiddleware.lastMigrationCheck) > MigrationMiddleware.MIGRATION_CHECK_INTERVAL
      ) {
        MigrationMiddleware.lastMigrationCheck = now;
        // Executa migração em background sem bloquear a requisição
        setImmediate(() => MigrationMiddleware.performBackgroundMigration());
      }
    } catch (error) {
      console.error('Erro no middleware de migração:', error);
      next(); // Continua mesmo com erro para não quebrar a aplicação
    }
  }

  /**
   * Executa migração em background de arquivos locais para S3
   */
  private static async performBackgroundMigration() {
    if (MigrationMiddleware.migrationInProgress) {
      return;
    }

    MigrationMiddleware.migrationInProgress = true;
    console.log('🔄 Iniciando migração automática de arquivos para S3...');

    try {
      // Busca arquivos que ainda estão no armazenamento local
      const localFiles = await db
        .select()
        .from(attachments)
        .where(
          and(
            eq(attachments.storageType, 'local'),
            isNull(attachments.s3Key)
          )
        )
        .limit(10); // Migra até 10 arquivos por vez para não sobrecarregar

      if (localFiles.length === 0) {
        console.log('✅ Nenhum arquivo local encontrado para migração');
        return;
      }

      console.log(`📁 Encontrados ${localFiles.length} arquivos para migração`);

      let successCount = 0;
      let errorCount = 0;

      for (const file of localFiles) {
        try {
          await MigrationMiddleware.migrateFile(file);
          successCount++;
          console.log(`✅ Arquivo migrado: ${file.fileName}`);
        } catch (error) {
          errorCount++;
          console.error(`❌ Erro ao migrar arquivo ${file.fileName}:`, error);
        }
      }

      console.log(`🎯 Migração concluída: ${successCount} sucessos, ${errorCount} erros`);
    } catch (error) {
      console.error('❌ Erro durante migração automática:', error);
    } finally {
      MigrationMiddleware.migrationInProgress = false;
    }
  }

  /**
   * Migra um arquivo específico do armazenamento local para S3
   */
  private static async migrateFile(file: any) {
    const localPath = path.resolve(file.filePath);

    // Verifica se o arquivo local existe
    if (!fs.existsSync(localPath)) {
      console.warn(`⚠️ Arquivo local não encontrado: ${localPath}`);
      return;
    }

    // Lê o arquivo local
    const fileBuffer = fs.readFileSync(localPath);
    
    // Gera chave S3 baseada no tipo de anexo
    const s3Key = s3Service.generateKey(file.attachmentType, file.fileName);

    // Faz upload para S3
    const uploadResult = await s3Service.uploadFile({
      key: s3Key,
      body: fileBuffer,
      contentType: file.fileType,
      metadata: {
        originalName: file.fileName,
        attachmentType: file.attachmentType,
        migratedAt: new Date().toISOString()
      }
    });

    if (uploadResult.success) {
      // Atualiza registro no banco de dados
      await db
        .update(attachments)
        .set({
          storageType: 's3',
          s3Key: s3Key
        })
        .where(eq(attachments.id, file.id));

      // Remove arquivo local após migração bem-sucedida
      try {
        fs.unlinkSync(localPath);
        console.log(`🗑️ Arquivo local removido: ${localPath}`);
      } catch (unlinkError) {
        console.warn(`⚠️ Não foi possível remover arquivo local: ${localPath}`, unlinkError);
      }
    } else {
      throw new Error(`Falha no upload para S3: ${uploadResult.error}`);
    }
  }

  /**
   * Força migração manual de todos os arquivos locais
   * Útil para execução via script ou endpoint administrativo
   */
  static async forceMigration(): Promise<{ success: number; errors: number; total: number }> {
    if (!config.s3.enabled) {
      throw new Error('S3 não está habilitado');
    }

    console.log('🚀 Iniciando migração forçada de todos os arquivos...');

    // Busca todos os arquivos locais
    const localFiles = await db
      .select()
      .from(attachments)
      .where(
        and(
          eq(attachments.storageType, 'local'),
          isNull(attachments.s3Key)
        )
      );

    const total = localFiles.length;
    let successCount = 0;
    let errorCount = 0;

    console.log(`📊 Total de arquivos para migração: ${total}`);

    for (const file of localFiles) {
      try {
        await MigrationMiddleware.migrateFile(file);
        successCount++;
        console.log(`✅ [${successCount + errorCount}/${total}] Migrado: ${file.fileName}`);
      } catch (error) {
        errorCount++;
        console.error(`❌ [${successCount + errorCount}/${total}] Erro: ${file.fileName}`, error);
      }
    }

    const result = { success: successCount, errors: errorCount, total };
    console.log(`🎯 Migração forçada concluída:`, result);
    return result;
  }

  /**
   * Verifica status da migração
   */
  static async getMigrationStatus() {
    const localFiles = await db
      .select()
      .from(attachments)
      .where(
        and(
          eq(attachments.storageType, 'local'),
          isNull(attachments.s3Key)
        )
      );

    const s3Files = await db
      .select()
      .from(attachments)
      .where(eq(attachments.storageType, 's3'));

    return {
      localFiles: localFiles.length,
      s3Files: s3Files.length,
      migrationInProgress: MigrationMiddleware.migrationInProgress,
      s3Enabled: config.s3.enabled
    };
  }
}

export const migrationMiddleware = MigrationMiddleware.checkAndMigrate;