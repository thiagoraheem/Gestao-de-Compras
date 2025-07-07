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
  },
  
  // Application settings
  app: {
    name: "Sistema de Compras Blomaq",
    description: "Sistema de gestão de solicitações de compra",
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