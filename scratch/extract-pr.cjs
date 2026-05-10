const fs = require('fs');

try {
  const content = fs.readFileSync('server/storage.ts', 'utf8');

  const startMarker = '  async getAllPurchaseRequests(';
  const endMarker = '  // RFQ (Quotation) operations';

  const startIndex = content.indexOf(startMarker);
  const endIndex = content.indexOf(endMarker);

  if (startIndex === -1 || endIndex === -1) {
    console.log('Markers not found', { startIndex, endIndex });
    process.exit(1);
  }

  // Extract the methods
  let methods = content.substring(startIndex, endIndex);

  // We need to add the class wrapper and imports
  const repoContent = `import { db, pool } from "../db";
import { 
  purchaseRequests, 
  purchaseRequestItems, 
  users, 
  departments, 
  costCenters, 
  suppliers, 
  purchaseOrders, 
  quotations, 
  supplierQuotations,
  receipts
} from "../../shared/schema";
import { eq, desc, and, or, inArray, like, isNull, sql } from "drizzle-orm";
import type { 
  PurchaseRequest, 
  InsertPurchaseRequest, 
  PurchaseRequestItem, 
  InsertPurchaseRequestItem,
  User,
  PurchaseRequestWithDetails
} from "../../shared/schema";
import { CalculadoraValoresSolicitacao, ItemCalculo } from "../utils/calculadora-valores";
import { userRepository } from "./user-repository";

export class PurchaseRequestRepository {
  async getUserDepartments(userId: number): Promise<number[]> {
    return await userRepository.getUserDepartments(userId);
  }

${methods}
}

export const purchaseRequestRepository = new PurchaseRequestRepository();
`;

  fs.writeFileSync('server/repositories/purchase-request-repository.ts', repoContent);

  // Now update storage.ts
  // Replace the extracted methods with facade calls

  const facadeMethods = `  async getAllPurchaseRequests(companyId?: number, user?: User): Promise<PurchaseRequest[]> {
    return await purchaseRequestRepository.getAllPurchaseRequests(companyId, user);
  }

  async getPurchaseRequestById(id: number): Promise<PurchaseRequest | undefined> {
    return await purchaseRequestRepository.getPurchaseRequestById(id);
  }

  async getPurchaseRequestByNumber(requestNumber: string): Promise<PurchaseRequest | undefined> {
    return await purchaseRequestRepository.getPurchaseRequestByNumber(requestNumber);
  }

  async createPurchaseRequest(request: InsertPurchaseRequest): Promise<PurchaseRequest> {
    return await purchaseRequestRepository.createPurchaseRequest(request);
  }

  async updatePurchaseRequest(id: number, request: Partial<InsertPurchaseRequest>): Promise<PurchaseRequest> {
    return await purchaseRequestRepository.updatePurchaseRequest(id, request);
  }

  async getPurchaseRequestsByPhase(phase: string): Promise<PurchaseRequestWithDetails[]> {
    return await purchaseRequestRepository.getPurchaseRequestsByPhase(phase);
  }

  async getPendingMaterialsForConference(): Promise<PurchaseRequestWithDetails[]> {
    return await purchaseRequestRepository.getPendingMaterialsForConference();
  }

  async getPurchaseRequestsByUser(userId: number): Promise<PurchaseRequest[]> {
    return await purchaseRequestRepository.getPurchaseRequestsByUser(userId);
  }

  async getPurchaseRequestsForReport(filters: any): Promise<{ data: any[]; total: number; summary?: any }> {
    return await purchaseRequestRepository.getPurchaseRequestsForReport(filters);
  }

  async getQuotationsDashboardData(): Promise<any> {
    return await purchaseRequestRepository.getQuotationsDashboardData();
  }

  async getPurchaseRequestItems(purchaseRequestId: number, includeTransferred: boolean = false): Promise<PurchaseRequestItem[]> {
    return await purchaseRequestRepository.getPurchaseRequestItems(purchaseRequestId, includeTransferred);
  }

  async createPurchaseRequestItem(item: InsertPurchaseRequestItem): Promise<PurchaseRequestItem> {
    return await purchaseRequestRepository.createPurchaseRequestItem(item);
  }

  async updatePurchaseRequestItem(id: number, item: Partial<InsertPurchaseRequestItem>): Promise<PurchaseRequestItem> {
    return await purchaseRequestRepository.updatePurchaseRequestItem(id, item);
  }

  async deletePurchaseRequestItem(id: number): Promise<void> {
    return await purchaseRequestRepository.deletePurchaseRequestItem(id);
  }

  async createPurchaseRequestItems(items: InsertPurchaseRequestItem[]): Promise<PurchaseRequestItem[]> {
    return await purchaseRequestRepository.createPurchaseRequestItems(items);
  }
`;

  const newStorageContent = content.substring(0, startIndex) + facadeMethods + '\n' + content.substring(endIndex);
  fs.writeFileSync('server/storage.ts', newStorageContent);

  console.log('Successfully extracted PurchaseRequestRepository');
} catch (e) {
  console.error(e);
}
