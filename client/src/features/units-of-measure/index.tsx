import React, { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/shared/ui/button";
import { Input } from "@/shared/ui/input";
import { Badge } from "@/shared/ui/badge";
import { Switch } from "@/shared/ui/switch";
import { Label } from "@/shared/ui/label";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/shared/ui/table";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/shared/ui/card";
import { Ruler, Plus, Search, Edit2, Trash2, CheckCircle2, XCircle } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import type { UnitOfMeasure } from "@shared/schema";
import { UnitOfMeasureFormModal, UnitFormData } from "./components/UnitOfMeasureFormModal";

export default function UnitsOfMeasureManagement() {
  const [searchTerm, setSearchTerm] = useState("");
  const [showInactive, setShowInactive] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingUnit, setEditingUnit] = useState<UnitOfMeasure | null>(null);

  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Query units from backend API
  const { data: units = [], isLoading, isError } = useQuery<UnitOfMeasure[]>({
    queryKey: ["/api/units-of-measure", { includeInactive: true }],
    queryFn: () => apiRequest("/api/units-of-measure?includeInactive=true"),
  });

  // Create Mutation
  const createMutation = useMutation({
    mutationFn: (data: UnitFormData) =>
      apiRequest("/api/units-of-measure", { method: "POST", body: data }),
    onSuccess: (data) => {
      toast({
        title: "Sucesso",
        description: `Unidade de medida "${data.code}" cadastrada com sucesso!`,
      });
      queryClient.invalidateQueries({ queryKey: ["/api/units-of-measure"] });
      setIsModalOpen(false);
    },
    onError: (error: any) => {
      toast({
        title: "Erro ao cadastrar",
        description: error.message || "Não foi possível cadastrar a unidade de medida",
        variant: "destructive",
      });
    },
  });

  // Update Mutation
  const updateMutation = useMutation({
    mutationFn: ({ code, data }: { code: string; data: Partial<UnitFormData> }) =>
      apiRequest(`/api/units-of-measure/${code}`, { method: "PUT", body: data }),
    onSuccess: (data) => {
      toast({
        title: "Sucesso",
        description: `Unidade de medida "${data.code}" atualizada com sucesso!`,
      });
      queryClient.invalidateQueries({ queryKey: ["/api/units-of-measure"] });
      setIsModalOpen(false);
      setEditingUnit(null);
    },
    onError: (error: any) => {
      toast({
        title: "Erro ao atualizar",
        description: error.message || "Não foi possível atualizar a unidade de medida",
        variant: "destructive",
      });
    },
  });

  // Toggle Active Mutation
  const toggleActiveMutation = useMutation({
    mutationFn: ({ code, active }: { code: string; active: boolean }) =>
      apiRequest(`/api/units-of-measure/${code}`, { method: "PUT", body: { active } }),
    onSuccess: (data) => {
      toast({
        title: "Status Atualizado",
        description: `Unidade "${data.code}" ${data.active ? "ativada" : "desativada"} com sucesso.`,
      });
      queryClient.invalidateQueries({ queryKey: ["/api/units-of-measure"] });
    },
    onError: (error: any) => {
      toast({
        title: "Erro ao alterar status",
        description: error.message || "Não foi possível alterar o status",
        variant: "destructive",
      });
    },
  });

  // Handle Modal Submit
  const handleFormSubmit = (data: UnitFormData) => {
    if (editingUnit) {
      updateMutation.mutate({ code: editingUnit.code, data: { description: data.description, active: data.active } });
    } else {
      createMutation.mutate(data);
    }
  };

  const handleOpenCreateModal = () => {
    setEditingUnit(null);
    setIsModalOpen(true);
  };

  const handleOpenEditModal = (unit: UnitOfMeasure) => {
    setEditingUnit(unit);
    setIsModalOpen(true);
  };

  // Filter units by search term and active flag
  const filteredUnits = units.filter((unit) => {
    const matchesSearch =
      unit.code.toLowerCase().includes(searchTerm.toLowerCase()) ||
      unit.description.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesActive = showInactive ? true : unit.active;
    return matchesSearch && matchesActive;
  });

  return (
    <div className="container mx-auto p-4 md:p-6 space-y-6 max-w-7xl">
      {/* Header section */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold tracking-tight text-slate-900 dark:text-slate-100 flex items-center gap-2">
            <Ruler className="h-7 w-7 text-primary" />
            Unidades de Medida
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Gerencie os tipos e siglas de unidades de medida disponíveis para solicitação e compra de materiais.
          </p>
        </div>
        <Button onClick={handleOpenCreateModal} className="flex items-center gap-2 self-start sm:self-auto">
          <Plus className="h-4 w-4" />
          Nova Unidade
        </Button>
      </div>

      {/* Filter and Content Card */}
      <Card className="border border-slate-200 dark:border-slate-800 shadow-sm">
        <CardHeader className="pb-4">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div className="relative flex-1 max-w-md">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar por código ou descrição..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-9"
              />
            </div>
            <div className="flex items-center space-x-2">
              <Switch
                id="show-inactive"
                checked={showInactive}
                onCheckedChange={setShowInactive}
              />
              <Label htmlFor="show-inactive" className="text-sm cursor-pointer">
                Mostrar unidades inativas
              </Label>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="text-center py-12 text-muted-foreground">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-3"></div>
              Carregando unidades de medida...
            </div>
          ) : isError ? (
            <div className="text-center py-12 text-red-500">
              Erro ao carregar unidades de medida. Por favor, tente novamente.
            </div>
          ) : filteredUnits.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <Ruler className="h-12 w-12 mx-auto mb-3 opacity-40" />
              <p className="font-medium text-base">Nenhuma unidade de medida encontrada</p>
              <p className="text-sm mt-1">
                {searchTerm
                  ? "Tente ajustar os termos da sua pesquisa."
                  : "Clique em 'Nova Unidade' para realizar o primeiro cadastro."}
              </p>
            </div>
          ) : (
            <div className="rounded-md border border-slate-200 dark:border-slate-800 overflow-hidden">
              <Table>
                <TableHeader className="bg-slate-50 dark:bg-slate-900/50">
                  <TableRow>
                    <TableHead className="w-[120px]">Código</TableHead>
                    <TableHead>Descrição</TableHead>
                    <TableHead className="w-[120px] text-center">Status</TableHead>
                    <TableHead className="w-[160px] text-right">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredUnits.map((unit) => (
                    <TableRow key={unit.code} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/50">
                      <TableCell className="font-mono font-bold text-sm">
                        <Badge variant="outline" className="font-mono px-2.5 py-0.5 text-xs bg-slate-100 dark:bg-slate-800 border-slate-300 dark:border-slate-700">
                          {unit.code}
                        </Badge>
                      </TableCell>
                      <TableCell className="font-medium text-slate-900 dark:text-slate-100">
                        {unit.description}
                      </TableCell>
                      <TableCell className="text-center">
                        {unit.active ? (
                          <Badge className="bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300 border-emerald-200 hover:bg-emerald-100">
                            <CheckCircle2 className="w-3 h-3 mr-1" />
                            Ativo
                          </Badge>
                        ) : (
                          <Badge variant="secondary" className="bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400">
                            <XCircle className="w-3 h-3 mr-1" />
                            Inativo
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-2">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleOpenEditModal(unit)}
                            title="Editar Unidade"
                            className="h-8 w-8 p-0"
                          >
                            <Edit2 className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => toggleActiveMutation.mutate({ code: unit.code, active: !unit.active })}
                            title={unit.active ? "Desativar Unidade" : "Ativar Unidade"}
                            className={`h-8 w-8 p-0 ${unit.active ? "text-amber-600 hover:text-amber-700" : "text-emerald-600 hover:text-emerald-700"}`}
                          >
                            {unit.active ? <XCircle className="h-4 w-4" /> : <CheckCircle2 className="h-4 w-4" />}
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Form Modal */}
      <UnitOfMeasureFormModal
        open={isModalOpen}
        onOpenChange={setIsModalOpen}
        onSubmit={handleFormSubmit}
        editingUnit={editingUnit}
        isLoading={createMutation.isPending || updateMutation.isPending}
      />
    </div>
  );
}
