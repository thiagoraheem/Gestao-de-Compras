import multer from "multer";
import path from "path";
import fs from "fs";
import { s3Service } from "../s3-service";
import { config } from "../config";

// Configuração condicional do multer baseada no S3
function createUploadConfig(uploadType: 'quotations' | 'logos') {
  // Se S3 estiver habilitado, usar memoryStorage para processar em memória
  if (config.s3.enabled) {
    return multer.memoryStorage();
  }
  
  // Caso contrário, usar diskStorage (comportamento atual)
  const uploadDir = uploadType === 'quotations' ? './uploads/supplier_quotations' : './uploads/company_logos';
  
  return multer.diskStorage({
    destination: function (req, file, cb) {
      if (!fs.existsSync(uploadDir)) {
        fs.mkdirSync(uploadDir, { recursive: true });
      }
      cb(null, uploadDir);
    },
    filename: function (req, file, cb) {
      const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
      const prefix = uploadType === 'logos' ? 'logo-' : file.fieldname + '-';
      cb(null, prefix + uniqueSuffix + path.extname(file.originalname));
    }
  });
}

// Configuração do multer para upload de arquivos de cotação
export const quotationUpload = multer({
  storage: createUploadConfig('quotations'),
  fileFilter: function (req, file, cb) {
    // Accept PDF, DOC, DOCX, XLS, XLSX, TXT, PNG, JPG, JPEG files for quotations
    const allowedMimeTypes = [
      'application/pdf',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/vnd.ms-excel',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'text/plain',
      'image/png',
      'image/jpeg',
      'image/jpg'
    ];

    if (allowedMimeTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Tipo de arquivo não suportado. Apenas PDF, DOC, DOCX, XLS, XLSX, TXT, PNG, JPG são permitidos.'), false);
    }
  },
  limits: {
    fileSize: 10 * 1024 * 1024 // 10MB
  }
});

// Configuração do multer para upload de logos de empresas
export const companyLogoUpload = multer({
  storage: createUploadConfig('logos'),
  fileFilter: function (req, file, cb) {
    // Accept only image files for logos
    if (file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new Error('Only image files are allowed for company logos'), false);
    }
  },
  limits: {
    fileSize: 5 * 1024 * 1024 // 5MB
  }
});