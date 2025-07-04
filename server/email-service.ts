import nodemailer from 'nodemailer';
import type { Supplier } from '../shared/schema';

// Email configuration
const createTransporter = () => {
  // For development - you can use email testing services like Ethereal Email
  // In production, configure with actual SMTP settings
  return nodemailer.createTransport({
    host: process.env.SMTP_HOST || 'smtp.ethereal.email',
    port: parseInt(process.env.SMTP_PORT || '587'),
    secure: false, // true for 465, false for other ports
    auth: {
      user: process.env.SMTP_USER || 'test@example.com',
      pass: process.env.SMTP_PASS || 'test123'
    }
  });
};

interface RFQEmailData {
  quotationNumber: string;
  requestNumber: string;
  quotationDeadline: string;
  items: Array<{
    itemCode: string;
    description: string;
    quantity: string;
    unit: string;
    specifications?: string;
  }>;
  termsAndConditions?: string;
  technicalSpecs?: string;
}

export async function sendRFQToSuppliers(
  suppliers: Supplier[],
  rfqData: RFQEmailData
): Promise<{ success: boolean; errors: string[] }> {
  const transporter = createTransporter();
  const errors: string[] = [];
  let successCount = 0;

  for (const supplier of suppliers) {
    if (!supplier.email) {
      errors.push(`Fornecedor ${supplier.name} não possui e-mail cadastrado`);
      continue;
    }

    try {
      const emailHtml = generateRFQEmailHTML(supplier, rfqData);
      
      const mailOptions = {
        from: process.env.FROM_EMAIL || 'compras@empresa.com',
        to: supplier.email,
        subject: `Solicitação de Cotação - ${rfqData.quotationNumber}`,
        html: emailHtml,
        attachments: [] // Could add PDF attachments here
      };

      await transporter.sendMail(mailOptions);
      successCount++;
      console.log(`RFQ enviado com sucesso para ${supplier.name} (${supplier.email})`);
    } catch (error) {
      console.error(`Erro ao enviar RFQ para ${supplier.name}:`, error);
      errors.push(`Erro ao enviar para ${supplier.name}: ${error instanceof Error ? error.message : 'Erro desconhecido'}`);
    }
  }

  return {
    success: successCount > 0,
    errors
  };
}

function generateRFQEmailHTML(supplier: Supplier, rfqData: RFQEmailData): string {
  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
        .header { background: #2563eb; color: white; padding: 20px; text-align: center; }
        .content { padding: 20px; }
        .item-table { width: 100%; border-collapse: collapse; margin: 20px 0; }
        .item-table th, .item-table td { border: 1px solid #ddd; padding: 8px; text-align: left; }
        .item-table th { background: #f4f4f4; }
        .footer { background: #f8f9fa; padding: 20px; text-align: center; color: #666; }
        .deadline { background: #fff3cd; border: 1px solid #ffeaa7; padding: 10px; margin: 15px 0; border-radius: 4px; }
      </style>
    </head>
    <body>
      <div class="header">
        <h1>Solicitação de Cotação</h1>
        <h2>${rfqData.quotationNumber}</h2>
      </div>
      
      <div class="content">
        <p>Prezado(a) <strong>${supplier.name}</strong>,</p>
        
        <p>Solicitamos sua cotação para os itens relacionados na solicitação <strong>${rfqData.requestNumber}</strong>.</p>
        
        <div class="deadline">
          <strong>⏰ Prazo para envio da cotação: ${new Date(rfqData.quotationDeadline).toLocaleDateString('pt-BR')}</strong>
        </div>
        
        <h3>Itens Solicitados:</h3>
        <table class="item-table">
          <thead>
            <tr>
              <th>Código</th>
              <th>Descrição</th>
              <th>Quantidade</th>
              <th>Unidade</th>
              <th>Especificações</th>
            </tr>
          </thead>
          <tbody>
            ${rfqData.items.map(item => `
              <tr>
                <td>${item.itemCode}</td>
                <td>${item.description}</td>
                <td>${item.quantity}</td>
                <td>${item.unit}</td>
                <td>${item.specifications || '-'}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>
        
        ${rfqData.technicalSpecs ? `
          <h3>Especificações Técnicas:</h3>
          <div style="background: #f8f9fa; padding: 15px; border-radius: 4px;">
            ${rfqData.technicalSpecs.replace(/\n/g, '<br>')}
          </div>
        ` : ''}
        
        ${rfqData.termsAndConditions ? `
          <h3>Termos e Condições:</h3>
          <div style="background: #f8f9fa; padding: 15px; border-radius: 4px;">
            ${rfqData.termsAndConditions.replace(/\n/g, '<br>')}
          </div>
        ` : ''}
        
        <h3>Informações Necessárias na Cotação:</h3>
        <ul>
          <li>Preço unitário e total para cada item</li>
          <li>Prazo de entrega</li>
          <li>Condições de pagamento</li>
          <li>Validade da proposta</li>
          <li>Dados bancários para transferência</li>
        </ul>
        
        <p>Agradecemos sua participação e aguardamos retorno até a data limite informada.</p>
        
        <p>Atenciosamente,<br>
        <strong>Departamento de Compras</strong></p>
      </div>
      
      <div class="footer">
        <p>Esta é uma mensagem automática do sistema de compras.</p>
      </div>
    </body>
    </html>
  `;
}

// Test email configuration
export async function testEmailConfiguration(): Promise<boolean> {
  try {
    const transporter = createTransporter();
    await transporter.verify();
    return true;
  } catch (error) {
    console.error('Erro na configuração de e-mail:', error);
    return false;
  }
}