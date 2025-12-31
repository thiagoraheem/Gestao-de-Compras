
import React, { createContext, useContext, useState, useEffect, useRef, ReactNode } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";

interface ReceiptContextType {
  // Props
  request: any;
  mode: 'view' | 'physical' | 'fiscal';
  onClose: () => void;
  
  // Tab State
  activeTab: 'fiscal' | 'financeiro' | 'xml' | 'manual_nf' | 'items';
  setActiveTab: (tab: 'fiscal' | 'financeiro' | 'xml' | 'manual_nf' | 'items') => void;
  
  // General State
  receiptType: "produto" | "servico" | "avulso";
  setReceiptType: (type: "produto" | "servico" | "avulso") => void;
  typeCategoryError: string;
  
  // Manual Entry State
  manualNFNumber: string;
  setManualNFNumber: (v: string) => void;
  manualNFSeries: string;
  setManualNFSeries: (v: string) => void;
  manualNFIssueDate: string;
  setManualNFIssueDate: (v: string) => void;
  manualNFEntryDate: string;
  setManualNFEntryDate: (v: string) => void;
  manualTotal: string;
  setManualTotal: (v: string) => void;
  manualNFEmitterCNPJ: string;
  setManualNFEmitterCNPJ: (v: string) => void;
  manualNFAccessKey: string;
  setManualNFAccessKey: (v: string) => void;
  manualItems: Array<any>;
  setManualItems: React.Dispatch<React.SetStateAction<Array<any>>>;
  manualErrors: Record<string, string>;
  setManualErrors: (v: Record<string, string>) => void;
  manualNFStep: 1 | 2 | 3;
  setManualNFStep: (v: 1 | 2 | 3) => void;
  manualPaymentCondition: string;
  setManualPaymentCondition: (v: string) => void;
  manualBankDetails: string;
  setManualBankDetails: (v: string) => void;
  manualPaidAmount: string;
  setManualPaidAmount: (v: string) => void;
  
  // Financial State
  paymentMethodCode: string;
  setPaymentMethodCode: (v: string) => void;
  invoiceDueDate: string;
  setInvoiceDueDate: (v: string) => void;
  hasInstallments: boolean;
  setHasInstallments: (v: boolean) => void;
  installmentCount: number;
  setInstallmentCount: (v: number) => void;
  installments: Array<{ dueDate: string; amount: string; method?: string }>;
  setInstallments: React.Dispatch<React.SetStateAction<Array<{ dueDate: string; amount: string; method?: string }>>>;
  allocations: Array<{ costCenterId?: number; chartOfAccountsId?: number; amount?: string; percentage?: string }>;
  setAllocations: React.Dispatch<React.SetStateAction<Array<{ costCenterId?: number; chartOfAccountsId?: number; amount?: string; percentage?: string }>>>;
  allocationMode: 'manual' | 'proporcional';
  setAllocationMode: (v: 'manual' | 'proporcional') => void;
  paymentMethods: Array<{ code: string; name: string }>;
  isLoadingPaymentMethods: boolean;
  
  // XML/Fiscal State
  xmlPreview: any | null;
  setXmlPreview: (v: any | null) => void;
  xmlRaw: string;
  setXmlRaw: (v: string) => void;
  xmlAttachmentId: number | null;
  setXmlAttachmentId: (v: number | null) => void;
  nfReceiptId: number | null;
  setNfReceiptId: (v: number | null) => void;
  xmlRecovered: boolean;
  setXmlRecovered: (v: boolean) => void;
  isXmlUploading: boolean;
  setIsXmlUploading: (v: boolean) => void;
  supplierMatch: boolean | null;
  setSupplierMatch: (v: boolean | null) => void;
  isPendencyModalOpen: boolean;
  setIsPendencyModalOpen: (v: boolean) => void;
  
  // Entities State
  emitter: Record<string, any>;
  setEmitter: React.Dispatch<React.SetStateAction<Record<string, any>>>;
  recipient: Record<string, any>;
  setRecipient: React.Dispatch<React.SetStateAction<Record<string, any>>>;
  productTransp: Record<string, any>;
  setProductTransp: React.Dispatch<React.SetStateAction<Record<string, any>>>;
  serviceData: Record<string, any>;
  setServiceData: React.Dispatch<React.SetStateAction<Record<string, any>>>;
  
  // Taxes State
  itemTaxes: Record<number, any>;
  setItemTaxes: React.Dispatch<React.SetStateAction<Record<number, any>>>;
  manualProductsValue: string;
  setManualProductsValue: (v: string) => void;
  manualFreightValue: string;
  setManualFreightValue: (v: string) => void;
  manualDiscountValue: string;
  setManualDiscountValue: (v: string) => void;
  manualIcmsBase: string;
  setManualIcmsBase: (v: string) => void;
  manualIcmsValue: string;
  setManualIcmsValue: (v: string) => void;
  manualOtherTaxes: string;
  setManualOtherTaxes: (v: string) => void;
  
  // Computed/External Data
  purchaseOrder: any;
  purchaseOrderItems: any[];
  itemsWithPrices: any[];
  nfStatus: any;
  costCenters: any[];
  chartAccounts: any[];
  quotation: any;
  supplierQuotations: any[];
  selectedSupplierQuotation: any;
  selectedSupplier: any;
  freightValue: number;
  receivedQuantities: Record<number, number>;
  setReceivedQuantities: React.Dispatch<React.SetStateAction<Record<number, number>>>;
  approvalHistory: any[];

  activeRequest: any; companyData: any;
  isLoadingCompany: boolean;
  
  // Permissions
  canPerformReceiptActions: boolean | undefined;
  canConfirmNf: boolean | undefined;
  nfConfirmed: boolean;
}

const ReceiptContext = createContext<ReceiptContextType | undefined>(undefined);

export function useReceipt() {
  const context = useContext(ReceiptContext);
  if (!context) {
    throw new Error("useReceipt must be used within a ReceiptProvider");
  }
  return context;
}

interface ReceiptProviderProps {
  request: any;
  onClose: () => void;
  mode?: 'view' | 'physical' | 'fiscal';
  children: ReactNode;
}

export function ReceiptProvider({ request, onClose, mode = 'view', children }: ReceiptProviderProps) {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Initial Tab Logic
  const [activeTab, setActiveTab] = useState<'fiscal' | 'financeiro' | 'xml' | 'manual_nf' | 'items'>(
    mode === 'physical' ? 'items' : 
    mode === 'fiscal' ? 'xml' : 
    'fiscal'
  );

  useEffect(() => {
    if (mode === 'physical') setActiveTab('items');
    else if (mode === 'fiscal') setActiveTab('xml');
    else setActiveTab('fiscal');
  }, [mode]);

  // General State
  const [receiptType, setReceiptType] = useState<"produto" | "servico" | "avulso">("produto");
  const [typeCategoryError, setTypeCategoryError] = useState<string>("");

  // Manual Entry State
  const [manualNFNumber, setManualNFNumber] = useState<string>("");
  const [manualNFSeries, setManualNFSeries] = useState<string>("");
  const [manualNFIssueDate, setManualNFIssueDate] = useState<string>("");
  const [manualNFEntryDate, setManualNFEntryDate] = useState<string>("");
  const [manualTotal, setManualTotal] = useState<string>("");
  const [manualNFEmitterCNPJ, setManualNFEmitterCNPJ] = useState<string>("");
  const [manualNFAccessKey, setManualNFAccessKey] = useState<string>("");
  const [manualItems, setManualItems] = useState<Array<any>>([]);
  const [manualErrors, setManualErrors] = useState<Record<string, string>>({});
  const [manualNFStep, setManualNFStep] = useState<1 | 2 | 3>(1);
  const [manualPaymentCondition, setManualPaymentCondition] = useState<string>("");
  const [manualBankDetails, setManualBankDetails] = useState<string>("");
  const [manualPaidAmount, setManualPaidAmount] = useState<string>("");

  // Financial State
  const [paymentMethodCode, setPaymentMethodCode] = useState<string>("");
  const [invoiceDueDate, setInvoiceDueDate] = useState<string>("");
  const [hasInstallments, setHasInstallments] = useState<boolean>(false);
  const [installmentCount, setInstallmentCount] = useState<number>(1);
  const [installments, setInstallments] = useState<Array<{ dueDate: string; amount: string; method?: string }>>([]);
  const [allocations, setAllocations] = useState<Array<{ costCenterId?: number; chartOfAccountsId?: number; amount?: string; percentage?: string }>>([]);
  const [allocationMode, setAllocationMode] = useState<'manual' | 'proporcional'>('manual');
  const [paymentMethods, setPaymentMethods] = useState<Array<{ code: string; name: string }>>([]);
  const [isLoadingPaymentMethods, setIsLoadingPaymentMethods] = useState(false);

  // XML/Fiscal State
  const [xmlPreview, setXmlPreview] = useState<any | null>(null);
  const [xmlRaw, setXmlRaw] = useState<string>("");
  const [xmlAttachmentId, setXmlAttachmentId] = useState<number | null>(null);
  const [nfReceiptId, setNfReceiptId] = useState<number | null>(null);
  const [xmlRecovered, setXmlRecovered] = useState(false);
  const [isXmlUploading, setIsXmlUploading] = useState(false);
  const [supplierMatch, setSupplierMatch] = useState<boolean | null>(null);
  const [isPendencyModalOpen, setIsPendencyModalOpen] = useState(false);

  // Entities State
  const [emitter, setEmitter] = useState<any>({});
  const [recipient, setRecipient] = useState<any>({});
  const [productTransp, setProductTransp] = useState<any>({});
  const [serviceData, setServiceData] = useState<any>({});

  // Taxes State
  const [itemTaxes, setItemTaxes] = useState<Record<number, any>>({});
  const [manualProductsValue, setManualProductsValue] = useState<string>("");
  const [manualFreightValue, setManualFreightValue] = useState<string>("");
  const [manualDiscountValue, setManualDiscountValue] = useState<string>("");
  const [manualIcmsBase, setManualIcmsBase] = useState<string>("");
  const [manualIcmsValue, setManualIcmsValue] = useState<string>("");
  const [manualOtherTaxes, setManualOtherTaxes] = useState<string>("");

  // Permissions
  const canPerformReceiptActions = user?.isReceiver || user?.isAdmin;
  const canConfirmNf = user?.isBuyer || user?.isAdmin;

  const [receivedQuantities, setReceivedQuantities] = useState<Record<number, number>>({});

  // Queries
  const { data: freshRequest } = useQuery<any>({
    queryKey: [`/api/purchase-requests/${request?.id}`],
    enabled: !!request?.id,
  });

  const activeRequest = freshRequest || request;

  const { data: companyData, isLoading: isLoadingCompany } = useQuery<any>({
    queryKey: [`/api/companies/${activeRequest?.companyId}`],
    enabled: !!activeRequest?.companyId,
  });

  const { data: purchaseOrder } = useQuery<any>({
    queryKey: [`/api/purchase-orders/by-request/${request?.id}`],
    enabled: !!request?.id,
  });

  const { data: purchaseOrderItems = [] } = useQuery<any[]>({
    queryKey: [`/api/purchase-orders/${purchaseOrder?.id}/items`],
    enabled: !!purchaseOrder?.id,
  });

  const itemsWithPrices = React.useMemo(() => {
    return Array.isArray(purchaseOrderItems) ? purchaseOrderItems.map(item => {
      const unitPrice = Number(item.unitPrice) || 0;
      const quantity = Number(item.quantity) || 0;
      const totalPrice = Number(item.totalPrice) || 0;
      return {
        ...item,
        unitPrice: unitPrice,
        originalUnitPrice: unitPrice,
        itemDiscount: 0,
        totalPrice: totalPrice,
        originalTotalPrice: totalPrice,
        brand: item.brand || '',
        deliveryTime: item.deliveryTime || '',
        isAvailable: true
      };
    }) : [];
  }, [purchaseOrderItems]);

  const { data: nfStatus } = useQuery<{
    nfConfirmed: boolean;
    status: string;
    receiptId?: number;
    confirmedAt?: string;
    confirmedBy?: { name: string; email?: string } | null;
    financialData?: any;
  }>({
    queryKey: [`/api/purchase-requests/${request?.id}/nf-status`],
    enabled: !!request?.id,
  });

  const nfConfirmed = !!nfStatus?.nfConfirmed;

  const { data: costCenters = [] } = useQuery<any[]>({
    queryKey: ["/api/cost-centers"],
  });

  const { data: chartAccounts = [] } = useQuery<any[]>({
    queryKey: ["/api/chart-of-accounts"],
  });

  const { data: quotation } = useQuery<any>({
    queryKey: [`/api/quotations/purchase-request/${request.id}`],
    enabled: !!request.id,
  });

  const { data: supplierQuotations = [] } = useQuery<any[]>({
    queryKey: [`/api/quotations/${quotation?.id}/supplier-quotations`],
    enabled: !!quotation?.id,
  });

  const selectedSupplierQuotation: any = React.useMemo(() => 
    supplierQuotations.find((sq: any) => sq.isChosen === true) || supplierQuotations[0], 
  [supplierQuotations]);

  const { data: selectedSupplier } = useQuery<any>({
    queryKey: [`/api/suppliers/${selectedSupplierQuotation?.supplierId}`],
    enabled: !!selectedSupplierQuotation?.supplierId,
  });

  const freightValue = React.useMemo(() => selectedSupplierQuotation?.includesFreight && selectedSupplierQuotation?.freightValue
    ? parseFloat(selectedSupplierQuotation.freightValue?.toString().replace(/[^\d.,]/g, '').replace(',', '.')) || 0
    : 0, [selectedSupplierQuotation]);
    
  const { data: approvalHistory = [] } = useQuery<any[]>({
    queryKey: [`/api/purchase-requests/${request.id}/approval-history`],
    enabled: !!request.id,
  });

  // Effects
  
  // Populate from XML
  useEffect(() => {
    if (!xmlPreview) return;
    try {
      const h = xmlPreview?.header || {};
      const sup = h?.supplier || {};
      const dest = h?.recipient || {};
      const totals = h?.totals || {};
      setEmitter((prev: any) => ({
        ...prev,
        cnpj: sup?.cnpjCpf || prev.cnpj,
        name: sup?.name || prev.name,
        fantasyName: sup?.fantasyName || prev.fantasyName,
        ie: sup?.ie || prev.ie,
        im: sup?.im || prev.im,
        address: {
          ...(prev.address || {}),
          ...(sup.address || {})
        }
      }));
      setRecipient((prev: any) => ({
        ...prev,
        cnpjCpf: dest?.cnpjCpf || prev.cnpjCpf,
        name: dest?.name || prev.name,
        ie: dest?.ie || prev.ie,
        email: dest?.email || prev.email,
        address: {
          ...(prev.address || {}),
          ...(dest.address || {})
        }
      }));
      
      // Populate transport data
      if (h?.transp) {
        setProductTransp((prev: any) => ({
          ...prev,
          modFrete: h.transp.modFrete,
          transporter: h.transp.transporta,
          volume: h.transp.vol
        }));
      }

      if (receiptType === "servico") {
        setServiceData((prev: any) => ({
          ...prev,
          valores: {
            ...prev.valores,
            valorServicos: Number((totals?.vServ ?? prev.valores?.valorServicos ?? 0)),
            valorPis: Number((totals?.vPIS ?? prev.valores?.valorPis ?? 0)),
            valorCofins: Number((totals?.vCOFINS ?? prev.valores?.valorCofins ?? 0)),
            valorIss: Number((totals?.vISS ?? prev.valores?.valorIss ?? 0)),
            baseCalculo: Number((totals?.vNF ?? prev.valores?.baseCalculo ?? 0)),
          }
        }));
      }
      if (receiptType === "produto") {
        setManualItems(Array.isArray(xmlPreview?.items) ? xmlPreview.items.map((it: any) => ({
          code: it.code || it.codigo,
          description: it.description,
          unit: it.unit,
          quantity: Number(it.quantity),
          unitPrice: Number(it.unitPrice),
        })) : []);
        const taxesMap: Record<number, any> = {};
        (xmlPreview?.items || []).forEach((it: any, idx: number) => {
          const t = it.taxes || {};
          taxesMap[idx + 1] = {
            vBC: Number(t.vBC ?? 0),
            pICMS: Number(t.pICMS ?? 0),
            vICMS: Number(t.vICMS ?? 0),
            ipi: { vBC: Number(t.ipiBase ?? 0), pIPI: Number(t.ipiAliquota ?? 0), vIPI: Number(t.ipiValor ?? 0) },
            pis: { cst: String(t.pisCST || "") },
            cofins: { cst: String(t.cofinsCST || "") },
          };
        });
        setItemTaxes(taxesMap);
      }
    } catch {}
  }, [xmlPreview, receiptType]);

  // Persist draft to LocalStorage
  useEffect(() => {
    try {
      const key = `nf_draft_${request?.id}`;
      const data = {
        receiptType, 
        emitter, recipient, productTransp, serviceData, itemTaxes,
        manualNFNumber, manualNFSeries, manualNFIssueDate, manualNFEntryDate, manualNFEmitterCNPJ, manualNFAccessKey, manualItems,
        manualProductsValue, manualFreightValue, manualDiscountValue, manualIcmsBase, manualIcmsValue, manualOtherTaxes,
        // manualPaymentCondition, manualBankDetails, manualPaidAmount, // Add these to state if needed, or remove from here
      };
      localStorage.setItem(key, JSON.stringify(data));
    } catch {}
  }, [request?.id, receiptType, emitter, recipient, productTransp, serviceData, itemTaxes, manualNFNumber, manualNFSeries, manualNFIssueDate, manualNFEntryDate, manualNFEmitterCNPJ, manualNFAccessKey, manualItems, manualProductsValue, manualFreightValue, manualDiscountValue, manualIcmsBase, manualIcmsValue, manualOtherTaxes]);

  // Clear XML when switching to "avulso"
  useEffect(() => {
    if (receiptType === "avulso") {
      const hadXml = !!xmlPreview;
      setXmlPreview(null);
      setXmlRaw("");
      // setSupplierMatch(null); // Missing in context state
      try {
        apiRequest(`/api/audit/log`, {
          method: "POST",
          body: {
            purchaseRequestId: request.id,
            actionType: "recebimento_avulso_mode_switch",
            actionDescription: "Alternado para modo Avulso, dados de XML descartados",
            beforeData: { xmlPreviewExists: hadXml },
            afterData: { xmlPreviewExists: false },
          },
        });
      } catch {}
    }
  }, [receiptType]);

  useEffect(() => {
    const category = request?.category;
    const map: Record<string, "produto" | "servico" | "avulso"> = { Produto: "produto", Serviço: "servico", Outros: "avulso" };
    const expected = map[category] || undefined;
    if (expected && receiptType !== expected && receiptType !== "avulso") {
      setTypeCategoryError(`Tipo selecionado (${receiptType}) incompatível com a Categoria de Compra (${category}). Ajuste o Tipo para '${expected}'.`);
    } else {
      setTypeCategoryError("");
    }
  }, [request?.category, receiptType]);

  // Load Payment Methods
  useEffect(() => {
    async function loadPaymentMethods() {
      try {
        const res = await apiRequest('/api/payment-methods');
        if (Array.isArray(res)) setPaymentMethods(res);
      } catch (error) {
        console.error("Failed to load payment methods", error);
      }
    }
    loadPaymentMethods();
  }, []);

  // Restore State from LocalStorage
  useEffect(() => {
    try {
      const key = `nf_draft_${request?.id}`;
      const raw = localStorage.getItem(key);
      if (raw) {
        const data = JSON.parse(raw);
        if (data.receiptType) setReceiptType(data.receiptType);
        setEmitter(data.emitter || {});
        setRecipient(data.recipient || {});
        setProductTransp(data.productTransp || {});
        setServiceData(data.serviceData || {});
        setItemTaxes(data.itemTaxes || {});
        setManualNFNumber(data.manualNFNumber || "");
        setManualNFSeries(data.manualNFSeries || "");
        setManualNFIssueDate(data.manualNFIssueDate || "");
        setManualNFEntryDate(data.manualNFEntryDate || "");
        setManualTotal(data.manualTotal || "");
        setManualNFEmitterCNPJ(data.manualNFEmitterCNPJ || "");
        setManualNFAccessKey(data.manualNFAccessKey || "");
        if (Array.isArray(data.manualItems)) setManualItems(data.manualItems);
      }
    } catch {}
  }, [request?.id]);

  const value: ReceiptContextType = {
    request, mode, onClose,
    activeTab, setActiveTab,
    receiptType, setReceiptType, typeCategoryError,
    manualNFNumber, setManualNFNumber,
    manualNFSeries, setManualNFSeries,
    manualNFIssueDate, setManualNFIssueDate,
    manualNFEntryDate, setManualNFEntryDate,
    manualTotal, setManualTotal,
    manualNFEmitterCNPJ, setManualNFEmitterCNPJ,
    manualNFAccessKey, setManualNFAccessKey,
    manualItems, setManualItems,
    manualErrors, setManualErrors,
    manualNFStep, setManualNFStep,
    manualPaymentCondition, setManualPaymentCondition,
    manualBankDetails, setManualBankDetails,
    manualPaidAmount, setManualPaidAmount,
    paymentMethodCode, setPaymentMethodCode,
    invoiceDueDate, setInvoiceDueDate,
    hasInstallments, setHasInstallments,
    installmentCount, setInstallmentCount,
    installments, setInstallments,
    allocations, setAllocations,
    allocationMode, setAllocationMode,
    paymentMethods,
    isLoadingPaymentMethods: isLoadingPaymentMethods,
    xmlPreview, setXmlPreview,
    xmlRaw, setXmlRaw,
    xmlAttachmentId, setXmlAttachmentId,
    nfReceiptId, setNfReceiptId,
    xmlRecovered, setXmlRecovered,
    isXmlUploading, setIsXmlUploading,
    supplierMatch, setSupplierMatch,
    isPendencyModalOpen, setIsPendencyModalOpen,
    emitter, setEmitter,
    recipient, setRecipient,
    productTransp, setProductTransp,
    serviceData, setServiceData,
    itemTaxes, setItemTaxes,
    manualProductsValue, setManualProductsValue,
    manualFreightValue, setManualFreightValue,
    manualDiscountValue, setManualDiscountValue,
    manualIcmsBase, setManualIcmsBase,
    manualIcmsValue, setManualIcmsValue,
    manualOtherTaxes, setManualOtherTaxes,
    purchaseOrder, purchaseOrderItems, itemsWithPrices, nfStatus, costCenters, chartAccounts,
    quotation, supplierQuotations, selectedSupplierQuotation, selectedSupplier, freightValue,
    receivedQuantities, setReceivedQuantities, approvalHistory,
    activeRequest, companyData, isLoadingCompany,
    canPerformReceiptActions, canConfirmNf, nfConfirmed
  };

  return (
    <ReceiptContext.Provider value={value}>
      {children}
    </ReceiptContext.Provider>
  );
}
