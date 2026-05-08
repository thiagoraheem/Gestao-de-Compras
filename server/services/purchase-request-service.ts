import { storage } from "../storage";
import { 
  insertPurchaseRequestSchema, 
  insertPurchaseRequestItemSchema 
} from "../../shared/schema";
import { isInvalidDescription } from "../utils/validate-description";
import { notifyNewRequest } from "../email-service";
import { invalidateCache } from "../cache";
import { realtime } from "../realtime";
import { REALTIME_CHANNELS, PURCHASE_REQUEST_EVENTS } from "../../shared/realtime-events";

export class PurchaseRequestService {
  async createRequest(data: any): Promise<any> {
    const { items, ...requestData } = data;

    // Validate request data
    const validatedRequestData = insertPurchaseRequestSchema.parse(requestData);

    // Validate items
    if (!items || !Array.isArray(items) || items.length === 0) {
      throw new Error("Adicione pelo menos um item à solicitação");
    }

    const validatedItems = items.map((item: any) => {
      return insertPurchaseRequestItemSchema.parse({
        ...item,
        purchaseRequestId: 0,
        productCode: item.productCode || null,
        description: item.description || "",
        unit: item.unit || "",
        requestedQuantity: item.requestedQuantity || 0,
        technicalSpecification: item.technicalSpecification || null,
        price: item.price || null,
        partNumber: item.partNumber || null,
      });
    });

    // Category specific validations
    this.validateItemsByCategory(validatedRequestData.category, validatedItems);

    // Create the request
    const request = await storage.createPurchaseRequest(validatedRequestData);

    // Create items
    const itemsWithRequestId = validatedItems.map((item) => ({
      ...item,
      purchaseRequestId: request.id,
    }));

    for (const item of itemsWithRequestId) {
      await storage.createPurchaseRequestItem(item);
    }

    // Notifications
    notifyNewRequest(request).catch((error) => {
      console.error("Erro ao enviar notificação de nova solicitação:", error);
    });

    invalidateCache(["/api/purchase-requests"]);

    realtime.publish(REALTIME_CHANNELS.PURCHASE_REQUESTS, {
      event: PURCHASE_REQUEST_EVENTS.CREATED,
      payload: {
        request: {
          id: request.id,
          requestNumber: request.requestNumber,
          currentPhase: request.currentPhase,
          totalValue: request.totalValue,
          updatedAt: request.updatedAt,
        },
      },
    });

    return request;
  }

  async updateRequest(id: number, data: any): Promise<any> {
    const { items, ...requestData } = data;

    const existingRequest = await storage.getPurchaseRequestById(id);
    if (!existingRequest) {
      throw new Error("Solicitação não encontrada");
    }

    const validatedRequestData = insertPurchaseRequestSchema.partial().parse(requestData);
    const category = validatedRequestData.category || existingRequest.category;

    if (items && Array.isArray(items)) {
      if (items.length === 0) {
        throw new Error("Adicione pelo menos um item à solicitação");
      }

      const validatedItems = items.map((item) =>
        insertPurchaseRequestItemSchema.parse({
          ...item,
          purchaseRequestId: id,
        })
      );

      this.validateItemsByCategory(category, validatedItems);

      // Update items: delete existing and create new ones
      const existingItems = await storage.getPurchaseRequestItems(id);
      for (const item of existingItems) {
        await storage.deletePurchaseRequestItem(item.id);
      }
      await storage.createPurchaseRequestItems(validatedItems);
    }

    const updatedRequest = await storage.updatePurchaseRequest(id, validatedRequestData);

    invalidateCache(["/api/purchase-requests"]);

    realtime.publish(REALTIME_CHANNELS.PURCHASE_REQUESTS, {
      event: PURCHASE_REQUEST_EVENTS.UPDATED,
      payload: { id, updatedAt: updatedRequest.updatedAt },
    });

    return updatedRequest;
  }

  private validateItemsByCategory(category: string, items: any[]) {
    if (category === "produto") {
      const missingErpProduct = items.some(
        (item) => !item.productCode || String(item.productCode).trim() === ""
      );
      if (missingErpProduct) {
        throw new Error("Para a categoria Produto, todos os itens devem ser selecionados a partir da busca no ERP.");
      }
    } else if (["servico", "material", "outros"].includes(category)) {
      const invalidItem = items.some((item) => isInvalidDescription(item.description as string));
      if (invalidItem) {
        const catLabel = category === "servico" ? "Serviço" : category === "material" ? "Material" : "Outros";
        throw new Error(`Para ${catLabel}, a descrição dos itens deve ter pelo menos 10 caracteres e não pode conter caracteres inválidos.`);
      }
    }
  }
}

export const purchaseRequestService = new PurchaseRequestService();
