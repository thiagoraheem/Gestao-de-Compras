export interface PurchaseRequest {
  id: number;
  requestNumber: string;
  description: string;
  requestDate: string;
  requesterName: string;
  departmentName: string;
  supplierName: string;
  phase: string;
  valorItens: number;
  desconto: number;
  subTotal: number;
  descontoProposta: number;
  valorFinal: number;
  urgency: string;
  approverA1Name: string;
  approverA2Name: string;
  items: PurchaseRequestItem[];
  approvals: Approval[];
  quotations: Quotation[];
  purchaseOrders: PurchaseOrder[];
}

export interface PurchaseRequestItem {
  id: number;
  description: string;
  quantity: number;
  unit: string;
  unitPrice: number | null;
  totalPrice: number | null;
}

export interface Approval {
  id: number;
  level: string;
  status: string;
  approverName: string;
  approvalDate: string;
  comments?: string;
}

export interface Quotation {
  id: number;
  supplierName: string;
  totalValue: number;
  status: string;
  submissionDate: string;
}

export interface PurchaseOrder {
  id: number;
  orderNumber: string;
  supplierName: string;
  totalValue: number;
  status: string;
  orderDate: string;
}

export interface Department {
  id: number;
  name: string;
}

export interface User {
  id: number;
  firstName: string;
  lastName: string;
}
