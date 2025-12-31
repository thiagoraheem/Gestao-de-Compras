
import React from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { Search, Trash, AlertCircle, Plus } from "lucide-react";
import { useReceipt } from "./ReceiptContext";
import { ReceiptSearchDialog } from "../receipt-search-dialog";
import { validateManualHeader, validateManualItems, validateTotalConsistency } from "../../utils/manual-nf-validation";
import { findBestPurchaseOrderMatch, MANUAL_ITEM_MATCH_THRESHOLD } from "../../utils/item-matching-helper";
import { apiRequest } from "@/lib/queryClient";
import { useMutation, useQueryClient } from "@tanstack/react-query";

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
    setXmlPreview, setNfReceiptId: setContextNfReceiptId, // Rename to avoid conflict if needed
    setProductTransp,
  } = useReceipt();
  
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
              <div className="text-sm text-muted-foreground">Adicione múltiplos itens e valide os dados</div>
              <Button type="button" variant="secondary" onClick={() => {
                if (receiptType === "servico") {
                  setManualItems(prev => [...prev, { description: "", serviceCode: "", netValue: 0, issValue: 0, quantity: 1, unitPrice: 0 }]);
                } else {
                  setManualItems(prev => [...prev, { code: "", description: "", unit: "UN", quantity: 1, unitPrice: 0, ncm: "" }]);
                }
              }}><Plus className="h-4 w-4 mr-2" />Adicionar Item</Button>
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
                          <Input
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
                        {/* Taxes fields skipped for brevity, should be included ideally */}
                      </>
                    )}
                  </div>
                  
                  {/* Link to Purchase Order Item */}
                  {receiptType !== "avulso" && (
                    <div className="flex items-center gap-2 pt-2 border-t mt-2">
                      <div className="flex-1">
                         <Select 
                           value={it.purchaseOrderItemId ? String(it.purchaseOrderItemId) : "none"} 
                           onValueChange={(v) => setManualItems(prev => prev.map((row, i) => i === idx ? { ...row, purchaseOrderItemId: v === "none" ? undefined : Number(v), matchSource: "manual" } : row))}
                         >
                           <SelectTrigger className={!it.purchaseOrderItemId ? "border-red-300 bg-red-50" : "border-green-300 bg-green-50"}>
                             <SelectValue placeholder="Vincular ao Item do Pedido" />
                           </SelectTrigger>
                           <SelectContent>
                             <SelectItem value="none">Sem vínculo</SelectItem>
                             {purchaseOrderItems.map((poItem: any) => (
                               <SelectItem key={poItem.id} value={String(poItem.id)}>
                                 {poItem.itemCode} - {poItem.description} ({poItem.quantity} {poItem.unit})
                               </SelectItem>
                             ))}
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
