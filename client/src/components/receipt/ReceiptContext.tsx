
import React, { createContext, useContext, useState, useEffect, useRef, ReactNode, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { findBestPurchaseOrderMatch, MANUAL_ITEM_MATCH_THRESHOLD } from "../../utils/item-matching-helper";

interface ReceiptContextType {
  // Props
  request: any;
  mode: 'view' | 'physical' | 'fiscal';
  onClose: () => void;
  receiptId?: number;
  
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
  showValidationErrors: boolean;
  setShowValidationErrors: (v: boolean) => void;
  isFinancialValid: boolean;
}

export const ReceiptContext = createContext<ReceiptContextType | undefined>(undefined);

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
  receiptId?: number; // Optional receipt ID to load specific context
  children: ReactNode;
}

export function ReceiptProvider({ request, onClose, mode = 'view', receiptId, children }: ReceiptProviderProps) {
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
  const [showValidationErrors, setShowValidationErrors] = useState<boolean>(false);

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

  // If receiptId is provided, fetch specific receipt, otherwise fallback to old behavior
  const { data: specificReceipt } = useQuery<any>({
    queryKey: [`/api/receipts/${receiptId}`],
    enabled: !!receiptId
  });

  const { data: nfStatus } = useQuery<{
    nfConfirmed: boolean;
    status: string;
    receiptId?: number;
    confirmedAt?: string;
    confirmedBy?: { name: string; email?: string } | null;
    financialData?: any;
  }>({
    queryKey: [`/api/purchase-requests/${request?.id}/nf-status`],
    enabled: !!request?.id && !receiptId, // Only if NO receiptId provided
  });

  const nfConfirmed = !!(receiptId ? specificReceipt?.status === 'conferida' : nfStatus?.nfConfirmed);

  // Effect to populate state from specificReceipt or nfStatus
  useEffect(() => {
    const data = specificReceipt || nfStatus?.financialData;
    if (data) {
      if (data.receiptType) setReceiptType(data.receiptType as any);
      
      // Load financial data
      if (data.paymentMethodCode) setPaymentMethodCode(data.paymentMethodCode);
      if (data.invoiceDueDate) setInvoiceDueDate(data.invoiceDueDate.split('T')[0]);
      
      if (data.hasInstallments !== undefined) setHasInstallments(data.hasInstallments);
      if (data.installmentCount) setInstallmentCount(data.installmentCount);
      
      if (data.installments && Array.isArray(data.installments)) {
        setInstallments(data.installments.map((i: any) => ({
          dueDate: i.dueDate ? i.dueDate.split('T')[0] : '',
          amount: String(i.amount),
          method: i.method || i.paymentMethodCode
        })));
      }

      if (data.allocations && Array.isArray(data.allocations)) {
        setAllocations(data.allocations.map((a: any) => ({
          costCenterId: a.costCenterId,
          chartOfAccountsId: a.chartOfAccountsId,
          amount: String(a.amount),
          percentage: String(a.percentage || '')
        })));
      }

      // Load Manual Entry Data if available (e.g. from observations or specific fields)
      if (data.documentNumber) setManualNFNumber(data.documentNumber);
      if (data.documentSeries) setManualNFSeries(data.documentSeries);
      if (data.documentIssueDate) setManualNFIssueDate(data.documentIssueDate.split('T')[0]);
      if (data.documentEntryDate) setManualNFEntryDate(data.documentEntryDate.split('T')[0]);
      if (data.totalAmount) setManualTotal(String(data.totalAmount).replace('.', ','));
      if (data.documentKey) setManualNFAccessKey(data.documentKey);
      
      // Parse observations for other fields if needed
      if (data.observations) {
        try {
          const obs = typeof data.observations === 'string' ? JSON.parse(data.observations) : data.observations;
          if (obs.emitterCnpj) setManualNFEmitterCNPJ(obs.emitterCnpj);
          if (obs.manualProductsValue) setManualProductsValue(obs.manualProductsValue);
          if (obs.manualFreightValue) setManualFreightValue(obs.manualFreightValue);
          if (obs.manualDiscountValue) setManualDiscountValue(obs.manualDiscountValue);
          if (obs.manualIcmsBase) setManualIcmsBase(obs.manualIcmsBase);
          if (obs.manualIcmsValue) setManualIcmsValue(obs.manualIcmsValue);
          if (obs.manualOtherTaxes) setManualOtherTaxes(obs.manualOtherTaxes);
        } catch (e) {
          // ignore parsing error
        }
      }
    }
  }, [specificReceipt, nfStatus]);

  // Populate from specific receipt
  useEffect(() => {
    if (specificReceipt) {
      setNfReceiptId(specificReceipt.id);
      if (specificReceipt.documentNumber) setManualNFNumber(specificReceipt.documentNumber);
      if (specificReceipt.documentSeries) setManualNFSeries(specificReceipt.documentSeries);
      
      // Restore Financial & Rateio Data from DB (Persistence Recovery)
      if (specificReceipt.observations) {
        try {
          // Check if it looks like JSON before parsing to avoid syntax errors on plain text
          const obsStr = typeof specificReceipt.observations === 'string' ? specificReceipt.observations.trim() : '';
          const isJson = obsStr.startsWith('{') || obsStr.startsWith('[');
          
          const obs = isJson 
            ? JSON.parse(specificReceipt.observations) 
            : (typeof specificReceipt.observations === 'object' ? specificReceipt.observations : null);

          if (obs && typeof obs === 'object') {
            console.log("[ReceiptContext] Restoring persisted fiscal data:", obs);

            if (obs.financial) {
              if (obs.financial.paymentMethodCode) setPaymentMethodCode(obs.financial.paymentMethodCode);
              if (obs.financial.invoiceDueDate) {
                 // Ensure correct date format if needed
                 const d = obs.financial.invoiceDueDate.split('T')[0];
                 setInvoiceDueDate(d);
              }
              if (typeof obs.financial.hasInstallments !== 'undefined') setHasInstallments(obs.financial.hasInstallments);
              if (obs.financial.installmentCount) setInstallmentCount(Number(obs.financial.installmentCount));
              if (Array.isArray(obs.financial.installments)) setInstallments(obs.financial.installments);
            }

            if (obs.rateio) {
              if (obs.rateio.mode) setAllocationMode(obs.rateio.mode);
              if (Array.isArray(obs.rateio.allocations)) setAllocations(obs.rateio.allocations);
            }
          }
        } catch (e) {
          // Silent fail for non-JSON content to avoid console noise
        }
      }
    }
  }, [specificReceipt]);

  const { data: costCenters = [] } = useQuery<any[]>({
    queryKey: ["/api/integration/locador/combos/centros-custo"],
  });

  const { data: chartAccounts = [] } = useQuery<any[]>({
    queryKey: ["/api/integration/locador/combos/planos-conta"],
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
  useEffect(() => {
    // If we have a specific receipt ID from props, prioritize it
    const idToUse = receiptId || nfStatus?.receiptId;
    
    if (!idToUse) return;

    // Ensure receiptId is set even if XML parse fails (e.g. manual physical receipt)
    setNfReceiptId(idToUse);

    // Pre-fill NF data from server if available and not yet set
    // (This block handled mostly by specificReceipt effect, but keeping for nfStatus fallback)
    if (!receiptId && (nfStatus as any)?.documentNumber && !manualNFNumber) {
      setManualNFNumber((nfStatus as any).documentNumber);
    }
    if (!receiptId && (nfStatus as any)?.documentSeries && !manualNFSeries) {
      setManualNFSeries((nfStatus as any).documentSeries);
    }

    if (xmlPreview) return;
    (async () => {
      try {
        const res = await apiRequest(`/api/recebimentos/parse-existing/${idToUse}`, { method: "POST" });
        const preview = (res as any)?.preview || res;
        if (preview) {
          setXmlPreview(preview);
          setXmlRecovered(true);
        }
      } catch (error) {
        // Silent failure: keep screen usable even if preview fetch fails
      }
    })();
  }, [nfStatus?.receiptId, receiptId, xmlPreview, (nfStatus as any)?.documentNumber, (nfStatus as any)?.documentSeries]);
  
  // Populate from XML
  useEffect(() => {
    if (!xmlPreview) return;
    try {
      const h = xmlPreview?.header || {};
      const sup = h?.supplier || {};
      const dest = h?.recipient || {};
      const totals = h?.totals || {};
      const normalizeDate = (s: any) => {
        if (!s) return "";
        try {
          const d = new Date(String(s));
          if (!isNaN(d.getTime())) return d.toISOString().slice(0, 10);
          const str = String(s);
          if (str.includes("T")) return str.split("T")[0];
          return str;
        } catch {
          const str = String(s);
          return str.includes("T") ? str.split("T")[0] : str;
        }
      };

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

      // Populate manual header fields
      if (h) {
        if (h.documentNumber || h.number) setManualNFNumber(String(h.documentNumber ?? h.number));
        if (h.documentSeries || h.series) setManualNFSeries(String(h.documentSeries ?? h.series));
        if (h.documentKey || h.accessKey) setManualNFAccessKey(String(h.documentKey ?? h.accessKey));
        if (h.issueDate || h.dhEmi) setManualNFIssueDate(normalizeDate(h.issueDate || h.dhEmi));
        if (h.entryDate || h.dhSaiEnt) setManualNFEntryDate(normalizeDate(h.entryDate || h.dhSaiEnt));
        if (sup?.cnpjCpf) setManualNFEmitterCNPJ(String(sup.cnpjCpf));
      }
      if (totals) {
        const total =
          totals.vNF ??
          totals.total ??
          undefined;
        if (typeof total !== "undefined") setManualTotal(String(total));
        if (typeof totals.vProd !== "undefined") setManualProductsValue(String(totals.vProd));
        if (typeof totals.vFrete !== "undefined") setManualFreightValue(String(totals.vFrete));
        if (typeof totals.vDesc !== "undefined") setManualDiscountValue(String(totals.vDesc));
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
        try {
          const icmsBaseSum = Object.values(taxesMap).reduce((acc: number, t: any) => acc + Number(t.vBC || 0), 0);
          const icmsValueSum = Object.values(taxesMap).reduce((acc: number, t: any) => acc + Number(t.vICMS || 0), 0);
          if (!isNaN(icmsBaseSum)) setManualIcmsBase(String(Number(icmsBaseSum.toFixed(2))));
          if (!isNaN(icmsValueSum)) setManualIcmsValue(String(Number(icmsValueSum.toFixed(2))));
        } catch {}

        // Auto-link imported items to Purchase Order items
        try {
          const baseItemsForMatch = Array.isArray(xmlPreview?.items) ? xmlPreview.items.map((it: any) => ({
            code: it.code || it.codigo,
            description: it.description,
            unit: it.unit,
            quantity: Number(it.quantity),
            unitPrice: Number(it.unitPrice),
          })) : [];
          const matched = baseItemsForMatch.map((row: any) => {
            const match = findBestPurchaseOrderMatch(row, purchaseOrderItems || []);
            if (match && match.score >= MANUAL_ITEM_MATCH_THRESHOLD) {
              return { ...row, purchaseOrderItemId: match.id, matchSource: "auto" };
            }
            return row;
          });
          if (matched.length > 0) setManualItems(matched);
        } catch {}
      }

      // Payment mapping from installments (NF-e detPag or cobr.dup)
      try {
        const installments: Array<{ number?: string; dueDate?: string; amount?: string }> = Array.isArray((xmlPreview as any)?.installments)
          ? (xmlPreview as any).installments
          : [];
        if (installments.length > 0) {
          const first = installments[0] || {};
          const codeOrLabel = String(first.number || "");
          const amountStr = String(first.amount || "");
          if (amountStr) setManualPaidAmount(amountStr);
          // Attempt to set payment method by code
          const isTwoDigitCode = /^[0-9]{2}$/.test(codeOrLabel);
          if (isTwoDigitCode) {
            setPaymentMethodCode(codeOrLabel);
          } else {
            // Try match by name against available paymentMethods
            const found = (paymentMethods || []).find(pm => String(pm.name).toLowerCase().includes(codeOrLabel.toLowerCase()));
            if (found) setPaymentMethodCode(found.code);
          }
          // Build payment condition string from installments list
          const condition = installments
            .map(it => `${it.number || ""}${it.dueDate ? ` (${normalizeDate(it.dueDate)})` : ""}: ${it.amount || ""}`)
            .join(" | ");
          if (condition) setManualPaymentCondition(condition);
        }
      } catch {}
    } catch {}
  }, [xmlPreview, receiptType]);

  // Re-match items when Purchase Order items load after XML preview
  useEffect(() => {
    try {
      if (receiptType !== "produto") return;
      if (!xmlPreview) return;
      if (!Array.isArray(purchaseOrderItems) || purchaseOrderItems.length === 0) return;
      if (!Array.isArray(manualItems) || manualItems.length === 0) return;
      const needsLink = manualItems.some((it: any) => !it.purchaseOrderItemId);
      if (!needsLink) return;
      const updated = manualItems.map((row: any) => {
        if (row.purchaseOrderItemId) return row;
        const match = findBestPurchaseOrderMatch(row, purchaseOrderItems || []);
        if (match && match.score >= MANUAL_ITEM_MATCH_THRESHOLD) {
          return { ...row, purchaseOrderItemId: match.id, matchSource: row.matchSource || "auto" };
        }
        return row;
      });
      setManualItems(updated);
    } catch {}
  }, [purchaseOrderItems]);

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
      setIsLoadingPaymentMethods(true);
      try {
        const res = await apiRequest('/api/integration/locador/combos/formas-pagamento');
        if (Array.isArray(res) && res.length > 0) {
          const mapped = res.map((pm: any) => ({
            code: pm.codigo?.toString() || pm.code || pm.id?.toString() || "",
            name: pm.descricao || pm.name || pm.description || ""
          })).filter((x: any) => x.code && x.name);
          setPaymentMethods(mapped);
        } else {
          setPaymentMethods([
            { code: "boleto", name: "Boleto" },
            { code: "cheque", name: "Cheque" },
            { code: "transferencia", name: "Transferência Bancária" },
            { code: "cartao_credito", name: "Cartão de Crédito" },
            { code: "dinheiro", name: "Dinheiro" },
            { code: "pix", name: "Pix" },
          ]);
        }
      } catch (error) {
        console.error("Failed to load payment methods", error);
        setPaymentMethods([
          { code: "boleto", name: "Boleto" },
          { code: "cheque", name: "Cheque" },
          { code: "transferencia", name: "Transferência Bancária" },
          { code: "cartao_credito", name: "Cartão de Crédito" },
          { code: "dinheiro", name: "Dinheiro" },
          { code: "pix", name: "Pix" },
        ]);
      } finally {
        setIsLoadingPaymentMethods(false);
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

  const isFinancialValid = useMemo(() => {
    // 1. Payment Method (*)
    if (!paymentMethodCode) return false;

    // 2. Allocations (*)
    // Must have at least one allocation and all must have cost center and chart of accounts
    if (!allocations || allocations.length === 0) return false;
    const allocationsValid = allocations.every(r => !!r.costCenterId && !!r.chartOfAccountsId);
    if (!allocationsValid) return false;

    // 3. Due Date / Installments (*)
    if (hasInstallments) {
      if (!installments || installments.length === 0) return false;
      // Check if all installments have due date and amount > 0
      const allFilled = installments.every(r => !!r.dueDate && (parseFloat(String(r.amount || "0").replace(",", ".")) > 0));
      if (!allFilled) return false;
    } else {
      if (!invoiceDueDate) return false;
    }

    return true;
  }, [paymentMethodCode, allocations, hasInstallments, installments, invoiceDueDate]);

  const value: ReceiptContextType = {
    request, mode, onClose, receiptId,
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
    canPerformReceiptActions, canConfirmNf, nfConfirmed,
    showValidationErrors, setShowValidationErrors,
    isFinancialValid,
  };

  return (
    <ReceiptContext.Provider value={value}>
      {children}
    </ReceiptContext.Provider>
  );
}
