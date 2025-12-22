import React, { useState, useMemo, useEffect, forwardRef, useImperativeHandle } from "react";
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
import { X, Check, Package, User, Building, Calendar, DollarSign, FileText, Download, Eye, Truck, ChevronDown, ChevronRight, Trash2, Search } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";
import { URGENCY_LABELS, CATEGORY_LABELS } from "@/lib/types";
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

interface ReceiptPhaseProps {
  request: any;
  onClose: () => void;
  className?: string;
  onPreviewOpen?: () => void;
  onPreviewClose?: () => void;
}

export interface ReceiptPhaseHandle {
  previewPDF: () => void;
  downloadPDF: () => void;
}

const ReceiptPhase = forwardRef((props: ReceiptPhaseProps, ref: React.Ref<ReceiptPhaseHandle>) => {
  const { request, onClose, className, onPreviewOpen, onPreviewClose } = props;
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
  const [xmlRecovered, setXmlRecovered] = useState(false);
  useEffect(() => {
    try {
      const key = `xml_state_${request?.id}`;
      const raw = localStorage.getItem(key);
      if (raw) {
        const snap = JSON.parse(raw);
        if (snap?.xmlPreview) setXmlPreview(snap.xmlPreview);
        if (snap?.xmlRaw) setXmlRaw(snap.xmlRaw);
        setXmlAttachmentId(snap?.xmlAttachmentId ?? null);
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
  const [manualItems, setManualItems] = useState<Array<{ code?: string; description: string; unit?: string; quantity: number; unitPrice: number }>>([]);
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
  const [activeTab, setActiveTab] = useState<'fiscal' | 'financeiro' | 'xml' | 'manual_nf' | 'items'>('fiscal');
  const [allocations, setAllocations] = useState<Array<{ costCenterId?: number; chartOfAccountsId?: number; amount?: string; percentage?: string }>>([]);
  const [allocationMode, setAllocationMode] = useState<'manual' | 'proporcional'>('manual');
  const [paymentMethods, setPaymentMethods] = useState<Array<{ code: string; name: string }>>([]);
  const [isLoadingPaymentMethods, setIsLoadingPaymentMethods] = useState(false);
  const [autoFilledRows, setAutoFilledRows] = useState<Set<number>>(new Set());
  const [emitter, setEmitter] = useState<{ cnpj?: string; name?: string; fantasyName?: string; ie?: string; im?: string; cnae?: string; crt?: string; address?: { street?: string; number?: string; neighborhood?: string; city?: string; uf?: string; cep?: string; country?: string; phone?: string } }>({});
  const [recipient, setRecipient] = useState<{ cnpjCpf?: string; name?: string; ie?: string; email?: string; address?: { street?: string; number?: string; neighborhood?: string; city?: string; uf?: string; cep?: string; country?: string; phone?: string } }>({});
  const [productTransp, setProductTransp] = useState<{ modFrete?: string; transporter?: { cnpj?: string; name?: string; ie?: string; address?: string; city?: string; uf?: string }; volume?: { quantity?: number; specie?: string } }>({});
  const [serviceData, setServiceData] = useState<{ itemListaServico?: string; codigoTributacaoMunicipio?: string; discriminacao?: string; codigoMunicipio?: string; valores?: { valorServicos?: number; valorDeducoes?: number; valorPis?: number; valorCofins?: number; valorInss?: number; valorIr?: number; valorCsll?: number; issRetido?: number; valorIss?: number; valorIssRetido?: number; baseCalculo?: number; aliquota?: number; valorLiquidoNfse?: number; descontoIncondicionado?: number; descontoCondicionado?: number } }>({});
  const [itemTaxes, setItemTaxes] = useState<Record<number, { vBC?: number; pICMS?: number; vICMS?: number; ipi?: { vBC?: number; pIPI?: number; vIPI?: number }; pis?: { cst?: string }; cofins?: { cst?: string } }>>({});

  // Check if user has permission to perform receipt actions
  const canPerformReceiptActions = user?.isReceiver || user?.isAdmin;

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
      setActiveTab("fiscal");
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
        const snapshot = { xmlRaw: raw, xmlPreview: preview, xmlAttachmentId: data.attachment?.id ?? null, receiptType, timestamp: new Date().toISOString() };
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
        // Mapeamento atualizado conforme requisitos:
        // - pedido_id: mapeado para purchaseOrder.id
        // - numero_pedido: mapeado para purchaseOrder.orderNumber (ou number como fallback)
        // - request_number: novo campo com o número da solicitação
        // - solicitacao_id: novo campo com o ID da solicitação
        const purchaseReceivePayload = {
          pedido_id: purchaseOrder?.id,
          numero_pedido: purchaseOrder?.orderNumber || purchaseOrder?.number,
          numero_solicitacao: activeRequest?.requestNumber,
          solicitacao_id: activeRequest?.id,
          data_pedido: purchaseOrder?.createdAt ? new Date(purchaseOrder.createdAt).toISOString() : new Date().toISOString(),
          fornecedor: {
            fornecedor_id: selectedSupplier?.idSupplierERP || selectedSupplier?.id || selectedSupplierQuotation?.supplier?.idSupplierERP || selectedSupplierQuotation?.supplier?.id,
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

      } catch (e) {
        if (e instanceof Error) {
          throw e;
        }
      }
      const response = await apiRequest(`/api/purchase-requests/${activeRequest?.id}/confirm-receipt`, {
        method: "POST",
        body: {
          receivedById: user?.id,
          receiptMode: receiptType,
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
      return response;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/purchase-requests"] });
      toast({
        title: "Sucesso",
        description: "Recebimento confirmado! Item movido para Conclusão.",
      });
      try { setLocation(`/kanban?request=${request?.id}&phase=conclusao_compra`); } catch {}
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
  const canConfirm = useMemo(() => {
    if (typeCategoryError) return false;
    if (!isFiscalValid) return false;
    if (allocations.length > 0 && !allocationsSumOk) return false;
    if (receiptType === "avulso" || activeTab === "manual_nf") {
      const header = validateManualHeader({
        number: manualNFNumber,
        series: manualNFSeries,
        accessKey: manualNFAccessKey,
        issueDate: manualNFIssueDate,
        emitterCnpj: manualNFEmitterCNPJ,
        total: manualTotal,
        kind: receiptType === "servico" ? "servico" : (receiptType === "avulso" ? "avulso" : "produto"),
      });
      if (!header.isValid) return false;
      const itemsOk = validateManualItems(receiptType === "servico" ? "servico" : "produto", manualItems as any).isValid;
      return itemsOk;
    }
    const invalids = Array.isArray(itemsWithPrices) ? itemsWithPrices.filter((it: any) => {
      const current = Number(receivedQuantities[it.id] || 0);
      const max = Number(it.quantity || 0);
      return current > max;
    }) : [];
    if (invalids.length > 0) return false;
    const hasAnyQty = Object.values(receivedQuantities).some(v => Number(v) > 0);
    if (!hasAnyQty && !xmlPreview) return false;
    return true;
  }, [typeCategoryError, isFiscalValid, allocations.length, allocationsSumOk, receiptType, manualNFNumber, manualNFSeries, manualNFIssueDate, manualNFEntryDate, manualNFEmitterCNPJ, manualNFAccessKey, manualTotal, manualItems.length, itemsWithPrices, receivedQuantities, xmlPreview, activeTab]);

  return (
    <div className={cn("space-y-6", className)}>
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-semibold text-slate-900 dark:text-slate-100">Recebimento de Material</h2>
          <p className="text-sm text-slate-600 dark:text-slate-400">Confirme o recebimento ou reporte pendências</p>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={(v) => {
        const next = v as 'fiscal' | 'financeiro' | 'xml' | 'manual_nf' | 'items';
        if (next === 'items') {
          if (!isFiscalValid) {
            toast({ title: "Validação", description: "Informe Forma de Pagamento e Vencimento da Fatura", variant: "destructive" });
            return;
          }
          const invalids = Array.isArray(itemsWithPrices) ? itemsWithPrices.filter((it: any) => {
            const current = Number(receivedQuantities[it.id] || 0);
            const max = Number(it.quantity || 0);
            return current > max;
          }) : [];
          if (invalids.length > 0) {
            toast({ title: "Validação", description: "Existem itens com quantidade recebida maior que a prevista", variant: "destructive" });
            return;
          }
          const hasAnyQty = Object.values(receivedQuantities).some(v => Number(v) > 0);
          if (!hasAnyQty && !xmlPreview) {
            toast({ title: "Validação", description: "Informe quantidades recebidas ou importe o XML", variant: "destructive" });
            return;
          }
          if (allocations.length > 0 && !allocationsSumOk) {
            toast({ title: "Validação", description: "A soma do rateio deve igualar o total", variant: "destructive" });
            return;
          }
        }
        setActiveTab(next);
      }}>
        <TabsList className="w-full justify-between gap-2">
          <TabsTrigger value="fiscal">Informações Básicas</TabsTrigger>
          <TabsTrigger value="xml">Informações de Nota Fiscal</TabsTrigger>
          {receiptType !== "avulso" && <TabsTrigger value="manual_nf">Inclusão Manual de NF</TabsTrigger>}
          <TabsTrigger value="financeiro">Informações Financeiras</TabsTrigger>
          <TabsTrigger value="items">Confirmação de Itens</TabsTrigger>
          <div className="ml-auto">
            <AlertDialog open={showClearConfirm} onOpenChange={setShowClearConfirm}>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Reiniciar Formulário</AlertDialogTitle>
                  <AlertDialogDescription>
                    Tem certeza que deseja limpar todos os dados? Um backup temporário será criado na sessão e campos obrigatórios permanecerão destacados.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancelar</AlertDialogCancel>
                  <AlertDialogAction
                    className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                    onClick={handleResetConfirmed}
                  >
                    Limpar
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
              <Button
                variant="outline"
                className="ml-2 border-destructive text-destructive hover:bg-destructive/10"
                aria-label="Limpar dados do formulário"
                onClick={() => setShowClearConfirm(true)}
              >
                <Trash2 className="h-4 w-4 mr-2" />
                Limpar Dados
              </Button>
            </AlertDialog>
          </div>
        </TabsList>

        <TabsContent value="fiscal">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Request Information */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Package className="h-5 w-5" />
              Informações da Solicitação
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-sm font-medium text-slate-600 dark:text-slate-400">Número</p>
                <Badge variant="outline" className="mt-1">
                  {request.requestNumber}
                </Badge>
              </div>
              <div>
                <p className="text-sm font-medium text-slate-600 dark:text-slate-400">Categoria</p>
                <p className="text-sm text-slate-700 dark:text-slate-300">{CATEGORY_LABELS[request.category as keyof typeof CATEGORY_LABELS]}</p>
              </div>
            </div>

            <div>
              <p className="text-sm font-medium text-slate-600 dark:text-slate-400">Justificativa</p>
              <p className="text-sm mt-1 text-slate-700 dark:text-slate-300">{request.justification}</p>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-sm font-medium text-slate-600 dark:text-slate-400">Urgência</p>
                <Badge
                  variant={request.urgency === "alto" ? "destructive" : "secondary"}
                  className="mt-1"
                >
                  {URGENCY_LABELS[request.urgency as keyof typeof URGENCY_LABELS]}
                </Badge>
              </div>
              <div>
                <p className="text-sm font-medium text-slate-600 dark:text-slate-400">Valor Total</p>
                <p className="text-sm font-medium mt-1 text-slate-700 dark:text-slate-300">{formatCurrency(request.totalValue)}</p>
              </div>
            </div>

            <div>
              <p className="text-sm font-medium text-slate-600 dark:text-slate-400">Data de Criação</p>
              <p className="text-sm mt-1 text-slate-700 dark:text-slate-300">{formatDate(request.createdAt)}</p>
            </div>
          </CardContent>
        </Card>

        {/* People Information */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <User className="h-5 w-5" />
              Responsáveis
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <p className="text-sm font-medium text-slate-600 dark:text-slate-400">Solicitante</p>
              <p className="text-sm mt-1 text-slate-700 dark:text-slate-300">
                {request.requester ?
                  `${request.requester.firstName} ${request.requester.lastName}` :
                  "N/A"
                }
              </p>
              <p className="text-xs text-slate-500 dark:text-slate-400">{request.requester?.email}</p>
            </div>

            {request.approverA1 && (
              <div>
                <p className="text-sm font-medium text-slate-600 dark:text-slate-400">Aprovador A1</p>
                <p className="text-sm mt-1 text-slate-700 dark:text-slate-300">
                  {`${request.approverA1.firstName} ${request.approverA1.lastName}`}
                </p>
                <p className="text-xs text-slate-500 dark:text-slate-400">{request.approverA1.email}</p>
              </div>
            )}

            {request.approverA2 && (
              <div>
                <p className="text-sm font-medium text-slate-600 dark:text-slate-400">Aprovador A2</p>
                <p className="text-sm mt-1 text-slate-700 dark:text-slate-300">
                  {`${request.approverA2.firstName} ${request.approverA2.lastName}`}
                </p>
                <p className="text-xs text-slate-500 dark:text-slate-400">{request.approverA2.email}</p>
              </div>
            )}

            {request.costCenter && (
              <div>
                <p className="text-sm font-medium text-slate-600 dark:text-slate-400">Centro de Custo</p>
                <p className="text-sm mt-1 text-slate-700 dark:text-slate-300">{request.costCenter.name}</p>
                <p className="text-xs text-slate-500 dark:text-slate-400">Código: {request.costCenter.code}</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
            <div className="flex justify-end gap-2">
        <Button variant="outline" onClick={onClose}>Cancelar</Button>
        <Button onClick={() => {
          setActiveTab('xml');
        }}>Próxima</Button>
      </div>
        </TabsContent>

        <TabsContent value="manual_nf">
          <div className="space-y-6">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle>Inclusão Manual de Nota Fiscal</CardTitle>
                <ReceiptSearchDialog
                  trigger={<Button variant="outline" size="sm"><Search className="h-4 w-4 mr-2" />Buscar Nota Existente</Button>}
                  onSelect={handleExistingReceiptSelect}
                />
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <Label>Tipo</Label>
                    <Select value={receiptType} onValueChange={(v) => setReceiptType(v as any)}>
                      <SelectTrigger className="w-full"><SelectValue placeholder="Selecione" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="produto">Produto</SelectItem>
                        <SelectItem value="servico">Serviço</SelectItem>
                        <SelectItem value="avulso">Avulsa</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label>{receiptType === "avulso" ? "Número do Documento" : "Número da NF"} {receiptType === "avulso" && <span className="text-red-500">*</span>}</Label>
                    <Input value={manualNFNumber} onChange={(e) => { setManualNFNumber(e.target.value); }} placeholder="Informe o número" />
                    {manualErrors.number && <p className="text-sm text-red-600 mt-1">{manualErrors.number}</p>}
                  </div>
                  {receiptType !== "avulso" && (
                    <div>
                      <Label>Série</Label>
                      <Input value={manualNFSeries} onChange={(e) => { setManualNFSeries(e.target.value); }} placeholder="Informe a série" />
                      {manualErrors.series && <p className="text-sm text-red-600 mt-1">{manualErrors.series}</p>}
                    </div>
                  )}
                </div>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  {receiptType !== "avulso" && (
                    <div>
                      <Label>Chave de Acesso (NF-e)</Label>
                      <Input value={manualNFAccessKey} onChange={(e) => setManualNFAccessKey(e.target.value)} placeholder="44 dígitos" />
                      {manualErrors.accessKey && <p className="text-sm text-red-600 mt-1">{manualErrors.accessKey}</p>}
                    </div>
                  )}
                  <div>
                    <Label>Data de Emissão {receiptType === "avulso" && <span className="text-red-500">*</span>}</Label>
                    <Input type="date" value={manualNFIssueDate} onChange={(e) => setManualNFIssueDate(e.target.value)} />
                    {manualErrors.issueDate && <p className="text-sm text-red-600 mt-1">{manualErrors.issueDate}</p>}
                  </div>
                  {receiptType !== "avulso" && (
                    <div>
                      <Label>CNPJ do Emitente</Label>
                      <Input value={manualNFEmitterCNPJ} onChange={(e) => setManualNFEmitterCNPJ(e.target.value)} placeholder="00.000.000/0000-00" />
                      {manualErrors.emitterCnpj && <p className="text-sm text-red-600 mt-1">{manualErrors.emitterCnpj}</p>}
                    </div>
                  )}
                </div>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  {receiptType !== "avulso" && (
                    <div>
                      <Label>Data de Entrada</Label>
                      <Input type="date" value={manualNFEntryDate} onChange={(e) => setManualNFEntryDate(e.target.value)} />
                    </div>
                  )}
                  <div>
                    <Label>Valor Total {receiptType === "avulso" && <span className="text-red-500">*</span>}</Label>
                    <Input value={manualTotal} onChange={(e) => setManualTotal(e.target.value)} placeholder="0,00" />
                    {manualErrors.total && <p className="text-sm text-red-600 mt-1">{manualErrors.total}</p>}
                  </div>
                </div>
                <div className="flex justify-between">
                  <Button type="button" variant="outline" onClick={() => setActiveTab('xml')}>Voltar</Button>
                  <div className="flex gap-2">
                    <Button type="button" variant="secondary" onClick={() => {
                      const header = validateManualHeader({
                        number: manualNFNumber, series: manualNFSeries, accessKey: manualNFAccessKey,
                        issueDate: manualNFIssueDate, emitterCnpj: manualNFEmitterCNPJ, total: manualTotal,
                        kind: receiptType === "servico" ? "servico" : (receiptType === "avulso" ? "avulso" : "produto"),
                      });
                      setManualErrors(header.errors);
                      if (!header.isValid) {
                        return toast({ title: "Validação", description: "Preencha os campos obrigatórios corretamente", variant: "destructive" });
                      }
                      setManualNFStep(2);
                      toast({ title: "Etapa", description: "Cadastro inicial concluído" });
                    }}>Próxima</Button>
                    <Button type="button" variant="outline" onClick={() => toast({ title: "Rascunho", description: "Dados salvos localmente" })}>Salvar Parcial</Button>
                  </div>
                </div>
              </CardContent>
            </Card>

            {manualNFStep >= 2 && (
              <Card>
                <CardHeader><CardTitle>Itens da Nota ({receiptType === "servico" ? "Serviços" : "Produtos"})</CardTitle></CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex justify-between items-center">
                    <div className="text-sm text-muted-foreground">Adicione múltiplos itens e valide os dados</div>
                    <Button type="button" variant="secondary" onClick={() => {
                      if (receiptType === "servico") {
                        setManualItems(prev => [...prev, { description: "", netValue: 0, issValue: 0 } as any]);
                      } else {
                        setManualItems(prev => [...prev, { description: "", ncm: "", quantity: 1, unit: "UN", unitPrice: 0 } as any]);
                      }
                    }}>Adicionar Item</Button>
                  </div>
                  <div className="space-y-2">
                    {manualItems.map((it: any, idx: number) => (
                      <div key={idx} className="grid grid-cols-1 md:grid-cols-6 gap-2 border rounded p-2">
                        {receiptType === "servico" ? (
                          <>
                            <div className="md:col-span-2">
                              <Label>Descrição</Label>
                              <Input value={it.description || ""} onChange={(e) => setManualItems(prev => prev.map((row, i) => i === idx ? { ...row, description: e.target.value } : row))} />
                            </div>
                            <div>
                              <Label>Código de Serviço</Label>
                              <Input value={it.serviceCode || ""} onChange={(e) => setManualItems(prev => prev.map((row, i) => i === idx ? { ...row, serviceCode: e.target.value } : row))} />
                            </div>
                            <div>
                              <Label>Valor Líquido</Label>
                              <Input type="number" value={it.netValue ?? 0} onChange={(e) => setManualItems(prev => prev.map((row, i) => i === idx ? { ...row, netValue: Number(e.target.value) } : row))} />
                            </div>
                            <div>
                              <Label>ISS</Label>
                              <Input type="number" value={it.issValue ?? 0} onChange={(e) => setManualItems(prev => prev.map((row, i) => i === idx ? { ...row, issValue: Number(e.target.value) } : row))} />
                            </div>
                            <div className="flex items-end">
                              <Button type="button" variant="destructive" onClick={() => setManualItems(prev => prev.filter((_, i) => i !== idx))}>Remover</Button>
                            </div>
                          </>
                        ) : (
                          <>
                            <div>
                              <Label>Código</Label>
                              <Input value={it.code || ""} onChange={(e) => setManualItems(prev => prev.map((row, i) => i === idx ? { ...row, code: e.target.value } : row))} />
                            </div>
                            <div className="md:col-span-2">
                              <Label>Descrição</Label>
                              <Input value={it.description || ""} onChange={(e) => setManualItems(prev => prev.map((row, i) => i === idx ? { ...row, description: e.target.value } : row))} />
                            </div>
                            <div>
                              <Label>NCM</Label>
                              <Input value={it.ncm || ""} onChange={(e) => setManualItems(prev => prev.map((row, i) => i === idx ? { ...row, ncm: e.target.value } : row))} />
                            </div>
                            <div>
                              <Label>Qtd</Label>
                              <Input type="number" value={it.quantity ?? 1} onChange={(e) => setManualItems(prev => prev.map((row, i) => i === idx ? { ...row, quantity: Number(e.target.value) } : row))} />
                            </div>
                            <div>
                              <Label>Valor Unit.</Label>
                              <Input type="number" value={it.unitPrice ?? 0} onChange={(e) => setManualItems(prev => prev.map((row, i) => i === idx ? { ...row, unitPrice: Number(e.target.value) } : row))} />
                            </div>
                            <div className="md:col-span-6 grid grid-cols-1 md:grid-cols-6 gap-2 border rounded p-2 bg-slate-50 dark:bg-slate-900">
                              <div>
                                <Label>ICMS vBC</Label>
                                <Input type="number" value={(itemTaxes[idx + 1]?.vBC ?? "") as any} onChange={(e) => {
                                  const vBC = Number(e.target.value || 0);
                                  setItemTaxes(prev => {
                                    const curr = { ...(prev[idx + 1] || {}) };
                                    curr.vBC = vBC;
                                    if (curr.pICMS != null) curr.vICMS = Number(((vBC || 0) * (Number(curr.pICMS) || 0) / 100).toFixed(2));
                                    return { ...prev, [idx + 1]: curr };
                                  });
                                }} />
                              </div>
                              <div>
                                <Label>ICMS %</Label>
                                <Input type="number" value={(itemTaxes[idx + 1]?.pICMS ?? "") as any} onChange={(e) => {
                                  const pICMS = Number(e.target.value || 0);
                                  setItemTaxes(prev => {
                                    const curr = { ...(prev[idx + 1] || {}) };
                                    curr.pICMS = pICMS;
                                    const base = curr.vBC ?? Number((it.quantity || 0) * (it.unitPrice || 0));
                                    curr.vICMS = Number(((base || 0) * (pICMS || 0) / 100).toFixed(2));
                                    return { ...prev, [idx + 1]: curr };
                                  });
                                }} />
                              </div>
                              <div>
                                <Label>ICMS Valor</Label>
                                <Input type="number" value={(itemTaxes[idx + 1]?.vICMS ?? "") as any} onChange={(e) => {
                                  const vICMS = Number(e.target.value || 0);
                                  setItemTaxes(prev => ({ ...prev, [idx + 1]: { ...(prev[idx + 1] || {}), vICMS } }));
                                }} />
                              </div>
                              <div>
                                <Label>IPI vBC</Label>
                                <Input type="number" value={(itemTaxes[idx + 1]?.ipi?.vBC ?? "") as any} onChange={(e) => {
                                  const vBC = Number(e.target.value || 0);
                                  setItemTaxes(prev => {
                                    const curr = { ...(prev[idx + 1] || {}) };
                                    curr.ipi = { ...(curr.ipi || {}), vBC };
                                    return { ...prev, [idx + 1]: curr };
                                  });
                                }} />
                              </div>
                              <div>
                                <Label>IPI %</Label>
                                <Input type="number" value={(itemTaxes[idx + 1]?.ipi?.pIPI ?? "") as any} onChange={(e) => {
                                  const pIPI = Number(e.target.value || 0);
                                  setItemTaxes(prev => {
                                    const curr = { ...(prev[idx + 1] || {}) };
                                    const base = curr.ipi?.vBC ?? Number((it.quantity || 0) * (it.unitPrice || 0));
                                    curr.ipi = { ...(curr.ipi || {}), pIPI, vIPI: Number(((base || 0) * (pIPI || 0) / 100).toFixed(2)) };
                                    return { ...prev, [idx + 1]: curr };
                                  });
                                }} />
                              </div>
                              <div>
                                <Label>IPI Valor</Label>
                                <Input type="number" value={(itemTaxes[idx + 1]?.ipi?.vIPI ?? "") as any} onChange={(e) => {
                                  const vIPI = Number(e.target.value || 0);
                                  setItemTaxes(prev => {
                                    const curr = { ...(prev[idx + 1] || {}) };
                                    curr.ipi = { ...(curr.ipi || {}), vIPI };
                                    return { ...prev, [idx + 1]: curr };
                                  });
                                }} />
                              </div>
                              <div>
                                <Label>PIS CST</Label>
                                <Input value={(itemTaxes[idx + 1]?.pis?.cst ?? "") as any} onChange={(e) => {
                                  const cst = String(e.target.value || "");
                                  setItemTaxes(prev => {
                                    const curr = { ...(prev[idx + 1] || {}) };
                                    curr.pis = { ...(curr.pis || {}), cst };
                                    return { ...prev, [idx + 1]: curr };
                                  });
                                }} />
                              </div>
                              <div>
                                <Label>COFINS CST</Label>
                                <Input value={(itemTaxes[idx + 1]?.cofins?.cst ?? "") as any} onChange={(e) => {
                                  const cst = String(e.target.value || "");
                                  setItemTaxes(prev => {
                                    const curr = { ...(prev[idx + 1] || {}) };
                                    curr.cofins = { ...(curr.cofins || {}), cst };
                                    return { ...prev, [idx + 1]: curr };
                                  });
                                }} />
                              </div>
                            </div>
                            <div className="flex items-end">
                              <Button type="button" variant="destructive" onClick={() => setManualItems(prev => prev.filter((_, i) => i !== idx))}>Remover</Button>
                            </div>
                          </>
                        )}
                      </div>
                    ))}
                  </div>
                  <div className="flex justify-between">
                    <Button type="button" variant="outline" onClick={() => setManualNFStep(1)}>Voltar</Button>
                    <div className="flex gap-2">
                      <Button type="button" variant="secondary" onClick={() => {
                        const res = validateManualItems(receiptType === "servico" ? "servico" : "produto", manualItems as any);
                        if (!res.isValid) {
                          return toast({ title: "Validação", description: res.errors[0]?.message || "Itens inválidos", variant: "destructive" });
                        }
                        setManualNFStep(3);
                        toast({ title: "Etapa", description: "Itens incluídos" });
                      }}>Próxima</Button>
                      <Button type="button" variant="outline" onClick={() => toast({ title: "Rascunho", description: "Itens salvos localmente" })}>Salvar Parcial</Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}

            {manualNFStep >= 3 && (
              <Card>
                <CardHeader><CardTitle>Conferência Final</CardTitle></CardHeader>
                <CardContent className="space-y-3">
                  <div className="text-sm text-muted-foreground">Verifique se os dados estão consistentes antes de confirmar</div>
                  <div className="flex justify-end gap-2">
                    <Button type="button" variant="outline" onClick={() => setManualNFStep(2)}>Voltar</Button>
                    <Button type="button" onClick={() => {
                      const header = validateManualHeader({
                        number: manualNFNumber, series: manualNFSeries, accessKey: manualNFAccessKey,
                        issueDate: manualNFIssueDate, emitterCnpj: manualNFEmitterCNPJ, total: manualTotal,
                        kind: receiptType === "servico" ? "servico" : "produto",
                      });
                      setManualErrors(header.errors);
                      if (!header.isValid) {
                        return toast({ title: "Validação", description: "Campos obrigatórios pendentes no cadastro inicial", variant: "destructive" });
                      }
                      const kind = receiptType === "servico" ? "servico" : "produto";
                      const res = validateManualItems(kind, manualItems as any);
                      if (!res.isValid) {
                        return toast({ title: "Validação", description: "Itens inválidos", variant: "destructive" });
                      }
                      const totCheck = validateTotalConsistency(manualTotal, kind as any, manualItems as any);
                      if (!totCheck.isValid) {
                        return toast({ title: "Validação", description: `Valor total (${totCheck.provided.toFixed(2)}) não confere com soma dos itens (${totCheck.expected.toFixed(2)})`, variant: "destructive" });
                      }
                      setActiveTab('financeiro');
                      toast({ title: "Sucesso", description: "Dados da Nota Fiscal validados. Prossiga com as informações financeiras." });
                    }}>Avançar para Financeiro</Button>
                  </div>
                </CardContent>
              </Card>
            )}
          </div>
        </TabsContent>
        <TabsContent value="financeiro">
          <div className="space-y-6">
            <Card>
              <CardHeader><CardTitle>Informações Financeiras</CardTitle></CardHeader>
              <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label>Forma de Pagamento</Label>
                  <Select value={paymentMethodCode || undefined} onValueChange={(v) => setPaymentMethodCode(v)}>
                    <SelectTrigger className="w-full"><SelectValue placeholder="Selecione" /></SelectTrigger>
                    <SelectContent>
                      {paymentMethods.length > 0 ? (
                        paymentMethods.map((pm) => (
                          <SelectItem key={pm.code} value={pm.code}>{pm.name}</SelectItem>
                        ))
                      ) : (
                        <SelectItem value="none" disabled>Nenhuma forma disponível</SelectItem>
                      )}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Data de Vencimento da Fatura</Label>
                  <Input type="date" value={invoiceDueDate} onChange={(e) => setInvoiceDueDate(e.target.value)} />
                </div>
                <div>
                  <Label>Parcelamento</Label>
                  <Select value={hasInstallments ? "sim" : "nao"} onValueChange={(v) => setHasInstallments(v === "sim")}> 
                    <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="nao">Sem parcelamento</SelectItem>
                      <SelectItem value="sim">Parcelado</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                {hasInstallments && (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                    <div>
                      <Label>Número de parcelas</Label>
                      <Input type="number" min={1} value={installmentCount} onChange={(e) => setInstallmentCount(Math.max(1, Number(e.target.value || 1)))} />
                    </div>
                    <div className="flex items-end">
                      <Button type="button" variant="secondary" onClick={() => {
                        if (!invoiceDueDate) {
                          toast({ title: "Validação", description: "Informe a Data de Vencimento inicial", variant: "destructive" });
                          return;
                        }
                        const total = baseTotalForAllocation;
                        const n = Math.max(1, Number(installmentCount || 1));
                        const per = Math.floor((total * 100) / n) / 100;
                        const vals = Array.from({ length: n }).map((_, i) => (i === n - 1 ? Number((total - per * (n - 1)).toFixed(2)) : per));
                        const base = new Date(invoiceDueDate);
                        const rows = vals.map((amt, i) => {
                          const d = new Date(base);
                          d.setMonth(d.getMonth() + i);
                          const yyyy = d.getFullYear();
                          const mm = String(d.getMonth() + 1).padStart(2, '0');
                          const dd = String(d.getDate()).padStart(2, '0');
                          return { dueDate: `${yyyy}-${mm}-${dd}`, amount: amt.toFixed(2), method: paymentMethodCode || undefined };
                        });
                        setInstallments(rows);
                        toast({ title: "Parcelas geradas", description: `${n} parcela(s) criadas totalizando ${formatCurrency(total)}` });
                      }}>Gerar Parcelas</Button>
                    </div>
                    <div className="md:col-span-2">
                      <div className="rounded border">
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead>#</TableHead>
                              <TableHead>Valor</TableHead>
                              <TableHead>Vencimento</TableHead>
                              <TableHead>Forma</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {installments.map((row, idx) => (
                              <TableRow key={idx}>
                                <TableCell>{idx + 1}</TableCell>
                                <TableCell>
                                  <Input value={row.amount} onChange={(e) => setInstallments(prev => prev.map((r, i) => i === idx ? { ...r, amount: e.target.value } : r))} />
                                </TableCell>
                                <TableCell>
                                  <Input type="date" value={row.dueDate} onChange={(e) => setInstallments(prev => prev.map((r, i) => i === idx ? { ...r, dueDate: e.target.value } : r))} />
                                </TableCell>
                                <TableCell>
                                  <Select value={row.method || paymentMethodCode || undefined} onValueChange={(v) => setInstallments(prev => prev.map((r, i) => i === idx ? { ...r, method: v } : r))} disabled={isLoadingPaymentMethods}>
                                    <SelectTrigger className="w-full"><SelectValue placeholder={isLoadingPaymentMethods ? "Carregando..." : ""} /></SelectTrigger>
                                    <SelectContent>
                                      {paymentMethods.length > 0 ? (
                                        paymentMethods.map((pm) => (
                                          <SelectItem key={pm.code} value={pm.code}>{pm.name}</SelectItem>
                                        ))
                                      ) : (
                                        <SelectItem value="none" disabled>Nenhuma forma disponível</SelectItem>
                                      )}
                                    </SelectContent>
                                  </Select>
                                </TableCell>
                              </TableRow>
                            ))}
                            {installments.length === 0 && (
                              <TableRow>
                                <TableCell colSpan={4} className="text-center text-sm text-muted-foreground">Nenhuma parcela</TableCell>
                              </TableRow>
                            )}
                          </TableBody>
                        </Table>
                      </div>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
            <Card>
              <CardHeader><CardTitle>Rateio de Centro de Custo e Plano de Contas</CardTitle></CardHeader>
              <CardContent className="space-y-4">
                <div className="flex gap-2 items-center">
                  <Label>Modo</Label>
                  <Select value={allocationMode} onValueChange={(v) => setAllocationMode(v as any)}>
                    <SelectTrigger className="w-48"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="manual">Manual</SelectItem>
                      <SelectItem value="proporcional">Proporcional</SelectItem>
                    </SelectContent>
                  </Select>
                  <div className="ml-auto text-sm">
                    <span className="mr-2">Total do Pedido:</span>
                    <Badge variant="outline">{formatCurrency(baseTotalForAllocation)}</Badge>
                  </div>
                </div>
                <div className="rounded border">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Centro de Custo</TableHead>
                        <TableHead>Plano de Contas</TableHead>
                        <TableHead className="text-right">Valor</TableHead>
                        <TableHead className="text-right">%</TableHead>
                        <TableHead className="text-center">Ações</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {allocations.map((row, idx) => (
                        <TableRow key={idx} className={autoFilledRows.has(idx) ? "bg-green-50 dark:bg-green-900/20" : undefined}>
                          <TableCell>
                            <CostCenterTreeSelect options={costCenters} value={row.costCenterId ?? null} onChange={(id) => {
                              setAllocations(prev => prev.map((r, i) => i === idx ? { ...r, costCenterId: id ?? undefined } : r));
                            }} placeholder="Selecione" />
                          </TableCell>
                          <TableCell>
                            <ChartAccountTreeSelect options={chartAccounts} value={row.chartOfAccountsId ?? null} onChange={(id) => {
                              setAllocations(prev => prev.map((r, i) => i === idx ? { ...r, chartOfAccountsId: id ?? undefined } : r));
                            }} placeholder="Selecione" />
                          </TableCell>
                          <TableCell className="text-right">
                            <Input value={row.amount ?? ""} onChange={(e) => {
                              const val = e.target.value;
                              setAllocations(prev => prev.map((r, i) => i === idx ? { ...r, amount: val } : r));
                            }} placeholder="0,00" className={autoFilledRows.has(idx) ? "ring-1 ring-green-500" : undefined} />
                          </TableCell>
                          <TableCell className="text-right">
                            <Input value={row.percentage ?? ""} onChange={(e) => {
                              const val = e.target.value;
                              setAllocations(prev => prev.map((r, i) => i === idx ? { ...r, percentage: val } : r));
                            }} placeholder="%" className={autoFilledRows.has(idx) ? "ring-1 ring-green-500" : undefined} />
                          </TableCell>
                          <TableCell className="text-center">
                            <Button variant="outline" size="sm" onClick={() => {
                              setAllocations(prev => prev.filter((_, i) => i !== idx));
                            }}>Remover</Button>
                          </TableCell>
                        </TableRow>
                      ))}
                      {allocations.length === 0 && (
                        <TableRow>
                          <TableCell colSpan={5} className="text-center text-sm text-muted-foreground">Nenhuma linha de rateio adicionada</TableCell>
                        </TableRow>
                      )}
                    </TableBody>
                  </Table>
                </div>
                <div className="flex gap-2">
                  <Button type="button" variant="secondary" onClick={() => {
                    setAllocations(prev => [...prev, {}]);
                  }}>Adicionar Linha</Button>
                  <Button type="button" variant="secondary" onClick={() => {
                    if (allocationMode !== "proporcional") return;
                    const rows = allocations.filter(a => a.costCenterId && a.chartOfAccountsId);
                    if (rows.length === 0) return;
                    const per = baseTotalForAllocation / rows.length;
                    const pct = 100 / rows.length;
                    setAllocations(prev => prev.map(r => {
                      if (r.costCenterId && r.chartOfAccountsId) {
                        return { ...r, amount: per.toFixed(2), percentage: pct.toFixed(2) };
                      }
                      return r;
                    }));
                  }}>Distribuir Proporcionalmente</Button>
                  <Button type="button" variant="secondary" onClick={() => {
                    const validRows = allocations.map((r, i) => ({ r, i })).filter(({ r }) => r.costCenterId && r.chartOfAccountsId);
                    if (validRows.length === 0) {
                      toast({ title: "Validação", description: "Adicione uma linha com Centro de Custo e Plano de Contas selecionados", variant: "destructive" });
                      return;
                    }
                    if (validRows.length > 1) {
                      toast({ title: "Validação", description: "Para 'Preencher 100%', mantenha apenas uma linha válida", variant: "destructive" });
                      return;
                    }
                    const idx = validRows[0].i;
                    setAllocations(prev => prev.map((r, i) => i === idx ? { ...r, amount: baseTotalForAllocation.toFixed(2), percentage: "100" } : { ...r, amount: undefined, percentage: undefined }));
                    setAutoFilledRows(new Set([idx]));
                    window.setTimeout(() => setAutoFilledRows(new Set()), 2500);
                  }}>Preencher 100%</Button>
                  <Button type="button" variant="default" onClick={handleFillMissingAllocationValues} aria-label="Preencher valores vazios do rateio">
                    Preencher Valores Vazios
                  </Button>
                  <div className="ml-auto flex items-center gap-3">
                    <Badge variant={allocationsSumOk ? "outline" : "destructive"}>{allocationsSumOk ? "Soma ok" : "Soma diferente do total"}</Badge>
                    <div className="text-sm">Soma: {formatCurrency(allocationsSum)} </div>
                  </div>
                </div>
              </CardContent>
            </Card>
            <div className="flex justify-between gap-2">
              <Button variant="outline" onClick={() => setActiveTab('xml')}>Voltar</Button>
              <Button onClick={() => {
                if (!isFiscalValid) {
                  return toast({ title: "Validação", description: "Informe Forma de Pagamento e Vencimento da Fatura", variant: "destructive" });
                }
                if (allocations.length > 0 && !allocationsSumOk) {
                  return toast({ title: "Validação", description: "A soma do rateio deve igualar o total", variant: "destructive" });
                }
                setActiveTab('items');
              }}>Próxima</Button>
            </div>
          </div>
        </TabsContent>

        <TabsContent value="xml">
          <div className="space-y-6">
            <Card>
              <CardHeader><CardTitle>Tipo de Nota Fiscal</CardTitle></CardHeader>
              <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label>Selecione o tipo</Label>
                  <Select value={receiptType} onValueChange={(v) => {
                    const next = v as "produto" | "servico" | "avulso";
                    setReceiptType(next);
                  }}>
                    <SelectTrigger className="w-full"><SelectValue placeholder="Selecione" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="produto">Produto</SelectItem>
                      <SelectItem value="servico">Serviço</SelectItem>
                      <SelectItem value="avulso">Avulsa</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="text-sm text-muted-foreground">
                  {receiptType === "avulso" 
                    ? "Para notas Avulsas, preencha os dados básicos do documento abaixo." 
                    : "Para notas fiscais eletrônicas, utilize a importação de XML ou busca automática."}
                </div>
              </CardContent>
            </Card>

            {receiptType === "avulso" ? (
              <Card>
                <CardHeader><CardTitle>Dados do Documento Avulso</CardTitle></CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <Label>Número do Documento <span className="text-red-500">*</span></Label>
                      <Input value={manualNFNumber} onChange={(e) => setManualNFNumber(e.target.value)} placeholder="Informe o número" />
                      {manualErrors.number && <p className="text-sm text-red-600 mt-1">{manualErrors.number}</p>}
                    </div>
                    <div>
                      <Label>Data de Emissão <span className="text-red-500">*</span></Label>
                      <Input type="date" value={manualNFIssueDate} onChange={(e) => setManualNFIssueDate(e.target.value)} />
                      {manualErrors.issueDate && <p className="text-sm text-red-600 mt-1">{manualErrors.issueDate}</p>}
                    </div>
                    <div className="md:col-span-2">
                      <Label>Valor Total <span className="text-red-500">*</span></Label>
                      <Input value={manualTotal} onChange={(e) => setManualTotal(e.target.value)} placeholder="0,00" />
                      {manualErrors.total && <p className="text-sm text-red-600 mt-1">{manualErrors.total}</p>}
                    </div>
                  </div>
                </CardContent>
              </Card>
            ) : (
              <>
                <Card>
                  <CardHeader><CardTitle>Importação de XML</CardTitle></CardHeader>
                  <CardContent>
                  <>
                    <Input type="file" accept=".xml" disabled={isXmlUploading} onChange={(e) => onUploadXml(e.target.files?.[0] || null)} />
                    {isXmlUploading && (
                      <div className="mt-2 text-sm text-muted-foreground">Processando XML...</div>
                    )}
                    {receiptType === "servico" && (
                      <div className="mt-3">
                        <Badge variant="outline" className="bg-indigo-50 text-indigo-700 border-indigo-200">Modo NFS-e</Badge>
                      </div>
                    )}
                    {(xmlPreview || xmlRecovered) && (
                      <div className="mt-3">
                        <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">XML já importado</Badge>
                      </div>
                    )}
                    {xmlPreview && (
                      <div className="mt-4 text-sm flex items-center justify-between">
                        <div>
                          <div>Total: {xmlPreview?.totals?.vNF || xmlPreview?.totals?.vProd}</div>
                          <div>Itens: {Array.isArray(xmlPreview?.items) ? xmlPreview.items.length : 0}</div>
                        </div>
                        {receiptType === "produto" && (
                          <Dialog>
                            <DialogTrigger asChild>
                              <Button variant="secondary">Visualização detalhada</Button>
                            </DialogTrigger>
                            <DialogContent className="max-w-6xl">
                              <DialogTitle>NF-e</DialogTitle>
                              <div className="max-h-[75vh] overflow-y-auto">
                                <NFEViewer xmlString={xmlRaw} />
                              </div>
                            </DialogContent>
                          </Dialog>
                        )}
                      </div>
                    )}
                    {receiptType === "produto" && (
                      <div className="mt-6">
                        <Card>
                          <CardHeader><CardTitle>Buscar NF-es Importadas</CardTitle></CardHeader>
                          <CardContent>
                            <ErrorBoundary fallback={<div className="text-sm text-red-600">Erro ao carregar lista</div>}>
                              <NFEList
                                purchaseRequestId={request.id}
                                onPreviewLoaded={({ preview, attachmentId, xmlRaw }) => {
                                  try {
                                    setXmlPreview(preview);
                                    setXmlRaw(xmlRaw);
                                    setXmlAttachmentId(attachmentId ?? null);

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
                                      const snapshot = { xmlRaw, xmlPreview: preview, xmlAttachmentId: attachmentId ?? null, receiptType, timestamp: new Date().toISOString() };
                                      localStorage.setItem(stateKey, JSON.stringify(snapshot));
                                      const existing = localStorage.getItem(histKey);
                                      const history = existing ? JSON.parse(existing) : [];
                                      history.push({ timestamp: snapshot.timestamp, attachmentId: snapshot.xmlAttachmentId, itemsCount: Array.isArray(preview?.items) ? preview.items.length : 0, totals: preview?.totals });
                                      localStorage.setItem(histKey, JSON.stringify(history));
                                    } catch {}
                                    setXmlRecovered(true);
                                    toast({ title: "XML carregado", description: "Prévia importada a partir de anexo" });
                                  } catch {}
                                }}
                              />
                            </ErrorBoundary>
                          </CardContent>
                        </Card>
                      </div>
                    )}
                    <div className="mt-4 flex justify-end">
                      <Button type="button" variant="secondary" onClick={() => {
                        try {
                          apiRequest(`/api/audit/log`, {
                            method: "POST",
                            body: {
                              purchaseRequestId: request.id,
                              actionType: "nfe_manual_inclusion_started",
                              actionDescription: "Inclusão manual de NF iniciada",
                              beforeData: null,
                              afterData: null,
                              affectedTables: ["receipts"],
                            },
                          });
                        } catch {}
                        setActiveTab('manual_nf' as any);
                      }}>Incluir Nota Manualmente</Button>
                    </div>
                  </>
            </CardContent>
          </Card>
        </>
      )}

          {receiptType !== "avulso" && (
            <>
              <Card>
                <CardHeader><CardTitle>Totais da Nota</CardTitle></CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div><Label>Valor Produtos</Label><Input value={manualProductsValue} onChange={(e) => setManualProductsValue(e.target.value)} placeholder="0,00" /></div>
                    <div><Label>Valor Frete</Label><Input value={manualFreightValue} onChange={(e) => setManualFreightValue(e.target.value)} placeholder="0,00" /></div>
                    <div><Label>Descontos</Label><Input value={manualDiscountValue} onChange={(e) => setManualDiscountValue(e.target.value)} placeholder="0,00" /></div>
                    <div><Label>Base ICMS</Label><Input value={manualIcmsBase} onChange={(e) => setManualIcmsBase(e.target.value)} placeholder="0,00" /></div>
                    <div><Label>Valor ICMS</Label><Input value={manualIcmsValue} onChange={(e) => setManualIcmsValue(e.target.value)} placeholder="0,00" /></div>
                    <div><Label>Outras Despesas</Label><Input value={manualOtherTaxes} onChange={(e) => setManualOtherTaxes(e.target.value)} placeholder="0,00" /></div>
                    <div className="md:col-span-3">
                      <Label>Valor Total da Nota</Label>
                      <Input value={manualTotal} onChange={(e) => setManualTotal(e.target.value)} placeholder="0,00" className="font-bold text-lg" />
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader><CardTitle>Pagamento</CardTitle></CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <Label>Forma de Pagamento</Label>
                      <Select value={paymentMethodCode} onValueChange={setPaymentMethodCode}>
                        <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                        <SelectContent>
                          {paymentMethods.map(pm => (<SelectItem key={pm.code} value={pm.code}>{pm.name}</SelectItem>))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div><Label>Condições de Pagamento</Label><Input value={manualPaymentCondition} onChange={(e) => setManualPaymentCondition(e.target.value)} placeholder="Ex: 30/60/90 dias" /></div>
                    <div className="md:col-span-2"><Label>Dados Bancários</Label><Input value={manualBankDetails} onChange={(e) => setManualBankDetails(e.target.value)} placeholder="Banco, Agência, Conta" /></div>
                    <div><Label>Valor Pago</Label><Input value={manualPaidAmount} onChange={(e) => setManualPaidAmount(e.target.value)} placeholder="0,00" /></div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader><CardTitle>Dados do Emitente</CardTitle></CardHeader>
            <CardContent className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <Label>CNPJ</Label>
                <Input value={emitter.cnpj || ""} onChange={(e) => setEmitter(prev => ({ ...prev, cnpj: e.target.value }))} placeholder="00.000.000/0000-00" />
              </div>
              <div className="md:col-span-2">
                <Label>Razão Social</Label>
                <Input value={emitter.name || ""} onChange={(e) => setEmitter(prev => ({ ...prev, name: e.target.value }))} placeholder="Nome" />
              </div>
              <div>
                <Label>Nome Fantasia</Label>
                <Input value={emitter.fantasyName || ""} onChange={(e) => setEmitter(prev => ({ ...prev, fantasyName: e.target.value }))} />
              </div>
              <div>
                <Label>IE</Label>
                <Input value={emitter.ie || ""} onChange={(e) => setEmitter(prev => ({ ...prev, ie: e.target.value }))} />
              </div>
              <div>
                <Label>IM</Label>
                <Input value={emitter.im || ""} onChange={(e) => setEmitter(prev => ({ ...prev, im: e.target.value }))} />
              </div>
              <div>
                <Label>Endereço</Label>
                <Input value={emitter.address?.street || ""} onChange={(e) => setEmitter(prev => ({ ...prev, address: { ...(prev.address || {}), street: e.target.value } }))} placeholder="Logradouro" />
              </div>
              <div>
                <Label>Número</Label>
                <Input value={emitter.address?.number || ""} onChange={(e) => setEmitter(prev => ({ ...prev, address: { ...(prev.address || {}), number: e.target.value } }))} />
              </div>
              <div>
                <Label>Bairro</Label>
                <Input value={emitter.address?.neighborhood || ""} onChange={(e) => setEmitter(prev => ({ ...prev, address: { ...(prev.address || {}), neighborhood: e.target.value } }))} />
              </div>
              <div>
                <Label>Cidade</Label>
                <Input value={emitter.address?.city || ""} onChange={(e) => setEmitter(prev => ({ ...prev, address: { ...(prev.address || {}), city: e.target.value } }))} />
              </div>
              <div>
                <Label>UF</Label>
                <Input value={emitter.address?.uf || ""} onChange={(e) => setEmitter(prev => ({ ...prev, address: { ...(prev.address || {}), uf: e.target.value } }))} />
              </div>
              <div>
                <Label>CEP</Label>
                <Input value={emitter.address?.cep || ""} onChange={(e) => setEmitter(prev => ({ ...prev, address: { ...(prev.address || {}), cep: e.target.value } }))} />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle>Dados do Destinatário</CardTitle></CardHeader>
            <CardContent className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <Label>CPF/CNPJ</Label>
                <Input value={recipient.cnpjCpf || ""} onChange={(e) => setRecipient(prev => ({ ...prev, cnpjCpf: e.target.value }))} />
              </div>
              <div className="md:col-span-2">
                <Label>Razão Social</Label>
                <Input value={recipient.name || ""} onChange={(e) => setRecipient(prev => ({ ...prev, name: e.target.value }))} />
              </div>
              <div>
                <Label>Email</Label>
                <Input value={recipient.email || ""} onChange={(e) => setRecipient(prev => ({ ...prev, email: e.target.value }))} />
              </div>
              <div>
                <Label>Endereço</Label>
                <Input value={recipient.address?.street || ""} onChange={(e) => setRecipient(prev => ({ ...prev, address: { ...(prev.address || {}), street: e.target.value } }))} placeholder="Logradouro" />
              </div>
              <div>
                <Label>Número</Label>
                <Input value={recipient.address?.number || ""} onChange={(e) => setRecipient(prev => ({ ...prev, address: { ...(prev.address || {}), number: e.target.value } }))} />
              </div>
              <div>
                <Label>Bairro</Label>
                <Input value={recipient.address?.neighborhood || ""} onChange={(e) => setRecipient(prev => ({ ...prev, address: { ...(prev.address || {}), neighborhood: e.target.value } }))} />
              </div>
              <div>
                <Label>Cidade</Label>
                <Input value={recipient.address?.city || ""} onChange={(e) => setRecipient(prev => ({ ...prev, address: { ...(prev.address || {}), city: e.target.value } }))} />
              </div>
              <div>
                <Label>UF</Label>
                <Input value={recipient.address?.uf || ""} onChange={(e) => setRecipient(prev => ({ ...prev, address: { ...(prev.address || {}), uf: e.target.value } }))} />
              </div>
              <div>
                <Label>CEP</Label>
                <Input value={recipient.address?.cep || ""} onChange={(e) => setRecipient(prev => ({ ...prev, address: { ...(prev.address || {}), cep: e.target.value } }))} />
              </div>
            </CardContent>
              </Card>
            </>
          )}

          {receiptType === "produto" && (
            <Card>
              <CardHeader><CardTitle>Informações de Transporte</CardTitle></CardHeader>
              <CardContent className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <Label>Modalidade de Frete</Label>
                  <Select value={productTransp.modFrete || ""} onValueChange={(v) => setProductTransp(prev => ({ ...prev, modFrete: v }))}>
                    <SelectTrigger className="w-full"><SelectValue placeholder="Selecione" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="0">Por conta do Emitente</SelectItem>
                      <SelectItem value="1">Por conta do Destinatário</SelectItem>
                      <SelectItem value="2">Por conta de Terceiros</SelectItem>
                      <SelectItem value="3">Transporte Próprio Remetente</SelectItem>
                      <SelectItem value="4">Transporte Próprio Destinatário</SelectItem>
                      <SelectItem value="9">Sem Frete</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>CNPJ Transportador</Label>
                  <Input value={productTransp.transporter?.cnpj || ""} onChange={(e) => setProductTransp(prev => ({ ...prev, transporter: { ...(prev.transporter || {}), cnpj: e.target.value } }))} />
                </div>
                <div>
                  <Label>Nome Transportador</Label>
                  <Input value={productTransp.transporter?.name || ""} onChange={(e) => setProductTransp(prev => ({ ...prev, transporter: { ...(prev.transporter || {}), name: e.target.value } }))} />
                </div>
                <div>
                  <Label>Qtd Volumes</Label>
                  <Input type="number" value={productTransp.volume?.quantity ?? ""} onChange={(e) => setProductTransp(prev => ({ ...prev, volume: { ...(prev.volume || {}), quantity: Number(e.target.value || 0) } }))} />
                </div>
                <div>
                  <Label>Espécie</Label>
                  <Input value={productTransp.volume?.specie || ""} onChange={(e) => setProductTransp(prev => ({ ...prev, volume: { ...(prev.volume || {}), specie: e.target.value } }))} />
                </div>
              </CardContent>
            </Card>
          )}

          {receiptType === "servico" && (
            <Card>
              <CardHeader><CardTitle>Dados de Serviço (NFS-e)</CardTitle></CardHeader>
              <CardContent className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <Label>Item Lista Serviço</Label>
                  <Input value={serviceData.itemListaServico || ""} onChange={(e) => setServiceData(prev => ({ ...prev, itemListaServico: e.target.value }))} />
                </div>
                <div>
                  <Label>Código Tributação Município</Label>
                  <Input value={serviceData.codigoTributacaoMunicipio || ""} onChange={(e) => setServiceData(prev => ({ ...prev, codigoTributacaoMunicipio: e.target.value }))} />
                </div>
                <div>
                  <Label>Código Município</Label>
                  <Input value={serviceData.codigoMunicipio || ""} onChange={(e) => setServiceData(prev => ({ ...prev, codigoMunicipio: e.target.value }))} />
                </div>
                <div className="md:col-span-3">
                  <Label>Discriminação</Label>
                  <Input value={serviceData.discriminacao || ""} onChange={(e) => setServiceData(prev => ({ ...prev, discriminacao: e.target.value }))} />
                </div>
                <div>
                  <Label>Valor Serviços</Label>
                  <Input type="number" value={serviceData.valores?.valorServicos ?? ""} onChange={(e) => {
                    const base = Number(e.target.value || 0);
                    const aliq = Number(serviceData.valores?.aliquota || 0);
                    const iss = computeIss(base, aliq);
                    setServiceData(prev => ({ ...prev, valores: { ...(prev.valores || {}), valorServicos: base, baseCalculo: base, valorIss: iss, valorLiquidoNfse: Number((base - iss).toFixed(2)) } }));
                  }} />
                </div>
                <div>
                  <Label>Alíquota (%)</Label>
                  <Input type="number" value={serviceData.valores?.aliquota ?? ""} onChange={(e) => {
                    const aliq = Number(e.target.value || 0);
                    const base = Number(serviceData.valores?.valorServicos || 0);
                    const iss = computeIss(base, aliq);
                    setServiceData(prev => ({ ...prev, valores: { ...(prev.valores || {}), aliquota: aliq, valorIss: iss, valorLiquidoNfse: Number((base - iss).toFixed(2)) } }));
                  }} />
                </div>
                <div>
                  <Label>ISS</Label>
                  <Input type="number" value={serviceData.valores?.valorIss ?? ""} onChange={(e) => {
                    const iss = Number(e.target.value || 0);
                    const base = Number(serviceData.valores?.valorServicos || 0);
                    setServiceData(prev => ({ ...prev, valores: { ...(prev.valores || {}), valorIss: iss, valorLiquidoNfse: Number((base - iss).toFixed(2)) } }));
                  }} />
                </div>
                <div>
                  <Label>Valor Líquido NFS-e</Label>
                  <Input type="number" value={serviceData.valores?.valorLiquidoNfse ?? ""} onChange={(e) => setServiceData(prev => ({ ...prev, valores: { ...(prev.valores || {}), valorLiquidoNfse: Number(e.target.value || 0) } }))} />
                </div>
              </CardContent>
            </Card>
          )}

          <div className="flex justify-between">
            <Button variant="outline" onClick={() => {
              try {
                const key = `nf_draft_${request?.id}`;
                const data = { emitter, recipient, productTransp, serviceData, itemTaxes, manualItems, manualNFNumber, manualNFSeries, manualNFIssueDate, manualNFEntryDate, manualNFEmitterCNPJ, manualNFAccessKey };
                localStorage.setItem(key, JSON.stringify(data));
                toast({ title: "Rascunho salvo", description: "Você pode retomar depois." });
              } catch {
                toast({ title: "Rascunho", description: "Falha ao salvar rascunho", variant: "destructive" });
              }
            }}>Salvar Rascunho</Button>
            <Button onClick={() => {
              if (receiptType === "produto") {
                const emRes = validateEmitter(emitter as any);
                const reRes = validateRecipient(recipient as any);
                if (!emRes.isValid || !reRes.isValid) {
                  const firstErr = Object.values(emRes.errors)[0] || Object.values(reRes.errors)[0] || "Campos obrigatórios ausentes";
                  return toast({ title: "Validação", description: firstErr, variant: "destructive" });
                }
                if (!Array.isArray(manualItems) || manualItems.length === 0) {
                  return toast({ title: "Validação", description: "Inclua ao menos um item", variant: "destructive" });
                }
                const totalsVProd = manualItems.reduce((acc, it) => acc + Number(it.quantity || 0) * Number(it.unitPrice || 0), 0);
                const xml = buildNFeXml({
                  accessKey: manualNFAccessKey || undefined,
                  number: manualNFNumber || "",
                  series: manualNFSeries || "",
                  issueDate: manualNFIssueDate || "",
                  entryDate: manualNFEntryDate || "",
                  emitter: {
                    cnpj: String(emitter.cnpj || "").replace(/\D+/g, ""),
                    name: emitter.name || "",
                    fantasyName: emitter.fantasyName || "",
                    ie: emitter.ie || "",
                    im: emitter.im || "",
                    cnae: emitter.cnae || "",
                    crt: emitter.crt || "",
                    address: { street: emitter.address?.street, number: emitter.address?.number, neighborhood: emitter.address?.neighborhood, city: emitter.address?.city, uf: emitter.address?.uf, cep: emitter.address?.cep, country: emitter.address?.country, phone: emitter.address?.phone }
                  },
                  recipient: {
                    cnpjCpf: String(recipient.cnpjCpf || "").replace(/\D+/g, ""),
                    name: recipient.name || "",
                    ie: recipient.ie || "",
                    email: recipient.email || "",
                    address: { street: recipient.address?.street, number: recipient.address?.number, neighborhood: recipient.address?.neighborhood, city: recipient.address?.city, uf: recipient.address?.uf, cep: recipient.address?.cep, country: recipient.address?.country, phone: recipient.address?.phone }
                  },
                  items: manualItems.map((it, idx) => {
                    const tax = itemTaxes[idx + 1] || {};
                    const vBC = tax.vBC ?? Number((it.quantity || 0) * (it.unitPrice || 0));
                    const vICMS = tax.pICMS != null ? computeIcms(vBC, Number(tax.pICMS)) : tax.vICMS;
                    return {
                      lineNumber: idx + 1,
                      code: it.code,
                      description: it.description,
                      unit: it.unit || "UN",
                      quantity: Number(it.quantity || 0),
                      unitPrice: Number(it.unitPrice || 0),
                      totalPrice: Number(((it.quantity || 0) * (it.unitPrice || 0)).toFixed(2)),
                      taxes: {
                        icms: { vBC, pICMS: tax.pICMS, vICMS },
                        ipi: { vBC: tax.ipi?.vBC, pIPI: tax.ipi?.pIPI, vIPI: tax.ipi?.vIPI, cst: "99" },
                        pis: { cst: tax.pis?.cst || "08" },
                        cofins: { cst: tax.cofins?.cst || "08" },
                      }
                    };
                  }),
                  totals: { vNF: Number(totalsVProd.toFixed(2)), vProd: Number(totalsVProd.toFixed(2)) },
                  transp: productTransp.modFrete ? { modFrete: String(productTransp.modFrete), transporter: productTransp.transporter, volume: productTransp.volume } : undefined,
                  pagamento: paymentMethodCode ? { indPag: "0", tPag: paymentMethodCode, vPag: Number(totalsVProd.toFixed(2)) } : undefined,
                  infCpl: xmlPreview?.header?.informacoesAdicionais || undefined,
                });
                setXmlRaw(xml);
                toast({ title: "XML Gerado", description: "NF-e montada a partir dos campos editáveis." });
              } else if (receiptType === "servico") {
                const emRes = validateEmitter(emitter as any);
                const reRes = validateRecipient(recipient as any);
                const svRes = validateServiceData(serviceData as any);
                if (!emRes.isValid || !reRes.isValid || !svRes.isValid) {
                  const firstErr = Object.values(emRes.errors)[0] || Object.values(reRes.errors)[0] || Object.values(svRes.errors)[0] || "Campos obrigatórios ausentes";
                  return toast({ title: "Validação", description: firstErr, variant: "destructive" });
                }
                const xml = buildNFSeXml({
                  numero: manualNFNumber || "",
                  codigoVerificacao: manualNFAccessKey || undefined,
                  dataEmissao: manualNFIssueDate || "",
                  rps: { numero: manualNFNumber || "", serie: manualNFSeries || "", tipo: "1" },
                  competencia: manualNFIssueDate || "",
                  outrasInformacoes: serviceData.discriminacao || "",
                  valores: {
                    valorServicos: Number(serviceData.valores?.valorServicos || 0),
                    valorDeducoes: Number(serviceData.valores?.valorDeducoes || 0),
                    valorPis: Number(serviceData.valores?.valorPis || 0),
                    valorCofins: Number(serviceData.valores?.valorCofins || 0),
                    valorInss: Number(serviceData.valores?.valorInss || 0),
                    valorIr: Number(serviceData.valores?.valorIr || 0),
                    valorCsll: Number(serviceData.valores?.valorCsll || 0),
                    issRetido: Number(serviceData.valores?.issRetido || 0),
                    valorIss: Number(serviceData.valores?.valorIss || 0),
                    valorIssRetido: Number(serviceData.valores?.valorIssRetido || 0),
                    baseCalculo: Number(serviceData.valores?.baseCalculo || serviceData.valores?.valorServicos || 0),
                    aliquota: Number(serviceData.valores?.aliquota || 0),
                    valorLiquidoNfse: Number(serviceData.valores?.valorLiquidoNfse || 0),
                    descontoIncondicionado: Number(serviceData.valores?.descontoIncondicionado || 0),
                    descontoCondicionado: Number(serviceData.valores?.descontoCondicionado || 0),
                  },
                  itemListaServico: serviceData.itemListaServico || "",
                  codigoTributacaoMunicipio: serviceData.codigoTributacaoMunicipio || "",
                  discriminacao: serviceData.discriminacao || "",
                  codigoMunicipio: serviceData.codigoMunicipio || "",
                  prestador: {
                    cnpj: String(emitter.cnpj || "").replace(/\D+/g, ""),
                    inscricaoMunicipal: emitter.im || "",
                    razaoSocial: emitter.name || "",
                    nomeFantasia: emitter.fantasyName || "",
                    endereco: { endereco: emitter.address?.street, numero: emitter.address?.number, complemento: "", bairro: emitter.address?.neighborhood, codigoMunicipio: "", uf: emitter.address?.uf, cep: emitter.address?.cep },
                    contato: { telefone: emitter.address?.phone, email: "" },
                  },
                  tomador: {
                    cnpjCpf: String(recipient.cnpjCpf || "").replace(/\D+/g, ""),
                    inscricaoMunicipal: recipient.ie || "",
                    razaoSocial: recipient.name || "",
                    endereco: { endereco: recipient.address?.street, numero: recipient.address?.number, complemento: "", bairro: recipient.address?.neighborhood, codigoMunicipio: serviceData.codigoMunicipio, uf: recipient.address?.uf, cep: recipient.address?.cep },
                    contato: { telefone: recipient.address?.phone, email: recipient.email },
                  },
                  orgaoGerador: { codigoMunicipio: serviceData.codigoMunicipio || "", uf: recipient.address?.uf || "" },
                });
                setXmlRaw(xml);
                toast({ title: "XML Gerado", description: "NFS-e montada a partir dos campos editáveis." });
              }
            }}>Gerar XML</Button>
          </div>



            {xmlPreview && (
              <Card>
                <CardHeader><CardTitle>Itens da Nota Fiscal</CardTitle></CardHeader>
                <CardContent>
                  <div className="rounded border">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Código</TableHead>
                          <TableHead>Descrição</TableHead>
                          <TableHead className="text-center">Qtd</TableHead>
                          <TableHead className="text-right">Valor Unit.</TableHead>
                          <TableHead className="text-right">Valor Total</TableHead>
                          <TableHead className="text-center">Unidade</TableHead>
                          <TableHead className="text-center">Status</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {nfItemsDecorated.map(({ nf, poItem, status }: any, idx: number) => (
                          <TableRow key={idx} className={
                            status === "red" ? "bg-red-50 dark:bg-red-900/20" :
                            status === "yellow" ? "bg-yellow-50 dark:bg-yellow-900/20" :
                            status === "orange" ? "bg-orange-50 dark:bg-orange-900/20" : ""
                          }>
                            <TableCell>{nf.itemCode || poItem?.itemCode || "-"}</TableCell>
                            <TableCell>{nf.description}</TableCell>
                            <TableCell className="text-center">{nf.quantity}</TableCell>
                            <TableCell className="text-right">{nf.unitPrice}</TableCell>
                            <TableCell className="text-right">{nf.totalPrice}</TableCell>
                            <TableCell className="text-center">{nf.unit}</TableCell>
                            <TableCell className="text-center">
                              {status === "ok" && <Badge variant="outline">OK</Badge>}
                              {status === "red" && <Badge variant="destructive">Divergência</Badge>}
                              {status === "yellow" && <Badge variant="secondary">Qtd diferente</Badge>}
                              {status === "orange" && <Badge variant="default">Não previsto</Badge>}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                </CardContent>
              </Card>
            )}

            <div className="flex justify-between gap-2">
              <Button variant="outline" onClick={() => setActiveTab('fiscal')}>Voltar</Button>
              <Button onClick={() => {
                if (receiptType === "avulso") {
                  const required = [manualNFNumber, manualNFIssueDate, manualTotal];
                  if (required.some(v => !v || String(v).trim() === "")) {
                    return toast({ title: "Validação", description: "Preencha Número, Emissão e Valor Total da NF Avulsa", variant: "destructive" });
                  }
                  return setActiveTab('financeiro');
                }
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
                  return toast({ title: "Validação", description: "Informe quantidades recebidas ou importe o XML da NF", variant: "destructive" });
                }
                setActiveTab('financeiro');
              }}>Próxima</Button>
            </div>
          </div>
        </TabsContent>



        <TabsContent value="items">
          <div className="space-y-6">
            {receiptType === "avulso" && (
              <>


                <Card>
                  <CardHeader><CardTitle>Itens (Avulso)</CardTitle></CardHeader>
                  <CardContent>
                    <div className="space-y-2">
                      <div className="flex justify-between items-center">
                        <div className="text-sm text-muted-foreground">Adicione itens manualmente ou importe do pedido</div>
                        <Button type="button" variant="outline" onClick={async () => {
                          try {
                            if (!purchaseOrder?.id) {
                              return toast({ title: "Importação", description: "Pedido de compra não encontrado", variant: "destructive" });
                            }
                            const poItems = await apiRequest(`/api/purchase-orders/${purchaseOrder.id}/items`);
                            if (poItems.length === 0) {
                              return toast({ title: "Importação", description: "Nenhum item disponível no pedido para importação", variant: "destructive" });
                            }
                            const ok = window.confirm(`Importar ${poItems.length} item(ns) do Pedido de Compra? Você poderá editar os itens após a importação.`);
                            if (!ok) return;
                            const imported = poItems.map((it: any) => {
                              const quantity = Number(it.quantity ?? it.requestedQuantity ?? 0);
                              const unitPrice = Number(it.unitPrice ?? (it.totalPrice && quantity ? Number(it.totalPrice) / quantity : 0));
                              return { code: it.itemCode || String(it.id), description: it.description || "", unit: it.unit || "", quantity: quantity || 0, unitPrice: unitPrice || 0 };
                            }).filter((m: any) => m.description && m.quantity > 0);
                            if (imported.length === 0) {
                              return toast({ title: "Importação", description: "Nenhum item válido para importar", variant: "destructive" });
                            }
                            setManualItems(imported);
                            const total = imported.reduce((acc: number, it: any) => acc + it.quantity * it.unitPrice, 0);
                            setManualTotal(String(total.toFixed(2)));
                            toast({ title: "Itens importados", description: `Foram importados ${imported.length} item(ns) do pedido.` });
                          } catch (e: any) {
                            toast({ title: "Erro", description: e.message || "Falha ao importar itens", variant: "destructive" });
                          }
                        }}>Importar itens do pedido</Button>
                      </div>
                      <div className="flex gap-2">
                        <Input placeholder="Código" onChange={(e) => { (window as any)._tmpCode = e.target.value; }} />
                        <Input placeholder="Descrição" onChange={(e) => { (window as any)._tmpDescription = e.target.value; }} />
                        <Input placeholder="Unidade" onChange={(e) => { (window as any)._tmpUnit = e.target.value; }} />
                        <Input type="number" placeholder="Qtd" onChange={(e) => { (window as any)._tmpQuantity = Number(e.target.value || 0); }} />
                        <Input type="number" placeholder="Valor Unit." onChange={(e) => { (window as any)._tmpUnitPrice = Number(e.target.value || 0); }} />
                        <Button type="button" onClick={() => {
                          const code = (window as any)._tmpCode || "";
                          const description = (window as any)._tmpDescription || "";
                          const unit = (window as any)._tmpUnit || "";
                          const quantity = Number((window as any)._tmpQuantity || 0);
                          const unitPrice = Number((window as any)._tmpUnitPrice || 0);
                          if (!description || quantity <= 0) {
                            return toast({ title: "Itens", description: "Informe descrição e quantidade válidas", variant: "destructive" });
                          }
                          setManualItems((prev) => [...prev, { code, description, unit, quantity, unitPrice }]);
                        }}>Adicionar</Button>
                      </div>
                      <div className="rounded border mt-2">
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead>Código</TableHead>
                              <TableHead>Descrição</TableHead>
                              <TableHead className="text-center">Qtd</TableHead>
                              <TableHead className="text-right">Valor Unit.</TableHead>
                              <TableHead className="text-right">Valor Total</TableHead>
                              <TableHead className="text-center">Unidade</TableHead>
                              <TableHead className="text-center">Ação</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {manualItems.map((it, idx) => (
                              <TableRow key={idx}>
                                <TableCell>{it.code || "-"}</TableCell>
                                <TableCell>{it.description}</TableCell>
                                <TableCell className="text-center">{it.quantity}</TableCell>
                                <TableCell className="text-right">{it.unitPrice}</TableCell>
                                <TableCell className="text-right">{(it.quantity * it.unitPrice).toFixed(2)}</TableCell>
                                <TableCell className="text-center">{it.unit || ""}</TableCell>
                                <TableCell className="text-center"><Button type="button" variant="destructive" onClick={() => setManualItems((prev) => prev.filter((_, i) => i !== idx))}>Remover</Button></TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </>
            )}

            {receiptType !== "avulso" && (
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
                          const invalid = current > max;
                          const saldo = Math.max(0, max - current);
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
                                {invalid ? <Badge variant="destructive">Qtd maior que prevista</Badge> : (current === 0 ? <Badge variant="secondary">Não Recebido</Badge> : current < max ? <Badge variant="default">Parcial</Badge> : <Badge variant="outline">Completo</Badge>)}
                              </TableCell>
                            </TableRow>
                          );
                        })}
                      </TableBody>
                    </Table>
                  </div>
                </CardContent>
              </Card>
            )}

            <div className="flex justify-between gap-2">
              <Button variant="outline" onClick={() => setActiveTab('xml')}>Voltar</Button>
              <Button disabled={!canConfirm} onClick={() => {
                if (typeCategoryError) {
                  return toast({ title: "Validação", description: typeCategoryError, variant: "destructive" });
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
        </TabsContent>

      </Tabs>

      {/* Selected Supplier Information */}
      {activeTab === 'fiscal' && selectedSupplierQuotation && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Building className="h-5 w-5 text-green-600" />
              Fornecedor Selecionado
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-4">
              <div>
                <p className="text-sm font-medium text-gray-500">Nome do Fornecedor</p>
                <p className="text-sm font-semibold mt-1">{selectedSupplierQuotation.supplier?.name || 'N/A'}</p>
              </div>
              <div>
                <p className="text-sm font-medium text-gray-500">E-mail</p>
                <p className="text-sm mt-1">{selectedSupplierQuotation.supplier?.email || 'N/A'}</p>
              </div>
              <div>
                <p className="text-sm font-medium text-gray-500">Contato</p>
                <p className="text-sm mt-1">{selectedSupplierQuotation.supplier?.contact || 'N/A'}</p>
              </div>
              <div>
                <p className="text-sm font-medium text-gray-500">CNPJ</p>
                <p className="text-sm mt-1">{selectedSupplierQuotation.supplier?.cnpj || 'N/A'}</p>
              </div>
              <div>
                <p className="text-sm font-medium text-gray-500">Valor Total da Proposta</p>
                <p className="text-lg font-bold text-green-600 mt-1">
                  {formatCurrency(selectedSupplierQuotation.totalValue)}
                </p>
              </div>

              {/* Freight Information - Highlighted */}
              <div className="col-span-full">
                <div className="p-4 bg-blue-50 dark:bg-blue-900/20 border-2 border-blue-200 dark:border-blue-800 rounded-lg">
                  <div className="flex items-center gap-2 mb-2">
                    <Truck className="h-5 w-5 text-blue-600 dark:text-blue-300" />
                    <p className="text-sm font-semibold text-blue-800 dark:text-blue-300">Informações de Frete</p>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <p className="text-sm font-medium text-blue-700 dark:text-blue-300">Frete Incluso</p>
                      <p className="text-sm mt-1 text-slate-700 dark:text-slate-300">
                        {selectedSupplierQuotation.includesFreight ? 'Sim' : 'Não'}
                      </p>
                    </div>
                    <div>
                      <p className="text-sm font-medium text-blue-700 dark:text-blue-300">Valor do Frete</p>
                      <p className="text-lg font-bold text-blue-800 dark:text-blue-300 mt-1">
                        {freightValue > 0 ? formatCurrency(freightValue) : 'Não incluso'}
                      </p>
                    </div>
                  </div>
                </div>
              </div>
              <div>
                <p className="text-sm font-medium text-gray-500">Condições de Pagamento</p>
                <p className="text-sm mt-1">{selectedSupplierQuotation.paymentTerms || 'N/A'}</p>
              </div>

              {/* Desconto da Proposta */}
              {(selectedSupplierQuotation.discountType && selectedSupplierQuotation.discountType !== 'none' && selectedSupplierQuotation.discountValue) && (
                <div>
                  <p className="text-sm font-medium text-gray-500">Desconto da Proposta</p>
                  <p className="text-lg font-bold text-green-600 mt-1">
                    {selectedSupplierQuotation.discountType === 'percentage'
                      ? `${selectedSupplierQuotation.discountValue}%`
                      : formatCurrency(selectedSupplierQuotation.discountValue)
                    }
                  </p>
                </div>
              )}
            </div>

            {selectedSupplierQuotation.choiceReason && (
              <div className="p-3 bg-green-50 border border-green-200 rounded-lg">
                <p className="text-sm font-medium text-green-800">Justificativa da Escolha:</p>
                <p className="text-sm text-green-700 mt-1">{selectedSupplierQuotation.choiceReason}</p>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Purchase Order Observations */}
      {(request.purchaseOrderObservations || request.purchaseObservations) && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5 text-blue-600" />
              Observações do Pedido de Compra
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="p-4 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg">
              <p className="text-sm text-blue-800 dark:text-blue-300 whitespace-pre-wrap">
                {request.purchaseOrderObservations || request.purchaseObservations || 'Nenhuma observação encontrada'}
              </p>
            </div>
          </CardContent>
        </Card>
      )}



      {/* Items Table */}
      {activeTab === 'fiscal' && (
        <Card>
          <CardHeader>
            <CardTitle>Itens da Compra</CardTitle>
          </CardHeader>
          <CardContent>
            {itemsWithPrices.length > 0 ? (
              <div className="rounded-md border border-border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Descrição</TableHead>
                      <TableHead className="text-center">Qtd</TableHead>
                      <TableHead className="text-center">Unidade</TableHead>
                      <TableHead className="text-right">Valor Unit.</TableHead>
                      <TableHead className="text-right">Valor Total</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {itemsWithPrices.map((item: any, index: number) => (
                      <TableRow key={index}>
                        <TableCell className="font-medium">
                          {item.description}
                        </TableCell>
                        <TableCell className="text-center">
                          {Number(item.quantity).toLocaleString('pt-BR', { minimumFractionDigits: 0, maximumFractionDigits: 2 })}
                        </TableCell>
                        <TableCell className="text-center">
                          {item.unit}
                        </TableCell>
                        <TableCell className="text-right">
                          {formatCurrency(item.unitPrice)}
                        </TableCell>
                        <TableCell className="text-right font-medium">
                          {formatCurrency(item.totalPrice)}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
                <div className="border-t border-border bg-slate-50 dark:bg-slate-900 p-4 space-y-3">
                  <div className="flex justify-between items-center">
                    <span className="text-sm font-medium text-slate-600 dark:text-slate-400">
                      Subtotal ({itemsWithPrices.length} {itemsWithPrices.length === 1 ? 'item' : 'itens'})
                    </span>
                    <span className="text-base font-semibold text-slate-800 dark:text-slate-200">
                      {formatCurrency(
                        itemsWithPrices.reduce((total: number, item: any) => total + (item.totalPrice || 0), 0)
                      )}
                    </span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm font-medium text-blue-600 dark:text-blue-300 flex items-center gap-1">
                      <Truck className="h-4 w-4" />
                      Frete
                    </span>
                    <span className="text-base font-semibold text-blue-600 dark:text-blue-300">
                      {freightValue > 0 ? formatCurrency(freightValue) : 'Não incluso'}
                    </span>
                  </div>
                  <div className="border-t pt-3">
                    <div className="flex justify-between items-center">
                      <span className="text-base font-bold text-slate-800 dark:text-slate-200">
                        Total Geral
                      </span>
                      <span className="text-xl font-bold text-green-600 dark:text-green-400">
                        {formatCurrency(
                          (itemsWithPrices.reduce((total: number, item: any) => total + (item.totalPrice || 0), 0) || 0) + (freightValue || 0)
                        )}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              <div className="text-center py-8 text-slate-500 dark:text-slate-400">
                <Package className="h-12 w-12 mx-auto mb-2 opacity-50" />
                <p>Nenhum item encontrado</p>
                <p className="text-sm text-slate-600 dark:text-slate-400">Os dados dos itens serão carregados automaticamente</p>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Approval History */}
      {Array.isArray(approvalHistory) && approvalHistory.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Histórico de Aprovações</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {(approvalHistory as any[]).map((history: any, index: number) => (
                <div key={index} className="flex items-start space-x-3 p-3 bg-slate-50 dark:bg-slate-900 rounded-lg border border-border">
                  <div className="flex-1">
                    <div className="flex items-center justify-between">
                      <p className="text-sm font-medium">
                        {history.approver?.firstName} {history.approver?.lastName}
                      </p>
                      <Badge variant={history.approved ? "default" : "destructive"}>
                        {history.approved ? "Aprovado" : "Rejeitado"}
                      </Badge>
                    </div>
                    <p className="text-xs text-slate-600 dark:text-slate-400 mt-1">
                      {formatDate(history.createdAt)}
                    </p>
                    {history.rejectionReason && (
                      <p className="text-sm text-red-600 dark:text-red-400 mt-2">
                        <strong>Motivo:</strong> {history.rejectionReason}
                      </p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      <Separator />

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

      {/* Modal: Recebimento de Nota Fiscal */}
      <Dialog open={showNFModal} onOpenChange={setShowNFModal}>
        <DialogContent className="sm:max-w-6xl max-h-[90vh] overflow-y-auto" aria-describedby="nf-receipt-desc">
          <div className="flex items-center justify-between">
            <DialogTitle>Recebimento de Nota Fiscal</DialogTitle>
            <button aria-label="Fechar" className="p-2 rounded" onClick={() => setShowNFModal(false)}>✕</button>
          </div>
          <p id="nf-receipt-desc" className="sr-only">Modal dedicado para conferência de NF-e</p>

          {/* Resumo do Pedido de Compra */}
          {purchaseOrder && (
            <div className="mb-3 grid grid-cols-1 md:grid-cols-3 gap-2 text-sm text-muted-foreground">
              <div>
                <span className="font-medium">Pedido:</span> {purchaseOrder.orderNumber || purchaseOrder.id}
              </div>
              <div>
                <span className="font-medium">Valor:</span> {formatCurrency(Number(purchaseOrder.totalValue || 0))}
              </div>
              <div>
                <span className="font-medium">Fornecedor PO:</span> {selectedSupplierQuotation?.supplier?.name || "N/A"}
              </div>
            </div>
          )}

          <Card>
            <CardHeader><CardTitle>Tipo</CardTitle></CardHeader>
            <CardContent>
              <div>
                <Label>Tipo de Recebimento</Label>
                <Select value={receiptType} onValueChange={(v) => setReceiptType(v as any)}>
                  <SelectTrigger className="w-full"><SelectValue placeholder="Selecione" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="produto">Produto (NF-e XML)</SelectItem>
                    <SelectItem value="servico">Serviço (Manual)</SelectItem>
                    <SelectItem value="avulso">Avulso (sem NF)</SelectItem>
                  </SelectContent>
                </Select>
                {typeCategoryError && (
                  <p role="alert" className="mt-2 text-sm text-red-600">{typeCategoryError}</p>
                )}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle>Importação de XML</CardTitle></CardHeader>
            <CardContent>
              {receiptType !== "avulso" ? (
                <>
                  <Input type="file" accept=".xml" disabled={isXmlUploading} onChange={(e) => onUploadXml(e.target.files?.[0] || null)} />
                  {isXmlUploading && (
                    <div className="mt-2 text-sm text-muted-foreground">Processando XML...</div>
                  )}
                  {xmlPreview && (
                    <div className="mt-4 text-sm">
                      <div>Total: {xmlPreview?.totals?.vNF || xmlPreview?.totals?.vProd}</div>
                      <div>Itens: {Array.isArray(xmlPreview?.items) ? xmlPreview.items.length : 0}</div>
                    </div>
                  )}
                </>
              ) : (
                <p className="text-sm text-muted-foreground">Importação de XML disponível apenas para Tipo Produto. No modo Avulso, preencha os campos manualmente.</p>
              )}
            </CardContent>
          </Card>

          {receiptType === "avulso" && (
            <>
              <Card>
                <CardHeader><CardTitle>Entrada Manual (Avulso)</CardTitle></CardHeader>
                <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="md:col-span-2">
                    <Badge variant="outline" className="bg-amber-50 text-amber-700 border-amber-200">Modo Avulso</Badge>
                  </div>
                  <div>
                    <Label>Número da NF</Label>
                    <Input value={manualNFNumber} onChange={(e) => setManualNFNumber(e.target.value)} placeholder="Informe o número" className={cn("", !manualNFNumber && "ring-1 ring-amber-400")}/>
                  </div>
                  <div>
                    <Label>Série</Label>
                    <Input value={manualNFSeries} onChange={(e) => setManualNFSeries(e.target.value)} placeholder="Informe a série" className={cn("", !manualNFSeries && "ring-1 ring-amber-400")}/>
                  </div>
                  <div>
                    <Label>Data de Emissão</Label>
                    <Input type="date" value={manualNFIssueDate} onChange={(e) => setManualNFIssueDate(e.target.value)} className={cn("", !manualNFIssueDate && "ring-1 ring-amber-400")}/>
                  </div>
                  <div>
                    <Label>Data de Entrada</Label>
                    <Input type="date" value={manualNFEntryDate} onChange={(e) => setManualNFEntryDate(e.target.value)} className={cn("", !manualNFEntryDate && "ring-1 ring-amber-400")}/>
                  </div>
                  <div>
                    <Label>Valor Total</Label>
                    <Input value={manualTotal} onChange={(e) => setManualTotal(e.target.value)} placeholder="0,00" />
                  </div>
                  <div className="md:col-span-2 text-sm text-muted-foreground">
                    Campos destacados são obrigatórios para confirmação.
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader><CardTitle>Itens (Avulso)</CardTitle></CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    <div className="flex justify-between items-center">
                      <div className="text-sm text-muted-foreground">Adicione itens manualmente ou importe do pedido</div>
                      <Button type="button" variant="outline" onClick={async () => {
                        try {
                          if (!purchaseOrder?.id) {
                            return toast({ title: "Importação", description: "Pedido de compra não encontrado", variant: "destructive" });
                          }
                          const poItems = await apiRequest(`/api/purchase-orders/${purchaseOrder.id}/items`);
                          if (poItems.length === 0) {
                            return toast({ title: "Importação", description: "Nenhum item disponível no pedido para importação", variant: "destructive" });
                          }
                          const ok = window.confirm(`Importar ${poItems.length} item(ns) do Pedido de Compra? Você poderá editar os itens após a importação.`);
                          if (!ok) return;
                          const imported = poItems.map((it: any) => {
                            const quantity = Number(it.quantity ?? it.requestedQuantity ?? 0);
                            const unitPrice = Number(it.unitPrice ?? (it.totalPrice && quantity ? Number(it.totalPrice) / quantity : 0));
                            return {
                              code: it.itemCode || String(it.id),
                              description: it.description || "",
                              unit: it.unit || "",
                              quantity: quantity || 0,
                              unitPrice: unitPrice || 0,
                            };
                          }).filter((m: any) => m.description && m.quantity > 0);
                          if (imported.length === 0) {
                            return toast({ title: "Importação", description: "Nenhum item válido para importar", variant: "destructive" });
                          }
                          setManualItems(imported);
                          const total = imported.reduce((acc: number, it: any) => acc + it.quantity * it.unitPrice, 0);
                          setManualTotal(String(total.toFixed(2)));
                          try {
                            await apiRequest(`/api/audit/log`, {
                              method: "POST",
                              body: {
                                purchaseRequestId: request.id,
                                actionType: "recebimento_avulso_import_po_items",
                                actionDescription: `Importados ${imported.length} item(ns) do PO ${purchaseOrder?.orderNumber || purchaseOrder?.id}`,
                                beforeData: { manualItemsCount: manualItems.length },
                                afterData: { manualItemsCount: imported.length, total },
                              },
                            });
                          } catch {}
                          toast({ title: "Itens importados", description: `Foram importados ${imported.length} item(ns) do pedido.`, });
                        } catch (e: any) {
                          toast({ title: "Erro", description: e.message || "Falha ao importar itens", variant: "destructive" });
                        }
                      }}>Importar itens do pedido</Button>
                    </div>
                    <div className="flex gap-2">
                      <Input placeholder="Código" onChange={(e) => {
                        const code = e.target.value;
                        (window as any)._tmpCode = code;
                      }} />
                      <Input placeholder="Descrição" onChange={(e) => {
                        const description = e.target.value;
                        (window as any)._tmpDescription = description;
                      }} />
                      <Input placeholder="Unidade" onChange={(e) => {
                        const unit = e.target.value;
                        (window as any)._tmpUnit = unit;
                      }} />
                      <Input type="number" placeholder="Qtd" onChange={(e) => {
                        const quantity = Number(e.target.value || 0);
                        (window as any)._tmpQuantity = quantity;
                      }} />
                      <Input type="number" placeholder="Valor Unit." onChange={(e) => {
                        const unitPrice = Number(e.target.value || 0);
                        (window as any)._tmpUnitPrice = unitPrice;
                      }} />
                      <Button type="button" onClick={() => {
                        const code = (window as any)._tmpCode || "";
                        const description = (window as any)._tmpDescription || "";
                        const unit = (window as any)._tmpUnit || "";
                        const quantity = Number((window as any)._tmpQuantity || 0);
                        const unitPrice = Number((window as any)._tmpUnitPrice || 0);
                        if (!description || quantity <= 0) {
                          return toast({ title: "Itens", description: "Informe descrição e quantidade válidas", variant: "destructive" });
                        }
                        setManualItems((prev) => [...prev, { code, description, unit, quantity, unitPrice }]);
                      }}>Adicionar</Button>
                    </div>
                    <div className="rounded border mt-2">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Código</TableHead>
                            <TableHead>Descrição</TableHead>
                            <TableHead className="text-center">Qtd</TableHead>
                            <TableHead className="text-right">Valor Unit.</TableHead>
                            <TableHead className="text-right">Valor Total</TableHead>
                            <TableHead className="text-center">Unidade</TableHead>
                            <TableHead className="text-center">Ação</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {manualItems.map((it, idx) => (
                            <TableRow key={idx}>
                              <TableCell>{it.code || "-"}</TableCell>
                              <TableCell>{it.description}</TableCell>
                              <TableCell className="text-center">{it.quantity}</TableCell>
                              <TableCell className="text-right">{it.unitPrice}</TableCell>
                              <TableCell className="text-right">{(it.quantity * it.unitPrice).toFixed(2)}</TableCell>
                              <TableCell className="text-center">{it.unit || ""}</TableCell>
                              <TableCell className="text-center">
                                <Button type="button" variant="destructive" onClick={() => setManualItems((prev) => prev.filter((_, i) => i !== idx))}>Remover</Button>
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </>
          )}

          <Card>
            <CardHeader><CardTitle>Fornecedor</CardTitle></CardHeader>
            <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label>Razão Social</Label>
                <p className="mt-1">{selectedSupplier?.name || xmlPreview?.header?.supplier?.name || "N/A"}</p>
              </div>
              <div>
                <Label>CNPJ</Label>
                <p className="mt-1">{selectedSupplier?.cnpj || xmlPreview?.header?.supplier?.cnpjCpf || "N/A"}</p>
              </div>
              {supplierMatch === false && (
                <div className="md:col-span-2 text-sm text-red-600">Alerta: CNPJ/CPF do emitente no XML difere do fornecedor do pedido de compra. Verifique se a NF pertence ao pedido.</div>
              )}
              {supplierMatch === true && (
                <div className="md:col-span-2 text-sm text-green-600">Fornecedor correspondente ao emitente da NF.</div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle>Dados da Nota Fiscal</CardTitle></CardHeader>
            <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {receiptType === "avulso" ? (
                <>
                  <div><Label>Número</Label><Input value={manualNFNumber} onChange={(e) => setManualNFNumber(e.target.value)} /></div>
                  <div><Label>Série</Label><Input value={manualNFSeries} onChange={(e) => setManualNFSeries(e.target.value)} /></div>
                  <div><Label>Data de Emissão</Label><Input type="date" value={manualNFIssueDate} onChange={(e) => setManualNFIssueDate(e.target.value)} /></div>
                  <div><Label>Data de Entrada</Label><Input type="date" value={manualNFEntryDate} onChange={(e) => setManualNFEntryDate(e.target.value)} /></div>
                  <div className="md:col-span-2"><Label>Valor Total</Label><Input value={manualTotal} onChange={(e) => setManualTotal(e.target.value)} /></div>
                </>
              ) : (
                <>
                  <div><Label>Número</Label><p className="mt-1">{xmlPreview?.header?.documentNumber || ""}</p></div>
                  <div><Label>Série</Label><p className="mt-1">{xmlPreview?.header?.documentSeries || ""}</p></div>
                  <div><Label>Data de Emissão</Label><p className="mt-1">{xmlPreview?.header?.issueDate || ""}</p></div>
                  <div><Label>Data de Entrada</Label><p className="mt-1">{xmlPreview?.header?.entryDate || ""}</p></div>
                  <div className="md:col-span-2"><Label>Valor Total</Label><p className="mt-1">{xmlPreview?.totals?.vNF || xmlPreview?.totals?.vProd || ""}</p></div>
                </>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle>Tributos Destacados</CardTitle></CardHeader>
            <CardContent className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div><Label>ICMS</Label><p className="mt-1">{totals.icms.toFixed(2)}</p></div>
              <div><Label>IPI</Label><p className="mt-1">{totals.ipi.toFixed(2)}</p></div>
              <div><Label>PIS</Label><p className="mt-1">{totals.pis.toFixed(2)}</p></div>
              <div><Label>COFINS</Label><p className="mt-1">{totals.cofins.toFixed(2)}</p></div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle>Transporte</CardTitle></CardHeader>
            <CardContent>
              <p className="text-sm">{xmlPreview?.header?.transport?.modFrete ? `Modalidade: ${xmlPreview.header.transport.modFrete}` : "Não informado"}</p>
            </CardContent>
          </Card>

          <Separator />

          <Card>
            <CardHeader><CardTitle>Itens da Nota Fiscal</CardTitle></CardHeader>
            <CardContent>
              <div className="rounded border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Código</TableHead>
                      <TableHead>Descrição</TableHead>
                      <TableHead className="text-center">Qtd</TableHead>
                      <TableHead className="text-right">Valor Unit.</TableHead>
                      <TableHead className="text-right">Valor Total</TableHead>
                      <TableHead className="text-center">Unidade</TableHead>
                      <TableHead className="text-center">Status</TableHead>
                      <TableHead className="text-center">Ação</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {nfItemsDecorated.map(({ nf, poItem, status }: any, idx: number) => (
                      <TableRow key={idx} className={
                        status === "red" ? "bg-red-50 dark:bg-red-900/20" :
                        status === "yellow" ? "bg-yellow-50 dark:bg-yellow-900/20" :
                        status === "orange" ? "bg-orange-50 dark:bg-orange-900/20" : ""
                      }>
                        <TableCell>{nf.itemCode || poItem?.itemCode || "-"}</TableCell>
                        <TableCell>{nf.description}</TableCell>
                        <TableCell className="text-center">{nf.quantity}</TableCell>
                        <TableCell className="text-right">{nf.unitPrice}</TableCell>
                        <TableCell className="text-right">{nf.totalPrice}</TableCell>
                        <TableCell className="text-center">{nf.unit}</TableCell>
                        <TableCell className="text-center">
                          {status === "ok" && <Badge variant="outline">OK</Badge>}
                          {status === "red" && <Badge variant="destructive">Divergência</Badge>}
                          {status === "yellow" && <Badge variant="secondary">Qtd diferente</Badge>}
                          {status === "orange" && <Badge variant="default">Não previsto</Badge>}
                        </TableCell>
                        <TableCell className="text-center">
                          <label className="inline-flex items-center gap-2 text-sm">
                            <input
                              type="checkbox"
                              checked={itemDecisions[idx]?.confirmed || false}
                              onChange={(e) => setItemDecisions((prev) => ({ ...prev, [idx]: { confirmed: e.target.checked } }))}
                            /> Confirmar
                          </label>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>

          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setShowNFModal(false)}>Cancelar</Button>
            <Button 
              disabled={confirmReceiptMutation.isPending || isLoadingCompany}
              onClick={() => {
              if (isLoadingCompany) return;
              if (typeCategoryError) {
                return toast({ title: "Validação", description: typeCategoryError, variant: "destructive" });
              }
              if (!isFiscalValid) {
                return toast({ title: "Validação", description: "Informe Forma de Pagamento e Vencimento da Fatura", variant: "destructive" });
              }
              if (receiptType === "avulso") {
                const hasTotals = manualTotal && String(manualTotal).trim() !== "";
                const hasItems = manualItems.length > 0;
                if (!hasTotals || !hasItems) {
                  return toast({ title: "Validação", description: "Preencha Valor Total e pelo menos um item", variant: "destructive" });
                }
              } else {
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
              setShowNFModal(false);
              confirmReceiptMutation.mutate();
            }}>
              {isLoadingCompany ? "Carregando..." : (confirmReceiptMutation.isPending ? "Enviando..." : "Confirmar")}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Modal de Pré-visualização do PDF removido - substituído por renderização condicional */}
    </div>
  );
});

export default ReceiptPhase;
