import nodemailer from "nodemailer";
import type { Supplier, User, PurchaseRequest, Quotation } from "../shared/schema";
import { storage } from "./storage";
import { config, buildRequestUrl, isEmailEnabled } from "./config";
import { PDFService } from "./pdf-service";
import { templateService } from "./services/template-service";

const createTransporter = () => {
  return nodemailer.createTransport({
    host: config.email.host,
    port: config.email.port,
    secure: config.email.secure,
    auth: config.email.auth,
  });
};

const getAppVersion = () => {
  return process.env.APP_VERSION || "1.0.0";
};

const isProductionEnvironment = () => {
  return process.env.NODE_ENV === "production";
};

export const decorateEmailHtmlWithEnvironmentBanner = (html: string, now: Date = new Date()): string => {
  if (isProductionEnvironment()) {
    return html;
  }

  const environmentName = process.env.APP_ENV || process.env.NODE_ENV || "development";
  const timestamp = now.toLocaleString("pt-BR");
  const version = getAppVersion();

  const headerBanner = `
    <div style="border: 2px solid #b91c1c; background-color: #fef3c7; color: #b91c1c; padding: 12px 16px; text-align: center; font-weight: 700; font-size: 13px; margin-bottom: 16px;">
      ENVIADO A PARTIR DO AMBIENTE DE TESTES (${environmentName.toUpperCase()})
    </div>
  `;

  const footerInfo = `
    <div style="margin-top: 24px; font-size: 11px; color: #4b5563; border-top: 1px dashed #d1d5db; padding-top: 8px;">
      Ambiente: <strong>${environmentName}</strong><br>
      Data/Hora de envio: <strong>${timestamp}</strong><br>
      Versão do sistema: <strong>${version}</strong>
    </div>
  `;

  const bodyCloseIndex = html.lastIndexOf("</body>");
  if (bodyCloseIndex === -1) {
    return `${headerBanner}${html}${footerInfo}`;
  }

  const beforeBodyClose = html.slice(0, bodyCloseIndex);
  const afterBodyClose = html.slice(bodyCloseIndex);

  return beforeBodyClose.replace("<body>", `<body>${headerBanner}`) + footerInfo + afterBodyClose;
};

const sendMailWithEnvironmentBanner = async (mailOptions: any) => {
  const transporter = createTransporter();
  const html = typeof mailOptions.html === "string" ? mailOptions.html : "";
  const decoratedHtml = decorateEmailHtmlWithEnvironmentBanner(html);
  const finalOptions = {
    ...mailOptions,
    html: decoratedHtml,
  };
  await transporter.sendMail(finalOptions);
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

  const errors: string[] = [];
  let successCount = 0;

  for (const supplier of suppliers) {
    if (!supplier.email) {
      errors.push(`Fornecedor ${supplier.name} não possui e-mail cadastrado`);
      continue;
    }

    try {
      const emailHtml = await generateRFQEmailHTML(supplier, rfqData);

      const mailOptions = {
        from: senderEmail || config.email.from,
        to: supplier.email,
        replyTo: senderEmail || config.email.from,
        subject: `Solicitação de Cotação - ${rfqData.quotationNumber}`,
        html: emailHtml,
        attachments: [], // Could add PDF attachments here
      };

      await sendMailWithEnvironmentBanner(mailOptions);
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

export async function notifyNewRFQ(
  supplier: Supplier,
  quotation: Quotation,
  token?: string,
): Promise<void> {
  // Verificar se o envio de e-mails está habilitado
  if (!isEmailEnabled()) {
    console.log(`📧 [EMAIL DISABLED] Notificação de nova RFQ para ${supplier.name} (Cotação: ${quotation.quotationNumber}) não foi enviada - envio de e-mails desabilitado`);
    return;
  }

  try {
    const purchaseRequest = await storage.getPurchaseRequestById(quotation.purchaseRequestId);
    if (!purchaseRequest) {
      console.error(`Purchase request ${quotation.purchaseRequestId} not found for quotation ${quotation.id}`);
      return;
    }

    const items = await storage.getQuotationItems(quotation.id);
    
    const rfqData: RFQEmailData = {
      quotationNumber: quotation.quotationNumber,
      requestNumber: purchaseRequest.requestNumber,
      quotationDeadline: quotation.quotationDeadline instanceof Date 
        ? quotation.quotationDeadline.toISOString() 
        : String(quotation.quotationDeadline),
      items: items.map(item => ({
        itemCode: item.itemCode,
        description: item.description,
        quantity: String(item.quantity),
        unit: item.unit,
        specifications: item.specifications || undefined
      })),
      termsAndConditions: quotation.termsAndConditions || undefined,
      technicalSpecs: quotation.technicalSpecs || undefined
    };

    const result = await sendRFQToSuppliers([supplier], rfqData);
    if (!result.success) {
      console.error(`Failed to send RFQ email to ${supplier.name}:`, result.errors);
    }
  } catch (error) {
    console.error(`Error in notifyNewRFQ for ${supplier.name}:`, error);
  }
}

async function generateRFQEmailHTML(
  supplier: Supplier,
  rfqData: RFQEmailData,
): Promise<string> {
  const itemRows = rfqData.items
    .map(
      (item) => `
    <tr>
      <td>${item.description}</td>
      <td style="text-align: right;">${item.quantity}</td>
      <td>${item.unit}</td>
      <td>${item.specifications || "-"}</td>
    </tr>
  `,
    )
    .join("");

  return await templateService.render("rfq", {
    quotationNumber: rfqData.quotationNumber,
    supplierContact: supplier.contact ?? supplier.name,
    requestNumber: rfqData.requestNumber,
    quotationDeadline: new Date(rfqData.quotationDeadline).toLocaleDateString("pt-BR"),
    itemRows,
    technicalSpecs: rfqData.technicalSpecs ? rfqData.technicalSpecs.replace(/\n/g, "<br>") : null,
    termsAndConditions: rfqData.termsAndConditions ? rfqData.termsAndConditions.replace(/\n/g, "<br>") : null,
  });
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

    const emailPromises = buyerUsers.map(async (buyer) => {
      if (!buyer.email) return;

      const mailOptions = {
        from: config.email.from,
        to: buyer.email,
        replyTo: config.email.from,
        subject: `Nova Solicitação de Compra - ${purchaseRequest.requestNumber}`,
        html: await generateNewRequestEmailHTML(
          buyer,
          purchaseRequest,
          requesterName,
        ),
      };

      try {
        await sendMailWithEnvironmentBanner(mailOptions);
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

    const emailPromises = approverA1Users.map(async (approver) => {
      if (!approver.email) return;

      const mailOptions = {
        from: config.email.from,
        to: approver.email,
        replyTo: config.email.from,
        subject: `Solicitação Pendente de Aprovação A1 - ${purchaseRequest.requestNumber}`,
        html: await generateApprovalA1EmailHTML(
          approver,
          purchaseRequest,
          requesterName,
        ),
      };

      try {
        await sendMailWithEnvironmentBanner(mailOptions);
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

    const emailPromises = approverA2Users.map(async (approver) => {
      if (!approver.email) return;

      const mailOptions = {
        from: config.email.from,
        to: approver.email,
        replyTo: config.email.from,
        subject: `Solicitação Pendente de Aprovação A2 - ${purchaseRequest.requestNumber}`,
        html: await generateApprovalA2EmailHTML(
          approver,
          purchaseRequest,
          requesterName,
          approverA1Name,
        ),
      };

      try {
        await sendMailWithEnvironmentBanner(mailOptions);
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
          html: await generateRejectionEmailHTML(
            requester,
            purchaseRequest,
            rejectionReason,
            phaseText,
            false
          ),
        };
        await sendMailWithEnvironmentBanner(mailOptions);
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
          html: await generateRejectionEmailHTML(
            approverA1,
            purchaseRequest,
            rejectionReason,
            phaseText,
            true
          ),
        };
        await sendMailWithEnvironmentBanner(mailOptions);
      }
    }

  } catch (error) {
    console.error("Erro ao notificar rejeição:", error);
  }
}

async function generateRejectionEmailHTML(
  user: User,
  purchaseRequest: PurchaseRequest,
  rejectionReason: string,
  phaseText: string,
  isManager: boolean
): Promise<string> {
  const introText = isManager 
    ? `A solicitação de compra <strong>${purchaseRequest.requestNumber}</strong>, aprovada tecnicamente por você, foi devolvida/rejeitada${phaseText}.`
    : `Sua solicitação de compra foi devolvida/rejeitada${phaseText}.`;

  return await templateService.render("rejection", {
    requestNumber: purchaseRequest.requestNumber,
    userName: user.firstName || user.username,
    introText,
    rejectionReason,
    requestUrl: buildRequestUrl(purchaseRequest.id),
  });
}

// Email templates for notifications
async function generateNewRequestEmailHTML(
  buyer: User,
  purchaseRequest: PurchaseRequest,
  requesterName: string,
): Promise<string> {
  return await templateService.render("new-request", {
    requestNumber: purchaseRequest.requestNumber,
    buyerName: buyer.firstName || buyer.username,
    requesterName,
    requestUrl: buildRequestUrl(purchaseRequest.id),
  });
}

async function generateApprovalA1EmailHTML(
  approver: User,
  purchaseRequest: PurchaseRequest,
  requesterName: string,
): Promise<string> {
  return await templateService.render("approval-a1", {
    requestNumber: purchaseRequest.requestNumber,
    approverName: approver.firstName || approver.username,
    requesterName,
    requestUrl: buildRequestUrl(purchaseRequest.id),
  });
}

async function generateApprovalA2EmailHTML(
  approver: User,
  purchaseRequest: PurchaseRequest,
  requesterName: string,
  approverA1Name: string,
): Promise<string> {
  return await templateService.render("approval-a2", {
    requestNumber: purchaseRequest.requestNumber,
    approverName: approver.firstName || approver.username,
    requesterName,
    approverA1Name,
    requestUrl: buildRequestUrl(purchaseRequest.id),
  });
}

export async function notifyRequestConclusion(purchaseRequestId: number): Promise<void> {
  if (!isEmailEnabled()) {
    console.log(`📧 [EMAIL DISABLED] Notificação de conclusão para solicitação ${purchaseRequestId} não foi enviada - envio de e-mails desabilitado`);
    return;
  }

  try {
    const purchaseRequest = await storage.getPurchaseRequestById(purchaseRequestId);
    if (!purchaseRequest) {
      console.log(`📧 Solicitação ${purchaseRequestId} não encontrada para envio de conclusão`);
      return;
    }

    if (!purchaseRequest.requesterId) {
      console.log(`📧 Solicitação ${purchaseRequest.requestNumber} não possui solicitante associado para envio de conclusão`);
      return;
    }

    const requester = await storage.getUser(purchaseRequest.requesterId);
    if (!requester || !requester.email) {
      console.log(`📧 Solicitante da solicitação ${purchaseRequest.requestNumber} não possui e-mail cadastrado para envio de conclusão`);
      return;
    }

    const purchaseOrder = await storage.getPurchaseOrderByRequestId(purchaseRequestId);
    if (!purchaseOrder) {
      console.log(`📧 Pedido de compra não encontrado para solicitação ${purchaseRequest.requestNumber}; e-mail de conclusão não será enviado`);
      return;
    }

    const items = await storage.getPurchaseOrderItems(purchaseOrder.id);

    let supplierName = "Não informado";
    if (purchaseOrder.supplierId) {
      const supplier = await storage.getSupplierById(purchaseOrder.supplierId);
      if (supplier) {
        supplierName = supplier.name || supplierName;
      }
    }

    let departmentName = "Não informado";
    if (purchaseRequest.costCenterId) {
      const allCostCenters = await storage.getAllCostCenters();
      const costCenter = allCostCenters.find((cc) => cc.id === purchaseRequest.costCenterId);
      if (costCenter && costCenter.departmentId) {
        const department = await storage.getDepartmentById(costCenter.departmentId);
        if (department) {
          departmentName = department.name || departmentName;
        }
      }
    }

    const totalValue =
      items.reduce((acc, item) => {
        const value = Number((item as any).totalPrice ?? (item as any).total_value ?? 0);
        return acc + (isNaN(value) ? 0 : value);
      }, 0) || Number(purchaseOrder.totalValue || purchaseRequest.totalValue || 0);

    const transporter = createTransporter();

    const formattedTotal = new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: "BRL",
    }).format(totalValue || 0);

    const issueDate = purchaseOrder.createdAt || purchaseRequest.createdAt;
    const formattedIssueDate = issueDate
      ? new Date(issueDate as any).toLocaleString("pt-BR")
      : "Não informado";

    const itemRows = items
      .map((item: any) => {
        const quantity = Number(item.quantity || item.requestedQuantity || 0);
        const unitPrice = Number(item.unitPrice || item.unit_price || 0);
        const lineTotal = Number(item.totalPrice || item.total_price || quantity * unitPrice || 0);

        const formattedQty = isNaN(quantity)
          ? "-"
          : quantity.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
        const formattedUnitPrice = new Intl.NumberFormat("pt-BR", {
          style: "currency",
          currency: "BRL",
        }).format(isNaN(unitPrice) ? 0 : unitPrice);
        const formattedLineTotal = new Intl.NumberFormat("pt-BR", {
          style: "currency",
          currency: "BRL",
        }).format(isNaN(lineTotal) ? 0 : lineTotal);

        return `
          <tr>
            <td>${item.description || item.itemDescription || "-"}</td>
            <td>${item.unit || item.unitMeasure || "-"}</td>
            <td style="text-align: right;">${formattedQty}</td>
            <td style="text-align: right;">${formattedUnitPrice}</td>
            <td style="text-align: right;">${formattedLineTotal}</td>
          </tr>
        `;
      })
      .join("");

    const html = await templateService.render("request-conclusion", {
      requestNumber: purchaseRequest.requestNumber,
      userName: requester.firstName || requester.username,
      orderNumber: purchaseOrder.orderNumber || purchaseRequest.requestNumber,
      issueDate: formattedIssueDate,
      totalValue: formattedTotal,
      supplierName,
      departmentName,
      itemRows: itemRows || `<tr><td colspan="5">Nenhum item encontrado.</td></tr>`,
      requestUrl: buildRequestUrl(purchaseRequest.id),
    });

    let pdfBuffer: Buffer | null = null;
    try {
      pdfBuffer = await PDFService.generatePurchaseOrderPDF(purchaseRequestId);
    } catch (pdfError) {
      console.error("Erro ao gerar PDF do pedido de compra para envio de conclusão:", pdfError);
    }

    const mailOptions: any = {
      from: config.email.from,
      to: requester.email,
      replyTo: config.email.from,
      subject: `Pedido de Compra Concluído - ${purchaseRequest.requestNumber}`,
      html,
    };

    if (pdfBuffer) {
      mailOptions.attachments = [
        {
          filename: `Pedido_de_Compra_${purchaseOrder.orderNumber || purchaseRequest.requestNumber}.pdf`,
          content: pdfBuffer,
        },
      ];
    }

    await sendMailWithEnvironmentBanner(mailOptions);
    console.log(`📧 Notificação de conclusão enviada para ${requester.email} (solicitação ${purchaseRequest.requestNumber})`);
  } catch (error) {
    console.error("Erro ao enviar notificação de conclusão de solicitação:", error);
  }
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

  const mailOptions = {
    from: config.email.from,
    to: user.email,
    subject: "Redefinição de Senha - Sistema Locador",
    html: await templateService.render("admin-set-password", {
      userName: user.firstName || user.username,
      temporaryPassword: newPassword,
    }),
  };
  
  try {
    await sendMailWithEnvironmentBanner(mailOptions);
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

  const resetLink = `${config.baseUrl}/reset-password?token=${token}`;
  
  const mailOptions = {
    from: config.email.from,
    to: user.email,
    subject: "Recuperação de Senha - Sistema Locador",
    html: await templateService.render("password-reset", {
      userName: user.firstName || user.username,
      resetLink,
    }),
  };
  
  try {
    await sendMailWithEnvironmentBanner(mailOptions);
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

  const mailOptions = {
    from: config.email.from,
    to: user.email,
    subject: "Senha Alterada pelo Administrador - Sistema Locador",
    html: await templateService.render("admin-set-password", {
      userName: user.firstName || user.username,
    }),
  };

  try {
    await sendMailWithEnvironmentBanner(mailOptions);
    console.log(`📧 E-mail de notificação de alteração de senha enviado para ${user.email}`);
  } catch (error) {
    console.error(`Erro ao enviar e-mail de notificação de alteração de senha para ${user.email}:`, error);
  }
}

export const testEmailConfiguration = verifyEmailConfig;

export async function notifyArchival(
  purchaseRequest: PurchaseRequest,
  observations?: string,
): Promise<void> {
  if (!isEmailEnabled()) {
    console.log(`📧 [EMAIL DISABLED] Notificação de arquivamento para solicitação ${purchaseRequest.requestNumber} não foi enviada - envio de e-mails desabilitado`);
    return;
  }

  try {
    if (purchaseRequest.requesterId) {
      const requester = await storage.getUser(purchaseRequest.requesterId);
      if (requester && requester.email) {
        const mailOptions = {
          from: config.email.from,
          to: requester.email,
          replyTo: config.email.from,
          subject: `Solicitação Arquivada - ${purchaseRequest.requestNumber}`,
          html: await generateArchivedEmailHTML(
            requester,
            purchaseRequest,
            observations,
          ),
        };
        await sendMailWithEnvironmentBanner(mailOptions);
      }
    }
  } catch (error) {
    console.error("Erro ao notificar arquivamento:", error);
  }
}

async function generateArchivedEmailHTML(
  user: User,
  purchaseRequest: PurchaseRequest,
  observations?: string,
): Promise<string> {
  return await templateService.render("archived", {
    requestNumber: purchaseRequest.requestNumber,
    userName: user.firstName || user.username,
    conclusionObservations: observations || null,
    requestUrl: buildRequestUrl(purchaseRequest.id),
  });
}
