import nodemailer from "nodemailer";
import type { Supplier, User, PurchaseRequest } from "../shared/schema";
import { storage } from "./storage";
import { config, buildRequestUrl, isEmailEnabled } from "./config";

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
  // Verificar se o envio de e-mails está habilitado
  if (!isEmailEnabled()) {
    console.log(`📧 [EMAIL DISABLED] Tentativa de envio de RFQ para ${suppliers.length} fornecedores foi bloqueada - envio de e-mails desabilitado`);
    return {
      success: false,
      errors: ['Envio de e-mails está desabilitado globalmente. Configure ENABLE_EMAIL_SENDING=true para habilitar.']
    };
  }

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
        replyTo: senderEmail || config.email.from,
        subject: `Solicitação de Cotação - ${rfqData.quotationNumber}`,
        html: emailHtml,
        attachments: [], // Could add PDF attachments here
      };

      await transporter.sendMail(mailOptions);
      successCount++;
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
  // Verificar se o envio de e-mails está habilitado
  if (!isEmailEnabled()) {
    console.log(`📧 [EMAIL DISABLED] Notificação de nova solicitação ${purchaseRequest.requestNumber} não foi enviada - envio de e-mails desabilitado`);
    return;
  }

  try {
    const buyers = await storage.getAllUsers();
    const buyerUsers = buyers.filter((user) => user.isBuyer);

    if (buyerUsers.length === 0) {
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
        replyTo: config.email.from,
        subject: `Nova Solicitação de Compra - ${purchaseRequest.requestNumber}`,
        html: generateNewRequestEmailHTML(
          buyer,
          purchaseRequest,
          requesterName,
        ),
      };

      try {
        await transporter.sendMail(mailOptions);
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
  // Verificar se o envio de e-mails está habilitado
  if (!isEmailEnabled()) {
    console.log(`📧 [EMAIL DISABLED] Notificação de aprovação A1 para solicitação ${purchaseRequest.requestNumber} não foi enviada - envio de e-mails desabilitado`);
    return;
  }

  try {
    const approvers = await storage.getAllUsers();
    let approverA1Users = approvers.filter((user) => user.isApproverA1);

    // Filtrar aprovadores pelos centros de custo
    if (purchaseRequest.costCenterId) {
      const relevantApprovers = [];
      
      for (const approver of approverA1Users) {
        const userCostCenters = await storage.getUserCostCenters(approver.id);
        if (userCostCenters.includes(purchaseRequest.costCenterId)) {
          relevantApprovers.push(approver);
        }
      }
      
      approverA1Users = relevantApprovers;
    }

    if (approverA1Users.length === 0) {
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
        replyTo: config.email.from,
        subject: `Solicitação Pendente de Aprovação A1 - ${purchaseRequest.requestNumber}`,
        html: generateApprovalA1EmailHTML(
          approver,
          purchaseRequest,
          requesterName,
        ),
      };

      try {
        await transporter.sendMail(mailOptions);
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
  // Verificar se o envio de e-mails está habilitado
  if (!isEmailEnabled()) {
    console.log(`📧 [EMAIL DISABLED] Notificação de aprovação A2 para solicitação ${purchaseRequest.requestNumber} não foi enviada - envio de e-mails desabilitado`);
    return;
  }

  try {
    const approvers = await storage.getAllUsers();
    const approverA2Users = approvers.filter((user) => user.isApproverA2);

    if (approverA2Users.length === 0) {
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
        replyTo: config.email.from,
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

export async function notifyRejection(
  purchaseRequest: PurchaseRequest,
  rejectionReason: string,
  phase?: string,
): Promise<void> {
  // Verificar se o envio de e-mails está habilitado
  if (!isEmailEnabled()) {
    console.log(`📧 [EMAIL DISABLED] Notificação de rejeição para solicitação ${purchaseRequest.requestNumber} não foi enviada - envio de e-mails desabilitado`);
    return;
  }

  try {
    const transporter = createTransporter();
    const phaseText = phase ? ` na fase ${phase}` : "";
    const subject = `Solicitação Rejeitada${phaseText} - ${purchaseRequest.requestNumber}`;

    // 1. Notificar Solicitante
    if (purchaseRequest.requesterId) {
      const requester = await storage.getUser(purchaseRequest.requesterId);
      if (requester && requester.email) {
        const mailOptions = {
          from: config.email.from,
          to: requester.email,
          replyTo: config.email.from,
          subject: subject,
          html: generateRejectionEmailHTML(
            requester,
            purchaseRequest,
            rejectionReason,
            phaseText,
            false
          ),
        };
        await transporter.sendMail(mailOptions);
      }
    }

    // 2. Notificar Gestor (Aprovador A1) se a rejeição ocorrer na fase A2
    // Isso mantém o gestor informado sobre rejeições da diretoria
    if (phase === "A2" && purchaseRequest.approverA1Id) {
      const approverA1 = await storage.getUser(purchaseRequest.approverA1Id);
      // Evitar enviar duas vezes se o aprovador for o mesmo que o solicitante (improvável mas possível)
      if (approverA1 && approverA1.email && approverA1.id !== purchaseRequest.requesterId) {
        const mailOptions = {
          from: config.email.from,
          to: approverA1.email,
          replyTo: config.email.from,
          subject: subject,
          html: generateRejectionEmailHTML(
            approverA1,
            purchaseRequest,
            rejectionReason,
            phaseText,
            true
          ),
        };
        await transporter.sendMail(mailOptions);
      }
    }

  } catch (error) {
    console.error("Erro ao notificar rejeição:", error);
  }
}

function generateRejectionEmailHTML(
  user: User,
  purchaseRequest: PurchaseRequest,
  rejectionReason: string,
  phaseText: string,
  isManager: boolean
): string {
  const introText = isManager 
    ? `A solicitação de compra <strong>${purchaseRequest.requestNumber}</strong>, aprovada tecnicamente por você, foi devolvida/rejeitada${phaseText}.`
    : `Sua solicitação de compra foi devolvida/rejeitada${phaseText}.`;

  return `
    <!DOCTYPE html>
    <html>
    <head>
      <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background-color: #fee2e2; padding: 15px; border-radius: 5px; margin-bottom: 20px; }
        .content { margin-bottom: 20px; }
        .reason { background-color: #f8f9fa; padding: 15px; border-left: 4px solid #dc2626; margin: 15px 0; }
        .footer { font-size: 12px; color: #666; text-align: center; border-top: 1px solid #eee; padding-top: 20px; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h2 style="color: #dc2626; margin: 0;">Solicitação Rejeitada</h2>
          <p style="margin: 5px 0 0 0;">Número: <strong>${purchaseRequest.requestNumber}</strong></p>
        </div>
        <div class="content">
          <p>Olá ${user.firstName || user.username},</p>
          <p>${introText}</p>
          
          <div class="reason">
            <strong>Motivo da rejeição:</strong><br>
            ${rejectionReason}
          </div>

          <p>
            <a href="${buildRequestUrl(purchaseRequest.id)}" style="background-color: #6b7280; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px; display: inline-block;">
              Ver Detalhes
            </a>
          </p>
        </div>
        <div class="footer">
          <p>Este é um e-mail automático do Sistema de Gestão de Compras.</p>
        </div>
      </div>
    </body>
    </html>
  `;
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
      <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background-color: #f8f9fa; padding: 15px; border-radius: 5px; margin-bottom: 20px; }
        .content { margin-bottom: 20px; }
        .footer { font-size: 12px; color: #666; text-align: center; border-top: 1px solid #eee; padding-top: 20px; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h2>Nova Solicitação de Compra</h2>
          <p>Número: <strong>${purchaseRequest.requestNumber}</strong></p>
        </div>
        <div class="content">
          <p>Olá ${buyer.firstName || buyer.username},</p>
          <p>Uma nova solicitação de compra foi criada por <strong>${requesterName}</strong> e precisa de sua atenção.</p>
          <p>
            <a href="${buildRequestUrl(purchaseRequest.id)}" style="background-color: #007bff; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px; display: inline-block;">
              Ver Solicitação
            </a>
          </p>
        </div>
        <div class="footer">
          <p>Este é um e-mail automático do Sistema de Gestão de Compras.</p>
        </div>
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
      <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background-color: #f8f9fa; padding: 15px; border-radius: 5px; margin-bottom: 20px; }
        .content { margin-bottom: 20px; }
        .footer { font-size: 12px; color: #666; text-align: center; border-top: 1px solid #eee; padding-top: 20px; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h2>Solicitação Aguardando Aprovação A1</h2>
          <p>Número: <strong>${purchaseRequest.requestNumber}</strong></p>
        </div>
        <div class="content">
          <p>Olá ${approver.firstName || approver.username},</p>
          <p>A solicitação criada por <strong>${requesterName}</strong> aguarda sua aprovação técnica.</p>
          <p>
            <a href="${buildRequestUrl(purchaseRequest.id)}" style="background-color: #007bff; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px; display: inline-block;">
              Revisar e Aprovar
            </a>
          </p>
        </div>
        <div class="footer">
          <p>Este é um e-mail automático do Sistema de Gestão de Compras.</p>
        </div>
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
      <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background-color: #f8f9fa; padding: 15px; border-radius: 5px; margin-bottom: 20px; }
        .content { margin-bottom: 20px; }
        .footer { font-size: 12px; color: #666; text-align: center; border-top: 1px solid #eee; padding-top: 20px; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h2>Solicitação Aguardando Aprovação A2</h2>
          <p>Número: <strong>${purchaseRequest.requestNumber}</strong></p>
        </div>
        <div class="content">
          <p>Olá ${approver.firstName || approver.username},</p>
          <p>A solicitação criada por <strong>${requesterName}</strong> foi aprovada tecnicamente por <strong>${approverA1Name}</strong> e agora aguarda sua aprovação final.</p>
          <p>
            <a href="${buildRequestUrl(purchaseRequest.id)}" style="background-color: #007bff; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px; display: inline-block;">
              Revisar e Aprovar
            </a>
          </p>
        </div>
        <div class="footer">
          <p>Este é um e-mail automático do Sistema de Gestão de Compras.</p>
        </div>
      </div>
    </body>
    </html>
  `;
}

export async function verifyEmailConfig(): Promise<boolean> {
  try {
    const transporter = createTransporter();
    await transporter.verify();
    return true;
  } catch (error) {
    console.error("Erro na configuração de e-mail:", error);
    return false;
  }
}

export async function notifyPasswordReset(user: User, newPassword: string): Promise<void> {
  // Verificar se o envio de e-mails está habilitado
  if (!isEmailEnabled()) {
    console.log(`📧 [EMAIL DISABLED] Notificação de redefinição de senha para ${user.email} não foi enviada - envio de e-mails desabilitado`);
    return;
  }

  if (!user.email) {
    console.log(`📧 Usuário ${user.username} não possui e-mail cadastrado para notificação de redefinição de senha`);
    return;
  }

  const transporter = createTransporter();
  
  const mailOptions = {
    from: config.email.from,
    to: user.email,
    subject: "Redefinição de Senha - Sistema Locador",
    html: `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .header { background: #2563eb; color: white; padding: 20px; text-align: center; }
          .content { padding: 20px; }
          .footer { background: #f8f9fa; padding: 20px; text-align: center; color: #666; }
          .password-box { background: #f4f4f4; border: 1px solid #ddd; padding: 15px; margin: 15px 0; border-radius: 4px; text-align: center; font-size: 1.2em; font-family: monospace; letter-spacing: 2px; }
          .warning { color: #d32f2f; font-weight: bold; }
        </style>
      </head>
      <body>
        <div class="header">
          <h1>Redefinição de Senha</h1>
        </div>
        
        <div class="content">
          <p>Prezado(a) <strong>${user.firstName || user.username}</strong>,</p>
          
          <p>Sua senha de acesso ao Sistema de Gestão de Compras foi redefinida por um administrador.</p>
          
          <p>Sua nova senha temporária é:</p>
          
          <div class="password-box">
            ${newPassword}
          </div>
          
          <p class="warning">Por segurança, você será solicitado a alterar esta senha no próximo login.</p>
          
          <p>Se você não solicitou esta alteração, entre em contato imediatamente com o suporte.</p>
          
          <p>Atenciosamente,<br>
          <strong>Administração do Sistema</strong></p>
        </div>
        
        <div class="footer">
          <p>Esta é uma mensagem automática do sistema.</p>
        </div>
      </body>
      </html>
    `
  };
  
  try {
    await transporter.sendMail(mailOptions);
    console.log(`📧 Notificação de redefinição de senha enviada para ${user.email}`);
  } catch (error) {
    console.error("Erro ao enviar notificação de redefinição de senha:", error);
  }
}

export async function sendPasswordResetEmail(user: User, token: string): Promise<void> {
  // Verificar se o envio de e-mails está habilitado
  if (!isEmailEnabled()) {
    console.log(`📧 [EMAIL DISABLED] Email de recuperação para ${user.email} não foi enviado - envio de e-mails desabilitado`);
    return;
  }

  if (!user.email) {
    console.log(`📧 Usuário ${user.username} não possui e-mail cadastrado para recuperação de senha`);
    return;
  }

  const transporter = createTransporter();
  const resetLink = `${config.baseUrl}/reset-password?token=${token}`;
  
  const mailOptions = {
    from: config.email.from,
    to: user.email,
    subject: "Recuperação de Senha - Sistema Locador",
    html: `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .header { background: #2563eb; color: white; padding: 20px; text-align: center; }
          .content { padding: 20px; }
          .footer { background: #f8f9fa; padding: 20px; text-align: center; color: #666; }
          .button { background: #2563eb; color: white; padding: 12px 24px; text-decoration: none; border-radius: 4px; display: inline-block; margin: 20px 0; }
        </style>
      </head>
      <body>
        <div class="header">
          <h1>Recuperação de Senha</h1>
        </div>
        
        <div class="content">
          <p>Prezado(a) <strong>${user.firstName || user.username}</strong>,</p>
          
          <p>Recebemos uma solicitação de recuperação de senha para sua conta.</p>
          
          <p>Para redefinir sua senha, clique no botão abaixo:</p>
          
          <div style="text-align: center;">
            <a href="${resetLink}" class="button">Redefinir Senha</a>
          </div>
          
          <p>Se o botão não funcionar, copie e cole o link abaixo no seu navegador:</p>
          <p><a href="${resetLink}">${resetLink}</a></p>
          
          <p>Se você não solicitou esta recuperação, ignore este e-mail.</p>
          
          <p>Atenciosamente,<br>
          <strong>Equipe do Sistema</strong></p>
        </div>
        
        <div class="footer">
          <p>Este é uma mensagem automática do sistema.</p>
        </div>
      </body>
      </html>
    `
  };
  
  try {
    await transporter.sendMail(mailOptions);
    console.log(`📧 Email de recuperação enviado para ${user.email}`);
  } catch (error) {
    console.error("Erro ao enviar email de recuperação:", error);
    throw error;
  }
}

export async function notifyAdminSetPassword(user: User): Promise<void> {
  // Verificar se o envio de e-mails está habilitado
  if (!isEmailEnabled()) {
    console.log(`📧 [EMAIL DISABLED] Notificação de alteração de senha para ${user.email} não foi enviada - envio de e-mails desabilitado`);
    return;
  }

  if (!user.email) {
    console.log(`📧 Usuário ${user.username} não possui e-mail cadastrado para notificação de alteração de senha`);
    return;
  }

  const transporter = createTransporter();
  
  const mailOptions = {
    from: config.email.from,
    to: user.email,
    subject: "Senha Alterada pelo Administrador - Sistema Locador",
    html: `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .header { background: #2563eb; color: white; padding: 20px; text-align: center; }
          .content { padding: 20px; }
          .footer { background: #f8f9fa; padding: 20px; text-align: center; color: #666; }
          .warning { color: #d32f2f; font-weight: bold; }
        </style>
      </head>
      <body>
        <div class="header">
          <h1>Senha Alterada</h1>
        </div>
        
        <div class="content">
          <p>Prezado(a) <strong>${user.firstName || user.username}</strong>,</p>
          
          <p>Sua senha de acesso ao Sistema de Gestão de Compras foi alterada manualmente por um administrador.</p>
          
          <p>Por favor, utilize a nova senha fornecida pelo administrador para acessar o sistema.</p>
          
          <p class="warning">Se você não solicitou esta alteração ou desconhece o motivo, entre em contato imediatamente com o suporte ou com o administrador do sistema.</p>
          
          <p>Atenciosamente,<br>
          Equipe de TI</p>
        </div>
        
        <div class="footer">
          <p>Este é um e-mail automático. Não responda a este endereço.</p>
        </div>
      </body>
      </html>
    `,
  };

  try {
    await transporter.sendMail(mailOptions);
    console.log(`📧 E-mail de notificação de alteração de senha enviado para ${user.email}`);
  } catch (error) {
    console.error(`Erro ao enviar e-mail de notificação de alteração de senha para ${user.email}:`, error);
  }
}

export const testEmailConfiguration = verifyEmailConfig;
