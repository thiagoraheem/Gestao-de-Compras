import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Separator } from "@/components/ui/separator";
import { Checkbox } from "@/components/ui/checkbox";
import { ScrollArea } from "@/components/ui/scroll-area";
import { 
  Search, 
  AlertTriangle, 
  CheckCircle, 
  XCircle, 
  RefreshCw, 
  Eye,
  Wrench,
  FileText,
  Info
} from "lucide-react";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

interface AuditIssue {
  type: string;
  severity: 'high' | 'medium' | 'low';
  description: string;
  quotationItemId?: number;
  purchaseRequestItemId?: number;
  quotationId?: number;
  data?: any;
}

interface AuditResults {
  requestId: number;
  requestNumber: string;
  issues: AuditIssue[];
  summary: {
    totalIssues: number;
    orphanedQuotationItems: number;
    missingReferences: number;
    valueDiscrepancies: number;
    quantityDiscrepancies: number;
  };
}

interface FixResults {
  requestId: number;
  requestNumber: string;
  dryRun: boolean;
  fixes: any[];
  summary: {
    totalFixes: number;
    orphanedItemsFixed: number;
    referencesFixed: number;
    quantitiesFixed: number;
    descriptionsFixed: number;
  };
}

interface DataAuditProps {
  requestId: number;
  requestNumber: string;
}

const SEVERITY_COLORS = {
  high: "destructive",
  medium: "default",
  low: "secondary"
} as const;

const ISSUE_TYPE_LABELS = {
  orphaned_quotation_item: "Item Órfão na Cotação",
  missing_reference: "Referência Perdida",
  quantity_discrepancy: "Divergência de Quantidade",
  description_discrepancy: "Divergência de Descrição",
  missing_quotation_item_reference: "Referência de Item Perdida",
  quotation_purchase_order_value_discrepancy: "Divergência: Valores dos Itens vs Cotação",
  quotation_purchase_order_total_discrepancy: "Divergência: Total do Pedido vs Cotação"
};

export default function DataAudit({ requestId, requestNumber }: DataAuditProps) {
  const { toast } = useToast();
  const [auditResults, setAuditResults] = useState<AuditResults | null>(null);
  const [fixResults, setFixResults] = useState<FixResults | null>(null);
  const [selectedFixTypes, setSelectedFixTypes] = useState<string[]>([]);
  const [showPreview, setShowPreview] = useState(false);

  const auditMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest(`/api/admin/purchase-requests/${requestId}/audit`);
      return response;
    },
    onSuccess: (data: AuditResults) => {
      setAuditResults(data);
      setFixResults(null);
      toast({
        title: "Auditoria Concluída",
        description: `Encontrados ${data.summary.totalIssues} problemas na solicitação`,
      });
    },
    onError: (error: any) => {
      toast({
        title: "Erro na Auditoria",
        description: error?.message || "Falha ao executar auditoria",
        variant: "destructive",
      });
    },
  });

  const fixMutation = useMutation({
    mutationFn: async ({ dryRun = false }: { dryRun?: boolean }) => {
      const response = await apiRequest(`/api/admin/purchase-requests/${requestId}/fix-data`, {
        method: "POST",
        body: {
          fixTypes: selectedFixTypes.length > 0 ? selectedFixTypes : ['all'],
          dryRun
        }
      });
      return response;
    },
    onSuccess: (data: FixResults) => {
      setFixResults(data);
      if (!data.dryRun) {
        toast({
          title: "Correções Aplicadas",
          description: `${data.summary.totalFixes} correções foram aplicadas com sucesso`,
        });
        // Re-run audit to see updated results
        auditMutation.mutate();
      } else {
        toast({
          title: "Prévia de Correções",
          description: `${data.summary.totalFixes} correções seriam aplicadas`,
        });
      }
    },
    onError: (error: any) => {
      toast({
        title: "Erro nas Correções",
        description: error?.message || "Falha ao executar correções",
        variant: "destructive",
      });
    },
  });

  const handleRunAudit = () => {
    auditMutation.mutate();
  };

  const handlePreviewFixes = () => {
    setShowPreview(true);
    fixMutation.mutate({ dryRun: true });
  };

  const handleApplyFixes = () => {
    fixMutation.mutate({ dryRun: false });
  };

  const handleFixTypeToggle = (fixType: string, checked: boolean) => {
    if (checked) {
      setSelectedFixTypes(prev => [...prev, fixType]);
    } else {
      setSelectedFixTypes(prev => prev.filter(type => type !== fixType));
    }
  };

  const getSeverityIcon = (severity: string) => {
    switch (severity) {
      case 'high':
        return <XCircle className="h-4 w-4 text-red-500" />;
      case 'medium':
        return <AlertTriangle className="h-4 w-4 text-yellow-500" />;
      case 'low':
        return <Info className="h-4 w-4 text-blue-500" />;
      default:
        return <Info className="h-4 w-4" />;
    }
  };

  const getAvailableFixTypes = () => {
    if (!auditResults) return [];
    
    const types = new Set<string>();
    auditResults.issues.forEach(issue => {
      types.add(issue.type);
    });
    
    return Array.from(types);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold">Auditoria de Dados</h3>
          <p className="text-sm text-gray-600">
            Verificar e corrigir inconsistências nos dados da solicitação {requestNumber}
          </p>
        </div>
        <Button 
          onClick={handleRunAudit} 
          disabled={auditMutation.isPending}
          variant="outline"
        >
          {auditMutation.isPending ? (
            <>
              <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
              Auditando...
            </>
          ) : (
            <>
              <Search className="h-4 w-4 mr-2" />
              Executar Auditoria
            </>
          )}
        </Button>
      </div>

      {/* Audit Results */}
      {auditResults && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              <span>Resultados da Auditoria</span>
              <Badge variant={auditResults.summary.totalIssues > 0 ? "destructive" : "default"}>
                {auditResults.summary.totalIssues} problemas encontrados
              </Badge>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Summary */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="text-center p-3 bg-red-50 rounded-lg">
                <div className="text-2xl font-bold text-red-600">
                  {auditResults.summary.orphanedQuotationItems}
                </div>
                <div className="text-sm text-red-700">Itens Órfãos</div>
              </div>
              <div className="text-center p-3 bg-orange-50 rounded-lg">
                <div className="text-2xl font-bold text-orange-600">
                  {auditResults.summary.missingReferences}
                </div>
                <div className="text-sm text-orange-700">Referências Perdidas</div>
              </div>
              <div className="text-center p-3 bg-yellow-50 rounded-lg">
                <div className="text-2xl font-bold text-yellow-600">
                  {auditResults.summary.quantityDiscrepancies}
                </div>
                <div className="text-sm text-yellow-700">Divergências Qtd</div>
              </div>
              <div className="text-center p-3 bg-blue-50 rounded-lg">
                <div className="text-2xl font-bold text-blue-600">
                  {auditResults.summary.valueDiscrepancies}
                </div>
                <div className="text-sm text-blue-700">Divergências Valor</div>
              </div>
            </div>

            {auditResults.summary.totalIssues === 0 ? (
              <Alert>
                <CheckCircle className="h-4 w-4" />
                <AlertDescription>
                  <strong>Parabéns!</strong> Nenhum problema de integridade foi encontrado nos dados desta solicitação.
                </AlertDescription>
              </Alert>
            ) : (
              <>
                <Separator />
                
                {/* Issues List */}
                <div className="space-y-3">
                  <h4 className="font-medium">Problemas Encontrados</h4>
                  <ScrollArea className="h-64">
                    <div className="space-y-2">
                      {auditResults.issues.map((issue, index) => (
                        <div key={index} className="flex items-start gap-3 p-3 border rounded-lg">
                          {getSeverityIcon(issue.severity)}
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-1">
                              <Badge variant={SEVERITY_COLORS[issue.severity]}>
                                {ISSUE_TYPE_LABELS[issue.type as keyof typeof ISSUE_TYPE_LABELS] || issue.type}
                              </Badge>
                              <Badge variant="outline">
                                {issue.severity.toUpperCase()}
                              </Badge>
                            </div>
                            <p className="text-sm text-gray-700">{issue.description}</p>
                            
                            {/* Special display for value discrepancies */}
                            {(issue.type === 'quotation_purchase_order_value_discrepancy' || 
                              issue.type === 'quotation_purchase_order_total_discrepancy') && issue.data && (
                              <div className="mt-2 p-3 bg-red-50 border border-red-200 rounded-lg">
                                <div className="text-sm font-medium text-red-800 mb-2">Detalhes da Divergência:</div>
                                <div className="grid grid-cols-2 gap-4 text-sm">
                                  <div>
                                    <span className="font-medium text-red-700">Valor da Cotação:</span>
                                    <div className="text-green-600 font-mono">
                                      R$ {issue.data.supplierQuotationTotal?.toFixed(4) || 'N/A'}
                                    </div>
                                  </div>
                                  <div>
                                    <span className="font-medium text-red-700">
                                      {issue.type === 'quotation_purchase_order_value_discrepancy' 
                                        ? 'Soma dos Itens:' 
                                        : 'Total do Pedido:'}
                                    </span>
                                    <div className="text-red-600 font-mono">
                                      R$ {(issue.data.purchaseOrderItemsTotal || issue.data.purchaseOrderTotal)?.toFixed(4) || 'N/A'}
                                    </div>
                                  </div>
                                </div>
                                <div className="mt-2 text-xs text-red-600">
                                  <strong>Diferença:</strong> R$ {issue.data.discrepancy?.toFixed(4) || 'N/A'}
                                </div>
                              </div>
                            )}
                            
                            {issue.data && 
                             issue.type !== 'quotation_purchase_order_value_discrepancy' && 
                             issue.type !== 'quotation_purchase_order_total_discrepancy' && (
                              <div className="mt-2 text-xs text-gray-500">
                                <details>
                                  <summary className="cursor-pointer">Ver detalhes</summary>
                                  <pre className="mt-1 p-2 bg-gray-50 rounded text-xs overflow-x-auto">
                                    {JSON.stringify(issue.data, null, 2)}
                                  </pre>
                                </details>
                              </div>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </ScrollArea>
                </div>

                <Separator />

                {/* Fix Options */}
                <div className="space-y-4">
                  <h4 className="font-medium">Opções de Correção</h4>
                  
                  <div className="space-y-2">
                    <div className="flex items-center space-x-2">
                      <Checkbox
                        id="fix-all"
                        checked={selectedFixTypes.length === 0}
                        onCheckedChange={(checked) => {
                          if (checked) {
                            setSelectedFixTypes([]);
                          }
                        }}
                      />
                      <label htmlFor="fix-all" className="text-sm font-medium">
                        Corrigir todos os problemas automaticamente
                      </label>
                    </div>
                    
                    {getAvailableFixTypes().map(fixType => (
                      <div key={fixType} className="flex items-center space-x-2 ml-6">
                        <Checkbox
                          id={`fix-${fixType}`}
                          checked={selectedFixTypes.includes(fixType)}
                          onCheckedChange={(checked) => handleFixTypeToggle(fixType, !!checked)}
                        />
                        <label htmlFor={`fix-${fixType}`} className="text-sm">
                          {ISSUE_TYPE_LABELS[fixType as keyof typeof ISSUE_TYPE_LABELS] || fixType}
                        </label>
                      </div>
                    ))}
                  </div>

                  <div className="flex gap-2">
                    <Button 
                      onClick={handlePreviewFixes}
                      disabled={fixMutation.isPending}
                      variant="outline"
                    >
                      {fixMutation.isPending && showPreview ? (
                        <>
                          <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                          Gerando Prévia...
                        </>
                      ) : (
                        <>
                          <Eye className="h-4 w-4 mr-2" />
                          Prévia das Correções
                        </>
                      )}
                    </Button>
                    
                    <Button 
                      onClick={handleApplyFixes}
                      disabled={fixMutation.isPending}
                      variant="default"
                    >
                      {fixMutation.isPending && !showPreview ? (
                        <>
                          <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                          Aplicando...
                        </>
                      ) : (
                        <>
                          <Wrench className="h-4 w-4 mr-2" />
                          Aplicar Correções
                        </>
                      )}
                    </Button>
                  </div>
                </div>
              </>
            )}
          </CardContent>
        </Card>
      )}

      {/* Fix Results */}
      {fixResults && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5" />
              {fixResults.dryRun ? "Prévia das Correções" : "Correções Aplicadas"}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <Alert>
              <Info className="h-4 w-4" />
              <AlertDescription>
                {fixResults.dryRun 
                  ? `${fixResults.summary.totalFixes} correções seriam aplicadas. Nenhuma alteração foi feita nos dados.`
                  : `${fixResults.summary.totalFixes} correções foram aplicadas com sucesso nos dados da solicitação.`
                }
              </AlertDescription>
            </Alert>

            {fixResults.fixes.length > 0 && (
              <div className="space-y-2">
                <h4 className="font-medium">Detalhes das Correções</h4>
                <ScrollArea className="h-48">
                  <div className="space-y-2">
                    {fixResults.fixes.map((fix, index) => (
                      <div key={index} className="p-3 border rounded-lg">
                        <div className="flex items-center gap-2 mb-1">
                          <Badge variant="outline">
                            {ISSUE_TYPE_LABELS[fix.type as keyof typeof ISSUE_TYPE_LABELS] || fix.type}
                          </Badge>
                          <Badge variant={fixResults.dryRun ? "secondary" : "default"}>
                            {fixResults.dryRun ? "PRÉVIA" : "APLICADO"}
                          </Badge>
                        </div>
                        <p className="text-sm text-gray-700">{fix.description}</p>
                      </div>
                    ))}
                  </div>
                </ScrollArea>
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
