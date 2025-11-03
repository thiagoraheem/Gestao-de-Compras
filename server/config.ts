// Configuration file for application settings
export const config = {
  // Base URL for the application (used in email links)
  baseUrl: process.env.BASE_URL || process.env.REPLIT_DOMAINS?.split(',')[0] || 'http://localhost:5000',
  
  // Email configuration
  email: {
    enabled: process.env.ENABLE_EMAIL_SENDING !== "false", // Default to true, only false if explicitly set to "false"
    host: process.env.SMTP_HOST || "smtp.ethereal.email",
    port: parseInt(process.env.SMTP_PORT || "587"),
    secure: false, // true for 465, false for other ports
    auth: {
      user: process.env.SMTP_USER || "test@example.com",
      pass: process.env.SMTP_PASS || "test123",
    },
    from: process.env.FROM_EMAIL || "sistema@blomaq.com.br",
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
    timeout: 10000, // 10 seconds timeout
    enabled: process.env.ERP_INTEGRATION_ENABLED === "true" || false,
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