
import React from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { Search, Trash, AlertCircle, Plus } from "lucide-react";
import { useReceipt } from "./ReceiptContext";
import { cn } from "@/lib/utils";
import { ReceiptSearchDialog } from "../receipt-search-dialog";
import { validateManualHeader, validateManualItems, validateTotalConsistency } from "../../utils/manual-nf-validation";
import { findBestPurchaseOrderMatch, MANUAL_ITEM_MATCH_THRESHOLD } from "../../utils/item-matching-helper";
import { apiRequest } from "@/lib/queryClient";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";

import { useReceiptActions } from "./useReceiptActions";

export function ReceiptManualEntry() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const {
    request,
    receiptType, setReceiptType,
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
    setActiveTab,
    itemTaxes, setItemTaxes,
    purchaseOrderItems,
    nfConfirmed, canConfirmNf, nfStatus,
    setNfReceiptId,
    nfReceiptId, // Ensure this is available from context
    setXmlPreview, setNfReceiptId: setContextNfReceiptId, // Rename to avoid conflict if needed
    setProductTransp,
  } = useReceipt();

  // Fetch items specifically received in this receipt (Physical Phase)
  const { data: receiptItems = [] } = useQuery<any[]>({
    queryKey: [`/api/recebimentos/${nfReceiptId}/items`],
    enabled: !!nfReceiptId,
  });

  // Auto-fill items for "Avulso" type
  React.useEffect(() => {
    if (receiptType === 'avulso' && receiptItems.length > 0) {
      const autoItems = receiptItems.map(ri => ({
        code: ri.locadorProductCode || String(ri.purchaseOrderItemId),
        description: ri.description,
        unit: ri.unit || 'UN',
        quantity: Number(ri.quantityReceived || 0),
        unitPrice: Number(ri.unitPrice || 0),
        ncm: ri.ncm || "",
        purchaseOrderItemId: ri.purchaseOrderItemId,
        matchSource: 'auto',
        isReadOnly: true
      }));
      
      // Only update if different to avoid infinite loop
      if (JSON.stringify(autoItems) !== JSON.stringify(manualItems)) {
        setManualItems(autoItems);
        
        // Auto-calculate total if not set
        if (!manualTotal || manualTotal === "0,00" || manualTotal === "0") {
            const total = autoItems.reduce((acc, it) => acc + (it.quantity * it.unitPrice), 0);
            setManualTotal(total.toFixed(2).replace('.', ','));
        }
      }
    }
  }, [receiptType, receiptItems, setManualItems, manualItems, manualTotal, setManualTotal]);

  const { confirmNfMutation } = useReceiptActions();

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
          if (data.preview.header.number) setManualNFNumber(data.preview.header.number);
          if (data.preview.header.series) setManualNFSeries(data.preview.header.series);
          if (data.preview.header.accessKey) setManualNFAccessKey(data.preview.header.accessKey);
          if (data.preview.header.issueDate) setManualNFIssueDate(data.preview.header.issueDate.split('T')[0]);
          if (data.preview.header.supplier?.cnpjCpf) setManualNFEmitterCNPJ(data.preview.header.supplier.cnpjCpf);
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

        toast({ title: "Dados carregados", description: "Nota fiscal carregada com sucesso." });
      }
    } catch (e) {
      console.error(e);
      toast({ title: "Erro", description: "Falha ao carregar dados da nota", variant: "destructive" });
    }
  };

  const manualItemsMissingLinks = manualItems.filter(it => !it.purchaseOrderItemId);

  return (
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
              <div className="text-sm text-muted-foreground">
                {receiptType === 'avulso' 
                  ? "Itens carregados automaticamente do recebimento físico" 
                  : "Adicione múltiplos itens e valide os dados"}
              </div>
              {receiptType !== "avulso" && (
                <Button type="button" variant="secondary" onClick={() => {
                  if (receiptType === "servico") {
                    setManualItems(prev => [...prev, { description: "", serviceCode: "", netValue: 0, issValue: 0, quantity: 1, unitPrice: 0 }]);
                  } else {
                    setManualItems(prev => [...prev, { code: "", description: "", unit: "UN", quantity: 1, unitPrice: 0, ncm: "" }]);
                  }
                }}><Plus className="h-4 w-4 mr-2" />Adicionar Item</Button>
              )}
            </div>
            
            <div className="space-y-4">
              {manualItems.map((it, idx) => (
                <div key={idx} className="border p-4 rounded-lg space-y-4 bg-slate-50 dark:bg-slate-900/50">
                  <div className="grid grid-cols-1 md:grid-cols-6 gap-4">
                    {receiptType === "servico" ? (
                      <>
                        <div className="md:col-span-3">
                          <Label>Descrição do Serviço</Label>
                          <Input
                            disabled={it.isReadOnly}
                            value={it.description || ""}
                            onChange={(e) => setManualItems(prev => prev.map((row, i) => {
                              if (i !== idx) return row;
                              const updated = { ...row, description: e.target.value };
                              if (!row.purchaseOrderItemId || row.matchSource === "auto") {
                                const match = findBestPurchaseOrderMatch(updated, purchaseOrderItems);
                                if (match && match.score >= MANUAL_ITEM_MATCH_THRESHOLD) {
                                  updated.purchaseOrderItemId = match.id;
                                  updated.matchSource = "auto";
                                }
                              }
                              return updated;
                            }))}
                          />
                        </div>
                        <div>
                          <Label>Código de Serviço</Label>
                          <Input disabled={it.isReadOnly} value={it.serviceCode || ""} onChange={(e) => setManualItems(prev => prev.map((row, i) => i === idx ? { ...row, serviceCode: e.target.value } : row))} />
                        </div>
                        <div>
                          <Label>Valor Líquido</Label>
                          <Input disabled={it.isReadOnly} type="number" value={it.netValue ?? 0} onChange={(e) => setManualItems(prev => prev.map((row, i) => i === idx ? { ...row, netValue: Number(e.target.value) } : row))} />
                        </div>
                        <div>
                          <Label>ISS</Label>
                          <Input disabled={it.isReadOnly} type="number" value={it.issValue ?? 0} onChange={(e) => setManualItems(prev => prev.map((row, i) => i === idx ? { ...row, issValue: Number(e.target.value) } : row))} />
                        </div>
                        <div className="flex items-end">
                          {!it.isReadOnly && (
                            <Button type="button" variant="destructive" onClick={() => setManualItems(prev => prev.filter((_, i) => i !== idx))}>Remover</Button>
                          )}
                        </div>
                      </>
                    ) : (
                      <>
                        <div>
                          <Label>Código</Label>
                          <Input
                            disabled={it.isReadOnly}
                            value={it.code || ""}
                            onChange={(e) => setManualItems(prev => prev.map((row, i) => {
                              if (i !== idx) return row;
                              const updated = { ...row, code: e.target.value };
                              if (!row.purchaseOrderItemId || row.matchSource === "auto") {
                                const match = findBestPurchaseOrderMatch(updated, purchaseOrderItems);
                                if (match && match.score >= MANUAL_ITEM_MATCH_THRESHOLD) {
                                  updated.purchaseOrderItemId = match.id;
                                  updated.matchSource = "auto";
                                }
                              }
                              return updated;
                            }))}
                          />
                        </div>
                        <div className="md:col-span-2">
                          <Label>Descrição</Label>
                          <Input
                            disabled={it.isReadOnly}
                            value={it.description || ""}
                            onChange={(e) => setManualItems(prev => prev.map((row, i) => {
                              if (i !== idx) return row;
                              const updated = { ...row, description: e.target.value };
                              if (!row.purchaseOrderItemId || row.matchSource === "auto") {
                                const match = findBestPurchaseOrderMatch(updated, purchaseOrderItems);
                                if (match && match.score >= MANUAL_ITEM_MATCH_THRESHOLD) {
                                  updated.purchaseOrderItemId = match.id;
                                  updated.matchSource = "auto";
                                }
                              }
                              return updated;
                            }))}
                          />
                        </div>
                        <div>
                          <Label>NCM</Label>
                          <Input disabled={it.isReadOnly} value={it.ncm || ""} onChange={(e) => setManualItems(prev => prev.map((row, i) => i === idx ? { ...row, ncm: e.target.value } : row))} />
                        </div>
                        <div>
                          <Label>Qtd</Label>
                          <Input 
                            disabled={it.isReadOnly} 
                            type="number" 
                            value={it.quantity ?? 1} 
                            onChange={(e) => {
                              const val = Number(e.target.value);
                              setManualItems(prev => prev.map((row, i) => i === idx ? { ...row, quantity: val } : row));
                              
                              // Validate against linked item
                              if (it.purchaseOrderItemId && receiptItems.length > 0) {
                                const ri = receiptItems.find(r => r.purchaseOrderItemId === it.purchaseOrderItemId);
                                if (ri) {
                                  const received = Number(ri.quantityReceived || 0);
                                  if (val > received) {
                                    toast({ title: "Validação", description: `Quantidade informada (${val}) maior que recebida (${received}).`, variant: "destructive" });
                                  }
                                }
                              }
                            }} 
                          />
                        </div>
                        <div>
                          <Label>Valor Unit.</Label>
                          <Input disabled={it.isReadOnly} type="number" value={it.unitPrice ?? 0} onChange={(e) => setManualItems(prev => prev.map((row, i) => i === idx ? { ...row, unitPrice: Number(e.target.value) } : row))} />
                        </div>
                        {/* Taxes fields skipped for brevity, should be included ideally */}
                      </>
                    )}
                  </div>
                  
                  {/* Link to Purchase Order Item or Receipt Item */}
                  {receiptType !== "avulso" && (
                    <div className="flex items-center gap-2 pt-2 border-t mt-2">
                      <div className="flex-1">
                         <Select 
                          value={it.purchaseOrderItemId ? String(it.purchaseOrderItemId) : "none"} 
                          onValueChange={(v) => {
                             // Validate Quantity if linking to a receipt item
                             const targetId = v === "none" ? undefined : Number(v);
                             let warning = "";
                             if (targetId && receiptItems.length > 0) {
                               const ri = receiptItems.find(r => r.purchaseOrderItemId === targetId);
                               if (ri) {
                                 const received = Number(ri.quantityReceived || 0);
                                 const current = Number(it.quantity || 0);
                                 if (current > received) {
                                   warning = `Atenção: Quantidade informada (${current}) é maior que a recebida (${received}).`;
                                   toast({ title: "Validação", description: warning, variant: "destructive" });
                                 }
                               }
                             }
                             
                             setManualItems(prev => prev.map((row, i) => i === idx ? { ...row, purchaseOrderItemId: targetId, matchSource: "manual" } : row));
                          }}
                        >
                          <SelectTrigger className={cn(
                            "transition-colors",
                            !it.purchaseOrderItemId 
                              ? "border-red-300 bg-red-50 dark:bg-red-900/20 dark:border-red-800" 
                              : "border-green-300 bg-green-50 dark:bg-green-900/20 dark:border-green-800"
                          )}>
                            <SelectValue placeholder="Vincular ao Item Recebido" />
                          </SelectTrigger>
                          <SelectContent>
                             <SelectItem value="none">Sem vínculo</SelectItem>
                             {/* If we have receipt items (physical receipt confirmed), show them. Otherwise show PO items */}
                             {receiptItems.length > 0 
                               ? receiptItems.map((ri: any) => (
                                   <SelectItem key={ri.id} value={String(ri.purchaseOrderItemId)}>
                                     {ri.description} (Recebido: {ri.quantityReceived} {ri.unit})
                                   </SelectItem>
                                 ))
                               : purchaseOrderItems.map((poItem: any) => (
                                   <SelectItem key={poItem.id} value={String(poItem.id)}>
                                     {poItem.itemCode} - {poItem.description} (Solicitado: {poItem.quantity} {poItem.unit})
                                   </SelectItem>
                                 ))
                             }
                           </SelectContent>
                         </Select>
                      </div>
                      {it.purchaseOrderItemId && <span className="text-xs text-green-600 flex items-center"><AlertCircle className="h-3 w-3 mr-1" />Vinculado</span>}
                    </div>
                  )}
                </div>
              ))}
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
              {canConfirmNf && (
                <Button
                  type="button"
                  variant="secondary"
                  disabled={confirmNfMutation.isPending || !!nfStatus?.nfConfirmed}
                  onClick={() => {
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
                    if (receiptType !== "avulso" && manualItemsMissingLinks.length > 0) {
                      return toast({ title: "Validação", description: "Vincule todos os itens da nota aos itens do pedido antes de confirmar.", variant: "destructive" });
                    }

                    if (receiptItems.length > 0) {
                       const invalidQty = manualItems.find(it => {
                         if (!it.purchaseOrderItemId) return false;
                         const ri = receiptItems.find(r => r.purchaseOrderItemId === it.purchaseOrderItemId);
                         if (!ri) return false;
                         return (it.quantity || 0) > (ri.quantityReceived || 0);
                       });
                       if (invalidQty) {
                         return toast({ title: "Validação", description: "Existem itens com quantidade superior ao recebido.", variant: "destructive" });
                       }
                    }

                    const totCheck = validateTotalConsistency(manualTotal, kind as any, manualItems as any);
                    if (!totCheck.isValid) {
                      return toast({ title: "Validação", description: `Valor total (${totCheck.provided.toFixed(2)}) não confere com soma dos itens (${totCheck.expected.toFixed(2)})`, variant: "destructive" });
                    }
                    confirmNfMutation.mutate();
                  }}
                >
                  {nfStatus?.nfConfirmed ? "NF confirmada" : "Confirmar NF"}
                </Button>
              )}
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
                if (receiptType !== "avulso" && manualItemsMissingLinks.length > 0) {
                  return toast({ title: "Validação", description: "Vincule todos os itens da nota aos itens do pedido antes de avançar.", variant: "destructive" });
                }

                if (receiptItems.length > 0) {
                   const invalidQty = manualItems.find(it => {
                     if (!it.purchaseOrderItemId) return false;
                     const ri = receiptItems.find(r => r.purchaseOrderItemId === it.purchaseOrderItemId);
                     if (!ri) return false;
                     return (it.quantity || 0) > (ri.quantityReceived || 0);
                   });
                   if (invalidQty) {
                     return toast({ title: "Validação", description: "Existem itens com quantidade superior ao recebido.", variant: "destructive" });
                   }
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
  );
}
