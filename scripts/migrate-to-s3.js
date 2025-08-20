#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const { promisify } = require('util');
const sqlite3 = require('sqlite3').verbose();
const AWS = require('aws-sdk');

// Promisify fs functions
const readdir = promisify(fs.readdir);
const stat = promisify(fs.stat);
const readFile = promisify(fs.readFile);
const writeFile = promisify(fs.writeFile);
const copyFile = promisify(fs.copyFile);
const mkdir = promisify(fs.mkdir);

// Configuration
const config = {
  s3Enabled: process.env.S3_ENABLED === 'true',
  s3Config: {
    accessKeyId: process.env.S3_ACCESS_KEY_ID,
    secretAccessKey: process.env.S3_SECRET_ACCESS_KEY,
    region: process.env.S3_REGION || 'us-east-1',
    bucket: process.env.S3_BUCKET_NAME
  },
  dbPath: path.join(__dirname, '..', 'database.sqlite'),
  uploadsDir: path.join(__dirname, '..', 'uploads'),
  backupDir: path.join(__dirname, '..', 'backups', `migration-${Date.now()}`)
};

// Initialize S3
let s3;
if (config.s3Enabled) {
  s3 = new AWS.S3(config.s3Config);
}

// Logging
class Logger {
  constructor() {
    this.logs = [];
    this.startTime = Date.now();
  }

  log(level, message, data = null) {
    const timestamp = new Date().toISOString();
    const logEntry = { timestamp, level, message, data };
    this.logs.push(logEntry);
    
    const colorMap = {
      INFO: '\x1b[36m',  // Cyan
      SUCCESS: '\x1b[32m', // Green
      WARNING: '\x1b[33m', // Yellow
      ERROR: '\x1b[31m',   // Red
      RESET: '\x1b[0m'    // Reset
    };
    
    console.log(`${colorMap[level] || ''}[${timestamp}] ${level}: ${message}${colorMap.RESET}`);
    if (data) {
      console.log('  Data:', JSON.stringify(data, null, 2));
    }
  }

  info(message, data) { this.log('INFO', message, data); }
  success(message, data) { this.log('SUCCESS', message, data); }
  warning(message, data) { this.log('WARNING', message, data); }
  error(message, data) { this.log('ERROR', message, data); }

  async saveReport() {
    const reportPath = path.join(config.backupDir, 'migration-report.json');
    const report = {
      startTime: new Date(this.startTime).toISOString(),
      endTime: new Date().toISOString(),
      duration: Date.now() - this.startTime,
      logs: this.logs,
      summary: this.generateSummary()
    };
    
    await writeFile(reportPath, JSON.stringify(report, null, 2));
    this.info(`Migration report saved to: ${reportPath}`);
    return reportPath;
  }

  generateSummary() {
    const summary = {
      total: this.logs.length,
      success: this.logs.filter(l => l.level === 'SUCCESS').length,
      errors: this.logs.filter(l => l.level === 'ERROR').length,
      warnings: this.logs.filter(l => l.level === 'WARNING').length
    };
    return summary;
  }
}

// Database helper
class DatabaseHelper {
  constructor(dbPath) {
    this.db = new sqlite3.Database(dbPath);
  }

  query(sql, params = []) {
    return new Promise((resolve, reject) => {
      this.db.all(sql, params, (err, rows) => {
        if (err) reject(err);
        else resolve(rows);
      });
    });
  }

  run(sql, params = []) {
    return new Promise((resolve, reject) => {
      this.db.run(sql, params, function(err) {
        if (err) reject(err);
        else resolve({ id: this.lastID, changes: this.changes });
      });
    });
  }

  close() {
    return new Promise((resolve) => {
      this.db.close(resolve);
    });
  }
}

// Migration class
class S3Migration {
  constructor() {
    this.logger = new Logger();
    this.db = new DatabaseHelper(config.dbPath);
    this.stats = {
      filesProcessed: 0,
      filesUploaded: 0,
      filesFailed: 0,
      logosProcessed: 0,
      logosUploaded: 0,
      logosFailed: 0,
      totalSize: 0
    };
  }

  async run() {
    try {
      this.logger.info('Starting S3 migration process');
      
      // Validate prerequisites
      await this.validatePrerequisites();
      
      // Create backup
      await this.createBackup();
      
      // Migrate files
      await this.migrateFiles();
      
      // Migrate company logos
      await this.migrateCompanyLogos();
      
      // Generate final report
      await this.generateFinalReport();
      
      this.logger.success('Migration completed successfully!');
      
    } catch (error) {
      this.logger.error('Migration failed', { error: error.message, stack: error.stack });
      await this.rollback();
      throw error;
    } finally {
      await this.db.close();
    }
  }

  async validatePrerequisites() {
    this.logger.info('Validating prerequisites');
    
    if (!config.s3Enabled) {
      throw new Error('S3_ENABLED must be set to true');
    }
    
    if (!config.s3Config.accessKeyId || !config.s3Config.secretAccessKey || !config.s3Config.bucket) {
      throw new Error('S3 configuration incomplete. Check S3_ACCESS_KEY_ID, S3_SECRET_ACCESS_KEY, and S3_BUCKET_NAME');
    }
    
    // Test S3 connection
    try {
      await s3.headBucket({ Bucket: config.s3Config.bucket }).promise();
      this.logger.success('S3 connection validated');
    } catch (error) {
      throw new Error(`S3 connection failed: ${error.message}`);
    }
    
    // Check database
    if (!fs.existsSync(config.dbPath)) {
      throw new Error(`Database not found: ${config.dbPath}`);
    }
    
    // Check uploads directory
    if (!fs.existsSync(config.uploadsDir)) {
      this.logger.warning('Uploads directory not found, creating it');
      await mkdir(config.uploadsDir, { recursive: true });
    }
  }

  async createBackup() {
    this.logger.info('Creating backup');
    
    await mkdir(config.backupDir, { recursive: true });
    
    // Backup database
    const dbBackupPath = path.join(config.backupDir, 'database.sqlite');
    await copyFile(config.dbPath, dbBackupPath);
    this.logger.success(`Database backed up to: ${dbBackupPath}`);
    
    // Create uploads backup directory
    const uploadsBackupDir = path.join(config.backupDir, 'uploads');
    await mkdir(uploadsBackupDir, { recursive: true });
    
    this.logger.success(`Backup directory created: ${config.backupDir}`);
  }

  async migrateFiles() {
    this.logger.info('Starting file migration');
    
    const directories = [
      'purchase-requests',
      'supplier_quotations'
    ];
    
    for (const dir of directories) {
      await this.migrateDirectory(dir);
    }
  }

  async migrateDirectory(dirName) {
    const dirPath = path.join(config.uploadsDir, dirName);
    
    if (!fs.existsSync(dirPath)) {
      this.logger.warning(`Directory not found: ${dirPath}`);
      return;
    }
    
    this.logger.info(`Migrating directory: ${dirName}`);
    
    const files = await this.getAllFiles(dirPath);
    
    for (const filePath of files) {
      await this.migrateFile(filePath, dirName);
    }
  }

  async getAllFiles(dirPath) {
    const files = [];
    
    async function traverse(currentPath) {
      const items = await readdir(currentPath);
      
      for (const item of items) {
        const itemPath = path.join(currentPath, item);
        const stats = await stat(itemPath);
        
        if (stats.isDirectory()) {
          await traverse(itemPath);
        } else {
          files.push(itemPath);
        }
      }
    }
    
    await traverse(dirPath);
    return files;
  }

  async migrateFile(filePath, dirName) {
    try {
      this.stats.filesProcessed++;
      
      const relativePath = path.relative(config.uploadsDir, filePath);
      const s3Key = `uploads/${relativePath.replace(/\\/g, '/')}`;
      
      // Check if file already exists in S3
      try {
        await s3.headObject({ Bucket: config.s3Config.bucket, Key: s3Key }).promise();
        this.logger.info(`File already exists in S3: ${s3Key}`);
        return;
      } catch (error) {
        // File doesn't exist, proceed with upload
      }
      
      // Read and upload file
      const fileContent = await readFile(filePath);
      const fileStats = await stat(filePath);
      
      const uploadParams = {
        Bucket: config.s3Config.bucket,
        Key: s3Key,
        Body: fileContent,
        ContentType: this.getContentType(filePath)
      };
      
      await s3.upload(uploadParams).promise();
      
      this.stats.filesUploaded++;
      this.stats.totalSize += fileStats.size;
      
      // Update database records
      await this.updateFileRecords(filePath, s3Key, dirName);
      
      this.logger.success(`File uploaded: ${s3Key}`);
      
    } catch (error) {
      this.stats.filesFailed++;
      this.logger.error(`Failed to migrate file: ${filePath}`, { error: error.message });
    }
  }

  async updateFileRecords(filePath, s3Key, dirName) {
    const fileName = path.basename(filePath);
    
    if (dirName === 'purchase-requests') {
      // Update attachments table
      await this.db.run(
        'UPDATE attachments SET storageType = ?, s3Key = ? WHERE fileName = ? AND storageType IS NULL',
        ['s3', s3Key, fileName]
      );
    } else if (dirName === 'supplier_quotations') {
      // Update supplier_quotation_items table
      await this.db.run(
        'UPDATE supplier_quotation_items SET storageType = ?, s3Key = ? WHERE fileName = ? AND storageType IS NULL',
        ['s3', s3Key, fileName]
      );
    }
  }

  async migrateCompanyLogos() {
    this.logger.info('Starting company logos migration');
    
    const companies = await this.db.query(
      'SELECT id, name, logoBase64 FROM companies WHERE logoBase64 IS NOT NULL AND s3Key IS NULL'
    );
    
    for (const company of companies) {
      await this.migrateCompanyLogo(company);
    }
  }

  async migrateCompanyLogo(company) {
    try {
      this.stats.logosProcessed++;
      
      if (!company.logoBase64) {
        this.logger.warning(`Company ${company.id} has no logo to migrate`);
        return;
      }
      
      // Extract base64 data
      const base64Match = company.logoBase64.match(/^data:([^;]+);base64,(.+)$/);
      if (!base64Match) {
        throw new Error('Invalid base64 format');
      }
      
      const mimeType = base64Match[1];
      const base64Data = base64Match[2];
      const buffer = Buffer.from(base64Data, 'base64');
      
      // Generate S3 key
      const extension = this.getExtensionFromMimeType(mimeType);
      const s3Key = `company-logos/${company.id}-${Date.now()}${extension}`;
      
      // Upload to S3
      const uploadParams = {
        Bucket: config.s3Config.bucket,
        Key: s3Key,
        Body: buffer,
        ContentType: mimeType
      };
      
      await s3.upload(uploadParams).promise();
      
      // Update database
      await this.db.run(
        'UPDATE companies SET s3Key = ? WHERE id = ?',
        [s3Key, company.id]
      );
      
      this.stats.logosUploaded++;
      this.stats.totalSize += buffer.length;
      
      this.logger.success(`Company logo uploaded: ${company.name} -> ${s3Key}`);
      
    } catch (error) {
      this.stats.logosFailed++;
      this.logger.error(`Failed to migrate logo for company ${company.id}`, { error: error.message });
    }
  }

  getContentType(filePath) {
    const ext = path.extname(filePath).toLowerCase();
    const mimeTypes = {
      '.pdf': 'application/pdf',
      '.jpg': 'image/jpeg',
      '.jpeg': 'image/jpeg',
      '.png': 'image/png',
      '.gif': 'image/gif',
      '.doc': 'application/msword',
      '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      '.xls': 'application/vnd.ms-excel',
      '.xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      '.txt': 'text/plain'
    };
    return mimeTypes[ext] || 'application/octet-stream';
  }

  getExtensionFromMimeType(mimeType) {
    const extensions = {
      'image/jpeg': '.jpg',
      'image/png': '.png',
      'image/gif': '.gif',
      'image/webp': '.webp'
    };
    return extensions[mimeType] || '.jpg';
  }

  async generateFinalReport() {
    const reportPath = await this.logger.saveReport();
    
    this.logger.info('Migration Statistics:', this.stats);
    
    // Create summary file
    const summaryPath = path.join(config.backupDir, 'migration-summary.txt');
    const summary = `
S3 Migration Summary
===================
Date: ${new Date().toISOString()}
Duration: ${Date.now() - this.logger.startTime}ms

Files:
- Processed: ${this.stats.filesProcessed}
- Uploaded: ${this.stats.filesUploaded}
- Failed: ${this.stats.filesFailed}

Company Logos:
- Processed: ${this.stats.logosProcessed}
- Uploaded: ${this.stats.logosUploaded}
- Failed: ${this.stats.logosFailed}

Total Size: ${(this.stats.totalSize / 1024 / 1024).toFixed(2)} MB

Backup Location: ${config.backupDir}
Report Location: ${reportPath}
`;
    
    await writeFile(summaryPath, summary);
    this.logger.success(`Summary saved to: ${summaryPath}`);
  }

  async rollback() {
    this.logger.info('Starting rollback process');
    
    try {
      // Restore database
      const dbBackupPath = path.join(config.backupDir, 'database.sqlite');
      if (fs.existsSync(dbBackupPath)) {
        await copyFile(dbBackupPath, config.dbPath);
        this.logger.success('Database restored from backup');
      }
      
      this.logger.success('Rollback completed');
    } catch (error) {
      this.logger.error('Rollback failed', { error: error.message });
    }
  }
}

// Main execution
if (require.main === module) {
  const migration = new S3Migration();
  
  migration.run()
    .then(() => {
      console.log('\n✅ Migration completed successfully!');
      process.exit(0);
    })
    .catch((error) => {
      console.error('\n❌ Migration failed:', error.message);
      process.exit(1);
    });
}

module.exports = S3Migration;