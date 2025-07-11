import nodemailer from "nodemailer";
import type { Supplier, User, PurchaseRequest } from "../shared/schema";
import { storage } from "./storage";
import { config, buildRequestUrl } from "./config";

// Email configuration
const createTransporter = () => {
  return nodemailer.createTransport({
    host: config.email.host,
    port: config.email.port,
    secure: config.email.secure,
    auth: config.email.auth,
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
  rfqData: RFQEmailData,
  senderEmail?: string,
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
        from: senderEmail || config.email.from,
        to: supplier.email,
        subject: `Solicitação de Cotação - ${rfqData.quotationNumber}`,
        html: emailHtml,
        attachments: [], // Could add PDF attachments here
      };

      await transporter.sendMail(mailOptions);
      successCount++;
      console.log(
        `RFQ enviado com sucesso para ${supplier.name} (${supplier.email})`,
      );
    } catch (error) {
      console.error(`Erro ao enviar RFQ para ${supplier.name}:`, error);
      errors.push(
        `Erro ao enviar para ${supplier.name}: ${error instanceof Error ? error.message : "Erro desconhecido"}`,
      );
    }
  }

  return {
    success: successCount > 0,
    errors,
  };
}

function generateRFQEmailHTML(
  supplier: Supplier,
  rfqData: RFQEmailData,
): string {
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
        <p>Prezado(a) <strong>${supplier.contact ?? supplier.name}</strong>,</p>
        
        <p>Solicitamos sua cotação para os itens relacionados na solicitação <strong>${rfqData.requestNumber}</strong>.</p>
        
        <div class="deadline">
          <strong>⏰ Prazo para envio da cotação: ${new Date(rfqData.quotationDeadline).toLocaleDateString("pt-BR")}</strong>
        </div>
        
        <h3>Itens Solicitados:</h3>
        <table class="item-table">
          <thead>
            <tr>
              <th>Descrição</th>
              <th>Quantidade</th>
              <th>Unidade</th>
              <th>Especificações</th>
            </tr>
          </thead>
          <tbody>
            ${rfqData.items
              .map(
                (item) => `
              <tr>
                <td>${item.description}</td>
                <td>${item.quantity}</td>
                <td>${item.unit}</td>
                <td>${item.specifications || "-"}</td>
              </tr>
            `,
              )
              .join("")}
          </tbody>
        </table>
        
        ${
          rfqData.technicalSpecs
            ? `
          <h3>Especificações Técnicas:</h3>
          <div style="background: #f8f9fa; padding: 15px; border-radius: 4px;">
            ${rfqData.technicalSpecs.replace(/\n/g, "<br>")}
          </div>
        `
            : ""
        }
        
        ${
          rfqData.termsAndConditions
            ? `
          <h3>Termos e Condições:</h3>
          <div style="background: #f8f9fa; padding: 15px; border-radius: 4px;">
            ${rfqData.termsAndConditions.replace(/\n/g, "<br>")}
          </div>
        `
            : ""
        }
        
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

// Workflow notification functions
export async function notifyNewRequest(
  purchaseRequest: PurchaseRequest,
): Promise<void> {
  try {
    const buyers = await storage.getAllUsers();
    const buyerUsers = buyers.filter((user) => user.isBuyer);

    if (buyerUsers.length === 0) {
      console.log("Nenhum comprador encontrado para notificação");
      return;
    }

    // Get requester details
    let requesterName = "N/A";
    if (purchaseRequest.requesterId) {
      const requester = await storage.getUser(purchaseRequest.requesterId);
      requesterName = requester
        ? requester.firstName
          ? `${requester.firstName} ${requester.lastName || ""}`.trim()
          : requester.username
        : "N/A";
    }

    const transporter = createTransporter();
    const emailPromises = buyerUsers.map(async (buyer) => {
      if (!buyer.email) return;

      const mailOptions = {
        from: config.email.from,
        to: buyer.email,
        subject: `Nova Solicitação de Compra - ${purchaseRequest.requestNumber}`,
        html: generateNewRequestEmailHTML(
          buyer,
          purchaseRequest,
          requesterName,
        ),
      };

      try {
        await transporter.sendMail(mailOptions);
        console.log(`Notificação enviada para comprador: ${buyer.email}`);
      } catch (error) {
        console.error(`Erro ao enviar notificação para ${buyer.email}:`, error);
      }
    });

    await Promise.all(emailPromises);
  } catch (error) {
    console.error("Erro ao notificar criação de solicitação:", error);
  }
}

export async function notifyApprovalA1(
  purchaseRequest: PurchaseRequest,
): Promise<void> {
  try {
    const approvers = await storage.getAllUsers();
    const approverA1Users = approvers.filter((user) => user.isApproverA1);

    if (approverA1Users.length === 0) {
      console.log("Nenhum aprovador A1 encontrado para notificação");
      return;
    }

    // Get requester details
    let requesterName = "N/A";
    if (purchaseRequest.requesterId) {
      const requester = await storage.getUser(purchaseRequest.requesterId);
      requesterName = requester
        ? requester.firstName
          ? `${requester.firstName} ${requester.lastName || ""}`.trim()
          : requester.username
        : "N/A";
    }

    const transporter = createTransporter();
    const emailPromises = approverA1Users.map(async (approver) => {
      if (!approver.email) return;

      const mailOptions = {
        from: config.email.from,
        to: approver.email,
        subject: `Solicitação Pendente de Aprovação A1 - ${purchaseRequest.requestNumber}`,
        html: generateApprovalA1EmailHTML(
          approver,
          purchaseRequest,
          requesterName,
        ),
      };

      try {
        await transporter.sendMail(mailOptions);
        console.log(`Notificação A1 enviada para aprovador: ${approver.email}`);
      } catch (error) {
        console.error(
          `Erro ao enviar notificação A1 para ${approver.email}:`,
          error,
        );
      }
    });

    await Promise.all(emailPromises);
  } catch (error) {
    console.error("Erro ao notificar aprovação A1:", error);
  }
}

export async function notifyApprovalA2(
  purchaseRequest: PurchaseRequest,
): Promise<void> {
  try {
    const approvers = await storage.getAllUsers();
    const approverA2Users = approvers.filter((user) => user.isApproverA2);

    if (approverA2Users.length === 0) {
      console.log("Nenhum aprovador A2 encontrado para notificação");
      return;
    }

    // Get requester details
    let requesterName = "N/A";
    if (purchaseRequest.requesterId) {
      const requester = await storage.getUser(purchaseRequest.requesterId);
      requesterName = requester
        ? requester.firstName
          ? `${requester.firstName} ${requester.lastName || ""}`.trim()
          : requester.username
        : "N/A";
    }

    // Get A1 approver name
    let approverA1Name = "N/A";
    if (purchaseRequest.approverA1Id) {
      const approverA1 = await storage.getUser(purchaseRequest.approverA1Id);
      approverA1Name = approverA1
        ? approverA1.firstName
          ? `${approverA1.firstName} ${approverA1.lastName || ""}`.trim()
          : approverA1.username
        : "N/A";
    }

    const transporter = createTransporter();
    const emailPromises = approverA2Users.map(async (approver) => {
      if (!approver.email) return;

      const mailOptions = {
        from: config.email.from,
        to: approver.email,
        subject: `Solicitação Pendente de Aprovação A2 - ${purchaseRequest.requestNumber}`,
        html: generateApprovalA2EmailHTML(
          approver,
          purchaseRequest,
          requesterName,
          approverA1Name,
        ),
      };

      try {
        await transporter.sendMail(mailOptions);
        console.log(`Notificação A2 enviada para aprovador: ${approver.email}`);
      } catch (error) {
        console.error(
          `Erro ao enviar notificação A2 para ${approver.email}:`,
          error,
        );
      }
    });

    await Promise.all(emailPromises);
  } catch (error) {
    console.error("Erro ao notificar aprovação A2:", error);
  }
}

// Email templates for notifications
function generateNewRequestEmailHTML(
  buyer: User,
  purchaseRequest: PurchaseRequest,
  requesterName: string,
): string {
  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
        .header { background: #10b981; color: white; padding: 20px; text-align: center; }
        .content { padding: 20px; }
        .details { background: #f8f9fa; padding: 15px; border-radius: 4px; margin: 15px 0; }
        .footer { background: #f8f9fa; padding: 20px; text-align: center; color: #666; }
        .button { background: #10b981; color: white; padding: 10px 20px; text-decoration: none; border-radius: 4px; display: inline-block; margin: 10px 0; }
      </style>
    </head>
    <body>
      <div class="header">
        <h1>Nova Solicitação de Compra</h1>
        <h2>${purchaseRequest.requestNumber}</h2>
      </div>
      
      <div class="content">
        <p>Olá <strong>${buyer.firstName || buyer.username}</strong>,</p>
        
        <p>Uma nova solicitação de compra foi criada e está aguardando processamento.</p>
        
        <div class="details">
          <h3>Detalhes da Solicitação:</h3>
          <ul>
            <li><strong>Número:</strong> ${purchaseRequest.requestNumber}</li>
            <li><strong>Solicitante:</strong> ${requesterName}</li>
            <li><strong>Justificativa:</strong> ${purchaseRequest.justification}</li>
            <li><strong>Urgência:</strong> ${purchaseRequest.urgency}</li>
            <li><strong>Data de Criação:</strong> ${purchaseRequest.createdAt ? new Date(purchaseRequest.createdAt).toLocaleDateString("pt-BR") : "N/A"}</li>
          </ul>
        </div>
        
        <p>Acesse o sistema para processar esta solicitação.</p>
        
        <a href="${buildRequestUrl(purchaseRequest.id, "solicitacao")}" class="button">
          Ver Solicitação
        </a>
      </div>
      
      <div class="footer">
        <p>Sistema de Gestão de Compras</p>
        <p>Este é um e-mail automático, não responda.</p>
      </div>
    </body>
    </html>
  `;
}

function generateApprovalA1EmailHTML(
  approver: User,
  purchaseRequest: PurchaseRequest,
  requesterName: string,
): string {
  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
        .header { background: #f59e0b; color: white; padding: 20px; text-align: center; }
        .content { padding: 20px; }
        .details { background: #f8f9fa; padding: 15px; border-radius: 4px; margin: 15px 0; }
        .footer { background: #f8f9fa; padding: 20px; text-align: center; color: #666; }
        .button { background: #f59e0b; color: white; padding: 10px 20px; text-decoration: none; border-radius: 4px; display: inline-block; margin: 10px 0; }
        .priority { background: #fef3c7; border: 1px solid #f59e0b; padding: 10px; border-radius: 4px; margin: 15px 0; }
      </style>
    </head>
    <body>
      <div class="header">
        <h1>Solicitação Pendente de Aprovação A1</h1>
        <h2>${purchaseRequest.requestNumber}</h2>
      </div>
      
      <div class="content">
        <p>Olá <strong>${approver.firstName || approver.username}</strong>,</p>
        
        <p>Uma solicitação de compra está aguardando sua aprovação (Nível A1).</p>
        
        <div class="priority">
          <strong>⚠️ Urgência: ${purchaseRequest.urgency}</strong>
        </div>
        
        <div class="details">
          <h3>Detalhes da Solicitação:</h3>
          <ul>
            <li><strong>Número:</strong> ${purchaseRequest.requestNumber}</li>
            <li><strong>Solicitante:</strong> ${requesterName}</li>
            <li><strong>Justificativa:</strong> ${purchaseRequest.justification}</li>
            <li><strong>Valor Estimado:</strong> R$ ${purchaseRequest.totalValue ? parseFloat(purchaseRequest.totalValue).toFixed(2) : "N/A"}</li>
            <li><strong>Data de Criação:</strong> ${purchaseRequest.createdAt ? new Date(purchaseRequest.createdAt).toLocaleDateString("pt-BR") : "N/A"}</li>
          </ul>
        </div>
        
        <p>Por favor, analise a solicitação e tome a decisão de aprovação.</p>
        
        <a href="${buildRequestUrl(purchaseRequest.id, "aprovacao_a1")}" class="button">
          Revisar e Aprovar A1
        </a>
      </div>
      
      <div class="footer">
        <p>Sistema de Gestão de Compras</p>
        <p>Este é um e-mail automático, não responda.</p>
      </div>
    </body>
    </html>
  `;
}

function generateApprovalA2EmailHTML(
  approver: User,
  purchaseRequest: PurchaseRequest,
  requesterName: string,
  approverA1Name: string,
): string {
  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
        .header { background: #dc2626; color: white; padding: 20px; text-align: center; }
        .content { padding: 20px; }
        .details { background: #f8f9fa; padding: 15px; border-radius: 4px; margin: 15px 0; }
        .footer { background: #f8f9fa; padding: 20px; text-align: center; color: #666; }
        .button { background: #dc2626; color: white; padding: 10px 20px; text-decoration: none; border-radius: 4px; display: inline-block; margin: 10px 0; }
        .priority { background: #fef3c7; border: 1px solid #f59e0b; padding: 10px; border-radius: 4px; margin: 15px 0; }
        .high-priority { background: #fef2f2; border: 1px solid #dc2626; padding: 10px; border-radius: 4px; margin: 15px 0; }
      </style>
    </head>
    <body>
      <div class="header">
        <h1>Solicitação Pendente de Aprovação A2</h1>
        <h2>${purchaseRequest.requestNumber}</h2>
      </div>
      
      <div class="content">
        <p>Olá <strong>${approver.firstName || approver.username}</strong>,</p>
        
        <p>Uma solicitação de compra passou pela primeira aprovação e está aguardando sua aprovação final (Nível A2).</p>
        
        <div class="${purchaseRequest.urgency === "Alta" ? "high-priority" : "priority"}">
          <strong>⚠️ Urgência: ${purchaseRequest.urgency}</strong>
        </div>
        
        <div class="details">
          <h3>Detalhes da Solicitação:</h3>
          <ul>
            <li><strong>Número:</strong> ${purchaseRequest.requestNumber}</li>
            <li><strong>Solicitante:</strong> ${requesterName}</li>
            <li><strong>Justificativa:</strong> ${purchaseRequest.justification}</li>
            <li><strong>Valor Estimado:</strong> R$ ${purchaseRequest.totalValue ? parseFloat(purchaseRequest.totalValue).toFixed(2) : "N/A"}</li>
            <li><strong>Data de Criação:</strong> ${purchaseRequest.createdAt ? new Date(purchaseRequest.createdAt).toLocaleDateString("pt-BR") : "N/A"}</li>
            <li><strong>Aprovador A1:</strong> ${approverA1Name}</li>
          </ul>
        </div>
        
        <p>Esta solicitação passou pela primeira aprovação e agora aguarda sua aprovação final.</p>
        
        <a href="${buildRequestUrl(purchaseRequest.id, "aprovacao_a2")}" class="button">
          Revisar e Aprovar A2
        </a>
      </div>
      
      <div class="footer">
        <p>Sistema de Gestão de Compras</p>
        <p>Este é um e-mail automático, não responda.</p>
      </div>
    </body>
    </html>
  `;
}

// Test email configuration
export async function notifyRejection(
  purchaseRequest: PurchaseRequest,
  rejectionReason: string,
  approverLevel: "A1" | "A2",
): Promise<void> {
  try {
    // Get requester details
    let requester = null;
    if (purchaseRequest.requesterId) {
      requester = await storage.getUser(purchaseRequest.requesterId);
    }

    if (!requester || !requester.email) {
      console.log("Requester not found or no email address");
      return;
    }

    const transporter = createTransporter();

    const mailOptions = {
      from: config.email.from,
      to: requester.email,
      subject: `Solicitação Reprovada - ${purchaseRequest.requestNumber}`,
      html: generateRejectionEmailHTML(
        requester,
        purchaseRequest,
        rejectionReason,
        approverLevel,
      ),
    };

    await transporter.sendMail(mailOptions);
    console.log(`Notificação de reprovação enviada para: ${requester.email}`);
  } catch (error) {
    console.error("Erro ao notificar reprovação:", error);
  }
}

function generateRejectionEmailHTML(
  requester: any,
  purchaseRequest: PurchaseRequest,
  rejectionReason: string,
  approverLevel: "A1" | "A2",
): string {
  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
        .header { background: #dc2626; color: white; padding: 20px; text-align: center; }
        .content { padding: 20px; }
        .details { background: #f8f9fa; padding: 15px; border-radius: 4px; margin: 15px 0; }
        .footer { background: #f8f9fa; padding: 20px; text-align: center; color: #666; }
        .rejection-box { background: #fef2f2; border: 1px solid #dc2626; padding: 15px; border-radius: 4px; margin: 15px 0; }
        .next-steps { background: #f0f9ff; border: 1px solid #3b82f6; padding: 15px; border-radius: 4px; margin: 15px 0; }
      </style>
    </head>
    <body>
      <div class="header">
        <h1>Solicitação Reprovada</h1>
        <h2>${purchaseRequest.requestNumber}</h2>
      </div>
      
      <div class="content">
        <p>Olá <strong>${requester.firstName || requester.username}</strong>,</p>
        
        <p>Sua solicitação de compra foi <strong>reprovada</strong> na fase de Aprovação ${approverLevel}.</p>
        
        <div class="rejection-box">
          <h3>📋 Motivo da Reprovação:</h3>
          <p><strong>${rejectionReason}</strong></p>
        </div>
        
        <div class="details">
          <h3>📄 Detalhes da Solicitação:</h3>
          <ul>
            <li><strong>Número:</strong> ${purchaseRequest.requestNumber}</li>
            <li><strong>Categoria:</strong> ${purchaseRequest.category}</li>
            <li><strong>Urgência:</strong> ${purchaseRequest.urgency}</li>
            <li><strong>Data da Reprovação:</strong> ${new Date().toLocaleDateString("pt-BR")}</li>
          </ul>
        </div>
        
        <div class="next-steps">
          <h3>🔄 Próximos Passos:</h3>
          <p>Você pode:</p>
          <ul>
            <li>Revisar os motivos da reprovação e fazer as correções necessárias</li>
            <li>Criar uma nova solicitação com as informações atualizadas</li>
            <li>Entrar em contato com o aprovador para esclarecimentos</li>
          </ul>
          <p><a href="${buildRequestUrl(purchaseRequest.id, "arquivado")}" style="background: #dc2626; color: white; padding: 10px 20px; text-decoration: none; border-radius: 4px; display: inline-block; margin: 10px 0;">Ver Solicitação</a></p>
        </div>
        
        <p>Em caso de dúvidas, entre em contato com a equipe de compras.</p>
      </div>
      
      <div class="footer">
        <p>Este é um e-mail automático, não responda.</p>
        <p>Sistema de Gestão de Compras</p>
      </div>
    </body>
    </html>
  `;
}

export async function sendPasswordResetEmail(
  user: User,
  resetToken: string,
): Promise<void> {
  const transporter = createTransporter();

  const resetUrl = `${config.baseUrl}/reset-password?token=${resetToken}`;

  const emailHtml = generatePasswordResetEmailHTML(user, resetUrl);

  const mailOptions = {
    from: config.email.from,
    to: user.email,
    subject: "Recuperação de Senha - Sistema LOCADOR",
    html: emailHtml,
  };

  try {
    await transporter.sendMail(mailOptions);
    console.log(`E-mail de recuperação enviado para ${user.email}`);
  } catch (error) {
    console.error(
      `Erro ao enviar e-mail de recuperação para ${user.email}:`,
      error,
    );
    throw new Error("Falha ao enviar e-mail de recuperação");
  }
}

function generatePasswordResetEmailHTML(user: User, resetUrl: string): string {
  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; margin: 0; padding: 0; }
        .container { max-width: 600px; margin: 0 auto; background: #f8f9fa; }
        .header { background: linear-gradient(135deg, #f97316, #ea580c); color: white; padding: 30px 20px; text-align: center; }
        .content { background: white; padding: 30px 20px; margin: 20px; border-radius: 8px; box-shadow: 0 2px 10px rgba(0,0,0,0.1); }
        .button { display: inline-block; background: linear-gradient(135deg, #f97316, #ea580c); color: white; padding: 15px 30px; text-decoration: none; border-radius: 8px; font-weight: bold; margin: 20px 0; }
        .button:hover { opacity: 0.9; }
        .footer { background: #f8f9fa; padding: 20px; text-align: center; color: #666; font-size: 12px; }
        .warning { background: #fff3cd; border: 1px solid #ffeaa7; padding: 15px; margin: 20px 0; border-radius: 4px; color: #856404; }
        .logo { font-size: 24px; font-weight: bold; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <div class="logo">Sistema LOCADOR</div>
          <h1>Recuperação de Senha</h1>
        </div>
        
        <div class="content">
          <p>Olá, <strong>${user.firstName || user.username}</strong>!</p>
          
          <p>Recebemos uma solicitação para redefinir a senha da sua conta no Sistema LOCADOR.</p>
          
          <p>Para criar uma nova senha, clique no botão abaixo:</p>
          
          <div style="text-align: center;">
            <a href="${resetUrl}" class="button">Redefinir Senha</a>
          </div>
          
          <p>Ou copie e cole este link no seu navegador:</p>
          <p style="word-break: break-all; background: #f8f9fa; padding: 10px; border-radius: 4px; font-family: monospace;">
            ${resetUrl}
          </p>
          
          <div class="warning">
            <strong>⚠️ Importante:</strong>
            <ul>
              <li>Este link expira em 1 hora por motivos de segurança</li>
              <li>Se você não solicitou esta alteração, ignore este e-mail</li>
              <li>Sua senha atual permanece inalterada até que você defina uma nova</li>
            </ul>
          </div>
          
          <p>Se você precisar de ajuda, entre em contato com nossa equipe de suporte.</p>
          
          <p>Atenciosamente,<br>
          <strong>Equipe Sistema LOCADOR</strong></p>
        </div>
        
        <div class="footer">
          <p>Sistema LOCADOR - Gestão de Compras</p>
          <p>Equipamentos • Plataformas Elevatórias • Imóveis • Veículos</p>
          <p>Este é um e-mail automático, não responda a esta mensagem.</p>
        </div>
      </div>
    </body>
    </html>
  `;
}

export async function testEmailConfiguration(): Promise<boolean> {
  try {
    const transporter = createTransporter();
    await transporter.verify();
    return true;
  } catch (error) {
    console.error("Erro na configuração de e-mail:", error);
    return false;
  }
}
