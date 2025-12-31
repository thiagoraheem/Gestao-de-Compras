import React from "react";
import { useReceipt } from "./ReceiptContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Table, TableHeader, TableRow, TableHead, TableBody, TableCell } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";

export function ReceiptItems() {
  const {
    receiptType,
    manualItems, setManualItems,
    setManualTotal,
    purchaseOrder,
    itemsWithPrices,
    receivedQuantities, setReceivedQuantities,
  } = useReceipt();
  
  const { user } = useAuth();
  const { toast } = useToast();

  const isReceiver = !!user?.isReceiver || !!user?.isAdmin;

  return (
    <div className="space-y-6">
      {receiptType === "avulso" && (
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
      )}

      {receiptType !== "avulso" && isReceiver && (
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
      )}
    </div>
  );
}
