import { db } from '../db';
import { users, quotations, quotationVersionHistory, purchaseRequests } from '../../shared/schema';
import { and, eq, inArray, or } from 'drizzle-orm';
import { isEmailEnabled } from '../config';

export interface NotificationData {
  type: 'quantity_change' | 'version_update' | 'deadline_change' | 'approval_required' | 'critical_change';
  title: string;
  message: string;
  quotationId: number;
  versionId?: number;
  severity: 'low' | 'medium' | 'high' | 'critical';
  recipients: number[]; // User IDs
  metadata?: Record<string, any>;
}

export interface NotificationService {
  sendQuantityChangeNotification(quotationId: number, changes: any[], changedBy: number): Promise<void>;
  sendVersionUpdateNotification(quotationId: number, versionId: number, changeType: string, changedBy: number): Promise<void>;
  sendDeadlineChangeNotification(quotationId: number, oldDeadline: Date, newDeadline: Date, changedBy: number): Promise<void>;
  sendApprovalRequiredNotification(quotationId: number, approverIds: number[], changedBy: number): Promise<void>;
  sendCriticalChangeNotification(quotationId: number, changes: any[], changedBy: number): Promise<void>;
  getNotificationRecipients(quotationId: number, notificationType: string): Promise<number[]>;
  createNotification(data: NotificationData): Promise<void>;
  markNotificationsSent(versionId: number): Promise<void>;
}

export class NotificationServiceImpl implements NotificationService {

  async sendQuantityChangeNotification(quotationId: number, changes: any[], changedBy: number): Promise<void> {
    const recipients = await this.getNotificationRecipients(quotationId, 'quantity_change');
    
    // Filter out the user who made the change
    const filteredRecipients = recipients.filter(id => id !== changedBy);
    
    if (filteredRecipients.length === 0) return;

    const quotation = await this.getQuotationDetails(quotationId);
    if (!quotation) return;

    const changedItems = changes.filter(change => 
      change.field === 'quantity' || change.field === 'availableQuantity'
    );

    if (changedItems.length === 0) return;

    const severity = this.calculateQuantityChangeSeverity(changedItems);
    
    const notification: NotificationData = {
      type: 'quantity_change',
      title: `Alteração de Quantidade - Cotação ${quotation.quotationNumber}`,
      message: this.buildQuantityChangeMessage(changedItems, quotation),
      quotationId,
      severity,
      recipients: filteredRecipients,
      metadata: {
        changes: changedItems,
        quotationNumber: quotation.quotationNumber,
        purchaseRequestId: quotation.purchaseRequestId
      }
    };

    await this.createNotification(notification);
  }

  async sendVersionUpdateNotification(quotationId: number, versionId: number, changeType: string, changedBy: number): Promise<void> {
    const recipients = await this.getNotificationRecipients(quotationId, 'version_update');
    
    // Filter out the user who made the change
    const filteredRecipients = recipients.filter(id => id !== changedBy);
    
    if (filteredRecipients.length === 0) return;

    const quotation = await this.getQuotationDetails(quotationId);
    if (!quotation) return;

    const severity = this.getChangeTypeSeverity(changeType);
    
    const notification: NotificationData = {
      type: 'version_update',
      title: `Nova Versão da Cotação ${quotation.quotationNumber}`,
      message: `Uma nova versão (v${quotation.rfqVersion}) da cotação foi criada devido a: ${this.getChangeTypeDescription(changeType)}`,
      quotationId,
      versionId,
      severity,
      recipients: filteredRecipients,
      metadata: {
        changeType,
        version: quotation.rfqVersion,
        quotationNumber: quotation.quotationNumber
      }
    };

    await this.createNotification(notification);
  }

  async sendDeadlineChangeNotification(quotationId: number, oldDeadline: Date, newDeadline: Date, changedBy: number): Promise<void> {
    const recipients = await this.getNotificationRecipients(quotationId, 'deadline_change');
    
    // Filter out the user who made the change
    const filteredRecipients = recipients.filter(id => id !== changedBy);
    
    if (filteredRecipients.length === 0) return;

    const quotation = await this.getQuotationDetails(quotationId);
    if (!quotation) return;

    const isExtension = newDeadline > oldDeadline;
    const daysDifference = Math.abs((newDeadline.getTime() - oldDeadline.getTime()) / (1000 * 60 * 60 * 24));
    
    const severity = daysDifference > 7 ? 'high' : daysDifference > 3 ? 'medium' : 'low';
    
    const notification: NotificationData = {
      type: 'deadline_change',
      title: `Prazo ${isExtension ? 'Prorrogado' : 'Antecipado'} - Cotação ${quotation.quotationNumber}`,
      message: `O prazo da cotação foi ${isExtension ? 'prorrogado' : 'antecipado'} de ${oldDeadline.toLocaleDateString('pt-BR')} para ${newDeadline.toLocaleDateString('pt-BR')} (${Math.round(daysDifference)} dias)`,
      quotationId,
      severity: severity as 'low' | 'medium' | 'high',
      recipients: filteredRecipients,
      metadata: {
        oldDeadline: oldDeadline.toISOString(),
        newDeadline: newDeadline.toISOString(),
        isExtension,
        daysDifference: Math.round(daysDifference)
      }
    };

    await this.createNotification(notification);
  }

  async sendApprovalRequiredNotification(quotationId: number, approverIds: number[], changedBy: number): Promise<void> {
    // Filter out the user who made the change
    const filteredApprovers = approverIds.filter(id => id !== changedBy);
    
    if (filteredApprovers.length === 0) return;

    const quotation = await this.getQuotationDetails(quotationId);
    if (!quotation) return;
    
    const notification: NotificationData = {
      type: 'approval_required',
      title: `Aprovação Necessária - Cotação ${quotation.quotationNumber}`,
      message: `A cotação requer sua aprovação devido a alterações significativas realizadas.`,
      quotationId,
      severity: 'high',
      recipients: filteredApprovers,
      metadata: {
        quotationNumber: quotation.quotationNumber,
        version: quotation.rfqVersion
      }
    };

    await this.createNotification(notification);
  }

  async sendCriticalChangeNotification(quotationId: number, changes: any[], changedBy: number): Promise<void> {
    const recipients = await this.getNotificationRecipients(quotationId, 'critical_change');
    
    // Filter out the user who made the change
    const filteredRecipients = recipients.filter(id => id !== changedBy);
    
    if (filteredRecipients.length === 0) return;

    const quotation = await this.getQuotationDetails(quotationId);
    if (!quotation) return;

    const criticalFields = changes.filter(change => 
      ['termsAndConditions', 'technicalSpecs', 'quotationDeadline'].includes(change.field)
    );

    if (criticalFields.length === 0) return;
    
    const notification: NotificationData = {
      type: 'critical_change',
      title: `ALTERAÇÃO CRÍTICA - Cotação ${quotation.quotationNumber}`,
      message: `Alterações críticas foram realizadas na cotação: ${criticalFields.map(c => this.getFieldDisplayName(c.field)).join(', ')}`,
      quotationId,
      severity: 'critical',
      recipients: filteredRecipients,
      metadata: {
        criticalChanges: criticalFields,
        quotationNumber: quotation.quotationNumber,
        version: quotation.rfqVersion
      }
    };

    await this.createNotification(notification);
  }

  async getNotificationRecipients(quotationId: number, notificationType: string): Promise<number[]> {
    // Get quotation details to find related users
    const quotation = await db
      .select({
        purchaseRequestId: quotations.purchaseRequestId,
        createdBy: quotations.createdBy
      })
      .from(quotations)
      .where(eq(quotations.id, quotationId))
      .limit(1);

    if (!quotation.length) return [];

    // Get purchase request to find all related users
    const purchaseRequest = await db
      .select({
        requesterId: purchaseRequests.requesterId,
        approverA1Id: purchaseRequests.approverA1Id,
        approverA2Id: purchaseRequests.approverA2Id,
        buyerId: purchaseRequests.buyerId,
        receivedById: purchaseRequests.receivedById
      })
      .from(purchaseRequests)
      .where(eq(purchaseRequests.id, quotation[0].purchaseRequestId))
      .limit(1);

    if (!purchaseRequest.length) return [];

    const request = purchaseRequest[0];
    const recipients = new Set<number>();

    // Add quotation creator
    if (quotation[0].createdBy) {
      recipients.add(quotation[0].createdBy);
    }

    // Add purchase request related users based on notification type
    switch (notificationType) {
      case 'quantity_change':
      case 'critical_change':
        // Notify all stakeholders for critical changes
        if (request.requesterId) recipients.add(request.requesterId);
        if (request.approverA1Id) recipients.add(request.approverA1Id);
        if (request.approverA2Id) recipients.add(request.approverA2Id);
        if (request.buyerId) recipients.add(request.buyerId);
        break;
        
      case 'version_update':
        // Notify buyers and approvers for version updates
        if (request.buyerId) recipients.add(request.buyerId);
        if (request.approverA2Id) recipients.add(request.approverA2Id);
        break;
        
      case 'deadline_change':
        // Notify all stakeholders for deadline changes
        if (request.requesterId) recipients.add(request.requesterId);
        if (request.approverA1Id) recipients.add(request.approverA1Id);
        if (request.approverA2Id) recipients.add(request.approverA2Id);
        if (request.buyerId) recipients.add(request.buyerId);
        break;
    }

    // Also get managers and admins for critical notifications
    if (['critical_change', 'approval_required'].includes(notificationType)) {
      const managersAndAdmins = await db
        .select({ id: users.id })
        .from(users)
        .where(
          or(
            eq(users.isManager, true),
            eq(users.isAdmin, true)
          )
        );

      managersAndAdmins.forEach(user => recipients.add(user.id));
    }

    return Array.from(recipients).filter(id => id !== null && id !== undefined);
  }

  async createNotification(data: NotificationData): Promise<void> {
    // In a real implementation, this would:
    // 1. Store notification in database
    // 2. Send email notifications
    // 3. Send in-app notifications
    // 4. Send SMS for critical notifications
    // 5. Log the notification for audit trail

    console.log('📧 Notification Created:', {
      type: data.type,
      title: data.title,
      severity: data.severity,
      recipients: data.recipients.length,
      quotationId: data.quotationId
    });

    // For now, we'll just log the notification
    // In production, implement actual notification delivery
    try {
      // Store in database (implement notification table)
      // await this.storeNotification(data);
      
      // Send email notifications - verificar se está habilitado
      if (isEmailEnabled()) {
        // await this.sendEmailNotifications(data);
        console.log(`📧 [EMAIL ENABLED] Notificações por e-mail seriam enviadas para ${data.recipients.length} destinatários`);
      } else {
        console.log(`📧 [EMAIL DISABLED] Notificações por e-mail para cotação ${data.quotationId} não foram enviadas - envio de e-mails desabilitado`);
      }
      
      // Send in-app notifications
      // await this.sendInAppNotifications(data);
      
      // For critical notifications, send SMS
      if (data.severity === 'critical') {
        // await this.sendSMSNotifications(data);
      }
      
    } catch (error) {
      console.error('Error creating notification:', error);
      // Don't throw error to avoid breaking the main flow
    }
  }

  async markNotificationsSent(versionId: number): Promise<void> {
    await db
      .update(quotationVersionHistory)
      .set({ notificationsSent: true })
      .where(eq(quotationVersionHistory.id, versionId));
  }

  private async getQuotationDetails(quotationId: number) {
    const [quotation] = await db
      .select({
        quotationNumber: quotations.quotationNumber,
        rfqVersion: quotations.rfqVersion,
        purchaseRequestId: quotations.purchaseRequestId,
        status: quotations.status
      })
      .from(quotations)
      .where(eq(quotations.id, quotationId))
      .limit(1);

    return quotation;
  }

  private calculateQuantityChangeSeverity(changes: any[]): 'low' | 'medium' | 'high' | 'critical' {
    let maxPercentageChange = 0;
    
    changes.forEach(change => {
      if (change.previousValue && change.newValue) {
        const percentageChange = Math.abs(
          (change.newValue - change.previousValue) / change.previousValue * 100
        );
        maxPercentageChange = Math.max(maxPercentageChange, percentageChange);
      }
    });

    if (maxPercentageChange > 50) return 'critical';
    if (maxPercentageChange > 25) return 'high';
    if (maxPercentageChange > 10) return 'medium';
    return 'low';
  }

  private getChangeTypeSeverity(changeType: string): 'low' | 'medium' | 'high' | 'critical' {
    switch (changeType) {
      case 'terms_changed':
      case 'deadline_extended':
        return 'critical';
      case 'items_modified':
        return 'high';
      case 'updated':
        return 'medium';
      default:
        return 'low';
    }
  }

  private getChangeTypeDescription(changeType: string): string {
    switch (changeType) {
      case 'created': return 'criação da cotação';
      case 'updated': return 'atualização geral';
      case 'items_modified': return 'modificação de itens';
      case 'deadline_extended': return 'prorrogação de prazo';
      case 'terms_changed': return 'alteração de termos e condições';
      default: return 'alteração não especificada';
    }
  }

  private buildQuantityChangeMessage(changes: any[], quotation: any): string {
    const itemCount = changes.length;
    const message = `${itemCount} ${itemCount === 1 ? 'item teve sua quantidade alterada' : 'itens tiveram suas quantidades alteradas'} na cotação.`;
    
    if (itemCount <= 3) {
      const details = changes.map(change => 
        `Item: ${change.previousValue} → ${change.newValue}`
      ).join('; ');
      return `${message} Detalhes: ${details}`;
    }
    
    return message;
  }

  private getFieldDisplayName(field: string): string {
    const fieldNames: Record<string, string> = {
      'termsAndConditions': 'Termos e Condições',
      'technicalSpecs': 'Especificações Técnicas',
      'quotationDeadline': 'Prazo da Cotação',
      'quantity': 'Quantidade',
      'availableQuantity': 'Quantidade Disponível'
    };
    
    return fieldNames[field] || field;
  }
}

export const notificationService = new NotificationServiceImpl();
