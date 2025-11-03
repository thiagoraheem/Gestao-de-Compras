import { EventEmitter } from 'events';
import { WebSocketManager } from './websocket-manager.js';

interface NotificationEvent {
  resource: string;
  action: 'created' | 'updated' | 'deleted' | 'status_changed';
  entityId: string | number;
  userId?: number;
  data?: any;
  metadata?: {
    oldValue?: any;
    newValue?: any;
    changedFields?: string[];
    timestamp?: string;
  };
}

interface EventFilter {
  userId?: number;
  department?: string;
  role?: string;
  permissions?: string[];
}

interface ProcessedEvent {
  id: string;
  resource: string;
  action: string;
  data: any;
  timestamp: string;
  recipients: number[];
}

export class EventNotificationSystem extends EventEmitter {
  private wsManager: WebSocketManager;
  private eventQueue: NotificationEvent[] = [];
  private processing = false;
  private batchSize = 10;
  private batchTimeout = 100; // ms
  private eventHistory: ProcessedEvent[] = [];
  private maxHistorySize = 1000;

  constructor(wsManager: WebSocketManager) {
    super();
    this.wsManager = wsManager;
    this.startEventProcessor();
  }

  public notify(event: NotificationEvent) {
    // Adicionar timestamp se não existir
    if (!event.metadata) {
      event.metadata = {};
    }
    event.metadata.timestamp = new Date().toISOString();

    this.eventQueue.push(event);
    this.processEvents();
  }

  public notifyMultiple(events: NotificationEvent[]) {
    events.forEach(event => {
      if (!event.metadata) {
        event.metadata = {};
      }
      event.metadata.timestamp = new Date().toISOString();
    });

    this.eventQueue.push(...events);
    this.processEvents();
  }

  private async processEvents() {
    if (this.processing || this.eventQueue.length === 0) {
      return;
    }

    this.processing = true;

    try {
      while (this.eventQueue.length > 0) {
        const batch = this.eventQueue.splice(0, this.batchSize);
        await this.processBatch(batch);
        
        // Pequena pausa entre batches para não sobrecarregar
        if (this.eventQueue.length > 0) {
          await new Promise(resolve => setTimeout(resolve, this.batchTimeout));
        }
      }
    } catch (error) {
      console.error('Error processing event batch:', error);
    } finally {
      this.processing = false;
    }
  }

  private async processBatch(events: NotificationEvent[]) {
    const processedEvents: ProcessedEvent[] = [];

    for (const event of events) {
      try {
        const processedEvent = await this.processEvent(event);
        if (processedEvent) {
          processedEvents.push(processedEvent);
        }
      } catch (error) {
        console.error('Error processing individual event:', error, event);
      }
    }

    // Enviar eventos processados
    for (const processedEvent of processedEvents) {
      this.sendNotification(processedEvent);
    }

    // Adicionar ao histórico
    this.addToHistory(processedEvents);
  }

  private async processEvent(event: NotificationEvent): Promise<ProcessedEvent | null> {
    try {
      // Filtrar e transformar dados do evento baseado em permissões
      const filteredData = await this.filterEventData(event);
      
      if (!filteredData) {
        return null; // Evento filtrado/bloqueado
      }

      // Determinar destinatários
      const recipients = await this.getEventRecipients(event);

      if (recipients.length === 0) {
        return null; // Nenhum destinatário
      }

      const processedEvent: ProcessedEvent = {
        id: this.generateEventId(),
        resource: event.resource,
        action: event.action,
        data: filteredData,
        timestamp: event.metadata?.timestamp || new Date().toISOString(),
        recipients
      };

      return processedEvent;
    } catch (error) {
      console.error('Error processing event:', error);
      return null;
    }
  }

  private async filterEventData(event: NotificationEvent): Promise<any> {
    // Implementar filtragem baseada em permissões e sensibilidade dos dados
    const { resource, action, data, userId } = event;

    // Remover campos sensíveis baseado no tipo de recurso
    const filteredData = this.removeSensitiveFields(resource, data);

    // Aplicar transformações específicas por tipo de evento
    switch (resource) {
      case 'purchase_requests':
        return this.filterPurchaseRequestData(filteredData, action);
      
      case 'quotations':
        return this.filterQuotationData(filteredData, action);
      
      case 'approvals':
        return this.filterApprovalData(filteredData, action);
      
      case 'orders':
        return this.filterOrderData(filteredData, action);
      
      default:
        return filteredData;
    }
  }

  private removeSensitiveFields(resource: string, data: any): any {
    if (!data || typeof data !== 'object') {
      return data;
    }

    const sensitiveFields = this.getSensitiveFields(resource);
    const filtered = { ...data };

    sensitiveFields.forEach(field => {
      if (field in filtered) {
        delete filtered[field];
      }
    });

    return filtered;
  }

  private getSensitiveFields(resource: string): string[] {
    const sensitiveFieldsMap: Record<string, string[]> = {
      'purchase_requests': ['internal_notes', 'budget_details'],
      'quotations': ['supplier_internal_notes', 'cost_breakdown'],
      'users': ['password', 'email', 'phone'],
      'suppliers': ['contact_details', 'payment_terms']
    };

    return sensitiveFieldsMap[resource] || [];
  }

  private filterPurchaseRequestData(data: any, action: string): any {
    // Incluir apenas campos relevantes para notificação
    return {
      id: data.id,
      title: data.title,
      status: data.status,
      priority: data.priority,
      requesterId: data.requesterId,
      departmentId: data.departmentId,
      totalValue: data.totalValue,
      createdAt: data.createdAt,
      updatedAt: data.updatedAt,
      // Incluir campos específicos baseado na ação
      ...(action === 'status_changed' && {
        previousStatus: data.previousStatus,
        newStatus: data.status
      })
    };
  }

  private filterQuotationData(data: any, action: string): any {
    return {
      id: data.id,
      purchaseRequestId: data.purchaseRequestId,
      supplierId: data.supplierId,
      status: data.status,
      totalValue: data.totalValue,
      validUntil: data.validUntil,
      createdAt: data.createdAt,
      updatedAt: data.updatedAt
    };
  }

  private filterApprovalData(data: any, action: string): any {
    return {
      id: data.id,
      entityType: data.entityType,
      entityId: data.entityId,
      approverId: data.approverId,
      status: data.status,
      level: data.level,
      createdAt: data.createdAt,
      updatedAt: data.updatedAt
    };
  }

  private filterOrderData(data: any, action: string): any {
    return {
      id: data.id,
      purchaseRequestId: data.purchaseRequestId,
      supplierId: data.supplierId,
      status: data.status,
      totalValue: data.totalValue,
      deliveryDate: data.deliveryDate,
      createdAt: data.createdAt,
      updatedAt: data.updatedAt
    };
  }

  private async getEventRecipients(event: NotificationEvent): Promise<number[]> {
    const { resource, action, userId, data } = event;
    const recipients = new Set<number>();

    // Lógica para determinar quem deve receber a notificação
    switch (resource) {
      case 'purchase_requests':
        // Notificar criador, aprovadores, e usuários do departamento
        if (data.requesterId) recipients.add(data.requesterId);
        if (data.departmentId) {
          const departmentUsers = await this.getDepartmentUsers(data.departmentId);
          departmentUsers.forEach(userId => recipients.add(userId));
        }
        
        // Adicionar aprovadores baseado no nível
        const approvers = await this.getApproversForLevel(data.approvalLevel || 1);
        approvers.forEach(userId => recipients.add(userId));
        break;

      case 'quotations':
        // Notificar compradores e criador da solicitação
        const purchaseRequest = await this.getPurchaseRequest(data.purchaseRequestId);
        if (purchaseRequest?.requesterId) {
          recipients.add(purchaseRequest.requesterId);
        }
        
        const buyers = await this.getBuyersForDepartment(purchaseRequest?.departmentId);
        buyers.forEach(userId => recipients.add(userId));
        break;

      case 'approvals':
        // Notificar o aprovador específico e o criador
        if (data.approverId) recipients.add(data.approverId);
        if (data.createdBy) recipients.add(data.createdBy);
        break;

      case 'orders':
        // Notificar compradores, recebedores e criador da solicitação
        const orderPurchaseRequest = await this.getPurchaseRequest(data.purchaseRequestId);
        if (orderPurchaseRequest?.requesterId) {
          recipients.add(orderPurchaseRequest.requesterId);
        }
        
        const receivers = await this.getReceiversForDepartment(orderPurchaseRequest?.departmentId);
        receivers.forEach(userId => recipients.add(userId));
        break;
    }

    // Remover o usuário que causou o evento (opcional)
    if (userId && action !== 'created') {
      recipients.delete(userId);
    }

    return Array.from(recipients);
  }

  private sendNotification(processedEvent: ProcessedEvent) {
    // Enviar via WebSocket para usuários conectados
    this.wsManager.notifyClients(
      processedEvent.resource,
      processedEvent.action,
      processedEvent.data
    );

    // Enviar notificação específica para usuários
    processedEvent.recipients.forEach(userId => {
      this.wsManager.sendToUser(userId, {
        type: 'user_notification',
        event: processedEvent,
        timestamp: processedEvent.timestamp
      });
    });

    // Emitir evento interno para outros sistemas
    this.emit('notification_sent', processedEvent);
  }

  private addToHistory(events: ProcessedEvent[]) {
    this.eventHistory.push(...events);
    
    // Manter apenas os últimos N eventos
    if (this.eventHistory.length > this.maxHistorySize) {
      this.eventHistory = this.eventHistory.slice(-this.maxHistorySize);
    }
  }

  private generateEventId(): string {
    return `evt_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  // Métodos auxiliares para buscar dados (devem ser implementados conforme o banco de dados)
  private async getDepartmentUsers(departmentId: number): Promise<number[]> {
    // TODO: Implementar busca de usuários do departamento
    return [];
  }

  private async getApproversForLevel(level: number): Promise<number[]> {
    // TODO: Implementar busca de aprovadores por nível
    return [];
  }

  private async getPurchaseRequest(id: number): Promise<any> {
    // TODO: Implementar busca de solicitação de compra
    return null;
  }

  private async getBuyersForDepartment(departmentId?: number): Promise<number[]> {
    // TODO: Implementar busca de compradores do departamento
    return [];
  }

  private async getReceiversForDepartment(departmentId?: number): Promise<number[]> {
    // TODO: Implementar busca de recebedores do departamento
    return [];
  }

  // Métodos públicos para controle
  public getQueueSize(): number {
    return this.eventQueue.length;
  }

  public isProcessing(): boolean {
    return this.processing;
  }

  public getEventHistory(limit?: number): ProcessedEvent[] {
    if (limit) {
      return this.eventHistory.slice(-limit);
    }
    return [...this.eventHistory];
  }

  public clearHistory() {
    this.eventHistory = [];
  }

  public getStats() {
    return {
      queueSize: this.getQueueSize(),
      isProcessing: this.isProcessing(),
      historySize: this.eventHistory.length,
      totalProcessed: this.eventHistory.length,
      uptime: process.uptime()
    };
  }

  private startEventProcessor() {
    // Processar eventos periodicamente mesmo se não houver novos
    setInterval(() => {
      if (this.eventQueue.length > 0) {
        this.processEvents();
      }
    }, 1000);
  }
}