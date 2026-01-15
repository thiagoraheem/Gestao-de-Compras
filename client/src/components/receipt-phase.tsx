import React, { useState, useMemo, useEffect, forwardRef, useImperativeHandle, useRef } from "react";
import { useLocation } from "wouter";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Dialog, DialogContent, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue, SelectGroup, SelectLabel } from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import PdfViewer from "./pdf-viewer";
import { ErrorBoundary } from "./error-boundary";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ReceiptSearchDialog } from "./receipt-search-dialog";
import { X, Check, Package, User, Building, Calendar, DollarSign, FileText, Download, Eye, Truck, ChevronDown, ChevronRight, Trash2, Search, AlertCircle } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";
import { URGENCY_LABELS, CATEGORY_LABELS, PHASE_LABELS } from "@/lib/types";
import { formatCurrency } from "@/lib/currency";
// import AttachmentsViewer from "./attachments-viewer";
// import ItemsViewer from "./items-viewer";
import { apiRequest } from "@/lib/queryClient";
import { cn } from "@/lib/utils";
import PendencyModal from "./pendency-modal";
import { NFEViewer } from "@/components/nfe/NFEViewer";
import { NFEList } from "@/components/nfe/NFEList";
import { CostCenterTreeSelect } from "@/components/fields/CostCenterTreeSelect";
import { ChartAccountTreeSelect } from "@/components/fields/ChartAccountTreeSelect";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { validateAllocationsAgainstLocador, formatReceiptApiError } from "../utils/locador-validation";
import { validateManualHeader, validateManualItems, validateEmitter, validateRecipient, validateTransport, validateProductTaxes, validateServiceData, computeIcms, computeIpi, computeIss, validateTotalConsistency } from "../utils/manual-nf-validation";
import { buildNFeXml, buildNFSeXml } from "../utils/xml-generation";
import { canConfirmReceipt, getInitialTabForMode } from "./receipt-phase-logic";

export function buildCostCenterTreeData(listInput: any[]) {
  const list = Array.isArray(listInput) ? listInput : [];
  const parents = list.filter((cc: any) => cc.parentId == null);
  const childrenMap = new Map<number, any[]>();
  for (const cc of list) {
    if (cc.parentId != null) {
      const pid = Number(cc.parentId);
      const arr = childrenMap.get(pid) || [];
      arr.push(cc);
      childrenMap.set(pid, arr);
    }
  }
  const result = parents.map((p: any) => {
    const pid = Number(p.idCostCenter ?? p.id);
    const childrenAll = (childrenMap.get(pid) || []).sort((a: any, b: any) => String(a.name || '').localeCompare(String(b.name || '')));
    const childrenWithGrand = childrenAll.map((c: any) => {
      const cid = Number(c.idCostCenter ?? c.id);
      const grandAll = (childrenMap.get(cid) || []).sort((a: any, b: any) => String(a.name || '').localeCompare(String(b.name || '')));
      return { node: c, grandchildren: grandAll, selectable: grandAll.length === 0 };
    });
    return { parent: p, children: childrenWithGrand };
  }).sort((a: any, b: any) => String(a.parent.name || '').localeCompare(String(b.parent.name || '')));
  return result;
}

export function computeInitialCcExpand(tree: any[]) {
  const lv1 = tree.map((g: any) => Number(g.parent.idCostCenter ?? g.parent.id)).filter(Boolean);
  const lv2 = tree.flatMap((g: any) => g.children.map((c: any) => Number(c.node.idCostCenter ?? c.node.id))).filter(Boolean);
  return { lv1, lv2 };
}

const MANUAL_ITEM_MATCH_THRESHOLD = 0.45;

const normalizeText = (value: string) =>
  value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();

const calculateTokenScore = (left: string, right: string) => {
  const leftTokens = new Set(left.split(" ").filter(Boolean));
  const rightTokens = new Set(right.split(" ").filter(Boolean));
  if (leftTokens.size === 0 || rightTokens.size === 0) return 0;
  let intersection = 0;
  leftTokens.forEach((token) => {
    if (rightTokens.has(token)) intersection += 1;
  });
  const maxSize = Math.max(leftTokens.size, rightTokens.size);
  return maxSize > 0 ? intersection / maxSize : 0;
};

const findBestPurchaseOrderMatch = (manualItem: any, poItems: any[]) => {
  if (!manualItem || poItems.length === 0) return null;
  const manualCode = normalizeText(String(manualItem.code || ""));
  const manualDesc = normalizeText(String(manualItem.description || ""));
  let best: { id: number; score: number } | null = null;

  for (const poItem of poItems) {
    const poCode = normalizeText(String(poItem.productCode || poItem.itemCode || poItem.code || ""));
    const poDesc = normalizeText(String(poItem.description || ""));
    let score = 0;

    if (manualCode && poCode) {
      if (manualCode === poCode) {
        score = 1;
      } else if (manualCode.includes(poCode) || poCode.includes(manualCode)) {
        score = Math.max(score, 0.85);
      }
    }

    if (manualDesc && poDesc) {
      if (manualDesc === poDesc) {
        score = Math.max(score, 0.9);
      } else if (manualDesc.includes(poDesc) || poDesc.includes(manualDesc)) {
        score = Math.max(score, 0.7);
      } else {
        score = Math.max(score, calculateTokenScore(manualDesc, poDesc));
      }
    }

    if (!best || score > best.score) {
      best = { id: poItem.id, score };
    }
  }

  return best;
};

interface ReceiptPhaseProps {
  request: any;
  onClose: () => void;
  className?: string;
  onPreviewOpen?: () => void;
  onPreviewClose?: () => void;
  mode?: 'view' | 'physical';
  hideTabsByDefault?: boolean;
  compactHeader?: boolean;
}

export interface ReceiptPhaseHandle {
  previewPDF: () => void;
  downloadPDF: () => void;
}

const ReceiptPhase = forwardRef((props: ReceiptPhaseProps, ref: React.Ref<ReceiptPhaseHandle>) => {
  const { request, onClose, className, onPreviewOpen, onPreviewClose, mode = 'view', hideTabsByDefault, compactHeader } = props;
  const [, setLocation] = useLocation();
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [isPendencyModalOpen, setIsPendencyModalOpen] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);
  const [isLoadingPreview, setIsLoadingPreview] = useState(false);
  const [pdfPreviewUrl, setPdfPreviewUrl] = useState<string | null>(null);
  const [pdfBuffer, setPdfBuffer] = useState<ArrayBuffer | null>(null);
  const [showPreviewModal, setShowPreviewModal] = useState(false);
  const [previewLoaded, setPreviewLoaded] = useState(false);
  const [showNFModal, setShowNFModal] = useState(false);
  const [receivedQuantities, setReceivedQuantities] = useState<Record<number, number>>({});
  const [receiptType, setReceiptType] = useState<"produto" | "servico" | "avulso">("produto");
  const [xmlPreview, setXmlPreview] = useState<any | null>(null);
  const [xmlRaw, setXmlRaw] = useState<string>("");
  const [isXmlUploading, setIsXmlUploading] = useState(false);
  const [xmlAttachmentId, setXmlAttachmentId] = useState<number | null>(null);
  const [nfReceiptId, setNfReceiptId] = useState<number | null>(null);
  const [xmlRecovered, setXmlRecovered] = useState(false);
  useEffect(() => {
    setActiveTab(getInitialTabForMode(mode));
  }, [mode]);

  useEffect(() => {
    try {
      const key = `xml_state_${request?.id}`;
      const raw = localStorage.getItem(key);
      if (raw) {
        const snap = JSON.parse(raw);
        if (snap?.xmlPreview) setXmlPreview(snap.xmlPreview);
        if (snap?.xmlRaw) setXmlRaw(snap.xmlRaw);
        setXmlAttachmentId(snap?.xmlAttachmentId ?? null);
        if (snap?.receiptId) setNfReceiptId(snap.receiptId);
        if (snap?.receiptType) setReceiptType(snap.receiptType);
        setXmlRecovered(true);
      }
    } catch {}
  }, [request?.id]);
  const [typeCategoryError, setTypeCategoryError] = useState<string>("");
  const [itemDecisions, setItemDecisions] = useState<Record<string, { confirmed: boolean }>>({});
  const [costCenters, setCostCenters] = useState<any[]>([]);
  const [chartAccounts, setChartAccounts] = useState<any[]>([]);
  const [expandedCoaLv1, setExpandedCoaLv1] = useState<Set<number>>(new Set());
  const [expandedCoaLv2, setExpandedCoaLv2] = useState<Set<number>>(new Set());
  const [expandedCcLv1, setExpandedCcLv1] = useState<Set<number>>(new Set());
  const [expandedCcLv2, setExpandedCcLv2] = useState<Set<number>>(new Set());
  const [manualTotal, setManualTotal] = useState<string>("");
  const [paymentMethodCode, setPaymentMethodCode] = useState<string>("");
  const [invoiceDueDate, setInvoiceDueDate] = useState<string>("");
  const [hasInstallments, setHasInstallments] = useState<boolean>(false);
  const [installmentCount, setInstallmentCount] = useState<number>(1);
  const [installments, setInstallments] = useState<Array<{ dueDate: string; amount: string; method?: string }>>([]);
  const [manualCostCenterId, setManualCostCenterId] = useState<number | null>(null);
  const [manualChartOfAccountsId, setManualChartOfAccountsId] = useState<number | null>(null);
  const [manualItems, setManualItems] = useState<Array<{ code?: string; description: string; unit?: string; quantity: number; unitPrice: number; purchaseOrderItemId?: number; matchSource?: "auto" | "manual" }>>([]);
  const [manualNFNumber, setManualNFNumber] = useState<string>("");
  const [manualNFSeries, setManualNFSeries] = useState<string>("");
  const [manualNFIssueDate, setManualNFIssueDate] = useState<string>("");
  const [manualNFEntryDate, setManualNFEntryDate] = useState<string>("");
  const [manualProductsValue, setManualProductsValue] = useState<string>("");
  const [manualFreightValue, setManualFreightValue] = useState<string>("");
  const [manualDiscountValue, setManualDiscountValue] = useState<string>("");
  const [manualIcmsBase, setManualIcmsBase] = useState<string>("");
  const [manualIcmsValue, setManualIcmsValue] = useState<string>("");
  const [manualOtherTaxes, setManualOtherTaxes] = useState<string>("");
  const [manualPaymentCondition, setManualPaymentCondition] = useState<string>("");
  const [manualBankDetails, setManualBankDetails] = useState<string>("");
  const [manualPaidAmount, setManualPaidAmount] = useState<string>("");
  const [manualNFEmitterCNPJ, setManualNFEmitterCNPJ] = useState<string>("");
  const [manualNFAccessKey, setManualNFAccessKey] = useState<string>("");
  const [manualNFStep, setManualNFStep] = useState<1 | 2 | 3>(1);
  const [manualErrors, setManualErrors] = useState<Record<string, string>>({});
  const [supplierMatch, setSupplierMatch] = useState<null | boolean>(null);
  const [activeTab, setActiveTab] = useState<'financeiro' | 'xml' | 'manual_nf' | 'items'>(getInitialTabForMode(mode));
  const [allocations, setAllocations] = useState<Array<{ costCenterId?: number; chartOfAccountsId?: number; amount?: string; percentage?: string }>>([]);
  const [allocationMode, setAllocationMode] = useState<'manual' | 'proporcional'>('manual');
  const [paymentMethods, setPaymentMethods] = useState<Array<{ code: string; name: string }>>([]);
  const [isLoadingPaymentMethods, setIsLoadingPaymentMethods] = useState(false);
  const [autoFilledRows, setAutoFilledRows] = useState<Set<number>>(new Set());
  const skipIntegrationRef = useRef(false);
  const [emitter, setEmitter] = useState<{ idSupplierERP?: string; cnpj?: string; name?: string; fantasyName?: string; ie?: string; im?: string; cnae?: string; crt?: string; address?: { street?: string; number?: string; neighborhood?: string; city?: string; uf?: string; cep?: string; country?: string; phone?: string } }>({});
  const [recipient, setRecipient] = useState<{ cnpjCpf?: string; name?: string; ie?: string; email?: string; address?: { street?: string; number?: string; neighborhood?: string; city?: string; uf?: string; cep?: string; country?: string; phone?: string } }>({});
  const [productTransp, setProductTransp] = useState<{ modFrete?: string; transporter?: { cnpj?: string; name?: string; ie?: string; address?: string; city?: string; uf?: string }; volume?: { quantity?: number; specie?: string } }>({});
  const [serviceData, setServiceData] = useState<{ itemListaServico?: string; codigoTributacaoMunicipio?: string; discriminacao?: string; codigoMunicipio?: string; valores?: { valorServicos?: number; valorDeducoes?: number; valorPis?: number; valorCofins?: number; valorInss?: number; valorIr?: number; valorCsll?: number; issRetido?: number; valorIss?: number; valorIssRetido?: number; baseCalculo?: number; aliquota?: number; valorLiquidoNfse?: number; descontoIncondicionado?: number; descontoCondicionado?: number } }>({});
  const [itemTaxes, setItemTaxes] = useState<Record<number, { vBC?: number; pICMS?: number; vICMS?: number; ipi?: { vBC?: number; pIPI?: number; vIPI?: number }; pis?: { cst?: string }; cofins?: { cst?: string } }>>({});

  // Check if user has permission to perform receipt actions
  const canPerformReceiptActions = user?.isReceiver || user?.isAdmin;
  const canConfirmNf = user?.isBuyer || user?.isAdmin;
  const isReceiverOnly = !!user?.isReceiver && !user?.isBuyer && !user?.isAdmin;

  // Buscar dados relacionados
  // Primeiro buscar o pedido de compra relacionado à solicitação
  const { data: purchaseOrder } = useQuery<any>({
    queryKey: [`/api/purchase-orders/by-request/${request?.id}`],
    enabled: !!request?.id,
  });

  // Buscar itens do pedido de compra (não da solicitação)
  const { data: items = [] } = useQuery<any[]>({
    queryKey: [`/api/purchase-orders/${purchaseOrder?.id}/items`],
    enabled: !!purchaseOrder?.id,
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
    enabled: !!request?.id,
  });

  const nfConfirmed = !!nfStatus?.nfConfirmed;
  useEffect(() => {
    if (nfStatus?.receiptId) setNfReceiptId(nfStatus.receiptId);
    if (nfConfirmed && nfStatus?.financialData) {
       try {
         const fd = nfStatus.financialData;
         if (fd.financial) {
           if (fd.financial.paymentMethodCode) setPaymentMethodCode(fd.financial.paymentMethodCode);
           if (fd.financial.invoiceDueDate) setInvoiceDueDate(fd.financial.invoiceDueDate);
         }
         if (fd.rateio) {
           if (fd.rateio.mode) setAllocationMode(fd.rateio.mode);
           if (Array.isArray(fd.rateio.allocations)) setAllocations(fd.rateio.allocations);
         }
       } catch (e) { console.error('Error restoring financial data', e); }
    }
  }, [nfStatus?.receiptId, nfConfirmed, nfStatus?.financialData]);

  useEffect(() => {
    if (!isReceiverOnly) return;
    // Se o modo for físico, permitir acesso à aba de itens para conferência
    if (mode === 'physical') return;
    
    if (nfConfirmed) {
      setActiveTab("items");
    } else {
      setActiveTab("xml");
    }
  }, [isReceiverOnly, nfConfirmed, mode]);

  // Fetch approval history
  const { data: approvalHistory = [] } = useQuery<any[]>({
    queryKey: [`/api/purchase-requests/${request.id}/approval-history`],
  });

  // Fetch supplier quotations to get selected supplier
  const { data: quotation } = useQuery<any>({
    queryKey: [`/api/quotations/purchase-request/${request.id}`],
  });

  const { data: supplierQuotations = [] } = useQuery<any[]>({
    queryKey: [`/api/quotations/${quotation?.id}/supplier-quotations`],
    enabled: !!quotation?.id,
  });

  // Get selected supplier quotation (ensure we find the chosen one)
  const selectedSupplierQuotation: any = supplierQuotations.find((sq: any) => sq.isChosen === true) || supplierQuotations[0];
  const { data: selectedSupplier } = useQuery<any>({
    queryKey: [`/api/suppliers/${selectedSupplierQuotation?.supplierId}`],
    enabled: !!selectedSupplierQuotation?.supplierId,
  });

  // Calculate freight value
  const freightValue = selectedSupplierQuotation?.includesFreight && selectedSupplierQuotation?.freightValue
    ? parseFloat(selectedSupplierQuotation.freightValue?.toString().replace(/[^\d.,]/g, '').replace(',', '.')) || 0
    : 0;

  // Fetch supplier quotation items with prices
  const { data: supplierQuotationItems = [] } = useQuery<any[]>({
    queryKey: [`/api/supplier-quotations/${selectedSupplierQuotation?.id}/items`],
    enabled: !!selectedSupplierQuotation?.id,
  });



  // Fetch quotation items to map descriptions
  const { data: quotationItems = [] } = useQuery<any[]>({
    queryKey: [`/api/quotations/${quotation?.id}/items`],
    enabled: !!quotation?.id,
  });

  // Ensure we have the latest request data including companyId
  const { data: freshRequest } = useQuery<any>({
    queryKey: [`/api/purchase-requests/${request?.id}`],
    enabled: !!request?.id,
    initialData: request
  });

  // Use freshRequest for critical fields
  const activeRequest = freshRequest || request;

  // Fetch company data to get idCompanyERP
  const { data: companyData, isLoading: isLoadingCompany } = useQuery<any>({
    queryKey: [`/api/companies/${activeRequest?.companyId}`],
    enabled: !!activeRequest?.companyId,
  });

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

  useEffect(() => {
    try {
      const key = `nf_draft_${request?.id}`;
      const raw = localStorage.getItem(key);
      if (raw) {
        const data = JSON.parse(raw);
        // Restore receipt type if saved
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
        setManualProductsValue(data.manualProductsValue || "");
        setManualFreightValue(data.manualFreightValue || "");
        setManualDiscountValue(data.manualDiscountValue || "");
        setManualIcmsBase(data.manualIcmsBase || "");
        setManualIcmsValue(data.manualIcmsValue || "");
        setManualOtherTaxes(data.manualOtherTaxes || "");
        setManualPaymentCondition(data.manualPaymentCondition || "");
        setManualBankDetails(data.manualBankDetails || "");
        setManualPaidAmount(data.manualPaidAmount || "");
        setManualNFEmitterCNPJ(data.manualNFEmitterCNPJ || "");
        setManualNFAccessKey(data.manualNFAccessKey || "");
        setManualItems(Array.isArray(data.manualItems) ? data.manualItems : []);
      }
    } catch {}
  }, [request?.id]);

  useEffect(() => {
    if (!xmlPreview) return;
    try {
      const h = xmlPreview?.header || {};
      const sup = h?.supplier || {};
      const dest = h?.recipient || {};
      const totals = h?.totals || {};
      setEmitter(prev => ({
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
      setRecipient(prev => ({
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
        setProductTransp(prev => ({
          ...prev,
          modFrete: h.transp.modFrete,
          transporter: {
            cnpj: h.transp.carrierCnpj,
            name: h.transp.carrierName,
          },
          volume: {
            quantity: h.transp.volumeQuantity ? Number(h.transp.volumeQuantity) : undefined,
            specie: h.transp.species,
          }
        }));
      }

      // Auto-fill manual header fields from XML
      if (h?.documentNumber || h?.nNF) setManualNFNumber(String(h.documentNumber || h.nNF));
      if (h?.documentSeries || h?.serie) setManualNFSeries(String(h.documentSeries || h.serie));
      
      const rawIssueDate = h?.issueDate || h?.dhEmi || h?.dEmi;
      if (rawIssueDate) {
        const d = String(rawIssueDate);
        setManualNFIssueDate(d.substring(0, 10));
      }

      const rawEntryDate = h?.entryDate || h?.dhSaiEnt || h?.dSaiEnt;
      if (rawEntryDate) {
        const d = String(rawEntryDate);
        setManualNFEntryDate(d.substring(0, 10));
      }

      if (h?.documentKey || h?.chNFe || h?.id) setManualNFAccessKey(String(h.documentKey || h.chNFe || h.id));
      if (h?.supplier?.cnpjCpf) setManualNFEmitterCNPJ(String(h.supplier.cnpjCpf).replace(/\D/g, ""));
      if (totals?.vNF) setManualTotal(String(totals.vNF));

      if (receiptType === "servico") {
        setServiceData(prev => ({
          ...prev,
          discriminacao: xmlPreview?.items?.[0]?.description || prev.discriminacao,
          codigoMunicipio: String((xmlPreview?.items?.[0]?.codigoMunicipio ?? prev.codigoMunicipio ?? "")),
          valores: {
            ...(prev.valores || {}),
            valorServicos: Number((totals?.vNF ?? prev.valores?.valorServicos ?? 0)),
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

  useEffect(() => {
    if (selectedSupplier?.idSupplierERP) {
      setEmitter(prev => ({ ...prev, idSupplierERP: selectedSupplier.idSupplierERP }));
    }
  }, [selectedSupplier]);

  useEffect(() => {
    try {
      const key = `nf_draft_${request?.id}`;
      const data = {
        receiptType, // Persist receipt type
        emitter, recipient, productTransp, serviceData, itemTaxes,
        manualNFNumber, manualNFSeries, manualNFIssueDate, manualNFEntryDate, manualNFEmitterCNPJ, manualNFAccessKey, manualItems,
        manualProductsValue, manualFreightValue, manualDiscountValue, manualIcmsBase, manualIcmsValue, manualOtherTaxes,
        manualPaymentCondition, manualBankDetails, manualPaidAmount,
      };
      localStorage.setItem(key, JSON.stringify(data));
    } catch {}
  }, [request?.id, receiptType, emitter, recipient, productTransp, serviceData, itemTaxes, manualNFNumber, manualNFSeries, manualNFIssueDate, manualNFEntryDate, manualNFEmitterCNPJ, manualNFAccessKey, manualItems, manualProductsValue, manualFreightValue, manualDiscountValue, manualIcmsBase, manualIcmsValue, manualOtherTaxes, manualPaymentCondition, manualBankDetails, manualPaidAmount]);
  useEffect(() => {
    if (receiptType === "avulso") {
      const hadXml = !!xmlPreview;
      setXmlPreview(null);
      setXmlRaw("");
      setItemDecisions({});
      setSupplierMatch(null);
      // Removed clearing of manual fields to prevent data loss when restoring state
      // setManualNFNumber("");
      // setManualNFSeries("");
      // setManualNFIssueDate("");
      // setManualNFEntryDate("");
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
    fetch("/api/integracao-locador/centros-custo")
      .then(async (r) => {
        try { const d = await r.json(); return Array.isArray(d) ? d : []; } catch (e) { console.error('locador centros-custo parse error', e); return []; }
      })
      .then((d) => { console.log('locador centros-custo loaded', Array.isArray(d) ? d.length : 0); setCostCenters(d); })
      .catch((e) => { console.error('locador centros-custo request error', e); setCostCenters([]); });

    fetch("/api/plano-contas")
      .then(async (r) => {
        try { const d = await r.json(); return Array.isArray(d) ? d : []; } catch (e) { console.error('locador plano-contas parse error', e); return []; }
      })
      .then((d) => { console.log('locador plano-contas loaded', Array.isArray(d) ? d.length : 0); setChartAccounts(d); })
      .catch((e) => { console.error('locador plano-contas request error', e); setChartAccounts([]); });
    setIsLoadingPaymentMethods(true);
    fetch("/api/integracao-locador/formas-pagamento")
      .then(async (r) => {
        try { const d = await r.json(); return Array.isArray(d) ? d : []; } catch { return []; }
      })
      .then((d) => {
        if (Array.isArray(d) && d.length > 0) {
          const mapped = d.map((pm: any) => ({ 
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
      })
      .catch(() => {
        setPaymentMethods([
          { code: "boleto", name: "Boleto" },
          { code: "cheque", name: "Cheque" },
          { code: "transferencia", name: "Transferência Bancária" },
          { code: "cartao_credito", name: "Cartão de Crédito" },
          { code: "dinheiro", name: "Dinheiro" },
          { code: "pix", name: "Pix" },
        ]);
      })
      .finally(() => {
        setIsLoadingPaymentMethods(false);
      });
  }, []);

  useEffect(() => {
    try {
      const key = `receipt_flow_${request?.id}`;
      const raw = localStorage.getItem(key);
      if (raw) {
        const data = JSON.parse(raw);
        if (data.paymentMethodCode) setPaymentMethodCode(String(data.paymentMethodCode));
        if (data.invoiceDueDate) setInvoiceDueDate(String(data.invoiceDueDate));
        if (data.receiptType) setReceiptType(data.receiptType);
        if (data.manualNFNumber) setManualNFNumber(data.manualNFNumber);
        if (data.manualNFSeries) setManualNFSeries(data.manualNFSeries);
        if (data.manualNFIssueDate) setManualNFIssueDate(data.manualNFIssueDate);
        if (data.manualNFEntryDate) setManualNFEntryDate(data.manualNFEntryDate);
        if (data.manualProductsValue) setManualProductsValue(data.manualProductsValue);
        if (data.manualFreightValue) setManualFreightValue(data.manualFreightValue);
        if (data.manualDiscountValue) setManualDiscountValue(data.manualDiscountValue);
        if (data.manualIcmsBase) setManualIcmsBase(data.manualIcmsBase);
        if (data.manualIcmsValue) setManualIcmsValue(data.manualIcmsValue);
        if (data.manualOtherTaxes) setManualOtherTaxes(data.manualOtherTaxes);
        if (data.manualPaymentCondition) setManualPaymentCondition(data.manualPaymentCondition);
        if (data.manualBankDetails) setManualBankDetails(data.manualBankDetails);
        if (data.manualPaidAmount) setManualPaidAmount(data.manualPaidAmount);
        if (data.manualNFEmitterCNPJ) setManualNFEmitterCNPJ(data.manualNFEmitterCNPJ);
        if (data.manualNFAccessKey) setManualNFAccessKey(data.manualNFAccessKey);
        if (data.manualNFStep) setManualNFStep(data.manualNFStep);
        if (data.manualTotal) setManualTotal(data.manualTotal);
        if (Array.isArray(data.manualItems)) setManualItems(data.manualItems);
        if (Array.isArray(data.allocations)) setAllocations(data.allocations);
        if (data.allocationMode) setAllocationMode(data.allocationMode);
        if (data.hasInstallments != null) setHasInstallments(!!data.hasInstallments);
        if (Array.isArray(data.installments)) setInstallments(data.installments);
        if (data.installmentCount != null) setInstallmentCount(Number(data.installmentCount));
      }
    } catch {}
  }, [request?.id]);

  useEffect(() => {
    try {
      const key = `receipt_flow_${request?.id}`;
      const payload = {
        paymentMethodCode,
        invoiceDueDate,
        receiptType,
        manualNFNumber,
        manualNFSeries,
        manualNFIssueDate,
        manualNFEntryDate,
        manualProductsValue, manualFreightValue, manualDiscountValue, manualIcmsBase, manualIcmsValue, manualOtherTaxes,
        manualPaymentCondition, manualBankDetails, manualPaidAmount,
        manualNFEmitterCNPJ,
        manualNFAccessKey,
        manualNFStep,
        manualTotal,
        manualItems,
        allocations,
        allocationMode,
        activeTab,
        hasInstallments,
        installmentCount,
        installments,
      };
      localStorage.setItem(key, JSON.stringify(payload));
    } catch {}
  }, [paymentMethodCode, invoiceDueDate, receiptType, manualNFNumber, manualNFSeries, manualNFIssueDate, manualNFEntryDate, manualNFEmitterCNPJ, manualNFAccessKey, manualNFStep, manualTotal, manualItems, allocations, allocationMode, activeTab, request?.id, manualProductsValue, manualFreightValue, manualDiscountValue, manualIcmsBase, manualIcmsValue, manualOtherTaxes, manualPaymentCondition, manualBankDetails, manualPaidAmount]);

  const [showClearConfirm, setShowClearConfirm] = useState(false);
  const handleResetConfirmed = () => {
    try {
      const backupDraftKey = `nf_draft_backup_${request?.id}`;
      const backupFlowKey = `receipt_flow_backup_${request?.id}`;
      const draftKey = `nf_draft_${request?.id}`;
      const flowKey = `receipt_flow_${request?.id}`;
      const currentDraft = {
        emitter, recipient, productTransp, serviceData, itemTaxes, manualItems,
        manualNFNumber, manualNFSeries, manualNFIssueDate, manualNFEntryDate, manualNFEmitterCNPJ, manualNFAccessKey,
      };
      const currentFlow = {
        paymentMethodCode, invoiceDueDate, receiptType, manualNFStep, manualTotal, allocations, allocationMode, activeTab,
        hasInstallments, installmentCount, installments,
      };
      sessionStorage.setItem(backupDraftKey, JSON.stringify(currentDraft));
      sessionStorage.setItem(backupFlowKey, JSON.stringify(currentFlow));
      localStorage.removeItem(draftKey);
      localStorage.removeItem(flowKey);
      sessionStorage.removeItem(draftKey);
      sessionStorage.removeItem(flowKey);
    } catch {}
    try {
      setReceivedQuantities({});
      setReceiptType("produto");
      setXmlPreview(null);
      setXmlRaw("");
      setIsXmlUploading(false);
      setXmlAttachmentId(null);
      setNfReceiptId(null);
      setTypeCategoryError("");
      setItemDecisions({});
      setManualTotal("");
      setPaymentMethodCode("");
      setInvoiceDueDate("");
      setManualCostCenterId(null);
      setManualChartOfAccountsId(null);
      setEmitter({});
      setRecipient({});
      setProductTransp({});
      setServiceData({});
      setItemTaxes({});
      setManualItems([]);
      setManualNFNumber("");
      setManualNFSeries("");
      setManualNFIssueDate("");
      setManualNFEntryDate("");
      setManualProductsValue("");
      setManualFreightValue("");
      setManualDiscountValue("");
      setManualIcmsBase("");
      setManualIcmsValue("");
      setManualOtherTaxes("");
      setManualPaymentCondition("");
      setManualBankDetails("");
      setManualPaidAmount("");
      setManualNFEmitterCNPJ("");
      setManualNFAccessKey("");
      setManualNFStep(1);
      setManualErrors({});
      setSupplierMatch(null);
      setAllocations([]);
      setAllocationMode("manual");
      setAutoFilledRows(new Set());
      setActiveTab("xml");
      setHasInstallments(false);
      setInstallmentCount(1);
      setInstallments([]);
      toast({ title: "Formulário reiniciado", description: "Dados limpos. Um backup temporário foi criado na sessão." });
    } catch {
      toast({ title: "Erro", description: "Falha ao reiniciar o formulário", variant: "destructive" });
    } finally {
      setShowClearConfirm(false);
    }
  };

  const onUploadXml = async (file: File | null) => {
    if (!file) return;
    if (!file.name.toLowerCase().endsWith(".xml")) {
      toast({ title: "Erro", description: "Selecione um arquivo .xml", variant: "destructive" });
      return;
    }
    try {
      setIsXmlUploading(true);
      const raw = await file.text();
      setXmlRaw(raw);
      const fd = new FormData();
      fd.append("file", file);
      fd.append("purchaseRequestId", String(request.id));
      fd.append("receiptType", String(receiptType));
      const res = await fetch("/api/recebimentos/import-xml", { method: "POST", body: fd });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.message || "Falha na importação");
      }
      const data = await res.json();
      const preview = data.preview || data;
      setXmlPreview(preview);
      setXmlAttachmentId(data.attachment?.id ?? null);
      setNfReceiptId(data.receipt?.id ?? null);

      // Auto-fill totals from XML preview
      if (preview?.totals) {
        setManualProductsValue(String(preview.totals.vProd || ""));
        setManualFreightValue(String(preview.totals.vFrete || ""));
        setManualDiscountValue(String(preview.totals.vDesc || ""));
        setManualIcmsBase(String(preview.totals.vBC || ""));
        setManualIcmsValue(String(preview.totals.vICMS || ""));
        setManualOtherTaxes(String(preview.totals.vOutro || ""));
        setManualTotal(String(preview.totals.vNF || ""));
      }

      try {
        const xmlCnpjCpf = String(preview?.header?.supplier?.cnpjCpf || "").replace(/\D+/g, "");
        const poCnpj = String(selectedSupplier?.cnpj || "").replace(/\D+/g, "");
        if (xmlCnpjCpf && poCnpj) setSupplierMatch(xmlCnpjCpf === poCnpj);
        else setSupplierMatch(null);
      } catch { setSupplierMatch(null); }
      try {
        const stateKey = `xml_state_${request.id}`;
        const histKey = `xml_history_${request.id}`;
      const snapshot = { xmlRaw: raw, xmlPreview: preview, xmlAttachmentId: data.attachment?.id ?? null, receiptId: data.receipt?.id ?? null, receiptType, timestamp: new Date().toISOString() };
        localStorage.setItem(stateKey, JSON.stringify(snapshot));
        const existing = localStorage.getItem(histKey);
        const history = existing ? JSON.parse(existing) : [];
        history.push({ timestamp: snapshot.timestamp, attachmentId: snapshot.xmlAttachmentId, itemsCount: Array.isArray(preview?.items) ? preview.items.length : 0, totals: preview?.totals });
        localStorage.setItem(histKey, JSON.stringify(history));
      } catch {}
      setXmlRecovered(true);
      if (data.warning) {
        toast({ 
          title: "Aviso: XML já importado", 
          description: data.warning + " Os dados foram carregados para conferência.", 
          variant: "destructive" 
        });
      } else {
        toast({ title: "XML importado", description: receiptType === "servico" ? "Dados preenchidos a partir do XML da NFS-e" : "Dados preenchidos a partir do XML da NF-e" });
      }
    } catch (e: any) {
      toast({ title: "Erro", description: e.message, variant: "destructive" });
    }
    finally {
      setIsXmlUploading(false);
    }
  };

  const totals = useMemo(() => {
    if (!xmlPreview?.items) return { icms: 0, ipi: 0, pis: 0, cofins: 0 };
    return (xmlPreview.items as any[]).reduce((acc, it: any) => {
      acc.icms += Number(it.taxes?.icmsAmount || 0);
      acc.ipi += Number(it.taxes?.ipiAmount || 0);
      acc.pis += Number(it.taxes?.pisAmount || 0);
      acc.cofins += Number(it.taxes?.cofinsAmount || 0);
      return acc;
    }, { icms: 0, ipi: 0, pis: 0, cofins: 0 });
  }, [xmlPreview]);

  const poLookup = useMemo(() => {
    const map = new Map<string, any>();
    (items || []).forEach((it: any) => {
      const key = (it.description || it.itemCode || String(it.id)).trim().toLowerCase();
      map.set(key, it);
    });
    return map;
  }, [items]);

  const compareStatus = (poItem: any, nfItem: any) => {
    const sameDesc = poItem?.description && nfItem?.description && poItem.description.trim().toLowerCase() === nfItem.description.trim().toLowerCase();
    const qtyPo = Number(poItem?.quantity || poItem?.requestedQuantity || 0);
    const qtyNf = Number(nfItem?.quantity || 0);
    const unitPricePo = Number(poItem?.unitPrice || 0);
    const unitPriceNf = Number(nfItem?.unitPrice || 0);
    if (!sameDesc) return "orange";
    if (qtyPo !== qtyNf) return "yellow";
    if (unitPricePo !== unitPriceNf) return "red";
    return "ok";
  };

  const nfItemsDecorated = useMemo(() => {
    const list = Array.isArray(xmlPreview?.items) ? xmlPreview.items : [];
    return list.map((nf: any, idx: number) => {
      const key = (nf.description || nf.itemCode || String(nf.lineNumber || idx)).trim().toLowerCase();
      const poItem = poLookup.get(key);
      const status = compareStatus(poItem, nf);
      return { nf, poItem, status };
    });
  }, [xmlPreview, poLookup]);

  const costCenterTree = useMemo(() => buildCostCenterTreeData(costCenters), [costCenters]);

  useEffect(() => {
    const { lv1, lv2 } = computeInitialCcExpand(costCenterTree);
    setExpandedCcLv1(new Set(lv1));
    setExpandedCcLv2(new Set(lv2));
  }, [costCenterTree.length]);

  const toggleCcLv1 = (id: number) => {
    setExpandedCcLv1((prev: Set<number>) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };
  const toggleCcLv2 = (id: number) => {
    setExpandedCcLv2((prev: Set<number>) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const chartAccountTree = useMemo(() => {
    const list = Array.isArray(chartAccounts) ? chartAccounts : [];
    const parents = list.filter((pc: any) => pc.parentId == null);
    const childrenMap = new Map<number, any[]>();
    for (const pc of list) {
      if (pc.parentId != null) {
        const arr = childrenMap.get(pc.parentId) || [];
        arr.push(pc);
        childrenMap.set(pc.parentId, arr);
      }
    }
    const byId = new Map<number, any>();
    list.forEach((pc: any) => { const id = (pc.idChartOfAccounts ?? pc.id); if (id != null) byId.set(Number(id), pc); });
    const result = parents.map((p: any) => {
      const pid = Number(p.idChartOfAccounts ?? p.id);
      const childrenAll = (childrenMap.get(pid) || []).sort((a: any, b: any) => String((a.accountName ?? a.name) || '').localeCompare(String((b.accountName ?? b.name) || '')));
      const childrenWithGrand = childrenAll.map((c: any) => {
        const cid = Number(c.idChartOfAccounts ?? c.id);
        const grandAll = (childrenMap.get(cid) || []).sort((a: any, b: any) => String((a.accountName ?? a.name) || '').localeCompare(String((b.accountName ?? b.name) || '')));
        const grandPayable = grandAll.filter((g: any) => g.isPayable === true);
        const isChildPayable = c.isPayable === true;
        return { node: c, grandchildren: grandPayable, selectable: isChildPayable && grandPayable.length === 0 };
      });
      // filter children: keep those selectable or that have payable grandchildren
      const childrenFiltered = childrenWithGrand.filter((c: any) => c.selectable || c.grandchildren.length > 0);
      return {
        parent: p,
        children: childrenFiltered
      };
    }).filter((g: any) => g.children.length > 0)
      .sort((a: any, b: any) => String((a.parent.accountName ?? a.parent.name) || '').localeCompare(String((b.parent.accountName ?? b.parent.name) || '')));
    return result;
  }, [chartAccounts]);

  useEffect(() => {
    const parents = chartAccountTree.map((g: any) => Number(g.parent.idChartOfAccounts ?? g.parent.id)).filter(Boolean);
    setExpandedCoaLv1(new Set(parents));
    const subs = chartAccountTree.flatMap((g: any) => g.children.map((c: any) => Number(c.node.idChartOfAccounts ?? c.node.id))).filter(Boolean);
    setExpandedCoaLv2(new Set(subs));
  }, [chartAccountTree.length]);

  const toggleLv1 = (id: number) => {
    setExpandedCoaLv1(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };
  const toggleLv2 = (id: number) => {
    setExpandedCoaLv2(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  // Mutations for receipt actions
  const confirmNfMutation = useMutation({
    mutationFn: async () => {
      const normalizedItems = receiptType === "servico"
        ? manualItems.map((item: any, index: number) => ({
            lineNumber: index + 1,
            description: item.description,
            unit: item.unit || "SV",
            quantity: 1,
            unitPrice: Number(item.netValue ?? item.unitPrice ?? 0),
            totalPrice: Number(item.netValue ?? item.unitPrice ?? 0),
            purchaseOrderItemId: item.purchaseOrderItemId,
          }))
        : manualItems.map((item: any, index: number) => ({
            lineNumber: index + 1,
            description: item.description,
            unit: item.unit || "UN",
            quantity: Number(item.quantity ?? 0),
            unitPrice: Number(item.unitPrice ?? 0),
            totalPrice: Number((Number(item.quantity ?? 0) * Number(item.unitPrice ?? 0)).toFixed(2)),
            ncm: item.ncm,
            purchaseOrderItemId: item.purchaseOrderItemId,
          }));
      return apiRequest(`/api/purchase-requests/${request?.id}/confirm-nf`, {
        method: "POST",
        body: {
          receiptType,
          purchaseOrderId: purchaseOrder?.id,
          nfNumber: manualNFNumber,
          nfSeries: manualNFSeries,
          nfIssueDate: manualNFIssueDate,
          nfEntryDate: manualNFEntryDate,
          nfTotal: manualTotal,
          nfAccessKey: manualNFAccessKey,
          manualItems: receiptType === "avulso" ? [] : normalizedItems,
          xmlReceiptId: nfReceiptId,
          paymentMethodCode,
          invoiceDueDate,
          allocations,
          allocationMode,
        },
      });
    },
    onSuccess: (data: any) => {
      if (data?.receipt?.id) setNfReceiptId(data.receipt.id);
      queryClient.invalidateQueries({ queryKey: [`/api/purchase-requests/${request?.id}/nf-status`] });
      toast({ title: "NF confirmada", description: "Nota Fiscal validada com sucesso." });
      setActiveTab("items");
    },
    onError: (error: any) => {
      toast({
        title: "Erro ao confirmar NF",
        description: error?.message || "Não foi possível confirmar a Nota Fiscal.",
        variant: "destructive",
      });
    },
  });

  const confirmPhysicalMutation = useMutation({
    mutationFn: async () => {
      const hasAnyQty = Object.values(receivedQuantities).some(v => Number(v) > 0);
      if (!hasAnyQty) throw new Error("Informe as quantidades recebidas");

      const response = await apiRequest(
        `/api/purchase-requests/${request?.id}/confirm-physical`,
        {
          method: "POST",
          body: {
            receivedQuantities,
            manualNFNumber,
            manualNFSeries,
            observations: "Confirmado via Recebimento Físico"
          },
        }
      );
      return response;
    },
    onSuccess: async (data: any) => {
      queryClient.invalidateQueries({ queryKey: ["/api/purchase-requests"] });
      toast({ title: "Sucesso", description: "Recebimento físico confirmado!" });
      
      if (data.isFullyComplete) {
         try {
           await apiRequest(`/api/purchase-requests/${request?.id}/finalize-receipt`, { method: "POST" });
           toast({ title: "Processo Concluído", description: "Recebimento finalizado e integrado!" });
         } catch (e) {
           console.error("Error finalizing", e);
         }
      }
      onClose();
    },
    onError: (err: any) => {
      toast({ title: "Erro", description: err.message || "Erro ao confirmar", variant: "destructive" });
    }
  });

  const confirmReceiptMutation = useMutation({
    onMutate: () => {
      console.log("Starting confirmation mutation...");
      console.log("Active request object:", activeRequest);
      console.log("Company ID from request:", activeRequest?.companyId);
      console.log("Company Data fetched:", companyData);
      console.log("Allocations:", allocations);
    },
    mutationFn: async () => {
      try {
        if (receiptType === "avulso") {
          try {
            await apiRequest(`/api/audit/log`, {
              method: "POST",
              body: {
                purchaseRequestId: activeRequest?.id,
                actionType: "recebimento_avulso_confirm",
                actionDescription: "Confirmação de recebimento em modo Avulso",
                beforeData: {
                  xmlPreviewExists: !!xmlPreview,
                },
                afterData: {
                  nf: {
                    number: manualNFNumber,
                    series: manualNFSeries,
                    issueDate: manualNFIssueDate,
                    entryDate: manualNFEntryDate,
                    total: manualTotal,
                  },
                  manualCostCenterId,
                  manualChartOfAccountsId,
                  itemsCount: manualItems.length,
                },
              },
            });
          } catch {}
        }
      } catch {}
      try {
        const validation = validateAllocationsAgainstLocador(allocations, costCenters, chartAccounts);
        console.log("validation:locador", { allocations, sources: validation.sources, invalidRows: validation.invalidRows });
        await apiRequest(`/api/audit/log`, {
          method: "POST",
          body: {
            purchaseRequestId: activeRequest?.id,
            actionType: "recebimento_validacao_rateio",
            actionDescription: "Validação de rateio usando dados do Locador",
            beforeData: {
              allocationsCount: allocations.length,
            },
            afterData: {
              isValid: validation.isValid,
              invalidRows: validation.invalidRows,
              sources: validation.sources,
            },
          },
        });
        if (!validation.isValid) {
          throw new Error(formatReceiptApiError("Validação de rateio falhou", validation.invalidRows));
        }

        // Integration with Locador
        // Mapeamento e parcelamento conforme requisitos:
        // - pedido_id: purchaseOrder.id
        // - numero_pedido: purchaseOrder.orderNumber (ou number como fallback)
        // - request_number: número da solicitação
        // - solicitacao_id: ID da solicitação
        // - parcelas_detalhes: lista de parcelas (vencimento/valor/forma/número)
        const parcelasDetalhes: Array<{
          data_vencimento: string;
          valor: number;
          forma_pagamento: number;
          numero_parcela: number;
        }> = (() => {
          const toNumber2 = (v: any) => {
            const n = parseFloat(String(v ?? "0").replace(",", "."));
            return Number.isFinite(n) ? Number(n.toFixed(2)) : NaN;
          };
          const baseMethod = Number(paymentMethodCode);
          if (hasInstallments) {
            const rows = installments || [];
            if (rows.length === 0) return [];
            return rows.map((row, idx) => {
              const amt = toNumber2(row.amount);
              const method = Number(row.method ?? paymentMethodCode);
              return {
                data_vencimento: row.dueDate,
                valor: amt,
                forma_pagamento: method,
                numero_parcela: idx + 1,
              };
            });
          } else {
            const amt = Number(baseTotalForAllocation.toFixed(2));
            return invoiceDueDate
              ? [
                  {
                    data_vencimento: invoiceDueDate,
                    valor: amt,
                    forma_pagamento: baseMethod,
                    numero_parcela: 1,
                  },
                ]
              : [];
          }
        })();
        const purchaseReceivePayload = {
          pedido_id: purchaseOrder?.id,
          numero_pedido: purchaseOrder?.orderNumber || purchaseOrder?.number,
          numero_solicitacao: activeRequest?.requestNumber,
          solicitacao_id: activeRequest?.id,
          data_pedido: purchaseOrder?.createdAt ? new Date(purchaseOrder.createdAt).toISOString() : new Date().toISOString(),
          justificativa: activeRequest?.justification || "",
          fornecedor: {
            fornecedor_id: selectedSupplier?.idSupplierERP || selectedSupplierQuotation?.supplier?.idSupplierERP,
            cnpj: selectedSupplier?.cnpj || selectedSupplierQuotation?.supplier?.cnpj,
            nome: selectedSupplier?.name || selectedSupplierQuotation?.supplier?.name
          },
          nota_fiscal: {
            numero: (xmlPreview?.header?.number) || manualNFNumber || "",
            serie: (xmlPreview?.header?.series) || manualNFSeries || "",
            chave_nfe: (xmlPreview?.header?.accessKey) || manualNFAccessKey || "",
            data_emissao: (xmlPreview?.header?.issueDate) || manualNFIssueDate || "",
            valor_total: (xmlPreview?.header?.totals?.vNF || xmlPreview?.header?.totals?.total)
              ? Number(xmlPreview?.header?.totals?.vNF || xmlPreview?.header?.totals?.total)
              : parseFloat(String(manualTotal || "0").replace(',', '.'))
          },
          condicoes_pagamento: {
            empresa_id: companyData?.idCompanyERP ?? activeRequest?.companyId,
            forma_pagamento: Number(paymentMethodCode),
            data_vencimento: invoiceDueDate,
            parcelas: hasInstallments ? installmentCount : 1,
            parcelas_detalhes: parcelasDetalhes,
            rateio: allocations.map(a => ({
              centro_custo_id: a.costCenterId,
              plano_conta_id: a.chartOfAccountsId,
              valor: Number(a.amount || 0),
              percentual: Number(a.percentage || 0)
            }))
          },
          itens: items.map((item: any) => ({
            produto_id: item.productId,
            codigo: item.productCode,
            descricao: item.description,
            unidade: item.unit,
            quantidade: Number(receivedQuantities[item.id] || 0),
            preco_unitario: Number(item.unitPrice || 0),
            valor_total: Number(receivedQuantities[item.id] || 0) * Number(item.unitPrice || 0),
          }))
        };

        console.log("Submitting to Locador:", purchaseReceivePayload);
        
        // Validação de parcelas detalhadas
        {
          const det = purchaseReceivePayload.condicoes_pagamento.parcelas_detalhes || [];
          if (!Array.isArray(det) || det.length === 0) {
            throw new Error("Nenhuma parcela detalhada encontrada nas condições de pagamento.");
          }
          const invalids = det.filter(
            (p) =>
              !p.data_vencimento ||
              !Number.isFinite(p.valor) ||
              p.valor <= 0 ||
              !Number.isFinite(p.forma_pagamento) ||
              !Number.isFinite(p.numero_parcela) ||
              p.numero_parcela < 1,
          );
          if (invalids.length > 0) {
            console.error("CRITICAL: Parcelas detalhadas inválidas!", { invalids, det });
            throw new Error("Uma ou mais parcelas detalhadas estão inválidas. Verifique vencimentos, valores e forma de pagamento.");
          }
        }

        // Validação de campos obrigatórios de identificação do pedido
        if (!purchaseReceivePayload.pedido_id) {
           console.error("CRITICAL: Purchase Order ID is missing!", { purchaseOrder });
           throw new Error("ID do Pedido de Compra não identificado. Verifique se o pedido foi gerado corretamente.");
        }
        if (!purchaseReceivePayload.numero_pedido) {
           console.error("CRITICAL: Purchase Order Number is missing!", { purchaseOrder });
           throw new Error("Número do Pedido de Compra não identificado.");
        }
        if (!purchaseReceivePayload.solicitacao_id) {
           console.error("CRITICAL: Request ID is missing!", { activeRequest });
           throw new Error("ID da Solicitação não identificado.");
        }

        // Validation check for Supplier
        if (!purchaseReceivePayload.fornecedor.cnpj) {
           console.error("CRITICAL: Supplier data is missing!", { 
             selectedSupplier, 
             selectedSupplierQuotation,
             supplierFromQuotation: selectedSupplierQuotation?.supplier
           });
           throw new Error("Dados do fornecedor (CNPJ) não identificados. Por favor, verifique o cadastro do fornecedor.");
        }

        // Validation check
        if (!skipIntegrationRef.current) {
          if (!purchaseReceivePayload.condicoes_pagamento.empresa_id) {
             console.error("CRITICAL: empresa_id is missing!", { 
               companyDataId: companyData?.idCompanyERP, 
               requestCompanyId: activeRequest?.companyId,
               companyData
             });
             throw new Error("ID da empresa não identificado. Por favor, verifique se a empresa está configurada corretamente.");
          }

          await apiRequest("/api/integracao-locador/recebimento", {
            method: "POST",
            body: purchaseReceivePayload
          });
        } else {
          try {
            await apiRequest(`/api/audit/log`, {
              method: "POST",
              body: {
                purchaseRequestId: activeRequest?.id,
                actionType: "recebimento_sem_integracao_locador",
                actionDescription: "Integração com Locador não realizada (idSupplierERP ausente)",
                beforeData: { 
                  supplierId: selectedSupplier?.id || selectedSupplierQuotation?.supplierId,
                  supplierName: selectedSupplier?.name || selectedSupplierQuotation?.supplier?.name
                },
                afterData: null,
                affectedTables: ["receipts"],
              },
            });
          } catch {}
        }

      } catch (e) {
        if (e instanceof Error) {
          throw e;
        }
      }
      // Calculate final status
      const isComplete = (() => {
        if (receiptType === "avulso") return true;
        if (!Array.isArray(itemsWithPrices) || itemsWithPrices.length === 0) return true;
        
        return itemsWithPrices.every((it: any) => {
          const prev = Number(it.quantityReceived || 0);
          const current = Number(receivedQuantities[it.id] || 0);
          const max = Number(it.quantity || 0);
          return (prev + current) >= max;
        });
      })();

      const response = await apiRequest(`/api/purchase-requests/${activeRequest?.id}/confirm-receipt`, {
        method: "POST",
        body: {
          receivedById: user?.id,
          receiptMode: receiptType,
          finalStatus: isComplete,
          paymentMethodCode,
          invoiceDueDate,
          nfNumber: receiptType === "avulso" ? manualNFNumber : undefined,
          nfSeries: receiptType === "avulso" ? manualNFSeries : undefined,
          nfIssueDate: receiptType === "avulso" ? manualNFIssueDate : undefined,
          nfEntryDate: receiptType === "avulso" ? manualNFEntryDate : undefined,
          nfTotal: receiptType === "avulso" ? manualTotal : undefined,
          manualItems: receiptType === "avulso" ? manualItems : undefined,
          receivedQuantities: receiptType !== "avulso" ? receivedQuantities : undefined,
          allocations: allocations.length > 0 ? allocations.map((a) => ({
            costCenterId: a.costCenterId,
            chartOfAccountsId: a.chartOfAccountsId,
            amount: a.amount,
            percentage: a.percentage,
          })) : undefined,
          allocationMode: allocations.length > 0 ? allocationMode : undefined,
        },
      });
      return { response, isComplete };
    },
    onSuccess: (data: any) => {
      queryClient.invalidateQueries({ queryKey: ["/api/purchase-requests"] });
      const { isComplete } = data;

      toast({
        title: "Sucesso",
        description: isComplete ? "Recebimento confirmado!" : "Recebimento parcial registrado com sucesso.",
      });
      
      onClose();
    },
    onError: (error: any) => {
      const apiMsg = error?.message || "Falha ao confirmar o recebimento";
      const validation = validateAllocationsAgainstLocador(allocations, costCenters, chartAccounts);
      const description = formatReceiptApiError(apiMsg, validation.invalidRows);
      toast({
        title: "Erro ao confirmar recebimento",
        description,
        variant: "destructive",
      });
    },
  });

  const reportIssueMutation = useMutation({
    mutationFn: async (pendencyReason: string) => {
      const response = await apiRequest(`/api/purchase-requests/${request.id}/report-issue`, {
        method: "POST",
        body: { reportedById: user?.id, pendencyReason },
      });
      return response;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/purchase-requests"] });
      setIsPendencyModalOpen(false);
      toast({
        title: "Pendência Reportada",
        description: "Item retornado para Pedido de Compra com tag de pendência.",
        variant: "destructive",
      });
      onClose();
    },
    onError: () => {
      toast({
        title: "Erro",
        description: "Não foi possível reportar a pendência",
        variant: "destructive",
      });
    },
  });

  // Função para gerar pré-visualização do PDF
  const arrayBufferToBase64 = (buffer: ArrayBuffer) => {
    let binary = "";
    const bytes = new Uint8Array(buffer);
    const chunkSize = 0x8000;
    for (let i = 0; i < bytes.byteLength; i += chunkSize) {
      const chunk = bytes.subarray(i, i + chunkSize);
      binary += String.fromCharCode.apply(null, Array.from(chunk));
    }
    return window.btoa(binary);
  };

  const handlePreviewPDF = async () => {
    try { onPreviewOpen && onPreviewOpen(); } catch { }
    setIsLoadingPreview(true);
    setShowPreviewModal(true);
    try {
      const response = await fetch(`/api/purchase-requests/${request.id}/pdf`, {
        method: 'GET',
        credentials: 'include',
        cache: 'no-store'
      });

      if (!response.ok) {
        throw new Error('Falha ao gerar PDF');
      }

      const contentType = response.headers.get('content-type') || '';
      const buffer = await response.arrayBuffer();
      setPdfBuffer(buffer);
      const base64 = arrayBufferToBase64(buffer);
      const url = `data:application/pdf;base64,${base64}`;
      setPdfPreviewUrl(url);
      setPreviewLoaded(false);
      setShowPreviewModal(true);

      if (contentType.includes('application/pdf')) {
        toast({
          title: "Sucesso",
          description: "Pré-visualização do PDF carregada com sucesso!",
        });
      } else if (contentType.includes('text/html')) {
        toast({
          title: "Aviso",
          description: "PDF não pôde ser gerado. Exibindo documento em HTML.",
        });
      } else {
        toast({
          title: "Aviso",
          description: "Formato de arquivo inesperado na pré-visualização.",
        });
      }
    } catch (error) {
      toast({
        title: "Erro",
        description: "Falha ao carregar pré-visualização do PDF",
        variant: "destructive",
      });
    } finally {
      setIsLoadingPreview(false);
    }
  };



  // Função para download do PDF
  const handleDownloadPDF = async () => {
    setIsDownloading(true);
    try {
      const response = await fetch(`/api/purchase-requests/${request.id}/pdf`, {
        method: 'GET'
      });

      if (!response.ok) {
        throw new Error('Falha ao gerar PDF');
      }

      const contentType = response.headers.get('Content-Type') || '';
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.style.display = 'none';
      a.href = url;
      a.download = `Pedido_Compra_${request.requestNumber}.${contentType.includes('application/pdf') ? 'pdf' : contentType.includes('text/html') ? 'html' : 'bin'}`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);

      toast({
        title: "Sucesso",
        description: contentType.includes('application/pdf') ? "PDF do pedido de compra baixado com sucesso!" : "Documento alternativo baixado com sucesso!",
      });
    } catch (error) {
      toast({
        title: "Erro",
        description: "Falha ao baixar PDF do pedido de compra",
        variant: "destructive",
      });
    } finally {
      setIsDownloading(false);
    }
  };

  // Função para baixar PDF da pré-visualização
  const handleDownloadFromPreview = () => {
    if (pdfPreviewUrl) {
      const a = document.createElement('a');
      a.style.display = 'none';
      a.href = pdfPreviewUrl;
      a.download = `Pedido_Compra_${request.requestNumber}.pdf`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);

      toast({
        title: "Sucesso",
        description: "PDF do pedido de compra baixado com sucesso!",
      });
    }
  };

  // Limpar URL do blob quando o modal for fechado
  const handleClosePreview = () => {
    try { onPreviewClose && onPreviewClose(); } catch { }
    setShowPreviewModal(false);
    if (pdfPreviewUrl) {
      window.URL.revokeObjectURL(pdfPreviewUrl);
      setPdfPreviewUrl(null);
    }
  };

  // Controla abertura/fechamento do modal de pré-visualização sem interferir no diálogo pai
  const handlePreviewOpenChange = (open: boolean) => {
    if (open) {
      setShowPreviewModal(true);
      return;
    }
    handleClosePreview();
  };

  useImperativeHandle(ref, () => ({
    previewPDF: handlePreviewPDF,
    downloadPDF: handleDownloadPDF,
  }));



  const handleExistingReceiptSelect = async (receiptId: number) => {
    try {
      const res = await apiRequest(`/api/recebimentos/parse-existing/${receiptId}`, { method: "POST" });
      const data = await res.json();

      if (data.preview) {
        setXmlPreview(data.preview);
        setNfReceiptId(receiptId);
        setManualNFStep(1); // Ensure we start at step 1 to review data
        
        // Auto-populate manual fields that might not be covered by the effect
        if (data.preview.header) {
          setManualNFNumber(data.preview.header.number || "");
          setManualNFSeries(data.preview.header.series || "");
          setManualNFAccessKey(data.preview.header.accessKey || "");
          setManualNFIssueDate(data.preview.header.issueDate?.split('T')[0] || "");
          setManualNFEmitterCNPJ(data.preview.header.supplier?.cnpjCpf || "");
        }
        
        if (data.preview.totals) {
            setManualTotal(String(data.preview.totals.vNF || data.preview.totals.total || "0"));
        }

        // Explicitly populate transport data
        if (data.preview.header?.transp) {
            const t = data.preview.header.transp;
            setProductTransp({
                modFrete: t.modFrete,
                transporter: {
                    cnpj: t.carrierCnpj,
                    name: t.carrierName,
                },
                volume: {
                    quantity: t.volumeQuantity ? Number(t.volumeQuantity) : undefined,
                    specie: t.species,
                }
            });
        }

        toast({
            title: "Nota Fiscal Carregada",
            description: "Os dados da nota fiscal foram preenchidos automaticamente.",
          });
          
          try {
            apiRequest(`/api/audit/log`, {
              method: "POST",
              body: {
                purchaseRequestId: request.id,
                actionType: "manual_nf_load_existing",
                actionDescription: `Carregados dados da Nota Fiscal existente ID: ${receiptId}`,
                beforeData: {},
                afterData: { receiptId, documentNumber: data.preview.header.number },
              },
            });
          } catch {}
        }
      } catch (error) {
      console.error("Error loading existing receipt:", error);
      toast({
        title: "Erro",
        description: "Não foi possível carregar os dados da nota fiscal.",
        variant: "destructive",
      });
    }
  };

  const formatDate = (date: any) => {
    if (!date) return "N/A";
    return formatDistanceToNow(new Date(date), {
      addSuffix: true,
      locale: ptBR
    });
  };


  if (showPreviewModal) {
    return (
      <div className={cn("flex flex-col h-full", className)}>
        <div className="flex-shrink-0 bg-background border-b border-border sticky top-0 z-30 pb-3 mb-4 rounded-t-lg">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-semibold">Pré-visualização - Pedido de Compra {request.requestNumber}</h3>
              <div className="flex gap-2">
                <Button onClick={handleDownloadFromPreview} size="sm" className="bg-green-600 hover:bg-green-700 dark:bg-green-500 dark:hover:bg-green-600">
                  <Download className="w-4 h-4 mr-2" />
                  Baixar PDF
                </Button>
                <Button onClick={handleClosePreview} size="sm" variant="outline">
                  <X className="w-4 h-4 mr-2" />
                  Voltar
                </Button>
              </div>
            </div>
          </div>
          
          <div className="flex-1 overflow-hidden flex flex-col min-h-[60vh]">
              {pdfBuffer ? (
                <ErrorBoundary fallback={
                  <div className="flex items-center justify-center h-full p-6 bg-red-50 text-red-600">
                    <p>Erro ao exibir PDF. O arquivo pode estar corrompido ou ser incompatível.</p>
                  </div>
                }>
                  <PdfViewer data={pdfBuffer} />
                </ErrorBoundary>
              ) : pdfPreviewUrl ? (
                <object data={pdfPreviewUrl} type="application/pdf" className="w-full h-[70vh] border border-border rounded-lg bg-slate-50 dark:bg-slate-900">
                  <iframe onLoad={() => setPreviewLoaded(true)}
                    src={pdfPreviewUrl}
                    className="w-full h-[70vh] border border-border rounded-lg bg-slate-50 dark:bg-slate-900"
                    title="Pré-visualização do PDF"
                  />
                </object>
              ) : (
                <div className="flex items-center justify-center h-[70vh] bg-slate-100 dark:bg-slate-800 rounded-lg border border-border">
                  <div className="text-center">
                    <FileText className="w-12 h-12 text-slate-400 dark:text-slate-500 mx-auto mb-4" />
                    <p className="text-slate-600 dark:text-slate-300">Carregando pré-visualização...</p>
                  </div>
                </div>
              )}
          </div>
      </div>
    );
  }

  const validCostCenterIds = useMemo(() => {
    const ids = new Set<number>();
    costCenterTree.forEach(({ children }: any) => {
      children.forEach((c: any) => {
        if (c.selectable) {
          const id = Number(c.node.idCostCenter ?? c.node.id);
          if (id) ids.add(id);
        }
        c.grandchildren.forEach((gc: any) => {
          const id = Number(gc.idCostCenter ?? gc.id);
          if (id) ids.add(id);
        });
      });
    });
    return ids;
  }, [costCenterTree]);

  const validChartAccountIds = useMemo(() => {
    const ids = new Set<number>();
    chartAccountTree.forEach(({ children }: any) => {
      children.forEach((c: any) => {
        if (c.selectable) {
          const id = Number(c.node.idChartOfAccounts ?? c.node.id);
          if (id) ids.add(id);
        }
        c.grandchildren.forEach((pc: any) => {
          const id = Number(pc.idChartOfAccounts ?? pc.id);
          if (id) ids.add(id);
        });
      });
    });
    return ids;
  }, [chartAccountTree]);

  const baseTotalForAllocation = useMemo(() => {
    if (receiptType === "avulso") {
      const val = parseFloat(String(manualTotal || "0").replace(",", "."));
      return isFinite(val) ? val : 0;
    }
    const poTot = Number(purchaseOrder?.totalValue || 0);
    return isFinite(poTot) ? poTot : 0;
  }, [receiptType, manualTotal, purchaseOrder?.totalValue]);

  const allocationsSum = useMemo(() => {
    return (allocations || []).reduce((acc, it) => acc + (parseFloat(String(it.amount || "0").replace(",", ".")) || 0), 0);
  }, [allocations]);

  const allocationsSumOk = useMemo(() => {
    const round2 = (n: number) => Math.round(n * 100) / 100;
    return round2(allocationsSum) === round2(baseTotalForAllocation);
  }, [allocationsSum, baseTotalForAllocation]);

  // Removed automatic switch to 'avulso' based on manual fields presence
  // to prevent incorrect type switching when user is manually entering a Product/Service invoice
  /*
  useEffect(() => {
    if (activeTab === 'xml') {
      const prefilledManual = [manualNFNumber, manualNFSeries, manualNFIssueDate, manualTotal].every(v => !!v && String(v).trim() !== "");
      if (prefilledManual) {
        setReceiptType('avulso');
      }
    }
  }, [activeTab, manualNFNumber, manualNFSeries, manualNFIssueDate, manualTotal]);
  */

  const handleFillMissingAllocationValues = () => {
    const parseNum = (v: any) => {
      const s = String(v ?? '').trim();
      if (!s) return NaN;
      const n = parseFloat(s.replace(',', '.'));
      return isFinite(n) ? n : NaN;
    };
    const validRows = allocations
      .map((r, i) => ({ r, i }))
      .filter(({ r }) => r.costCenterId && r.chartOfAccountsId);
    if (validRows.length === 0) {
      toast({ title: "Validação", description: "Nenhuma linha válida para preenchimento automático", variant: "destructive" });
      return;
    }
    const filled = validRows
      .map(({ r, i }) => ({ i, amount: parseNum(r.amount) }))
      .filter(({ amount }) => isFinite(amount) && amount > 0);
    const sumFilled = filled.reduce((acc, it) => acc + it.amount, 0);
    const remaining = Math.max(0, baseTotalForAllocation - sumFilled);
    if (remaining <= 0) {
      toast({ title: "Validação", description: "Nada a preencher: o restante do total é 0", variant: "destructive" });
      return;
    }
    const missing = validRows.filter(({ r }) => {
      const amt = parseNum(r.amount);
      return !(isFinite(amt) && amt > 0);
    });
    if (missing.length === 0) {
      toast({ title: "Validação", description: "Nenhuma linha com valor vazio para preencher", variant: "destructive" });
      return;
    }
    let weights = missing.map(({ r }) => {
      const pct = parseNum(r.percentage);
      if (isFinite(pct) && pct > 0) return pct;
      return 1;
    });
    let weightSum = weights.reduce((a, b) => a + b, 0);
    if (!(isFinite(weightSum) && weightSum > 0)) {
      weights = missing.map(() => 1);
      weightSum = missing.length;
    }
    const updates = new Map<number, { amount: string; percentage: string }>();
    let assigned = 0;
    for (let idx = 0; idx < missing.length; idx++) {
      const isLast = idx === missing.length - 1;
      const portion = isLast ? Math.round((remaining - assigned) * 100) / 100 : Math.round(((remaining * weights[idx]) / weightSum) * 100) / 100;
      assigned += isLast ? 0 : portion;
      const pct = Math.round(((portion / baseTotalForAllocation) * 100) * 100) / 100;
      updates.set(missing[idx].i, { amount: portion.toFixed(2), percentage: pct.toFixed(2) });
    }
    setAllocations(prev => prev.map((r, i) => updates.has(i) ? { ...r, amount: updates.get(i)!.amount, percentage: updates.get(i)!.percentage } : r));
    setAutoFilledRows(new Set(missing.map(m => m.i)));
    toast({ title: "Sucesso", description: `Valores preenchidos automaticamente em ${missing.length} linha(s)` });
    window.setTimeout(() => setAutoFilledRows(new Set()), 2500);
  };

  // Para a fase de recebimento, usar diretamente os dados dos itens que já vêm com preços do pedido de compra
  const itemsWithPrices = Array.isArray(items) ? items.map(item => {
    // Os itens do pedido de compra já vêm com os preços corretos da API
    const unitPrice = Number(item.unitPrice) || 0;
    const quantity = Number(item.quantity) || 0;
    const totalPrice = Number(item.totalPrice) || 0;

    return {
      ...item,
      unitPrice: unitPrice,
      originalUnitPrice: unitPrice,
      itemDiscount: 0, // Para pedidos de compra, não há desconto adicional
      totalPrice: totalPrice,
      originalTotalPrice: totalPrice,
      brand: item.brand || '',
      deliveryTime: item.deliveryTime || '',
      isAvailable: true
    };
  }) : [];
  const purchaseOrderItems = useMemo(() => (Array.isArray(itemsWithPrices) ? itemsWithPrices : []), [itemsWithPrices]);

  const isFiscalValid = (() => {
    if (!hasInstallments) return !!paymentMethodCode && !!invoiceDueDate;
    const total = baseTotalForAllocation;
    const rows = installments || [];
    if (rows.length === 0) return false;
    const sum = rows.reduce((acc, r) => acc + (parseFloat(String(r.amount || "0").replace(",", ".")) || 0), 0);
    const round2 = (n: number) => Math.round(n * 100) / 100;
    const sorted = rows.every((r, i, arr) => i === 0 || new Date(r.dueDate) >= new Date(arr[i - 1].dueDate));
    const allFilled = rows.every(r => !!r.dueDate && (parseFloat(String(r.amount || "0").replace(",", ".")) > 0) && (!!r.method || !!paymentMethodCode));
    return round2(sum) === round2(total) && sorted && allFilled;
  })();
  const manualItemsMissingLinks = useMemo(() => {
    if (receiptType === "avulso" || manualItems.length === 0 || purchaseOrderItems.length === 0) return [];
    return manualItems
      .map((item, index) => (!item.purchaseOrderItemId ? index : null))
      .filter((value): value is number => value !== null);
  }, [manualItems, purchaseOrderItems.length, receiptType]);
  const canConfirm = useMemo(() => {
    return canConfirmReceipt({
      mode,
      receivedQuantities,
      typeCategoryError,
      isReceiverOnly,
      nfConfirmed,
      isFiscalValid,
      allocations,
      allocationsSumOk,
      receiptType,
      activeTab,
      manualNFNumber,
      manualNFSeries,
      manualNFAccessKey,
      manualNFIssueDate,
      manualNFEmitterCNPJ,
      manualTotal,
      manualItems,
      manualItemsMissingLinks,
      itemsWithPrices,
      xmlPreview
    });
  }, [mode, receivedQuantities, typeCategoryError, isReceiverOnly, nfConfirmed, isFiscalValid, allocations, allocationsSumOk, receiptType, activeTab, manualNFNumber, manualNFSeries, manualNFAccessKey, manualNFIssueDate, manualNFEmitterCNPJ, manualTotal, manualItems, manualItemsMissingLinks, itemsWithPrices, xmlPreview]);

  return (
    <div className={cn("space-y-6", className)}>
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-semibold text-slate-900 dark:text-slate-100">Recebimento de Material</h2>
          <p className="text-sm text-slate-600 dark:text-slate-400">Confirme o recebimento ou reporte pendências</p>
        </div>
      </div>

        <Card className="border border-slate-200 dark:border-slate-800 bg-slate-950/40 dark:bg-slate-900/60">
          <CardContent className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-6 gap-4 text-sm pt-4">
            <div className="space-y-1">
              <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide">
                Solicitação / Pedido
              </p>
              <p className="font-medium text-slate-100">
                {request?.requestNumber}
                {purchaseOrder?.orderNumber && (
                  <> / {purchaseOrder.orderNumber}</>
                )}
              </p>
            </div>

            <div className="space-y-1">
              <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide">
                Solicitante
              </p>
              <p className="text-slate-100 truncate">
                {request?.requester
                  ? `${request.requester.firstName} ${request.requester.lastName}`
                  : "N/A"}
              </p>
            </div>

            <div className="space-y-1">
              <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide">
                Fornecedor
              </p>
              <p className="text-slate-100 truncate">
                {selectedSupplier?.name ||
                  request?.chosenSupplier?.name ||
                  "Não definido"}
              </p>
            </div>

            <div className="space-y-1">
              <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide">
                Data do Pedido
              </p>
              <p className="text-slate-100">
                {formatDate(
                  purchaseOrder?.createdAt || request?.createdAt || null
                )}
              </p>
            </div>

            <div className="space-y-1">
              <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide">
                Valor Total
              </p>
              <p className="font-medium text-slate-100">
                {typeof request?.totalValue === "number"
                  ? formatCurrency(request.totalValue)
                  : "R$ 0,00"}
              </p>
            </div>

            <div className="space-y-1">
              <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide">
                Status Atual
              </p>
              <p className="text-slate-100">
                {(request?.phase &&
                  (PHASE_LABELS as any)[request.phase as keyof typeof PHASE_LABELS]) ||
                  "—"}
              </p>
            </div>
          </CardContent>
        </Card>      

          <div className="space-y-6">
            {(user?.isReceiver || user?.isAdmin) && (
              <>
              <Card>
                <CardHeader><CardTitle>Dados da Nota Fiscal</CardTitle></CardHeader>
                <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div><Label>Número da Nota Fiscal</Label><Input value={manualNFNumber} onChange={(e) => setManualNFNumber(e.target.value)} placeholder="NF-00000000" /></div>
                  <div><Label>Série</Label><Input value={manualNFSeries} onChange={(e) => setManualNFSeries(e.target.value)} placeholder="S-000" /></div>
                </CardContent>
              </Card>
              <Card>
                <CardHeader><CardTitle>Confirmação de Itens</CardTitle></CardHeader>
                <CardContent>
                  <div className="rounded border">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Descrição</TableHead>
                          <TableHead className="text-center">Qtd Prevista</TableHead>
                          <TableHead className="text-center">Qtd Recebida</TableHead>
                          <TableHead className="text-center">Saldo a Receber</TableHead>
                          <TableHead className="text-center">Status</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {Array.isArray(itemsWithPrices) && itemsWithPrices.map((it: any) => {
                          const current = Number(receivedQuantities[it.id] || 0);
                          const max = Number(it.quantity || 0);
                          const prev = Number(it.quantityReceived || 0);
                          const totalReceived = prev + current;
                          const invalid = totalReceived > max;
                          const saldo = Math.max(0, max - totalReceived);
                          return (
                            <TableRow key={it.id} className={invalid ? "bg-red-50 dark:bg-red-900/20" : ""}>
                              <TableCell>{it.description}</TableCell>
                              <TableCell className="text-center">{Number(max).toLocaleString('pt-BR', { minimumFractionDigits: 0, maximumFractionDigits: 3 })}</TableCell>
                              <TableCell className="text-center">
                                <Input type="number" min={0} step={0.001} value={current || ''} onChange={(e) => {
                                  const v = Number(e.target.value || 0);
                                  setReceivedQuantities((prev) => ({ ...prev, [it.id]: v }));
                                }} />
                              </TableCell>
                              <TableCell className="text-center">{Number(saldo).toLocaleString('pt-BR', { minimumFractionDigits: 0, maximumFractionDigits: 3 })}</TableCell>
                              <TableCell className="text-center">
                                {invalid ? <Badge variant="destructive">Qtd Excedente</Badge> : (totalReceived === 0 ? <Badge variant="secondary">Não Recebido</Badge> : totalReceived < max ? <Badge variant="default">Parcial ({prev > 0 ? `+${prev}` : ''})</Badge> : <Badge variant="outline">Completo</Badge>)}
                              </TableCell>
                            </TableRow>
                          );
                        })}
                      </TableBody>
                    </Table>
                    
                    {/* Summary Footer */}
                    <div className="bg-slate-50 dark:bg-slate-900 p-4 border-t border-slate-200 dark:border-slate-800">
                      <div className="flex flex-col gap-2">
                        <div className="flex justify-between items-center text-sm">
                          <span className="text-slate-600 dark:text-slate-400">Progresso do Recebimento:</span>
                          <span className="font-medium">
                            {(() => {
                              const totalExpected = itemsWithPrices.reduce((acc: number, it: any) => acc + Number(it.quantity || 0), 0);
                              const totalReceivedPrev = itemsWithPrices.reduce((acc: number, it: any) => acc + Number(it.quantityReceived || 0), 0);
                              const totalReceivedNow = itemsWithPrices.reduce((acc: number, it: any) => acc + Number(receivedQuantities[it.id] || 0), 0);
                              const total = totalReceivedPrev + totalReceivedNow;
                              const percent = totalExpected > 0 ? Math.min(100, (total / totalExpected) * 100) : 0;
                              return `${percent.toFixed(1)}% (${total.toLocaleString('pt-BR')} / ${totalExpected.toLocaleString('pt-BR')})`;
                            })()}
                          </span>
                        </div>
                        
                        <div className="w-full bg-slate-200 dark:bg-slate-700 rounded-full h-2.5">
                          <div 
                            className="bg-blue-600 h-2.5 rounded-full transition-all duration-500" 
                            style={{ width: `${(() => {
                              const totalExpected = itemsWithPrices.reduce((acc: number, it: any) => acc + Number(it.quantity || 0), 0);
                              const totalReceivedPrev = itemsWithPrices.reduce((acc: number, it: any) => acc + Number(it.quantityReceived || 0), 0);
                              const totalReceivedNow = itemsWithPrices.reduce((acc: number, it: any) => acc + Number(receivedQuantities[it.id] || 0), 0);
                              return totalExpected > 0 ? Math.min(100, ((totalReceivedPrev + totalReceivedNow) / totalExpected) * 100) : 0;
                            })()}%` }}
                          ></div>
                        </div>

                        <div className="flex justify-between items-center mt-2 p-2 bg-blue-50 dark:bg-blue-900/20 rounded border border-blue-100 dark:border-blue-800">
                           <span className="text-sm font-medium text-blue-800 dark:text-blue-300">Status Previsto:</span>
                           {(() => {
                              const isComplete = itemsWithPrices.every((it: any) => {
                                const prev = Number(it.quantityReceived || 0);
                                const current = Number(receivedQuantities[it.id] || 0);
                                const max = Number(it.quantity || 0);
                                return (prev + current) >= max;
                              });
                              return isComplete ? 
                                <Badge className="bg-green-600 hover:bg-green-700">Conclusão Total</Badge> : 
                                <Badge variant="secondary">Recebimento Parcial - Continuar</Badge>;
                           })()}
                        </div>
                        {(() => {
                              const isComplete = itemsWithPrices.every((it: any) => {
                                const prev = Number(it.quantityReceived || 0);
                                const current = Number(receivedQuantities[it.id] || 0);
                                const max = Number(it.quantity || 0);
                                return (prev + current) >= max;
                              });
                              if (!isComplete) {
                                return (
                                  <p className="text-xs text-slate-500 mt-1">
                                    * O pedido permanecerá na fase de recebimento até que todos os itens sejam entregues.
                                  </p>
                                );
                              }
                              return null;
                        })()}
                      </div>
                    </div>

                  </div>
                </CardContent>
              </Card>
              </>
            )}

            <div className="flex justify-between gap-2">
              <Button variant="outline" onClick={() => setActiveTab('xml')}>Voltar</Button>
              <Button disabled={!canConfirm} onClick={() => {
                if (mode === 'physical') {
                   const hasAnyQty = Object.values(receivedQuantities).some(v => Number(v) > 0);
                   if (!hasAnyQty) {
                      return toast({ title: "Validação", description: "Informe as quantidades recebidas", variant: "destructive" });
                   }
                   confirmPhysicalMutation.mutate();
                   return;
                }
                if (typeCategoryError) {
                  return toast({ title: "Validação", description: typeCategoryError, variant: "destructive" });
                }
                if (receiptType !== "avulso" && !nfConfirmed) {
                  return toast({ title: "NF pendente", description: "Necessário cadastro prévio da NF para confirmar o recebimento.", variant: "destructive" });
                }
                // Validar campos financeiros da etapa inicial
                if (receiptType === "avulso") {
                  const hasTotals = manualTotal && String(manualTotal).trim() !== "";
                  const hasItems = manualItems.length > 0;
                  if (!hasTotals || !hasItems) {
                    return toast({ title: "Validação", description: "Preencha Valor Total e pelo menos um item", variant: "destructive" });
                  }
                }
                if (receiptType !== "avulso") {
                  const invalids = Array.isArray(itemsWithPrices) ? itemsWithPrices.filter((it: any) => {
                    const current = Number(receivedQuantities[it.id] || 0);
                    const max = Number(it.quantity || 0);
                    return current > max;
                  }) : [];
                  if (invalids.length > 0) {
                    return toast({ title: "Validação", description: "Existem itens com quantidade recebida maior que a prevista", variant: "destructive" });
                  }
                }
                if (!isFiscalValid) {
                  return toast({ title: "Validação", description: "Informe Forma de Pagamento e Vencimento da Fatura", variant: "destructive" });
                }
                if (receiptType === "avulso") {
                  const required = [manualNFNumber, manualNFIssueDate, manualTotal];
                  if (required.some(v => !v || String(v).trim() === "")) {
                    return toast({ title: "Validação", description: "Preencha Número, Emissão e Valor Total da NF", variant: "destructive" });
                  }
                } else if (!xmlPreview) {
                  // Manual entry for Produto/Servico
                  const required = [manualNFNumber, manualNFIssueDate, manualTotal];
                  if (required.some(v => !v || String(v).trim() === "")) {
                    return toast({ title: "Validação", description: "Como não há XML, preencha Número, Emissão e Valor Total na aba de Inclusão Manual", variant: "destructive" });
                  }
                  
                  const hasAnyQty = Object.values(receivedQuantities).some(v => Number(v) > 0);
                  if (!hasAnyQty) {
                    return toast({ title: "Validação", description: "Informe as quantidades recebidas", variant: "destructive" });
                  }
                  if (manualItemsMissingLinks.length > 0) {
                    return toast({ title: "Validação", description: "Vincule todos os itens da nota aos itens do pedido.", variant: "destructive" });
                  }
                } else {
                  const hasAnyQty = Object.values(receivedQuantities).some(v => Number(v) > 0);
                  if (!hasAnyQty && !xmlPreview) {
                    return toast({ title: "Validação", description: "Informe quantidades recebidas ou importe o XML", variant: "destructive" });
                  }
                }
                confirmReceiptMutation.mutate();
              }}>Confirmar Recebimento</Button>
            </div>
          </div>
          
      {/* Action Buttons */}
      <div className="sticky bottom-0 bg-white/80 dark:bg-slate-900/80 backdrop-blur-sm pt-4 pb-2 border-t border-slate-200 dark:border-slate-800 mt-6">
        <div className="flex flex-col sm:flex-row gap-3 sm:justify-end">
          <Button
            variant="outline"
            onClick={onClose}
            className="w-full sm:w-auto order-last sm:order-first"
          >
            Fechar
          </Button>
          <Button
            type="button"
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              handlePreviewPDF();
            }}
            disabled={isLoadingPreview}
            variant="outline"
            className="w-full sm:w-auto border-green-600 text-green-600 hover:bg-green-50 dark:text-green-400 dark:border-green-700 dark:hover:bg-green-900/20"
          >
            <Eye className="w-4 h-4 mr-2" />
            {isLoadingPreview ? "Carregando..." : "Visualizar PDF"}
          </Button>
          {canPerformReceiptActions ? (
            <div className="flex flex-col sm:flex-row gap-3 w-full sm:w-auto">
              <Button
                variant="destructive"
                onClick={() => setIsPendencyModalOpen(true)}
                disabled={reportIssueMutation.isPending}
                className="w-full sm:w-auto flex items-center justify-center"
              >
                <X className="mr-2 h-4 w-4 flex-shrink-0" />
                <span className="truncate">Reportar Pendência</span>
              </Button>
              <Button
                onClick={() => {
                  if (!isFiscalValid) {
                    return toast({ title: "Validação", description: "Informe Forma de Pagamento e Vencimento da Fatura", variant: "destructive" });
                  }
                  if (receiptType !== "avulso" && !nfConfirmed) {
                    return toast({ title: "NF pendente", description: "Necessário cadastro prévio da NF para confirmar o recebimento.", variant: "destructive" });
                  }
                  if (receiptType === "avulso") {
                    const required = [manualNFNumber, manualNFIssueDate];
                    const hasTotals = String(manualTotal || '').trim() !== '';
                    const hasItems = manualItems.length > 0;
                    if (required.some(v => !v || String(v).trim() === "")) {
                      return toast({ title: "Validação", description: "Preencha Número e Emissão da NF", variant: "destructive" });
                    }
                    if (!hasTotals || !hasItems) {
                      return toast({ title: "Validação", description: "Preencha Valor Total e pelo menos um item", variant: "destructive" });
                    }
                  } else {
                    const invalids = Array.isArray(itemsWithPrices) ? itemsWithPrices.filter((it: any) => {
                      const current = Number(receivedQuantities[it.id] || 0);
                      const max = Number(it.quantity || 0);
                      return current > max;
                    }) : [];
                    if (invalids.length > 0) {
                      return toast({ title: "Validação", description: "Existem itens com quantidade recebida maior que a prevista", variant: "destructive" });
                    }
                    const hasAnyQty = Object.values(receivedQuantities).some(v => Number(v) > 0);
                    if (!hasAnyQty && !xmlPreview) {
                      return toast({ title: "Validação", description: "Informe quantidades recebidas ou importe o XML", variant: "destructive" });
                    }
                    const v = validateAllocationsAgainstLocador(allocations, costCenters, chartAccounts);
                    console.log("validation:locador:pre-submit", { allocations, sources: v.sources, invalidRows: v.invalidRows });
                    if (!v.isValid) {
                      return toast({
                        title: "Validação",
                        description: formatReceiptApiError("Rateio inválido com base nos dados do Locador", v.invalidRows),
                        variant: "destructive",
                      });
                    }
                  }
                  confirmReceiptMutation.mutate();
                }}
                disabled={!canConfirm}
                className="bg-green-600 hover:bg-green-700 dark:bg-green-500 dark:hover:bg-green-600 w-full sm:w-auto flex items-center justify-center"
              >
                <Check className="mr-2 h-4 w-4 flex-shrink-0" />
                <span className="truncate">Confirmar Recebimento</span>
              </Button>
            </div>
          ) : (
            <div className="text-sm text-slate-500 dark:text-slate-400 flex items-center justify-center sm:justify-start p-3 bg-slate-50 dark:bg-slate-900 rounded-lg border border-border">
              <User className="mr-2 h-4 w-4 flex-shrink-0" />
              <span className="text-center sm:text-left">
                Apenas usuários com perfil "Recebedor" podem confirmar recebimentos
              </span>
            </div>
          )}
        </div>
      </div>

      {/* Pendency Modal */}
      <PendencyModal
        isOpen={isPendencyModalOpen}
        onClose={() => setIsPendencyModalOpen(false)}
        onConfirm={(reason) => reportIssueMutation.mutate(reason)}
        isLoading={reportIssueMutation.isPending}
      />
    </div>
  );
});

export default ReceiptPhase;
