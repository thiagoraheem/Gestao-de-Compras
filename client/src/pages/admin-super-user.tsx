import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Calendar, Search, Save, RefreshCw, AlertTriangle, Shield } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import DataAudit from "@/components/data-audit";
import { PHASE_OPTIONS, CATEGORY_OPTIONS, URGENCY_OPTIONS } from "./admin-super-user-constants";

export default function AdminSuperUserPage() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [searchNumber, setSearchNumber] = useState("");
  const [currentRequest, setCurrentRequest] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [formData, setFormData] = useState<any>({});

  const searchMutation = useMutation({
    mutationFn: async (requestNumber: string) => {
      const response = await apiRequest(`/api/admin/purchase-requests/search/${encodeURIComponent(requestNumber)}`);
      return response;
    },
    onSuccess: (data) => {
      // Debug: Log dos dados recebidos do backend
      console.log('AdminSuperUser - Dados recebidos do backend:', {
        category: data.category,
        urgency: data.urgency,
        allData: data
      });
      
      setCurrentRequest(data);
      const newFormData = {
        category: data.category || "",
        urgency: data.urgency || "",
        justification: data.justification || "",
        idealDeliveryDate: data.idealDeliveryDate ? format(new Date(data.idealDeliveryDate), "yyyy-MM-dd") : "",
        availableBudget: data.availableBudget || "",
        additionalInfo: data.additionalInfo || "",
        currentPhase: data.currentPhase || "",
        items: data.items || []
      };
      
      // Debug: Log dos dados que serão definidos no formData
      console.log('AdminSuperUser - FormData que será definido:', {
        category: newFormData.category,
        urgency: newFormData.urgency,
        formData: newFormData
      });
      
      setFormData(newFormData);
      toast({
        title: "Sucesso",
        description: "Solicitação encontrada e carregada para edição",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Erro",
        description: error?.message || "Solicitação não encontrada",
        variant: "destructive",
      });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async (data: any) => {
      const response = await apiRequest(`/api/admin/purchase-requests/${currentRequest.id}`, {
        method: "PATCH",
        body: data,
      });
      return response;
    },
    onSuccess: () => {
      // Atualiza o estado local para refletir as mudanças imediatamente na UI (ex: badge no cabeçalho)
      setCurrentRequest((prev: any) => ({
        ...prev,
        ...formData
      }));

      toast({
        title: "Sucesso",
        description: "Solicitação atualizada com sucesso",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/purchase-requests"] });
    },
    onError: (error: any) => {
      toast({
        title: "Erro",
        description: error?.message || "Falha ao atualizar solicitação",
        variant: "destructive",
      });
    },
  });

  const handleSearch = () => {
    if (!searchNumber.trim()) {
      toast({
        title: "Erro",
        description: "Informe o número da solicitação",
        variant: "destructive",
      });
      return;
    }
    searchMutation.mutate(searchNumber.trim());
  };

  const handleSave = () => {
    if (!currentRequest) return;
    
    updateMutation.mutate({
      ...formData,
      availableBudget: formData.availableBudget ? parseFloat(formData.availableBudget) : null,
      idealDeliveryDate: formData.idealDeliveryDate || null,
    });
  };

  const updateItem = (index: number, field: string, value: string) => {
    const updatedItems = [...formData.items];
    updatedItems[index] = { ...updatedItems[index], [field]: value };
    setFormData({ ...formData, items: updatedItems });
  };

  const addItem = () => {
    const newItem = {
      description: "",
      unit: "",
      requestedQuantity: "1",
      technicalSpecification: ""
    };
    setFormData({ 
      ...formData, 
      items: [...(formData.items || []), newItem] 
    });
  };

  const removeItem = (index: number) => {
    const updatedItems = formData.items.filter((_: any, i: number) => i !== index);
    setFormData({ ...formData, items: updatedItems });
  };

  return (
    <div className="h-full overflow-y-auto">
    <div className="container mx-auto p-6 space-y-6 min-h-screen overflow-y-auto bg-background" data-testid="admin-super-user-page">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-foreground" data-testid="page-title">
            Super Usuário - Edição de Solicitações
          </h1>
          <p className="text-muted-foreground mt-2">
            Ferramenta administrativa para edição completa de solicitações de compra
          </p>
        </div>
        <div className="flex items-center gap-2">
          <AlertTriangle className="h-5 w-5 text-amber-500" />
          <span className="text-sm text-amber-600 dark:text-amber-400 font-medium">Acesso Restrito</span>
        </div>
      </div>

      <Alert>
        <AlertTriangle className="h-4 w-4" />
        <AlertDescription>
          <strong>Atenção:</strong> Esta área permite alterações completas nas solicitações, incluindo mudanças de fase. 
          Use com cuidado pois as alterações são irreversíveis.
        </AlertDescription>
      </Alert>

      {/* Search Section */}
      <Card data-testid="search-section">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Search className="h-5 w-5" />
            Buscar Solicitação
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex gap-4">
            <div className="flex-1">
              <Label htmlFor="searchNumber">Número da Solicitação</Label>
              <Input
                id="searchNumber"
                data-testid="input-search-number"
                placeholder="Ex: SOL-2024-001"
                value={searchNumber}
                onChange={(e) => setSearchNumber(e.target.value)}
                onKeyPress={(e) => e.key === "Enter" && handleSearch()}
              />
            </div>
            <div className="flex items-end">
              <Button 
                onClick={handleSearch} 
                disabled={searchMutation.isPending}
                data-testid="button-search"
              >
                {searchMutation.isPending ? (
                  <>
                    <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                    Buscando...
                  </>
                ) : (
                  <>
                    <Search className="h-4 w-4 mr-2" />
                    Buscar
                  </>
                )}
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Request Details Section */}
      {currentRequest && (
        <Card data-testid="request-details">
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              <span>Solicitação {currentRequest.requestNumber}</span>
              <div className="flex items-center gap-2">
                <Badge variant="outline" data-testid="current-phase-badge">
                  {PHASE_OPTIONS.find(p => p.value === currentRequest.currentPhase)?.label || currentRequest.currentPhase}
                </Badge>
                <Badge variant="secondary" data-testid="created-date-badge">
                  <Calendar className="h-3 w-3 mr-1" />
                  {format(new Date(currentRequest.createdAt), "dd/MM/yyyy", { locale: ptBR })}
                </Badge>
              </div>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Tabs defaultValue="edit" className="w-full">
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="edit" className="flex items-center gap-2">
                  <Save className="h-4 w-4" />
                  Editar Solicitação
                </TabsTrigger>
                <TabsTrigger value="audit" className="flex items-center gap-2">
                  <Shield className="h-4 w-4" />
                  Auditoria de Dados
                </TabsTrigger>
              </TabsList>
              
              <TabsContent value="edit" className="space-y-6 mt-6">
            {/* Request Info */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label>Solicitante</Label>
                <Input
                  value={currentRequest.requester ? `${currentRequest.requester.firstName} ${currentRequest.requester.lastName}` : "N/A"}
                  disabled
                  data-testid="requester-name"
                />
              </div>
              <div>
                <Label>Centro de Custo</Label>
                <Input
                  value={currentRequest.costCenter ? `${currentRequest.costCenter.code} - ${currentRequest.costCenter.name}` : "N/A"}
                  disabled
                  data-testid="cost-center"
                />
              </div>
            </div>

            <Separator />

            {/* Editable Fields */}
            <div className="space-y-4">
              <h3 className="text-lg font-semibold">Dados Editáveis</h3>
              
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <Label htmlFor="category">Categoria</Label>
                  <Select value={formData.category} onValueChange={(value) => setFormData({...formData, category: value})}>
                    <SelectTrigger data-testid="select-category">
                      <SelectValue placeholder="Selecione..." />
                    </SelectTrigger>
                    <SelectContent>
                      {CATEGORY_OPTIONS.map(option => (
                        <SelectItem key={option.value} value={option.value}>
                          {option.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label htmlFor="urgency">Urgência</Label>
                  <Select value={formData.urgency} onValueChange={(value) => setFormData({...formData, urgency: value})}>
                    <SelectTrigger data-testid="select-urgency">
                      <SelectValue placeholder="Selecione..." />
                    </SelectTrigger>
                    <SelectContent>
                      {URGENCY_OPTIONS.map(option => (
                        <SelectItem key={option.value} value={option.value}>
                          {option.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label htmlFor="currentPhase">Fase Atual</Label>
                  <Select value={formData.currentPhase} onValueChange={(value) => setFormData({...formData, currentPhase: value})}>
                    <SelectTrigger data-testid="select-phase">
                      <SelectValue placeholder="Selecione..." />
                    </SelectTrigger>
                    <SelectContent>
                      {PHASE_OPTIONS.map(option => (
                        <SelectItem key={option.value} value={option.value}>
                          {option.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="idealDeliveryDate">Data Ideal de Entrega</Label>
                  <Input
                    id="idealDeliveryDate"
                    type="date"
                    data-testid="input-delivery-date"
                    value={formData.idealDeliveryDate}
                    onChange={(e) => setFormData({...formData, idealDeliveryDate: e.target.value})}
                  />
                </div>

                <div>
                  <Label htmlFor="availableBudget">Orçamento Disponível (R$)</Label>
                  <Input
                    id="availableBudget"
                    type="number"
                    step="0.01"
                    data-testid="input-budget"
                    placeholder="0.00"
                    value={formData.availableBudget}
                    onChange={(e) => setFormData({...formData, availableBudget: e.target.value})}
                  />
                </div>
              </div>

              <div>
                <Label htmlFor="justification">Justificativa</Label>
                <Textarea
                  id="justification"
                  data-testid="textarea-justification"
                  value={formData.justification}
                  onChange={(e) => setFormData({...formData, justification: e.target.value})}
                  rows={3}
                />
              </div>

              <div>
                <Label htmlFor="additionalInfo">Informações Adicionais</Label>
                <Textarea
                  id="additionalInfo"
                  data-testid="textarea-additional-info"
                  value={formData.additionalInfo}
                  onChange={(e) => setFormData({...formData, additionalInfo: e.target.value})}
                  rows={3}
                />
              </div>
            </div>

            <Separator />

            {/* Items Section */}
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-semibold">Itens da Solicitação</h3>
                <Button onClick={addItem} variant="outline" size="sm" data-testid="button-add-item">
                  Adicionar Item
                </Button>
              </div>

              {formData.items?.map((item: any, index: number) => (
                <Card key={index} className="p-4">
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="font-medium">Item {index + 1}</span>
                      <Button 
                        onClick={() => removeItem(index)} 
                        variant="destructive" 
                        size="sm"
                        data-testid={`button-remove-item-${index}`}
                      >
                        Remover
                      </Button>
                    </div>
                    
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                      <div>
                        <Label>Descrição</Label>
                        <Input
                          value={item.description || ""}
                          onChange={(e) => updateItem(index, "description", e.target.value)}
                          data-testid={`input-item-description-${index}`}
                        />
                      </div>
                      
                      <div>
                        <Label>Unidade</Label>
                        <Input
                          value={item.unit || ""}
                          onChange={(e) => updateItem(index, "unit", e.target.value)}
                          data-testid={`input-item-unit-${index}`}
                        />
                      </div>
                      
                      <div>
                        <Label>Quantidade</Label>
                        <Input
                          type="number"
                          step="0.01"
                          value={item.requestedQuantity || ""}
                          onChange={(e) => updateItem(index, "requestedQuantity", e.target.value)}
                          data-testid={`input-item-quantity-${index}`}
                        />
                      </div>
                    </div>
                    
                    <div>
                      <Label>Especificação Técnica</Label>
                      <Textarea
                        value={item.technicalSpecification || ""}
                        onChange={(e) => updateItem(index, "technicalSpecification", e.target.value)}
                        rows={2}
                        data-testid={`textarea-item-spec-${index}`}
                      />
                    </div>
                  </div>
                </Card>
              ))}
            </div>

            <Separator />

                {/* Save Button */}
                <div className="flex justify-end">
                  <Button 
                    onClick={handleSave} 
                    disabled={updateMutation.isPending}
                    data-testid="button-save"
                  >
                    {updateMutation.isPending ? (
                      <>
                        <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                        Salvando...
                      </>
                    ) : (
                      <>
                        <Save className="h-4 w-4 mr-2" />
                        Salvar Alterações
                      </>
                    )}
                  </Button>
                </div>
              </TabsContent>
              
              <TabsContent value="audit" className="mt-6">
                <DataAudit 
                  requestId={currentRequest.id}
                  requestNumber={currentRequest.requestNumber}
                />
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>
      )}
    </div>
    </div>
  );
}
