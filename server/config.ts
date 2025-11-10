// Configuration file for application settings
export const config = {
  // Base URL for the application (used in email links)
  baseUrl: process.env.BASE_URL || process.env.REPLIT_DOMAINS?.split(',')[0] || 'http://localhost:5000',
  
  // Email configuration
  email: {
    host: process.env.SMTP_HOST || "smtp.ethereal.email",
    port: parseInt(process.env.SMTP_PORT || "587"),
    secure: false, // true for 465, false for other ports
    auth: {
      user: process.env.SMTP_USER || "test@example.com",
      pass: process.env.SMTP_PASS || "test123",
    },
    from: process.env.FROM_EMAIL || "sistema@blomaq.com.br",
    // Global email sending control
    // Set ENABLE_EMAIL_SENDING=true in .env or environment variables to enable email sending
    // Any other value (including undefined) will disable email sending for security
    enabled: (process.env.ENABLE_EMAIL_SENDING || 'false').toLowerCase() === 'true',
  },
  
  // Application settings
  app: {
    name: "Sistema de Compras Blomaq",
    description: "Sistema de gestão de solicitações de compra",
  },

  // ERP Integration settings
  erp: {
    baseUrl: process.env.BASE_API_URL || "http://54.232.194.197:5001/api",
    productsEndpoint: "/Produtos",
    suppliersEndpoint: "/Fornecedor",
    suppliersCountEndpoint: "/Fornecedor/GetCount",
    timeout: 10000, // 10 seconds timeout
    supplierPageSize: parseInt(process.env.ERP_SUPPLIER_PAGE_SIZE || "200", 10),
    enabled: process.env.ERP_INTEGRATION_ENABLED === "true" || false,
    useMockFallback:
      process.env.ERP_USE_MOCK_FALLBACK === undefined
        ? true
        : process.env.ERP_USE_MOCK_FALLBACK.toLowerCase() !== "false",
  }
};

// Helper function to build application URLs
export function buildAppUrl(path: string = ''): string {
  const baseUrl = config.baseUrl.replace(/\/$/, ''); // Remove trailing slash
  const cleanPath = path.startsWith('/') ? path : `/${path}`;
  return `${baseUrl}${cleanPath}`;
}

// Helper function to build request-specific URLs
export function buildRequestUrl(requestId: number, phase?: string): string {
  let path = `/kanban?request=${requestId}`;
  if (phase) {
    path += `&phase=${phase}`;
  }
  return buildAppUrl(path);
}

/**
 * Verifica se o envio de e-mails está habilitado globalmente
 * 
 * Esta função verifica a variável de ambiente ENABLE_EMAIL_SENDING para determinar
 * se o sistema deve enviar e-mails. Por segurança, o padrão é 'false'.
 * 
 * @returns {boolean} true se o envio de e-mails estiver habilitado, false caso contrário
 */
export function isEmailEnabled(): boolean {
  const enabled = config.email.enabled;
  
  if (!enabled) {
    console.log('📧 [EMAIL DISABLED] Envio de e-mails está desabilitado globalmente. Configure ENABLE_EMAIL_SENDING=true para habilitar.');
  }
  
  return enabled;
}