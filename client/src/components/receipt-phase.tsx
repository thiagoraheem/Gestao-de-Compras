import React, { useState, useMemo, useEffect, forwardRef, useImperativeHandle, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
import { X, Check, User, FileText, Download, Eye} from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";
import { PHASE_LABELS } from "@/lib/types";
import { formatCurrency } from "@/lib/currency";
import { apiRequest } from "@/lib/queryClient";
import { cn } from "@/lib/utils";
import PendencyModal from "./pendency-modal";
import { canConfirmReceipt, getInitialTabForMode } from "./receipt-phase-logic";

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
  const [receivedQuantities, setReceivedQuantities] = useState<Record<number, number>>({});
  const [manualNFNumber, setManualNFNumber] = useState<string>("");
  const [manualNFSeries, setManualNFSeries] = useState<string>("");
    const [emitter, setEmitter] = useState<{ idSupplierERP?: string; cnpj?: string; name?: string; fantasyName?: string; ie?: string; im?: string; cnae?: string; crt?: string; address?: { street?: string; number?: string; neighborhood?: string; city?: string; uf?: string; cep?: string; country?: string; phone?: string } }>({});

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

  useEffect(() => {
    if (selectedSupplier?.idSupplierERP) {
      setEmitter(prev => ({ ...prev, idSupplierERP: selectedSupplier.idSupplierERP }));
    }
  }, [selectedSupplier]);

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

  useImperativeHandle(ref, () => ({
    previewPDF: handlePreviewPDF,
    downloadPDF: handleDownloadPDF,
  }));

  const formatDate = (date: any) => {
    if (!date) return "N/A";
    return formatDistanceToNow(new Date(date), {
      addSuffix: true,
      locale: ptBR
    });
  };

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

  const canConfirm = useMemo(() => {
    return canConfirmReceipt({
      mode,
      receivedQuantities,
      itemsWithPrices
    });
  }, [mode, receivedQuantities, itemsWithPrices]);

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
                        <TableHead className="text-center">Qtd Já Confirmada</TableHead>
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
                            <TableCell className="text-center text-muted-foreground">{Number(prev).toLocaleString('pt-BR', { minimumFractionDigits: 0, maximumFractionDigits: 3 })}</TableCell>
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
                            return `${Math.min(percent, 100).toFixed(1)}% (${total.toLocaleString('pt-BR')} / ${totalExpected.toLocaleString('pt-BR')})`;
                          })()}
                        </span>
                      </div>

                      <div className="w-full bg-slate-200 dark:bg-slate-700 rounded-full h-2.5">
                        <div
                          className={cn(
                            "h-2.5 rounded-full transition-all duration-500",
                            (() => {
                              const totalExpected = itemsWithPrices.reduce((acc: number, it: any) => acc + Number(it.quantity || 0), 0);
                              const totalReceivedPrev = itemsWithPrices.reduce((acc: number, it: any) => acc + Number(it.quantityReceived || 0), 0);
                              const totalReceivedNow = itemsWithPrices.reduce((acc: number, it: any) => acc + Number(receivedQuantities[it.id] || 0), 0);
                              const total = totalReceivedPrev + totalReceivedNow;
                              return total > totalExpected ? "bg-red-600" : "bg-blue-600";
                            })()
                          )}
                          style={{
                            width: `${(() => {
                              const totalExpected = itemsWithPrices.reduce((acc: number, it: any) => acc + Number(it.quantity || 0), 0);
                              const totalReceivedPrev = itemsWithPrices.reduce((acc: number, it: any) => acc + Number(it.quantityReceived || 0), 0);
                              const totalReceivedNow = itemsWithPrices.reduce((acc: number, it: any) => acc + Number(receivedQuantities[it.id] || 0), 0);
                              return totalExpected > 0 ? Math.min(100, ((totalReceivedPrev + totalReceivedNow) / totalExpected) * 100) : 0;
                            })()}%`
                          }}
                        ></div>
                      </div>

                      <div className="flex justify-between items-center mt-2 p-2 bg-slate-50 dark:bg-slate-900/20 rounded border border-slate-100 dark:border-slate-800">
                        <span className="text-sm font-medium text-slate-700 dark:text-slate-300">Status Previsto:</span>
                        {(() => {
                          const hasExcess = itemsWithPrices.some((it: any) => {
                            const prev = Number(it.quantityReceived || 0);
                            const current = Number(receivedQuantities[it.id] || 0);
                            const max = Number(it.quantity || 0);
                            return (prev + current) > max;
                          });

                          if (hasExcess) {
                            return <Badge variant="destructive">Divergência de Quantidade</Badge>;
                          }

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
                        const hasExcess = itemsWithPrices.some((it: any) => {
                          const prev = Number(it.quantityReceived || 0);
                          const current = Number(receivedQuantities[it.id] || 0);
                          const max = Number(it.quantity || 0);
                          return (prev + current) > max;
                        });

                        if (hasExcess) {
                          return (
                            <p className="text-xs text-red-600 mt-1 font-medium">
                              * Há itens com quantidade excedente. Corrija para prosseguir.
                            </p>
                          );
                        }

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
                  const hasAnyQty = Object.values(receivedQuantities).some(v => Number(v) > 0);
                  if (!hasAnyQty) {
                    return toast({ title: "Validação", description: "Informe as quantidades recebidas", variant: "destructive" });
                  }
                  confirmPhysicalMutation.mutate();
                  return;
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
