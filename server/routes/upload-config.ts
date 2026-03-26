import multer from "multer";

// Configuração do multer para upload de arquivos de cotação
export const quotationUpload = multer({
  storage: multer.memoryStorage(),
  fileFilter: function (_req, file, cb) {
    // Accept PDF, DOC, DOCX, XLS, XLSX, TXT, PNG, JPG, JPEG files for quotations
    const allowedMimeTypes = [
      "application/pdf",
      "application/msword",
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      "application/vnd.ms-excel",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "text/plain",
      "image/png",
      "image/jpeg",
      "image/jpg",
    ];

    if (allowedMimeTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(null, false);
    }
  },
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB
  },
});

// Mantido por compatibilidade; o upload de logos é tratado na rota própria.
export const companyLogoUpload = multer({
  storage: multer.memoryStorage(),
  fileFilter: function (_req, file, cb) {
    if (file.mimetype.startsWith("image/")) {
      cb(null, true);
    } else {
      cb(null, false);
    }
  },
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB
  },
});
