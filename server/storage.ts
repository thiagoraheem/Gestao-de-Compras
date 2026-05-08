import { CalculadoraValoresSolicitacao, ItemCalculo } from "../shared/utils/CalculadoraValoresSolicitacao";
import crypto from "crypto";
import {
  users,
  companies,
  departments,
  costCenters,
  userDepartments,
  userCostCenters,
  suppliers,
  paymentMethods,
  purchaseRequests,
  purchaseRequestItems,
  deliveryLocations,
  quotations,
  quotationItems,
  supplierQuotations,
  supplierQuotationItems,
  purchaseOrders,
  purchaseOrderItems,
  receipts,
  receiptItems,
  attachments,
  approvalHistory,
  approvalConfigurations,
  configurationHistory,
  auditLogs,
  quantityAdjustmentHistory,
  type User,
  type InsertUser,
  type Company,
  type InsertCompany,
  type Department,
  type InsertDepartment,
  type CostCenter,
  type InsertCostCenter,
  type Supplier,
  type InsertSupplier,
  type PurchaseRequest,
  type InsertPurchaseRequest,
  type PurchaseRequestItem,
  type InsertPurchaseRequestItem,
  type PaymentMethod,
  type InsertPaymentMethod,
  type DeliveryLocation,
  type InsertDeliveryLocation,
  type Quotation,
  type InsertQuotation,
  type QuotationItem,
  type InsertQuotationItem,
  type SupplierQuotation,
  type InsertSupplierQuotation,
  type SupplierQuotationItem,
  type InsertSupplierQuotationItem,
  type PurchaseOrder,
  type InsertPurchaseOrder,
  type PurchaseOrderItem,
  type InsertPurchaseOrderItem,
  type ApprovalHistory,
  type InsertApprovalHistory,
  type Attachment,
  type InsertAttachment,
  type ApprovalConfiguration,
  type InsertApprovalConfiguration,
  type ConfigurationHistory,
  type InsertConfigurationHistory,
  type Receipt,
  type InsertReceipt,
  type ReceiptItem,
  type InsertReceiptItem,
  receiptNfXmls,
  receiptInstallments,
  receiptAllocations,
  approvedQuotationItems,
  quotationVersionHistory,
  type ApprovedQuotationItem,
  type InsertApprovedQuotationItem,
  type PurchaseRequestWithDetails,
} from "../shared/schema";
import { db, pool } from "./db";
import { eq, and, desc, like, sql, gt, count, or, isNull, inArray } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import bcrypt from "bcryptjs";
import { companyRepository } from "./repositories/company-repository";
import { departmentRepository } from "./repositories/department-repository";
import { userRepository } from "./repositories/user-repository";
import { supplierRepository } from "./repositories/supplier-repository";
import { quotationRepository } from "./repositories/quotation-repository";
import { purchaseOrderRepository } from "./repositories/purchase-order-repository";
import { receiptRepository } from "./repositories/receipt-repository";
import { purchaseRequestRepository } from "./repositories/purchase-request-repository";
import { approvalRepository } from "./repositories/approval-repository";
import { systemRepository } from "./repositories/system-repository";
import { timelineService } from "./services/timeline-service";

export interface IStorage {
  // Company operations
  getAllCompanies(): Promise<Company[]>;
  getCompanyById(id: number): Promise<Company | undefined>;
  createCompany(company: InsertCompany): Promise<Company>;
  updateCompany(id: number, company: Partial<InsertCompany>): Promise<Company>;
  deleteCompany(id: number): Promise<void>;

  // User operations
  getUser(id: number): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  getUserByEmail(email: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;
  updateUser(id: number, user: Partial<InsertUser>): Promise<User>;
  getAllUsers(): Promise<User[]>;

  // Department operations
  getAllDepartments(): Promise<Department[]>;
  createDepartment(department: InsertDepartment): Promise<Department>;
  getDepartmentById(id: number): Promise<Department | undefined>;
  updateDepartment(
    id: number,
    department: Partial<InsertDepartment>,
  ): Promise<Department>;
  checkDepartmentCanBeDeleted(
    id: number,
  ): Promise<{
    canDelete: boolean;
    reason?: string;
    associatedCostCenters?: number;
    associatedUsers?: number;
  }>;
  deleteDepartment(id: number): Promise<void>;

  // Cost Center operations
  getAllCostCenters(): Promise<CostCenter[]>;
  getCostCenterById(id: number): Promise<CostCenter | undefined>;
  getCostCentersByDepartment(departmentId: number): Promise<CostCenter[]>;
  createCostCenter(costCenter: InsertCostCenter): Promise<CostCenter>;
  updateCostCenter(
    id: number,
    costCenter: Partial<InsertCostCenter>,
  ): Promise<CostCenter>;
  checkCostCenterCanBeDeleted(
    id: number,
  ): Promise<{
    canDelete: boolean;
    reason?: string;
    associatedUsers?: number;
    associatedRequests?: number;
  }>;
  deleteCostCenter(id: number): Promise<void>;

  // User delete operations
  deleteUser(id: number): Promise<void>;
  checkUserCanBeDeleted(
    id: number,
  ): Promise<{
    canDelete: boolean;
    reason?: string;
    associatedRequests?: number;
  }>;

  // User Department associations
  getUserDepartments(userId: number): Promise<number[]>;
  assignUserToDepartment(userId: number, departmentId: number): Promise<void>;
  removeUserFromDepartment(userId: number, departmentId: number): Promise<void>;

  // User Cost Center associations
  getUserCostCenters(userId: number): Promise<number[]>;
  assignUserToCostCenter(userId: number, costCenterId: number): Promise<void>;
  removeUserFromCostCenter(userId: number, costCenterId: number): Promise<void>;
  setUserCostCenters(userId: number, costCenterIds: number[]): Promise<void>;

  // Supplier operations
  getAllSuppliers(): Promise<Supplier[]>;
  createSupplier(supplier: InsertSupplier): Promise<Supplier>;
  getSupplierById(id: number): Promise<Supplier | undefined>;
  updateSupplier(
    id: number,
    supplier: Partial<InsertSupplier>,
  ): Promise<Supplier>;

  // Payment Method operations
  getAllPaymentMethods(): Promise<PaymentMethod[]>;
  createPaymentMethod(
    paymentMethod: InsertPaymentMethod,
  ): Promise<PaymentMethod>;

  // Delivery Location operations
  getAllDeliveryLocations(): Promise<DeliveryLocation[]>;
  getDeliveryLocationById(id: number): Promise<DeliveryLocation | undefined>;
  createDeliveryLocation(
    deliveryLocation: InsertDeliveryLocation,
  ): Promise<DeliveryLocation>;
  updateDeliveryLocation(
    id: number,
    deliveryLocation: Partial<InsertDeliveryLocation>,
  ): Promise<DeliveryLocation>;
  deleteDeliveryLocation(id: number): Promise<void>;

  // Purchase Request operations
  getAllPurchaseRequests(companyId?: number, user?: User): Promise<PurchaseRequest[]>;
  getPurchaseRequestById(id: number): Promise<PurchaseRequest | undefined>;
  getPurchaseRequestByNumber(requestNumber: string): Promise<PurchaseRequest | undefined>;
  createPurchaseRequest(
    request: InsertPurchaseRequest,
  ): Promise<PurchaseRequest>;
  updatePurchaseRequest(
    id: number,
    request: Partial<InsertPurchaseRequest>,
  ): Promise<PurchaseRequest>;
  getPurchaseRequestsByPhase(phase: string): Promise<PurchaseRequestWithDetails[]>;
  getPurchaseRequestsByUser(userId: number): Promise<PurchaseRequest[]>;
  getPurchaseRequestsForReport(filters: any): Promise<{ data: any[]; total: number; summary?: any }>;
  getQuotationsDashboardData(): Promise<any>;
  deletePurchaseRequest(id: number): Promise<void>;

  // Purchase Request Items operations
  getPurchaseRequestItems(
    purchaseRequestId: number,
    includeTransferred?: boolean
  ): Promise<PurchaseRequestItem[]>;
  createPurchaseRequestItem(
    item: InsertPurchaseRequestItem,
  ): Promise<PurchaseRequestItem>;
  updatePurchaseRequestItem(
    id: number,
    item: Partial<InsertPurchaseRequestItem>,
  ): Promise<PurchaseRequestItem>;
  deletePurchaseRequestItem(id: number): Promise<void>;
  createPurchaseRequestItems(
    items: InsertPurchaseRequestItem[],
  ): Promise<PurchaseRequestItem[]>;

  // RFQ (Quotation) operations
  getAllQuotations(): Promise<Quotation[]>;
  getQuotationById(id: number): Promise<Quotation | undefined>;
  getQuotationByPurchaseRequestId(
    purchaseRequestId: number,
  ): Promise<Quotation | undefined>;
  getRFQHistoryByPurchaseRequestId(
    purchaseRequestId: number,
  ): Promise<Quotation[]>;
  createQuotation(quotation: InsertQuotation): Promise<Quotation>;
  updateQuotation(
    id: number,
    quotation: Partial<InsertQuotation>,
  ): Promise<Quotation>;
  deleteQuotation(id: number): Promise<void>;

  // Quotation Items operations
  getQuotationItems(quotationId: number): Promise<QuotationItem[]>;
  createQuotationItem(item: InsertQuotationItem): Promise<QuotationItem>;
  createQuotationItems(items: InsertQuotationItem[]): Promise<QuotationItem[]>;
  updateQuotationItem(
    id: number,
    item: Partial<InsertQuotationItem>,
  ): Promise<QuotationItem>;
  deleteQuotationItem(id: number): Promise<void>;

  // Supplier Quotations operations
  getSupplierQuotations(quotationId: number): Promise<SupplierQuotation[]>;
  getSupplierQuotationById(id: number): Promise<SupplierQuotation | undefined>;
  createSupplierQuotation(
    supplierQuotation: InsertSupplierQuotation,
  ): Promise<SupplierQuotation>;
  updateSupplierQuotation(
    id: number,
    supplierQuotation: Partial<InsertSupplierQuotation>,
  ): Promise<SupplierQuotation>;

  // Supplier Quotation Items operations
  getSupplierQuotationItems(
    supplierQuotationId: number,
  ): Promise<SupplierQuotationItem[]>;
  createSupplierQuotationItem(
    item: InsertSupplierQuotationItem,
  ): Promise<SupplierQuotationItem>;
  createSupplierQuotationItems(
    items: InsertSupplierQuotationItem[],
  ): Promise<SupplierQuotationItem[]>;
  updateSupplierQuotationItem(
    id: number,
    item: Partial<InsertSupplierQuotationItem>,
  ): Promise<SupplierQuotationItem>;

  // Approved Quotation Items (Snapshot) operations
  getApprovedQuotationItems(quotationId: number): Promise<ApprovedQuotationItem[]>;
  createApprovedQuotationItem(item: InsertApprovedQuotationItem): Promise<ApprovedQuotationItem>;
  clearApprovedQuotationItems(quotationId: number): Promise<void>;

  // Quantity Adjustment History operations
  createQuantityAdjustmentHistory(
    history: any,
  ): Promise<any>;

  getPendingMaterialsForConference(): Promise<PurchaseRequestWithDetails[]>;

  // Purchase Order operations
  getPurchaseOrderById(id: number): Promise<PurchaseOrder | undefined>;
  getPurchaseOrderByRequestId(purchaseRequestId: number): Promise<PurchaseOrder | undefined>;
  createPurchaseOrder(purchaseOrder: InsertPurchaseOrder): Promise<PurchaseOrder>;
  updatePurchaseOrder(
    id: number,
    purchaseOrder: Partial<InsertPurchaseOrder>,
  ): Promise<PurchaseOrder>;

  // Purchase Order Items operations
  getPurchaseOrderItems(purchaseOrderId: number): Promise<PurchaseOrderItem[]>;
  createPurchaseOrderItem(item: InsertPurchaseOrderItem): Promise<PurchaseOrderItem>;
  updatePurchaseOrderItem(
    id: number,
    item: Partial<InsertPurchaseOrderItem>,
  ): Promise<PurchaseOrderItem>;

  // Receipts operations
  createReceipt(receipt: InsertReceipt): Promise<Receipt>;
  createReceiptItem(item: InsertReceiptItem): Promise<ReceiptItem>;
  getReceiptsByPurchaseOrderId(purchaseOrderId: number): Promise<Receipt[]>;
  getReceiptById(id: number): Promise<Receipt | undefined>;
  returnToPhysicalReceipt(purchaseRequestId: number, userId: number): Promise<void>;

  // Approval History operations
  getApprovalHistory(purchaseRequestId: number): Promise<any[]>;
  getApprovalHistoryByRequestId(requestId: number): Promise<ApprovalHistory[]>;
  createApprovalHistory(
    approvalHistory: InsertApprovalHistory,
  ): Promise<ApprovalHistory>;
  
  // Value-based approval system operations
  getActiveApprovalConfiguration(): Promise<ApprovalConfiguration | undefined>;
  getCEOAndDirectors(): Promise<User[]>;
  getA2Approvers(): Promise<User[]>;
  createApprovalHistoryWithStep(history: InsertApprovalHistory & { 
    approvalStep: string; 
    approvalValue: string; 
    requiresDualApproval: boolean; 
    ipAddress: string; 
    userAgent: string; 
  }): Promise<ApprovalHistory>;
  createApprovalConfiguration(config: InsertApprovalConfiguration): Promise<ApprovalConfiguration>;
  getConfigurationHistory(): Promise<ConfigurationHistory[]>;
  getUserById(id: number): Promise<User | undefined>;

  // Complete Timeline operations
  getCompleteTimeline(purchaseRequestId: number): Promise<any[]>;

  // Attachment operations
  createAttachment(attachment: InsertAttachment): Promise<Attachment>;
  getAttachmentsByPurchaseRequestId(purchaseRequestId: number): Promise<Attachment[]>;

  // Initialize default data
  initializeDefaultData(): Promise<void>;

  // Method to cleanup Purchase Requests data
  cleanupPurchaseRequestsData(): Promise<void>;

  // Item Search for Reports
  getDistinctItemDescriptions(query?: string): Promise<string[]>;

  // Password reset methods
  generatePasswordResetToken(email: string): Promise<string | null>;
  validatePasswordResetToken(token: string): Promise<User | null>;
  resetPassword(token: string, newPassword: string): Promise<boolean>;
}

// Create aliases for user tables
const requesterUser = alias(users, "requester_user");
const approverA1User = alias(users, "approver_a1_user");
const chosenSupplier = alias(suppliers, "chosen_supplier");

export class DatabaseStorage implements IStorage {
  // Company operations
  async getAllCompanies(): Promise<Company[]> {
    return await companyRepository.getAllCompanies();
  }

  async getCompanyById(id: number): Promise<Company | undefined> {
    return await companyRepository.getCompanyById(id);
  }

  async createCompany(company: InsertCompany): Promise<Company> {
    return await companyRepository.createCompany(company);
  }

  async updateCompany(id: number, company: Partial<InsertCompany>): Promise<Company> {
    return await companyRepository.updateCompany(id, company);
  }

  async deleteCompany(id: number): Promise<void> {
    return await companyRepository.deleteCompany(id);
  }

  // User operations
  async getUser(id: number): Promise<User | undefined> {
    return await userRepository.getUser(id);
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    return await userRepository.getUserByUsername(username);
  }

  async getUserByEmail(email: string): Promise<User | undefined> {
    return await userRepository.getUserByEmail(email);
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    return await userRepository.createUser(insertUser);
  }

  async updateUser(id: number, updateData: Partial<InsertUser>): Promise<User> {
    return await userRepository.updateUser(id, updateData);
  }

  async getAllUsers(): Promise<User[]> {
    return await userRepository.getAllUsers();
  }

  async deleteUser(id: number): Promise<void> {
    return await userRepository.deleteUser(id);
  }

  async checkUserCanBeDeleted(
    id: number,
  ): Promise<{
    canDelete: boolean;
    reason?: string;
    associatedRequests?: number;
  }> {
    return await userRepository.checkUserCanBeDeleted(id);
  }

  // Department operations
  async getAllDepartments(companyId?: number): Promise<Department[]> {
    return await departmentRepository.getAllDepartments(companyId);
  }

  async createDepartment(department: InsertDepartment): Promise<Department> {
    return await departmentRepository.createDepartment(department);
  }

  async getDepartmentById(id: number): Promise<Department | undefined> {
    return await departmentRepository.getDepartmentById(id);
  }

  async updateDepartment(
    id: number,
    updateData: Partial<InsertDepartment>,
  ): Promise<Department> {
    return await departmentRepository.updateDepartment(id, updateData);
  }

  async checkDepartmentCanBeDeleted(
    id: number,
  ): Promise<{
    canDelete: boolean;
    reason?: string;
    associatedCostCenters?: number;
    associatedUsers?: number;
  }> {
    return await departmentRepository.checkDepartmentCanBeDeleted(id);
  }

  async deleteDepartment(id: number): Promise<void> {
    return await departmentRepository.deleteDepartment(id);
  }

  // Cost Center operations
  async getAllCostCenters(): Promise<CostCenter[]> {
    return await departmentRepository.getAllCostCenters();
  }

  async getCostCenterById(id: number): Promise<CostCenter | undefined> {
    return await departmentRepository.getCostCenterById(id);
  }

  async getCostCentersByDepartment(
    departmentId: number,
  ): Promise<CostCenter[]> {
    return await departmentRepository.getCostCentersByDepartment(departmentId);
  }

  async createCostCenter(costCenter: InsertCostCenter): Promise<CostCenter> {
    return await departmentRepository.createCostCenter(costCenter);
  }

  async updateCostCenter(
    id: number,
    updateData: Partial<InsertCostCenter>,
  ): Promise<CostCenter> {
    return await departmentRepository.updateCostCenter(id, updateData);
  }

  async checkCostCenterCanBeDeleted(
    id: number,
  ): Promise<{
    canDelete: boolean;
    reason?: string;
    associatedUsers?: number;
    associatedRequests?: number;
  }> {
    return await departmentRepository.checkCostCenterCanBeDeleted(id);
  }

  async deleteCostCenter(id: number): Promise<void> {
    return await departmentRepository.deleteCostCenter(id);
  }

  async getUserDepartments(userId: number): Promise<number[]> {
    return await userRepository.getUserDepartments(userId);
  }

  async assignUserToDepartment(
    userId: number,
    departmentId: number,
  ): Promise<void> {
    return await userRepository.assignUserToDepartment(userId, departmentId);
  }

  async removeUserFromDepartment(
    userId: number,
    departmentId: number,
  ): Promise<void> {
    return await userRepository.removeUserFromDepartment(userId, departmentId);
  }

  async getUserCostCenters(userId: number): Promise<number[]> {
    return await userRepository.getUserCostCenters(userId);
  }

  async assignUserToCostCenter(
    userId: number,
    costCenterId: number,
  ): Promise<void> {
    return await userRepository.assignUserToCostCenter(userId, costCenterId);
  }

  async removeUserFromCostCenter(
    userId: number,
    costCenterId: number,
  ): Promise<void> {
    return await userRepository.removeUserFromCostCenter(userId, costCenterId);
  }

  async setUserCostCenters(
    userId: number,
    costCenterIds: number[],
  ): Promise<void> {
    return await userRepository.setUserCostCenters(userId, costCenterIds);
  }

  async getAllSuppliers(companyId?: number): Promise<Supplier[]> {
    return await supplierRepository.getAllSuppliers(companyId);
  }

  async createSupplier(supplier: InsertSupplier): Promise<Supplier> {
    return await supplierRepository.createSupplier(supplier);
  }

  async getSupplierById(id: number): Promise<Supplier | undefined> {
    return await supplierRepository.getSupplierById(id);
  }

  async updateSupplier(
    id: number,
    supplier: Partial<InsertSupplier>,
  ): Promise<Supplier> {
    return await supplierRepository.updateSupplier(id, supplier);
  }

  async getAllPaymentMethods(): Promise<PaymentMethod[]> {
    return await systemRepository.getAllPaymentMethods();
  }

  async createPaymentMethod(
    paymentMethod: InsertPaymentMethod,
  ): Promise<PaymentMethod> {
    return await systemRepository.createPaymentMethod(paymentMethod);
  }

  async getAllDeliveryLocations(): Promise<DeliveryLocation[]> {
    return await systemRepository.getAllDeliveryLocations();
  }

  async getDeliveryLocationById(
    id: number,
  ): Promise<DeliveryLocation | undefined> {
    return await systemRepository.getDeliveryLocationById(id);
  }

  async createDeliveryLocation(
    deliveryLocation: InsertDeliveryLocation,
  ): Promise<DeliveryLocation> {
    return await systemRepository.createDeliveryLocation(deliveryLocation);
  }

  async updateDeliveryLocation(
    id: number,
    deliveryLocation: Partial<InsertDeliveryLocation>,
  ): Promise<DeliveryLocation> {
    return await systemRepository.updateDeliveryLocation(id, deliveryLocation);
  }

  async deleteDeliveryLocation(id: number): Promise<void> {
    return await systemRepository.deleteDeliveryLocation(id);
  }

  // Purchase Request operations
  async getAllPurchaseRequests(companyId?: number, user?: User): Promise<PurchaseRequest[]> {
    return await purchaseRequestRepository.getAllPurchaseRequests(companyId, user);
  }

  async getPurchaseRequestById(
    id: number,
  ): Promise<PurchaseRequest | undefined> {
    return await purchaseRequestRepository.getPurchaseRequestById(id);
  }

  async getPurchaseRequestByNumber(requestNumber: string): Promise<PurchaseRequest | undefined> {
    return await purchaseRequestRepository.getPurchaseRequestByNumber(requestNumber);
  }

  async createPurchaseRequest(
    request: InsertPurchaseRequest,
  ): Promise<PurchaseRequest> {
    return await purchaseRequestRepository.createPurchaseRequest(request);
  }

  async updatePurchaseRequest(
    id: number,
    request: Partial<InsertPurchaseRequest>,
  ): Promise<PurchaseRequest> {
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

  async deletePurchaseRequest(id: number): Promise<void> {
    return await purchaseRequestRepository.deletePurchaseRequest(id);
  }

  // Purchase Request Items operations
  async getPurchaseRequestItems(
    purchaseRequestId: number,
    includeTransferred: boolean = false
  ): Promise<PurchaseRequestItem[]> {
    return await purchaseRequestRepository.getPurchaseRequestItems(purchaseRequestId, includeTransferred);
  }

  async createPurchaseRequestItem(
    item: InsertPurchaseRequestItem,
  ): Promise<PurchaseRequestItem> {
    return await purchaseRequestRepository.createPurchaseRequestItem(item);
  }

  async updatePurchaseRequestItem(
    id: number,
    item: Partial<InsertPurchaseRequestItem>,
  ): Promise<PurchaseRequestItem> {
    return await purchaseRequestRepository.updatePurchaseRequestItem(id, item);
  }

  async deletePurchaseRequestItem(id: number): Promise<void> {
    return await purchaseRequestRepository.deletePurchaseRequestItem(id);
  }

  async createPurchaseRequestItems(
    items: InsertPurchaseRequestItem[],
  ): Promise<PurchaseRequestItem[]> {
    return await purchaseRequestRepository.createPurchaseRequestItems(items);
  }

  // RFQ (Quotation) operations
  async getAllQuotations(): Promise<Quotation[]> {
    return await quotationRepository.getAllQuotations();
  }

  async getQuotationById(id: number): Promise<Quotation | undefined> {
    return await quotationRepository.getQuotationById(id);
  }

  async getQuotationByPurchaseRequestId(
    purchaseRequestId: number,
  ): Promise<Quotation | undefined> {
    return await quotationRepository.getQuotationByPurchaseRequestId(purchaseRequestId);
  }

  async getRFQHistoryByPurchaseRequestId(
    purchaseRequestId: number,
  ): Promise<Quotation[]> {
    return await quotationRepository.getRFQHistoryByPurchaseRequestId(purchaseRequestId);
  }

  async createQuotation(quotationData: InsertQuotation): Promise<Quotation> {
    return await quotationRepository.createQuotation(quotationData);
  }

  async updateQuotation(
    id: number,
    quotationData: Partial<InsertQuotation>,
  ): Promise<Quotation> {
    return await quotationRepository.updateQuotation(id, quotationData);
  }

  async deleteQuotation(id: number): Promise<void> {
    return await quotationRepository.deleteQuotation(id);
  }

  // Quotation Items operations
  async getQuotationItems(quotationId: number): Promise<QuotationItem[]> {
    return await quotationRepository.getQuotationItems(quotationId);
  }

  async createQuotationItem(
    itemData: InsertQuotationItem,
  ): Promise<QuotationItem> {
    return await quotationRepository.createQuotationItem(itemData);
  }

  async createQuotationItems(
    itemsData: InsertQuotationItem[],
  ): Promise<QuotationItem[]> {
    return await quotationRepository.createQuotationItems(itemsData);
  }

  async updateQuotationItem(
    id: number,
    itemData: Partial<InsertQuotationItem>,
  ): Promise<QuotationItem> {
    return await quotationRepository.updateQuotationItem(id, itemData);
  }

  async deleteQuotationItem(id: number): Promise<void> {
    return await quotationRepository.deleteQuotationItem(id);
  }

  // Supplier Quotations operations
  async getSupplierQuotations(
    quotationId: number,
  ): Promise<SupplierQuotation[]> {
    return await quotationRepository.getSupplierQuotations(quotationId);
  }

  async getSupplierQuotationById(
    id: number,
  ): Promise<SupplierQuotation | undefined> {
    return await quotationRepository.getSupplierQuotationById(id);
  }

  async createSupplierQuotation(
    supplierQuotationData: InsertSupplierQuotation,
  ): Promise<SupplierQuotation> {
    return await quotationRepository.createSupplierQuotation(supplierQuotationData);
  }

  async updateSupplierQuotation(
    id: number,
    supplierQuotationData: Partial<InsertSupplierQuotation>,
  ): Promise<SupplierQuotation> {
    return await quotationRepository.updateSupplierQuotation(id, supplierQuotationData);
  }

  // Supplier Quotation Items operations
  async getSupplierQuotationItems(
    supplierQuotationId: number,
  ): Promise<SupplierQuotationItem[]> {
    return await quotationRepository.getSupplierQuotationItems(supplierQuotationId);
  }

  async createSupplierQuotationItem(
    itemData: InsertSupplierQuotationItem,
  ): Promise<SupplierQuotationItem> {
    return await quotationRepository.createSupplierQuotationItem(itemData);
  }

  async createSupplierQuotationItems(
    itemsData: InsertSupplierQuotationItem[],
  ): Promise<SupplierQuotationItem[]> {
    return await quotationRepository.createSupplierQuotationItems(itemsData);
  }

  async updateSupplierQuotationItem(
    id: number,
    itemData: Partial<InsertSupplierQuotationItem>,
  ): Promise<SupplierQuotationItem> {
    return await quotationRepository.updateSupplierQuotationItem(id, itemData);
  }

  // Approved Quotation Items operations
  async getApprovedQuotationItems(quotationId: number): Promise<ApprovedQuotationItem[]> {
    return await quotationRepository.getApprovedQuotationItems(quotationId);
  }

  async createApprovedQuotationItem(item: InsertApprovedQuotationItem): Promise<ApprovedQuotationItem> {
    return await quotationRepository.createApprovedQuotationItem(item);
  }

  async clearApprovedQuotationItems(quotationId: number): Promise<void> {
    return await quotationRepository.clearApprovedQuotationItems(quotationId);
  }

  // Purchase Order operations
  async getPurchaseOrderById(id: number): Promise<PurchaseOrder | undefined> {
    return await purchaseOrderRepository.getPurchaseOrderById(id);
  }

  async getPurchaseOrderByRequestId(purchaseRequestId: number): Promise<PurchaseOrder | undefined> {
    return await purchaseOrderRepository.getPurchaseOrderByRequestId(purchaseRequestId);
  }

  async createPurchaseOrder(purchaseOrder: InsertPurchaseOrder): Promise<PurchaseOrder> {
    return await purchaseOrderRepository.createPurchaseOrder(purchaseOrder);
  }

  async updatePurchaseOrder(
    id: number,
    purchaseOrder: Partial<InsertPurchaseOrder>,
  ): Promise<PurchaseOrder> {
    return await purchaseOrderRepository.updatePurchaseOrder(id, purchaseOrder);
  }

  // Purchase Order Items operations
  async getPurchaseOrderItems(purchaseOrderId: number): Promise<PurchaseOrderItem[]> {
    return await purchaseOrderRepository.getPurchaseOrderItems(purchaseOrderId);
  }

  async createPurchaseOrderItem(item: InsertPurchaseOrderItem): Promise<PurchaseOrderItem> {
    return await purchaseOrderRepository.createPurchaseOrderItem(item);
  }

  async deletePurchaseOrderByRequestId(purchaseRequestId: number): Promise<number> {
    return await purchaseOrderRepository.deletePurchaseOrderByRequestId(purchaseRequestId);
  }

  async updatePurchaseOrderItem(
    id: number,
    item: Partial<InsertPurchaseOrderItem>,
  ): Promise<PurchaseOrderItem> {
    return await purchaseOrderRepository.updatePurchaseOrderItem(id, item);
  }

  // Receipts operations
  async createReceipt(receipt: InsertReceipt): Promise<Receipt> {
    return await receiptRepository.createReceipt(receipt);
  }

  async createReceiptItem(item: InsertReceiptItem): Promise<ReceiptItem> {
    return await receiptRepository.createReceiptItem(item);
  }

  async getReceiptsByPurchaseOrderId(purchaseOrderId: number): Promise<Receipt[]> {
    return await receiptRepository.getReceiptsByPurchaseOrderId(purchaseOrderId);
  }

  async getReceiptById(id: number): Promise<Receipt | undefined> {
    return await receiptRepository.getReceiptById(id);
  }

  async returnToPhysicalReceipt(purchaseRequestId: number, userId: number): Promise<void> {
    return await receiptRepository.returnToPhysicalReceipt(purchaseRequestId, userId);
  }

  // Approval History operations
  async getApprovalHistory(purchaseRequestId: number): Promise<any[]> {
    return await approvalRepository.getApprovalHistory(purchaseRequestId);
  }

  async createApprovalHistory(
    approvalHistoryData: InsertApprovalHistory,
  ): Promise<ApprovalHistory> {
    return await approvalRepository.createApprovalHistory(approvalHistoryData);
  }

  async getCompleteTimeline(purchaseRequestId: number): Promise<any[]> {
    return await timelineService.getCompleteTimeline(purchaseRequestId);
  }

  async createAttachment(
    attachmentData: InsertAttachment,
  ): Promise<Attachment> {
    return await systemRepository.createAttachment(attachmentData);
  }

  async getAttachmentsByPurchaseRequestId(purchaseRequestId: number): Promise<Attachment[]> {
    return await systemRepository.getAttachmentsByPurchaseRequestId(purchaseRequestId);
  }

  async cleanupPurchaseRequestsData(): Promise<void> {
    return await purchaseRequestRepository.cleanupPurchaseRequestsData();
  }

  async generatePasswordResetToken(email: string): Promise<string | null> {
    return await userRepository.generatePasswordResetToken(email);
  }

  async validatePasswordResetToken(token: string): Promise<User | null> {
    return await userRepository.validatePasswordResetToken(token);
  }

  async resetPassword(token: string, newPassword: string): Promise<boolean> {
    return await userRepository.resetPassword(token, newPassword);
  }

  async getUserById(id: number): Promise<User | undefined> {
    return await userRepository.getUser(id);
  }

  async getApprovalHistoryByRequestId(requestId: number): Promise<ApprovalHistory[]> {
    return await approvalRepository.getApprovalHistoryByRequestId(requestId);
  }

  async getActiveApprovalConfiguration(): Promise<ApprovalConfiguration | undefined> {
    return await approvalRepository.getActiveApprovalConfiguration();
  }

  async getCEOAndDirectors(): Promise<User[]> {
    return await approvalRepository.getCEOAndDirectors();
  }

  async getA2Approvers(): Promise<User[]> {
    return await approvalRepository.getA2Approvers();
  }

  async createApprovalHistoryWithStep(history: InsertApprovalHistory & { 
    approvalStep: string; 
    approvalValue: string; 
    requiresDualApproval: boolean; 
    ipAddress: string; 
    userAgent: string; 
  }): Promise<ApprovalHistory> {
    return await approvalRepository.createApprovalHistoryWithStep(history);
  }

  async createApprovalConfiguration(config: InsertApprovalConfiguration): Promise<ApprovalConfiguration> {
    return await approvalRepository.createApprovalConfiguration(config);
  }

  async getConfigurationHistory(): Promise<ConfigurationHistory[]> {
    return await approvalRepository.getConfigurationHistory();
  }

  async initializeDefaultData(): Promise<void> {
    // Check if admin user already exists
    const adminUser = await this.getUserByUsername("admin");
    if (adminUser) {
      return; // Admin user already exists
    }

    // Create default company if none exist
    const existingCompanies = await this.getAllCompanies();
    if (existingCompanies.length === 0) {
      await this.createCompany({
        name: "Empresa Matriz",
        cnpj: "00.000.000/0001-00",
        address: "Endereço da empresa",
        phone: "(11) 99999-9999",
        email: "contato@empresa.com",
        active: true
      });
    }

    // Create default payment methods (check if they exist first)
    const defaultPaymentMethods = [
      { name: "Boleto", active: true },
      { name: "Cheque", active: true },
      { name: "Transferência Bancária", active: true },
      { name: "Cartão de Crédito", active: true },
      { name: "Dinheiro", active: true },
      { name: "Pix", active: true },
    ];

    const existingPaymentMethods = await this.getAllPaymentMethods();
    const existingMethodNames = existingPaymentMethods.map(pm => pm.name);

    for (const method of defaultPaymentMethods) {
      if (!existingMethodNames.includes(method.name)) {
        await this.createPaymentMethod(method);
      }
    }

    // Create default departments and cost centers (check if they exist first)
    const defaultDepartments = [
      { name: "TI", description: "Tecnologia da Informação" },
      { name: "Financeiro", description: "Departamento Financeiro" },
      { name: "RH", description: "Recursos Humanos" },
      { name: "Marketing", description: "Marketing e Vendas" },
      { name: "Administrativo", description: "Departamento Administrativo" },
    ];

    const existingDepartments = await this.getAllDepartments();
    const existingDeptNames = existingDepartments.map(d => d.name);
    const existingCostCenters = await this.getAllCostCenters();
    const existingCostCenterCodes = existingCostCenters.map(cc => cc.code);

    for (const dept of defaultDepartments) {
      let department;
      
      // Check if department already exists
      if (existingDeptNames.includes(dept.name)) {
        department = existingDepartments.find(d => d.name === dept.name);
      } else {
        department = await this.createDepartment(dept);
      }

      if (department) {
        // Create cost centers for each department (check if they exist first)
        const generalCostCenterCode = `${dept.name.toUpperCase()}-GER-001`;
        if (!existingCostCenterCodes.includes(generalCostCenterCode)) {
          await this.createCostCenter({
            code: generalCostCenterCode,
            name: `${dept.name} - Geral`,
            departmentId: department.id,
          });
        }

        if (dept.name === "TI") {
          const devCostCenterCode = "TI-DEV-001";
          if (!existingCostCenterCodes.includes(devCostCenterCode)) {
            await this.createCostCenter({
              code: devCostCenterCode,
              name: "TI - Desenvolvimento",
              departmentId: department.id,
            });
          }
        }
      }
    }

    // Create default approval configuration
    const existingConfig = await this.getActiveApprovalConfiguration();
    if (!existingConfig) {
      await this.createApprovalConfiguration({
        valueThreshold: "2500.00",
        effectiveDate: new Date(),
        reason: "Configuração inicial do sistema - limite padrão R$ 2.500,00",
        createdBy: 1,
      });
    }

    // Create default admin user
    const hashedPassword = await bcrypt.hash("admin123", 10);
    await this.createUser({
      username: "admin",
      password: hashedPassword,
      email: "admin@empresa.com",
      firstName: "Admin",
      lastName: "Sistema",
      isBuyer: true,
      isApproverA1: true,
      isApproverA2: true,
      isAdmin: true,
      isCEO: true, // Make admin a CEO for testing dual approval
    });
  }

  // Quantity Adjustment History operations
  async createQuantityAdjustmentHistory(history: any): Promise<any> {
    return await systemRepository.createQuantityAdjustmentHistory(history);
  }

  async getDistinctItemDescriptions(query?: string): Promise<string[]> {
    return await systemRepository.getDistinctItemDescriptions(query);
  }
}

export const storage = new DatabaseStorage();
