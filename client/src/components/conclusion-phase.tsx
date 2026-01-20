import { useState, useMemo, forwardRef, useImperativeHandle, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { PHASE_LABELS, URGENCY_LABELS, CATEGORY_LABELS, PURCHASE_PHASES } from "@/lib/types";
import ProcessTimeline from "@/components/process-timeline";
import {
  Download,
  FileText,
  User,
  Calendar,
  Building,
  Clock,
  CheckCircle,
  Package,
  Truck,
  X,
  Archive,
  Mail,
  Printer,
  History,
  DollarSign,
  AlertCircle,
  Eye,
  CheckCircle2,
  XCircle,
  TrendingUp,
  TrendingDown,
  Minus,
  MapPin,
  Phone,
  ExternalLink,
  Star,
  AlertTriangle,
  RefreshCw
} from "lucide-react";
import { format, formatDistanceToNow, differenceInDays } from "date-fns";
import { ptBR } from "date-fns/locale";

const archiveSchema = z.object({
  conclusionObservations: z.string().optional(),
});

type ArchiveFormData = z.infer<typeof archiveSchema>;

interface ConclusionPhaseProps {
  request: any;
  onClose: () => void;
  className?: string;
}

export interface ConclusionPhaseHandle {
  downloadPurchaseOrderPDF: () => void;
  exportPDF: () => void;
  printSummary: () => void;
  sendEmail: () => void;
  openArchiveDialog: () => void;
}

const ConclusionPhase = forwardRef<ConclusionPhaseHandle, ConclusionPhaseProps>(function ConclusionPhase({ request, onClose, className }: ConclusionPhaseProps, ref) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [isArchiving, setIsArchiving] = useState(false);
  const [showArchiveDialog, setShowArchiveDialog] = useState(false);
  const [showAttachmentViewer, setShowAttachmentViewer] = useState(false);

  const form = useForm<ArchiveFormData>({
    resolver: zodResolver(archiveSchema),
    defaultValues: {
      conclusionObservations: "",
    },
  });

  // Fetch all related data
  const { data: items = [], isLoading: itemsLoading } = useQuery<any[]>({
    queryKey: [`/api/purchase-requests/${request.id}/items`],
  });

  // Buscar dados relacionados
  // Primeiro buscar o pedido de compra relacionado à solicitação
  const { data: purchaseOrder } = useQuery<any>({
    queryKey: [`/api/purchase-orders/by-request/${request?.id}`],
    enabled: !!request?.id,
  });

  // Buscar itens do pedido de compra (não da solicitação)
  const { data: purchaseOrderItems = [] } = useQuery<any[]>({
    queryKey: [`/api/purchase-orders/${purchaseOrder?.id}/items`],
    enabled: !!purchaseOrder?.id,
  });

  const { data: approvalHistory = [], isLoading: approvalHistoryLoading } = useQuery<any[]>({
    queryKey: [`/api/purchase-requests/${request.id}/approval-history`],
  });

  // Fetch complete timeline for better process visualization
  const { data: completeTimeline = [], isLoading: timelineLoading } = useQuery<any[]>({
    queryKey: [`/api/purchase-requests/${request.id}/complete-timeline`],
  });

  const { data: attachments = [], isLoading: attachmentsLoading } = useQuery<any[]>({
    queryKey: [`/api/purchase-requests/${request.id}/attachments`],
  });

  // Buscar dados do solicitante
  const { data: requester, isLoading: requesterLoading } = useQuery<any>({
    queryKey: [`/api/users/${request.requesterId}`],
    enabled: !!request.requesterId,
  });

  // Buscar dados do centro de custo
  const { data: allCostCenters = [], isLoading: costCentersLoading } = useQuery<any[]>({
    queryKey: ['/api/cost-centers'],
  });

  // Buscar departamento
  const { data: allDepartments = [], isLoading: departmentsLoading } = useQuery<any[]>({
    queryKey: ['/api/departments'],
  });

  // Encontrar centro de custo e departamento
  const costCenter = allCostCenters.find((cc: any) => cc.id === request.costCenterId);
  const department = costCenter ? allDepartments.find((d: any) => d.id === costCenter.departmentId) : null;

  const { data: quotation, isLoading: quotationLoading } = useQuery<any>({
    queryKey: [`/api/quotations/purchase-request/${request.id}`],
  });

  const { data: supplierQuotations = [], isLoading: supplierQuotationsLoading } = useQuery<any[]>({
    queryKey: [`/api/quotations/${quotation?.id}/supplier-quotations`],
    enabled: !!quotation?.id,
  });

  // Find selected supplier quotation
  const selectedSupplierQuotation = supplierQuotations.find((sq: any) => sq.isChosen) || supplierQuotations[0];

  // Fetch supplier quotation items to get pricing
  const { data: supplierQuotationItems = [], isLoading: supplierQuotationItemsLoading } = useQuery<any[]>({
    queryKey: [`/api/supplier-quotations/${selectedSupplierQuotation?.id}/items`],
    enabled: !!selectedSupplierQuotation?.id,
  });

  // Buscar anexos de cotações de fornecedores
  const { data: quotationAttachments = [], isLoading: quotationAttachmentsLoading } = useQuery<any[]>({
    queryKey: [`/api/quotations/${quotation?.id}/attachments`],
    enabled: !!quotation?.id,
  });

  // Fetch receipt linked to this request
  const { data: receipt, isLoading: receiptLoading } = useQuery<any>({
    queryKey: [`/api/receipts/request/${request.id}`],
    enabled: !!request.id,
    refetchInterval: 5000,
  });

  // Fetch audit logs for detailed history
  const { data: auditLogs = [], isLoading: auditLogsLoading } = useQuery<any[]>({
    queryKey: [`/api/audit/logs/${request.id}`],
    enabled: !!request.id,
    refetchInterval: 5000,
  });

  // ERP Logs State
  const [erpLogs, setErpLogs] = useState<{ time: Date; message: string; type: 'info' | 'success' | 'error' }[]>([]);

  // Parse receipt observations for ERP info
  const receiptObs = useMemo(() => {
    if (!receipt?.observations) return {};
    try {
      return typeof receipt.observations === 'string' ? JSON.parse(receipt.observations) : receipt.observations;
    } catch { return {}; }
  }, [receipt]);

  const lastErpAttempt = receiptObs.lastErpAttempt || receiptObs.erp;

  // Update local logs from persisted data if available
  useEffect(() => {
    if (lastErpAttempt) {
      setErpLogs(prev => {
        // Avoid duplicate logs if already present
        const isDuplicate = prev.some(l => l.message === lastErpAttempt.message && Math.abs(l.time.getTime() - new Date(lastErpAttempt.time).getTime()) < 1000);
        if (isDuplicate) return prev;

        return [
          {
            time: new Date(lastErpAttempt.time),
            message: lastErpAttempt.message,
            type: lastErpAttempt.success ? 'success' : 'error'
          },
          ...prev
        ];
      });
    }
  }, [lastErpAttempt]);

  // Retry ERP Mutation
  const retryErpMutation = useMutation({
    mutationFn: async () => {
      if (!receipt?.id) throw new Error("Nota fiscal não encontrada");
      
      setErpLogs(prev => [{ time: new Date(), message: "Iniciando reenvio para o ERP...", type: 'info' }, ...prev]);
      
      return apiRequest(`/api/recebimentos/${receipt.id}/enviar-locador`, {
        method: "POST",
      });
    },
    onSuccess: (data: any) => {
      queryClient.invalidateQueries({ queryKey: [`/api/receipts/request/${request.id}`] });
      
      const isSuccess = data.status_integracao === 'integrada' || data.status_integracao === 'sucesso';
      const message = data.mensagem || (isSuccess ? "Integrado com sucesso" : "Erro na integração");
      
      setErpLogs(prev => [{ 
         time: new Date(), 
         message: `ERP Resposta: ${message}`, 
         type: isSuccess ? 'success' : 'error' 
      }, ...prev]);
      
      if (!isSuccess) {
         toast({ title: "Aviso ERP", description: `Erro na integração: ${message}`, variant: "destructive" });
      } else {
         toast({ title: "Sucesso", description: "Reenvio ao ERP realizado com sucesso!" });
      }
    },
    onError: (err: any) => {
      setErpLogs(prev => [{ time: new Date(), message: `Falha no envio: ${err.message}`, type: 'error' }, ...prev]);
      toast({ title: "Erro", description: err.message || "Erro ao reenviar para ERP", variant: "destructive" });
    }
  });

  // Archive mutation
  const archiveMutation = useMutation({
    mutationFn: async (data: ArchiveFormData) => {
      return apiRequest(`/api/purchase-requests/${request.id}/archive`, {
        method: "PATCH",
        body: data,
      });
    },
    onSuccess: () => {
      toast({
        title: "Sucesso",
        description: "Solicitação arquivada com sucesso",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/purchase-requests"] });
      onClose();
    },
    onError: (error: any) => {
      toast({
        title: "Erro",
        description: error.message || "Erro ao arquivar solicitação",
        variant: "destructive",
      });
    },
  });

  // Export PDF mutation
  const exportPDFMutation = useMutation({
    mutationFn: async () => {
      const response = await fetch(`/api/purchase-requests/${request.id}/completion-summary-pdf`, {
        method: "GET",
      });

      if (!response.ok) {
        throw new Error("Erro ao gerar PDF");
      }

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `conclusao-${request.requestNumber}.pdf`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    },
    onSuccess: () => {
      toast({
        title: "Sucesso",
        description: "PDF gerado com sucesso",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Erro",
        description: error.message || "Erro ao gerar PDF",
        variant: "destructive",
      });
    },
  });

  // Download Purchase Order PDF mutation
  const downloadPurchaseOrderPDFMutation = useMutation({
    mutationFn: async () => {
      const response = await fetch(`/api/purchase-requests/${request.id}/pdf`, {
        method: "GET",
        headers: {
          'Content-Type': 'application/pdf',
        },
      });

      if (!response.ok) {
        throw new Error("Erro ao baixar PDF do Pedido de Compra");
      }

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `Pedido_Compra_${request.requestNumber}.pdf`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    },
    onSuccess: () => {
      toast({
        title: "Sucesso",
        description: "PDF do Pedido de Compra baixado com sucesso!",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Erro",
        description: error.message || "Erro ao baixar PDF do Pedido de Compra",
        variant: "destructive",
      });
    },
  });

  const handleArchive = async (data: ArchiveFormData) => {
    setIsArchiving(true);
    try {
      await archiveMutation.mutateAsync(data);
    } finally {
      setIsArchiving(false);
      setShowArchiveDialog(false);
    }
  };

  const handlePrint = () => {
    // Create print-optimized HTML content
    const printContent = generatePrintableHTML();

    // Open new window for printing
    const printWindow = window.open('', '_blank', 'width=800,height=600');
    if (printWindow) {
      printWindow.document.write(printContent);
      printWindow.document.close();

      // Wait for content to load, then trigger print
      printWindow.onload = () => {
        printWindow.print();
        // Close window after printing (optional)
        printWindow.onafterprint = () => {
          printWindow.close();
        };
      };
    }
  };

  const generatePrintableHTML = () => {
    const formatCurrency = (value: number | string) => {
      const num = typeof value === 'string' ? parseFloat(value) : value;
      return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(num || 0);
    };

    const formatDate = (date: string | Date) => {
      return new Intl.DateTimeFormat('pt-BR', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      }).format(new Date(date));
    };

    return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="UTF-8">
      <title>Conclusão da Compra - ${request.requestNumber}</title>
      <style>
        @media print {
          @page { margin: 1cm; }
          body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; }
        }
        body { 
          font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; 
          line-height: 1.4; 
          margin: 0; 
          padding: 20px; 
          color: #374151;
        }
        .header { 
          text-align: center; 
          margin-bottom: 30px; 
          border-bottom: 2px solid #e5e7eb; 
          padding-bottom: 20px; 
        }
        .header h1 { 
          margin: 0; 
          font-size: 24px; 
          color: #111827; 
        }
        .header p { 
          margin: 5px 0 0 0; 
          color: #6b7280; 
          font-size: 14px; 
        }
        .metrics { 
          display: grid; 
          grid-template-columns: repeat(3, 1fr); 
          gap: 20px; 
          margin-bottom: 30px; 
        }
        .metric-card { 
          border: 1px solid #e5e7eb; 
          border-radius: 8px; 
          padding: 20px; 
          text-align: center; 
        }
        .metric-label { 
          font-size: 12px; 
          color: #6b7280; 
          font-weight: 500; 
          margin-bottom: 5px; 
        }
        .metric-value { 
          font-size: 20px; 
          font-weight: bold; 
          color: #111827; 
        }
        .section { 
          margin-bottom: 30px; 
          border: 1px solid #e5e7eb; 
          border-radius: 8px; 
          overflow: hidden; 
        }
        .section-header { 
          background: #f9fafb; 
          padding: 15px 20px; 
          border-bottom: 1px solid #e5e7eb; 
          font-weight: 600; 
          font-size: 16px; 
        }
        .section-content { 
          padding: 20px; 
        }
        .grid { 
          display: grid; 
          grid-template-columns: repeat(3, 1fr); 
          gap: 20px; 
        }
        .field { 
          margin-bottom: 15px; 
        }
        .field-label { 
          font-size: 12px; 
          color: #6b7280; 
          font-weight: 500; 
          margin-bottom: 3px; 
        }
        .field-value { 
          font-size: 14px; 
          color: #111827; 
          font-weight: 500; 
        }
        .table { 
          width: 100%; 
          border-collapse: collapse; 
          margin-top: 15px; 
        }
        .table th, .table td { 
          border: 1px solid #e5e7eb; 
          padding: 8px 12px; 
          text-align: left; 
        }
        .table th { 
          background: #f9fafb; 
          font-weight: 600; 
          font-size: 12px; 
        }
        .table td { 
          font-size: 13px; 
        }
        .text-right { 
          text-align: right; 
        }
        .text-center { 
          text-align: center; 
        }
        .badge { 
          display: inline-block; 
          padding: 2px 8px; 
          border-radius: 12px; 
          font-size: 11px; 
          font-weight: 500; 
        }
        .badge-success { 
          background: #dcfce7; 
          color: #166534; 
        }
        .badge-outline { 
          background: #f9fafb; 
          color: #374151; 
          border: 1px solid #e5e7eb; 
        }
        .status-complete {
          background: #dcfce7;
          color: #166534;
          padding: 15px;
          border-radius: 8px;
          text-align: center;
          font-weight: 600;
        }
      </style>
    </head>
    <body>
      <div class="header">
        <h1>Conclusão da Compra</h1>
        <p>Solicitação ${request.requestNumber} • ${formatDate(new Date())}</p>
      </div>

      <div class="metrics">
        <div class="metric-card">
          <div class="metric-label">Tempo Total</div>
          <div class="metric-value">${totalProcessTime} dias</div>
        </div>
        <div class="metric-card">
          <div class="metric-label">Valor Total</div>
          <div class="metric-value">${formatCurrency(totalItemsValue)}</div>
        </div>
        <div class="metric-card">
          <div class="metric-label">Status</div>
          <div class="metric-value" style="color: #059669;">Concluído</div>
        </div>
      </div>

      <div class="section">
        <div class="section-header">📋 Resumo da Solicitação</div>
        <div class="section-content">
          <div class="grid">
            <div>
              <div class="field">
                <div class="field-label">Número da Solicitação</div>
                <div class="field-value">${request.requestNumber}</div>
              </div>
              <div class="field">
                <div class="field-label">Data de Criação</div>
                <div class="field-value">${formatDate(request.createdAt)}</div>
              </div>
              <div class="field">
                <div class="field-label">Status Final</div>
                <div class="field-value">
                  <span class="badge badge-success">Concluído</span>
                </div>
              </div>
            </div>
            <div>
              <div class="field">
                <div class="field-label">Solicitante</div>
                <div class="field-value">${requester ? `${requester.firstName} ${requester.lastName}` : request.requesterName || 'Não informado'}</div>
              </div>
              <div class="field">
                <div class="field-label">Departamento</div>
                <div class="field-value">${department?.name || request.departmentName || 'Não informado'}</div>
              </div>
              <div class="field">
                <div class="field-label">Centro de Custo</div>
                <div class="field-value">${costCenter ? `${costCenter.code} - ${costCenter.name}` : request.costCenterName || 'Não informado'}</div>
              </div>
            </div>
            <div>
              <div class="field">
                <div class="field-label">Categoria</div>
                <div class="field-value">
                  <span class="badge badge-outline">${request.category}</span>
                </div>
              </div>
              <div class="field">
                <div class="field-label">Urgência</div>
                <div class="field-value">
                  <span class="badge badge-outline">${request.urgency}</span>
                </div>
              </div>
              <div class="field">
                <div class="field-label">Orçamento Disponível</div>
                <div class="field-value">${request.availableBudget ? formatCurrency(request.availableBudget) : 'Não informado'}</div>
              </div>
            </div>
          </div>
          <div class="field" style="margin-top: 20px; border-top: 1px solid #e5e7eb; padding-top: 15px;">
            <div class="field-label">Justificativa</div>
            <div class="field-value">${request.justification}</div>
          </div>
        </div>
      </div>

      ${selectedSupplier ? `
      <div class="section">
        <div class="section-header">🏢 Fornecedor Selecionado</div>
        <div class="section-content">
          <div class="grid">
            <div>
              <div class="field">
                <div class="field-label">Nome do Fornecedor</div>
                <div class="field-value">${selectedSupplier.supplier?.name || 'Não informado'}</div>
              </div>
              <div class="field">
                <div class="field-label">Telefone</div>
                <div class="field-value">${selectedSupplier.supplier?.phone || 'Não informado'}</div>
              </div>
              <div class="field">
                <div class="field-label">E-mail</div>
                <div class="field-value">${selectedSupplier.supplier?.email || 'Não informado'}</div>
              </div>
            </div>
            <div>
              <div class="field">
                <div class="field-label">Valor da Cotação</div>
                <div class="field-value" style="color: #059669; font-weight: bold;">
                  ${selectedSupplier.totalValue ?
          formatCurrency(selectedSupplier.totalValue) :
          (request.totalValue ? formatCurrency(request.totalValue) : 'Não informado')
        }
                </div>
              </div>
              <div class="field">
                <div class="field-label">Prazo de Entrega</div>
                <div class="field-value">${selectedSupplier.deliveryTerms || selectedSupplier.deliveryTime || 'Não informado'}</div>
              </div>
              <div class="field">
                <div class="field-label">Status</div>
                <div class="field-value">
                  <span class="badge badge-success">Selecionado</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
      ` : ''}

      ${items.length > 0 ? `
      <div class="section">
        <div class="section-header">📦 Itens Recebidos</div>
        <div class="section-content">
          <table class="table">
            <thead>
              <tr>
                <th>Descrição</th>
                <th>Unidade</th>
                <th class="text-right">Qtd. Solicitada</th>
                <th class="text-right">Qtd. Recebida</th>
                <th class="text-right">Valor Unitário</th>
                <th class="text-right">Valor Total</th>
                <th class="text-center">Status</th>
              </tr>
            </thead>
            <tbody>
              ${items.filter((item: any) => {
          // Filter out unavailable items
          const supplierItem = supplierQuotationItems.find((sqi: any) => {
            if (sqi.purchaseRequestItemId && item.id && sqi.purchaseRequestItemId === item.id) {
              return true;
            }
            return sqi.description === item.description ||
              sqi.itemCode === item.itemCode ||
              sqi.quotationItemId === item.id;
          });
          return !supplierItem || supplierItem.isAvailable !== false;
        }).map((item: any) => {
          const supplierItem = supplierQuotationItems.find((sqi: any) => {
            // First try by purchaseRequestItemId (most reliable)
            if (sqi.purchaseRequestItemId && item.id && sqi.purchaseRequestItemId === item.id) {
              return true;
            }
            // Fallback: try by description, item code, or quotationItemId
            return sqi.description === item.description ||
              sqi.itemCode === item.itemCode ||
              sqi.quotationItemId === item.id;
          });

          const unitPrice = supplierItem ? parseFloat(supplierItem.unitPrice) || 0 : 0;
          const quantity = parseFloat(item.requestedQuantity) || 0;
          const total = quantity * unitPrice;
          const status = getItemStatus(item);

          return `
                  <tr>
                    <td>${item.description}</td>
                    <td>${item.unit}</td>
                    <td class="text-right">${quantity}</td>
                    <td class="text-right">${quantity}</td>
                    <td class="text-right">${formatCurrency(unitPrice)}</td>
                    <td class="text-right" style="font-weight: 600;">${formatCurrency(total)}</td>
                    <td class="text-center">
                      <span class="badge ${status === 'received' ? 'badge-success' : 'badge-outline'}">
                        ${status === 'received' ? 'Recebido' : 'Pendente'}
                      </span>
                    </td>
                  </tr>
                `;
        }).join('')}
            </tbody>
          </table>
        </div>
      </div>
      ` : ''}

      ${completeTimeline.length > 0 ? `
      <div class="section">
        <div class="section-header">📅 Linha do Tempo do Processo</div>
        <div class="section-content">
          <table class="table">
            <thead>
              <tr>
                <th>Fase</th>
                <th>Data</th>
                <th>Usuário</th>
                <th>Descrição</th>
              </tr>
            </thead>
            <tbody>
              ${completeTimeline.map((event: any) => `
                <tr>
                  <td>${event.phase || 'N/A'}</td>
                  <td>${event.timestamp ? formatDate(event.timestamp) : 'N/A'}</td>
                  <td>${event.userName || 'Sistema'}</td>
                  <td>${event.description || event.notes || 'N/A'}</td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>
      </div>
      ` : ''}

      <div class="status-complete">
        ✅ Processo Concluído - Todas as etapas foram executadas com sucesso
      </div>
    </body>
    </html>
    `;
  };

  const handleSendEmail = async () => {
    try {
      await apiRequest(`/api/purchase-requests/${request.id}/send-conclusion-email`, {
        method: "POST",
      });
      toast({
        title: "Sucesso",
        description: "Resumo enviado por e-mail",
      });
    } catch (error: any) {
      toast({
        title: "Erro",
        description: error.message || "Erro ao enviar e-mail",
        variant: "destructive",
      });
    }
  };

  // Calculate metrics
  const selectedSupplier = selectedSupplierQuotation;
  const totalProcessTime = request.createdAt ? differenceInDays(new Date(), new Date(request.createdAt)) : 0;

  // Calculate total items value - prioritize request.totalValue for consistency
  const totalItemsValue = useMemo(() => {
    // Priority 1: Use request's total value to maintain consistency with Kanban card
    if (request.totalValue && parseFloat(request.totalValue) > 0) {
      return parseFloat(request.totalValue);
    }

    // Priority 2: Use selected supplier quotation's total value if available
    if (selectedSupplierQuotation?.totalValue && parseFloat(selectedSupplierQuotation.totalValue) > 0) {
      return parseFloat(selectedSupplierQuotation.totalValue);
    }

    // Priority 3: Calculate from supplier quotation items (excluding unavailable items)
    if (supplierQuotationItems && supplierQuotationItems.length > 0 && items && items.length > 0) {
      return items.reduce((sum: number, item: any) => {
        // Find matching supplier quotation item
        const supplierItem = supplierQuotationItems.find((sqi: any) => {
          // First try by purchaseRequestItemId (most reliable)
          if (sqi.purchaseRequestItemId && item.id && sqi.purchaseRequestItemId === item.id) {
            return true;
          }
          // Fallback: try by description, item code, or quotationItemId
          return sqi.description === item.description ||
            sqi.itemCode === item.itemCode ||
            sqi.quotationItemId === item.id;
        });

        // Only include available items in the total
        if (supplierItem && supplierItem.isAvailable !== false) {
          const unitPrice = parseFloat(supplierItem.unitPrice) || 0;
          const quantity = parseFloat(item.requestedQuantity) || 0;
          return sum + (quantity * unitPrice);
        }

        return sum;
      }, 0);
    }

    // Priority 4: Use available budget as fallback
    if (request.availableBudget && parseFloat(request.availableBudget) > 0) {
      return parseFloat(request.availableBudget);
    }

    // Default: 0
    return 0;
  }, [request, selectedSupplierQuotation, supplierQuotationItems, items]);

  // Função para formatar quantidades no padrão brasileiro
  const formatQuantity = (quantity: number | string) => {
    const num = typeof quantity === 'string' ? parseFloat(quantity) : quantity;
    return Number(num || 0).toLocaleString('pt-BR', {
      minimumFractionDigits: 0,
      maximumFractionDigits: 2
    });
  };

  // Get status indicators
  const getItemStatus = (item: any) => {
    // Mock status based on item data - in real app this would come from receipt data
    return item.requestedQuantity > 0 ? 'received' : 'pending';
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'received':
        return <CheckCircle2 className="h-4 w-4 text-green-500" />;
      case 'pending':
        return <Clock className="h-4 w-4 text-yellow-500" />;
      case 'divergent':
        return <XCircle className="h-4 w-4 text-red-500" />;
      default:
        return <Minus className="h-4 w-4 text-gray-400" />;
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'received':
        return <Badge variant="default" className="bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-300">Recebido</Badge>;
      case 'pending':
        return <Badge variant="secondary" className="bg-yellow-100 dark:bg-yellow-900/30 text-yellow-800 dark:text-yellow-300">Pendente</Badge>;
      case 'divergent':
        return <Badge variant="destructive">Divergente</Badge>;
      default:
        return <Badge variant="outline">Não informado</Badge>;
    }
  };

  const isLoading = itemsLoading || approvalHistoryLoading || attachmentsLoading || quotationLoading || supplierQuotationItemsLoading || requesterLoading || costCentersLoading || departmentsLoading || quotationAttachmentsLoading || timelineLoading;

  useImperativeHandle(ref, () => ({
    downloadPurchaseOrderPDF: () => downloadPurchaseOrderPDFMutation.mutate(),
    exportPDF: () => exportPDFMutation.mutate(),
    printSummary: () => handlePrint(),
    sendEmail: () => handleSendEmail(),
    openArchiveDialog: () => setShowArchiveDialog(true),
  }))

  return (
    <div className={className}>
{/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-2xl font-bold text-foreground">Conclusão da Compra</h2>
          <p className="text-muted-foreground">Solicitação {request.requestNumber}</p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => downloadPurchaseOrderPDFMutation.mutate()}
            disabled={downloadPurchaseOrderPDFMutation.isPending}
            className="border-blue-600 text-blue-600 hover:bg-blue-50"
          >
            <FileText className="h-4 w-4 mr-2" />
            {downloadPurchaseOrderPDFMutation.isPending ? "Baixando..." : "PDF Pedido de Compra"}
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => exportPDFMutation.mutate()}
            disabled={exportPDFMutation.isPending}
          >
            <Download className="h-4 w-4 mr-2" />
            Exportar PDF
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={handlePrint}
          >
            <Printer className="h-4 w-4 mr-2" />
            Imprimir
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={handleSendEmail}
          >
            <Mail className="h-4 w-4 mr-2" />
            Enviar E-mail
          </Button>

          {request.currentPhase === PURCHASE_PHASES.CONCLUSAO_COMPRA && (
            <Dialog open={showArchiveDialog} onOpenChange={setShowArchiveDialog}>
              <DialogTrigger asChild>
                <Button
                  variant="outline"
                  size="sm"
                >
                  <Archive className="h-4 w-4 mr-2" />
                  Arquivar
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Arquivar Solicitação</DialogTitle>
                </DialogHeader>
                <Form {...form}>
                  <form onSubmit={form.handleSubmit(handleArchive)} className="space-y-4">
                    <FormField
                      control={form.control}
                      name="conclusionObservations"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Observações de Conclusão (Opcional)</FormLabel>
                          <FormControl>
                            <Textarea
                              placeholder="Adicione observações sobre a conclusão do processo..."
                              {...field}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <div className="flex justify-end gap-2">
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => setShowArchiveDialog(false)}
                      >
                        Cancelar
                      </Button>
                      <Button
                        type="submit"
                        disabled={isArchiving}
                      >
                        {isArchiving ? "Arquivando..." : "Arquivar"}
                      </Button>
                    </div>
                  </form>
                </Form>
              </DialogContent>
            </Dialog>
          )}

          <Button variant="ghost" size="icon" onClick={onClose}>
            <X className="h-5 w-5" />
          </Button>
        </div>
      </div>
      {isLoading ? (
        <div className="flex items-center justify-center p-8">
          <Clock className="h-6 w-6 animate-spin mr-2" />
          <span>Carregando informações da conclusão...</span>
        </div>
      ) : (
      <div className="space-y-6">
        {/* Process Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Tempo Total</p>
                  <p className="text-2xl font-bold text-foreground">{totalProcessTime} dias</p>
                </div>
                <Clock className="h-8 w-8 text-blue-500" />
              </div>
            </CardContent>
          </Card >

          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Valor Total</p>
                  <p className="text-2xl font-bold text-foreground">
                    {totalItemsValue.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                  </p>
                </div>
                <DollarSign className="h-8 w-8 text-green-500" />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Status</p>
                  <p className="text-2xl font-bold text-green-600 dark:text-green-400">Concluído</p>
                </div>
                <CheckCircle className="h-8 w-8 text-green-500" />
              </div>
            </CardContent>
          </Card>
        </div >

        {/* Request Summary */}
        < Card >
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5" />
              Resumo da Solicitação
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              <div className="space-y-4">
                <div>
                  <span className="text-sm font-medium text-muted-foreground">Número da Solicitação</span>
                  <p className="text-lg font-semibold">{request.requestNumber}</p>
                </div>
                <div>
                  <span className="text-sm font-medium text-muted-foreground">Data de Criação</span>
                  <p>{format(new Date(request.createdAt), "dd/MM/yyyy HH:mm", { locale: ptBR })}</p>
                </div>
                <div>
                  <span className="text-sm font-medium text-muted-foreground">Status Final</span>
                  <Badge variant="default" className="bg-green-100 text-green-800">
                    {PHASE_LABELS[request.currentPhase as keyof typeof PHASE_LABELS]}
                  </Badge>
                </div>
              </div>

              <div className="space-y-4">
                <div>
                  <span className="text-sm font-medium text-muted-foreground">Solicitante</span>
                  <p className="font-medium">
                    {requester ? `${requester.firstName} ${requester.lastName}` : request.requesterName || 'Não informado'}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    {requester?.email || request.requesterEmail || 'Não informado'}
                  </p>
                </div>
                <div>
                  <span className="text-sm font-medium text-muted-foreground">Departamento</span>
                  <p>{department?.name || request.departmentName || 'Não informado'}</p>
                </div>
                <div>
                  <span className="text-sm font-medium text-muted-foreground">Centro de Custo</span>
                  <p>{costCenter?.code} - {costCenter?.name || 'Não informado'}</p>
                </div>
              </div>

              <div className="space-y-4">
                <div>
                  <span className="text-sm font-medium text-muted-foreground">Categoria</span>
                  <Badge variant="outline">{CATEGORY_LABELS[request.category as keyof typeof CATEGORY_LABELS]}</Badge>
                </div>
                <div>
                  <span className="text-sm font-medium text-muted-foreground">Urgência</span>
                  <Badge variant="outline">{URGENCY_LABELS[request.urgency as keyof typeof URGENCY_LABELS]}</Badge>
                </div>
                <div>
                  <span className="text-sm font-medium text-muted-foreground">Orçamento Disponível</span>
                  <p className="font-medium">
                    {request.availableBudget?.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }) || 'Não informado'}
                  </p>
                </div>
              </div>
            </div>

            <Separator className="my-4" />

            <div>
              <span className="text-sm font-medium text-muted-foreground">Justificativa</span>
              <p className="mt-1 text-foreground">{request.justification}</p>
            </div>
          </CardContent>
        </Card >

        {/* Selected Supplier */}
        {
          selectedSupplier && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Building className="h-5 w-5" />
                  Fornecedor Selecionado
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-4">
                    <div>
                      <span className="text-sm font-medium text-muted-foreground">Nome do Fornecedor</span>
                      <p className="text-lg font-semibold text-foreground">{selectedSupplier.supplier?.name || 'Não informado'}</p>
                    </div>
                    <div>
                      <span className="text-sm font-medium text-muted-foreground">Contato</span>
                      <div className="flex items-center gap-2 mt-1">
                        <Phone className="h-4 w-4 text-muted-foreground" />
                        <p>{selectedSupplier.supplier?.phone || 'Não informado'}</p>
                      </div>
                      <div className="flex items-center gap-2 mt-1">
                        <Mail className="h-4 w-4 text-muted-foreground" />
                        <p>{selectedSupplier.supplier?.email || 'Não informado'}</p>
                      </div>
                    </div>
                  </div>

                  <div className="space-y-4">
                    <div>
                      <span className="text-sm font-medium text-muted-foreground">Valor da Cotação</span>
                      <p className="text-lg font-semibold text-green-600 dark:text-green-400">
                        {selectedSupplier.totalValue ?
                          parseFloat(selectedSupplier.totalValue).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }) :
                          (request.totalValue ?
                            parseFloat(request.totalValue).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }) :
                            'Não informado'
                          )
                        }
                      </p>
                    </div>
                    <div>
                      <span className="text-sm font-medium text-muted-foreground">Prazo de Entrega</span>
                      <p>{selectedSupplier.deliveryTerms || selectedSupplier.deliveryTime || 'Não informado'}</p>
                    </div>
                    <div>
                      <span className="text-sm font-medium text-muted-foreground">Status</span>
                      <Badge variant="default" className="bg-green-100 text-green-800">
                        Selecionado
                      </Badge>
                    </div>

                    {/* Desconto da Proposta */}
                    {(selectedSupplier.discountType && selectedSupplier.discountType !== 'none' && selectedSupplier.discountValue) && (
                      <div>
                        <span className="text-sm font-medium text-muted-foreground">Desconto da Proposta</span>
                        <p className="text-lg font-semibold text-green-600 dark:text-green-400">
                          {selectedSupplier.discountType === 'percentage'
                            ? `${selectedSupplier.discountValue}%`
                            : `R$ ${Number(selectedSupplier.discountValue).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`
                          }
                        </p>
                      </div>
                    )}
                  </div>
                </div>


              </CardContent>
            </Card>
          )
        }

        {/* Purchase Order Data */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Package className="h-5 w-5" />
              Dados do Pedido de Compra
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-4">
                <div>
                  <span className="text-sm font-medium text-muted-foreground">Número do Pedido</span>
                  <p className="text-lg font-semibold">{purchaseOrder.orderNumber || request.requestNumber}</p>
                </div>
                <div>
                  <span className="text-sm font-medium text-muted-foreground">Data de Emissão</span>
                  <p>{format(new Date(request.createdAt), "dd/MM/yyyy", { locale: ptBR })}</p>
                </div>
                <div>
                  <span className="text-sm font-medium text-muted-foreground">Status do Pedido</span>
                  <Badge variant="default" className="bg-green-100 text-green-800">
                    Entregue
                  </Badge>
                </div>
              </div>

              <div className="space-y-4">
                <div>
                  <span className="text-sm font-medium text-muted-foreground">Condições de Pagamento</span>
                  <p>{request.paymentConditions || 'Conforme contrato'}</p>
                </div>
                <div>
                  <span className="text-sm font-medium text-muted-foreground">Local de Entrega</span>
                  <div className="flex items-center gap-2 mt-1">
                    <MapPin className="h-4 w-4 text-muted-foreground" />
                    <p>{request.deliveryLocation || 'Sede da empresa'}</p>
                  </div>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Physical Receipt Section */}
        {receipt && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Truck className="h-5 w-5" />
                Recebimento Físico
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
                <div className="space-y-4">
                  <div>
                    <span className="text-sm font-medium text-muted-foreground">Data do Recebimento</span>
                    <p>{receipt.created_at ? format(new Date(receipt.created_at), "dd/MM/yyyy HH:mm", { locale: ptBR }) : 'Pendente'}</p>
                  </div>
                  <div>
                    <span className="text-sm font-medium text-muted-foreground">Responsável</span>
                    <p>{receipt.receiver_first_name} {receipt.receiver_last_name}</p>
                  </div>
                </div>
                <div className="space-y-4">
                  <div>
                    <span className="text-sm font-medium text-muted-foreground">Status</span>
                    <Badge variant={receipt.status === 'completed' ? 'default' : 'secondary'} className={receipt.status === 'completed' ? "bg-green-100 text-green-800" : ""}>
                      {receipt.status === 'completed' ? 'Concluído' : 'Pendente'}
                    </Badge>
                  </div>
                  <div>
                    <span className="text-sm font-medium text-muted-foreground">Observações</span>
                    <p>{receiptObs?.physical || receiptObs?.general || 'Sem observações'}</p>
                  </div>
                </div>
              </div>

              {/* Physical Receipt History */}
              <div className="border rounded-md p-4 bg-muted/20">
                <h4 className="text-sm font-semibold mb-3 flex items-center gap-2">
                  <History className="h-4 w-4" />
                  Histórico de Recebimento
                </h4>
                <div className="space-y-3">
                  {auditLogs
                    .filter((log: any) => log.action.includes('receipt') || log.entity_type === 'receipt')
                    .map((log: any, idx: number) => (
                    <div key={idx} className="flex justify-between items-start text-sm border-b border-border/50 last:border-0 pb-2 last:pb-0">
                      <div>
                        <span className="font-medium">{log.action}</span>
                        <p className="text-muted-foreground text-xs">{log.first_name} {log.last_name}</p>
                      </div>
                      <span className="text-xs text-muted-foreground whitespace-nowrap">
                        {format(new Date(log.performed_at), "dd/MM/yyyy HH:mm", { locale: ptBR })}
                      </span>
                    </div>
                  ))}
                  {auditLogs.filter((log: any) => log.action.includes('receipt') || log.entity_type === 'receipt').length === 0 && (
                    <p className="text-sm text-muted-foreground">Nenhum histórico registrado.</p>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Fiscal Conference Section */}
        {receipt && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FileText className="h-5 w-5" />
                Conferência Fiscal
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
                <div className="space-y-4">
                  <div>
                    <span className="text-sm font-medium text-muted-foreground">Data da Conferência</span>
                    <p>{receipt.approval_date ? format(new Date(receipt.approval_date), "dd/MM/yyyy HH:mm", { locale: ptBR }) : 'Pendente'}</p>
                  </div>
                  <div>
                    <span className="text-sm font-medium text-muted-foreground">Fiscal Responsável</span>
                    <p>{receipt.approver_first_name ? `${receipt.approver_first_name} ${receipt.approver_last_name}` : 'Aguardando Aprovação'}</p>
                  </div>
                </div>
                <div className="space-y-4">
                  <div>
                    <span className="text-sm font-medium text-muted-foreground">Status</span>
                    <Badge variant={receipt.approval_date ? 'default' : 'secondary'} className={receipt.approval_date ? "bg-green-100 text-green-800" : ""}>
                      {receipt.approval_date ? 'Aprovado' : 'Pendente'}
                    </Badge>
                  </div>
                </div>
              </div>

              {/* Fiscal Conference History */}
              <div className="border rounded-md p-4 bg-muted/20">
                <h4 className="text-sm font-semibold mb-3 flex items-center gap-2">
                  <History className="h-4 w-4" />
                  Histórico Fiscal
                </h4>
                <div className="space-y-3">
                  {auditLogs
                    .filter((log: any) => log.action.includes('fiscal') || log.action.includes('approv') || (log.details && JSON.stringify(log.details).includes('fiscal')))
                    .map((log: any, idx: number) => (
                    <div key={idx} className="flex justify-between items-start text-sm border-b border-border/50 last:border-0 pb-2 last:pb-0">
                      <div>
                        <span className="font-medium">{log.action}</span>
                        <p className="text-muted-foreground text-xs">{log.first_name} {log.last_name}</p>
                      </div>
                      <span className="text-xs text-muted-foreground whitespace-nowrap">
                        {format(new Date(log.performed_at), "dd/MM/yyyy HH:mm", { locale: ptBR })}
                      </span>
                    </div>
                  ))}
                  {auditLogs.filter((log: any) => log.action.includes('fiscal') || log.action.includes('approv') || (log.details && JSON.stringify(log.details).includes('fiscal'))).length === 0 && (
                    <p className="text-sm text-muted-foreground">Nenhum histórico registrado.</p>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* ERP Integration Section */}
        {receipt && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <RefreshCw className="h-5 w-5" />
                Integração ERP
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-6">
                {/* Last Status */}
                <div className="flex items-center justify-between p-4 border rounded-lg bg-card">
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">Status da Integração</p>
                    <div className="flex items-center gap-2 mt-1">
                      {erpLogs.length > 0 && erpLogs[0].type === 'success' ? (
                        <CheckCircle className="h-5 w-5 text-green-500" />
                      ) : (
                        <AlertTriangle className="h-5 w-5 text-yellow-500" />
                      )}
                      <span className="font-medium">
                        {erpLogs.length > 0 ? (erpLogs[0].type === 'success' ? 'Integrado' : 'Erro na Integração') : 'Aguardando'}
                      </span>
                    </div>
                  </div>
                  <Button 
                    onClick={() => retryErpMutation.mutate()} 
                    disabled={retryErpMutation.isPending}
                    variant={erpLogs.length > 0 && erpLogs[0].type === 'error' ? "destructive" : "outline"}
                  >
                    <RefreshCw className={`h-4 w-4 mr-2 ${retryErpMutation.isPending ? 'animate-spin' : ''}`} />
                    {retryErpMutation.isPending ? 'Enviando...' : 'Tentar Novamente'}
                  </Button>
                </div>

                {/* Integration Logs */}
                <div className="border rounded-md overflow-hidden">
                  <div className="bg-muted px-4 py-2 border-b flex justify-between items-center">
                    <h4 className="text-sm font-semibold">Logs da API</h4>
                    <Badge variant="outline" className="text-xs">{erpLogs.length} registros</Badge>
                  </div>
                  <div className="max-h-[300px] overflow-y-auto p-0">
                    {erpLogs.length > 0 ? (
                      <table className="w-full text-sm">
                        <thead className="bg-muted/50 sticky top-0">
                          <tr>
                            <th className="text-left py-2 px-4 font-medium text-muted-foreground w-[150px]">Data/Hora</th>
                            <th className="text-left py-2 px-4 font-medium text-muted-foreground">Mensagem</th>
                            <th className="text-right py-2 px-4 font-medium text-muted-foreground w-[100px]">Status</th>
                          </tr>
                        </thead>
                        <tbody>
                          {erpLogs.map((log, idx) => (
                            <tr key={idx} className="border-b last:border-0 hover:bg-muted/50 transition-colors">
                              <td className="py-2 px-4 text-xs text-muted-foreground whitespace-nowrap">
                                {format(log.time, "dd/MM/yyyy HH:mm:ss", { locale: ptBR })}
                              </td>
                              <td className="py-2 px-4 font-mono text-xs">
                                {log.message}
                              </td>
                              <td className="py-2 px-4 text-right">
                                <Badge variant={log.type === 'success' ? 'default' : log.type === 'error' ? 'destructive' : 'outline'} className="text-[10px] h-5">
                                  {log.type.toUpperCase()}
                                </Badge>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    ) : (
                      <div className="p-8 text-center text-muted-foreground">
                        <p>Nenhum log de integração registrado.</p>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Complete Process Timeline */}
        <ProcessTimeline timeline={completeTimeline} isLoading={timelineLoading} />

        {/* Dados do Processo */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-foreground">
              <History className="h-5 w-5" />
              Dados do Processo
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Informações da Solicitação */}
              <div className="space-y-4">
                <h4 className="text-lg font-semibold text-foreground border-b border-border pb-2">📋 Solicitação</h4>
                <div className="space-y-3">
                  <div>
                    <span className="text-sm font-medium text-muted-foreground">Número da Solicitação</span>
                    <p className="font-medium">{request.requestNumber}</p>
                  </div>
                  <div>
                    <span className="text-sm font-medium text-muted-foreground">Data de Criação</span>
                    <p>{format(new Date(request.createdAt), "dd/MM/yyyy HH:mm", { locale: ptBR })}</p>
                  </div>
                  <div>
                    <span className="text-sm font-medium text-muted-foreground">Solicitante</span>
                    <p>{requester ? `${requester.firstName} ${requester.lastName}` : request.requesterName || 'Não informado'}</p>
                  </div>
                  <div>
                    <span className="text-sm font-medium text-muted-foreground">Departamento</span>
                    <p>{department?.name || request.departmentName || 'Não informado'}</p>
                  </div>
                  <div>
                    <span className="text-sm font-medium text-muted-foreground">Centro de Custo</span>
                    <p>{costCenter?.code} - {costCenter?.name || 'Não informado'}</p>
                  </div>
                  <div>
                    <span className="text-sm font-medium text-muted-foreground">Quantidade Total de Itens</span>
                    <p className="font-medium">{formatQuantity(items.reduce((sum: number, item: any) => sum + (parseFloat(item.requestedQuantity) || 0), 0))}</p>
                  </div>
                </div>
              </div>

              {/* Dados da Cotação */}
              <div className="space-y-4">
                <h4 className="text-lg font-semibold text-foreground border-b border-border pb-2">💰 Cotação</h4>
                {quotation ? (
                  <div className="space-y-3">
                    <div>
                      <span className="text-sm font-medium text-muted-foreground">Número da Cotação</span>
                      <p className="font-medium">{quotation.quotationNumber}</p>
                    </div>
                    <div>
                      <span className="text-sm font-medium text-muted-foreground">Data de Criação</span>
                      <p>{format(new Date(quotation.createdAt), "dd/MM/yyyy HH:mm", { locale: ptBR })}</p>
                    </div>
                    <div>
                      <span className="text-sm font-medium text-muted-foreground">Status</span>
                      <Badge variant="outline">{quotation.status}</Badge>
                    </div>
                    <div>
                      <span className="text-sm font-medium text-muted-foreground">Fornecedores Participantes</span>
                      <p className="font-medium">{supplierQuotations.length}</p>
                    </div>
                  </div>
                ) : (
                  <p className="text-muted-foreground">Dados da cotação não disponíveis</p>
                )}
              </div>

              {/* Cotação Vencedora */}
              <div className="space-y-4">
                <h4 className="text-lg font-semibold text-foreground border-b border-border pb-2">🏆 Cotação Vencedora</h4>
                {selectedSupplierQuotation ? (
                  <div className="space-y-3">
                    <div>
                      <span className="text-sm font-medium text-muted-foreground">Fornecedor</span>
                      <p className="font-medium">{selectedSupplierQuotation.supplierName}</p>
                    </div>
                    <div>
                      <span className="text-sm font-medium text-muted-foreground">Valor Total da Proposta</span>
                      <p className="font-medium text-green-600">
                        {parseFloat(selectedSupplierQuotation.totalValue || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', minimumFractionDigits: 4, maximumFractionDigits: 4 })}
                      </p>
                    </div>
                    <div>
                      <span className="text-sm font-medium text-muted-foreground">Data de Submissão</span>
                      <p>{selectedSupplierQuotation.submissionDate ? format(new Date(selectedSupplierQuotation.submissionDate), "dd/MM/yyyy HH:mm", { locale: ptBR }) : 'Não informado'}</p>
                    </div>
                    <div>
                      <span className="text-sm font-medium text-muted-foreground">Itens Cotados</span>
                      <p className="font-medium">{supplierQuotationItems.filter((item: any) => item.isAvailable !== false).length}</p>
                    </div>
                  </div>
                ) : (
                  <p className="text-muted-foreground">Dados da cotação vencedora não disponíveis</p>
                )}
              </div>

              {/* Pedido de Compra */}
              <div className="space-y-4">
                <h4 className="text-lg font-semibold text-foreground border-b border-border pb-2">📄 Pedido de Compra</h4>
                {purchaseOrder ? (
                  <div className="space-y-3">
                    <div>
                      <span className="text-sm font-medium text-muted-foreground">Número do Pedido</span>
                      <p className="font-medium">{purchaseOrder.orderNumber}</p>
                    </div>
                    <div>
                      <span className="text-sm font-medium text-muted-foreground">Data de Criação</span>
                      <p>{format(new Date(purchaseOrder.createdAt), "dd/MM/yyyy HH:mm", { locale: ptBR })}</p>
                    </div>
                    <div>
                      <span className="text-sm font-medium text-muted-foreground">Valor Total</span>
                      <p className="font-medium text-green-600">
                        {parseFloat(purchaseOrder.totalValue || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                      </p>
                    </div>
                    <div>
                      <span className="text-sm font-medium text-muted-foreground">Itens no Pedido</span>
                      <p className="font-medium">{formatQuantity(purchaseOrderItems.reduce((sum: number, item: any) => sum + (parseFloat(item.quantity) || 0), 0))}</p>
                    </div>
                  </div>
                ) : (
                  <p className="text-muted-foreground">Dados do pedido de compra não disponíveis</p>
                )}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Items Received */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Package className="h-5 w-5" />
              Itens Recebidos
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b">
                    <th className="text-left py-2">Item</th>
                    <th className="text-left py-2">Unidade</th>
                    <th className="text-right py-2">Qtd. Solicitada</th>
                    <th className="text-right py-2">Qtd. do Pedido</th>
                    <th className="text-right py-2">Qtd. Recebida</th>
                    <th className="text-right py-2">Preço Unitário</th>
                    <th className="text-right py-2">Total</th>
                    <th className="text-center py-2">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {purchaseOrderItems.length > 0 ? purchaseOrderItems.map((purchaseItem: any) => {
                    // Encontrar o item original da solicitação para comparação
                    const originalItem = items.find((item: any) =>
                      item.description === purchaseItem.description ||
                      item.id === purchaseItem.purchaseRequestItemId
                    );

                    const status = getItemStatus(purchaseItem);

                    // Usar dados do pedido de compra
                    const unitPrice = parseFloat(purchaseItem.unitPrice) || 0;
                    const purchaseQuantity = parseFloat(purchaseItem.quantity) || 0;
                    const originalQuantity = originalItem ? parseFloat(originalItem.requestedQuantity) || 0 : purchaseQuantity;
                    const total = parseFloat(purchaseItem.totalPrice) || (purchaseQuantity * unitPrice);

                    return (
                      <tr key={purchaseItem.id} className="border-b border-border">
                        <td className="py-2">
                          <div>
                            <p className="font-medium">{purchaseItem.description}</p>
                            {purchaseItem.specifications && (
                              <p className="text-sm text-muted-foreground">{purchaseItem.specifications}</p>
                            )}
                          </div>
                        </td>
                        <td className="py-2">{purchaseItem.unit}</td>
                        <td className="text-right py-2">{formatQuantity(originalQuantity)}</td>
                        <td className="text-right py-2 font-medium text-blue-600 dark:text-blue-400">{formatQuantity(purchaseQuantity)}</td>
                        <td className="text-right py-2 font-medium text-green-600 dark:text-green-400">{formatQuantity(purchaseQuantity)}</td>
                        <td className="text-right py-2">
                          {unitPrice.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                        </td>
                        <td className="text-right py-2 font-medium">
                          {total.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                        </td>
                        <td className="text-center py-2">
                          <div className="flex items-center justify-center gap-1">
                            {getStatusIcon(status)}
                            {getStatusBadge(status)}
                          </div>
                        </td>
                      </tr>
                    );
                  }) : (
                    // Fallback para usar itens da solicitação se não houver itens do pedido de compra
                    items.filter((item: any) => {
                      // Filter out unavailable items
                      const supplierItem = supplierQuotationItems.find((sqi: any) => {
                        if (sqi.purchaseRequestItemId && item.id && sqi.purchaseRequestItemId === item.id) {
                          return true;
                        }
                        return sqi.description === item.description ||
                          sqi.itemCode === item.itemCode ||
                          sqi.quotationItemId === item.id ||
                          (sqi.description && item.description &&
                            sqi.description.toLowerCase().trim() === item.description.toLowerCase().trim());
                      });
                      return !supplierItem || supplierItem.isAvailable !== false;
                    }).map((item: any) => {
                      const status = getItemStatus(item);

                      // Find matching supplier quotation item with multiple criteria
                      const supplierItem = supplierQuotationItems.find((sqi: any) => {
                        // First try by purchaseRequestItemId (most reliable)
                        if (sqi.purchaseRequestItemId && item.id && sqi.purchaseRequestItemId === item.id) {
                          return true;
                        }
                        // Fallback: try by description, item code, quotationItemId, or normalized description
                        return sqi.description === item.description ||
                          sqi.itemCode === item.itemCode ||
                          sqi.quotationItemId === item.id ||
                          (sqi.description && item.description &&
                            sqi.description.toLowerCase().trim() === item.description.toLowerCase().trim());
                      });

                      // Get unit price with better fallback logic
                      let unitPrice = 0;
                      if (supplierItem) {
                        unitPrice = parseFloat(supplierItem.unitPrice) || 0;
                      } else if (selectedSupplierQuotation?.totalValue && items.length === 1) {
                        // If only one item and we have total value, use it as unit price
                        unitPrice = parseFloat(selectedSupplierQuotation.totalValue) || 0;
                      }

                      const quantity = parseFloat(item.requestedQuantity) || 0;
                      const total = quantity * unitPrice;

                      return (
                        <tr key={item.id} className="border-b border-border">
                          <td className="py-2">
                            <div>
                              <p className="font-medium">{item.description}</p>
                              {item.specifications && (
                                <p className="text-sm text-muted-foreground">{item.specifications}</p>
                              )}
                            </div>
                          </td>
                          <td className="py-2">{item.unit}</td>
                          <td className="text-right py-2">{formatQuantity(quantity)}</td>
                          <td className="text-right py-2 font-medium text-blue-600 dark:text-blue-400">{formatQuantity(quantity)}</td>
                          <td className="text-right py-2 font-medium text-green-600 dark:text-green-400">{formatQuantity(quantity)}</td>
                          <td className="text-right py-2">
                            {unitPrice.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                          </td>
                          <td className="text-right py-2 font-medium">
                            {total.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                          </td>
                          <td className="text-center py-2">
                            <div className="flex items-center justify-center gap-1">
                              {getStatusIcon(status)}
                              {getStatusBadge(status)}
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>

        {/* Attachments */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Eye className="h-5 w-5" />
              Anexos do Processo
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {/* Anexos da Solicitação Original */}
              {attachments.length > 0 && (
                <div>
                  <h4 className="text-sm font-medium text-foreground mb-3">Anexos da Solicitação</h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {attachments.map((attachment: any) => (
                      <div key={attachment.id} className="flex items-center gap-3 p-3 border border-border rounded-lg">
                        <FileText className="h-8 w-8 text-blue-500" />
                        <div className="flex-1">
                          <p className="font-medium">{attachment.fileName || attachment.filename}</p>
                          <p className="text-sm text-muted-foreground">{attachment.fileType}</p>
                          <p className="text-xs text-gray-500">
                            {attachment.attachmentType === 'requisition' ? 'Anexo de Solicitação' : attachment.attachmentType}
                          </p>
                        </div>
                        <Button variant="ghost" size="sm" asChild>
                          <a href={`/api/attachments/${attachment.id}/download`} target="_blank">
                            <ExternalLink className="h-4 w-4" />
                          </a>
                        </Button>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Anexos de Cotações de Fornecedores */}
              {quotationAttachments.length > 0 && (
                <div>
                  <h4 className="text-sm font-medium text-foreground mb-3">Anexos de Cotações</h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {quotationAttachments.map((attachment: any) => (
                      <div key={attachment.id} className="flex items-center gap-3 p-3 border border-border rounded-lg">
                        <FileText className="h-8 w-8 text-green-500" />
                        <div className="flex-1">
                          <p className="font-medium">{attachment.fileName || attachment.filename}</p>
                          <p className="text-sm text-muted-foreground">{attachment.fileType}</p>
                          <p className="text-xs text-gray-500">
                            Proposta de {attachment.supplierName || 'Fornecedor'}
                          </p>
                        </div>
                        <Button variant="ghost" size="sm" asChild>
                          <a href={`/api/attachments/${attachment.id}/download`} target="_blank">
                            <ExternalLink className="h-4 w-4" />
                          </a>
                        </Button>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Mensagem quando não há anexos */}
              {attachments.length === 0 && quotationAttachments.length === 0 && (
                <div className="text-center py-8 text-muted-foreground">
                  <FileText className="h-12 w-12 mx-auto mb-3 text-gray-400" />
                  <p>Nenhum anexo encontrado para esta solicitação</p>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Process Completion Status */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CheckCircle className="h-5 w-5" />
              Status do Processo
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-start gap-3 p-4 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg">
              <CheckCircle className="h-5 w-5 text-green-600 mt-0.5" />
              <div>
                <p className="font-medium text-green-900 dark:text-green-300">Processo Concluído</p>
                <p className="text-sm text-green-700 dark:text-green-300">
                  Todas as etapas foram executadas com sucesso. O processo está finalizado.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        {request.currentPhase === PURCHASE_PHASES.CONCLUSAO_COMPRA && (
          <Dialog open={showArchiveDialog} onOpenChange={setShowArchiveDialog}>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Arquivar Solicitação</DialogTitle>
              </DialogHeader>
              <Form {...form}>
                <form onSubmit={form.handleSubmit(handleArchive)} className="space-y-4">
                  <FormField
                    control={form.control}
                    name="conclusionObservations"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Observações de Conclusão (Opcional)</FormLabel>
                        <FormControl>
                          <Textarea
                            placeholder="Adicione observações sobre a conclusão do processo..."
                            {...field}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <div className="flex justify-end gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => setShowArchiveDialog(false)}
                    >
                      Cancelar
                    </Button>
                    <Button
                      type="submit"
                      disabled={isArchiving}
                    >
                      {isArchiving ? "Arquivando..." : "Arquivar"}
                    </Button>
                  </div>
                </form>
              </Form>
            </DialogContent>
          </Dialog>
        )}
      </div >
      )}
    </div >
  );
})

export default ConclusionPhase
