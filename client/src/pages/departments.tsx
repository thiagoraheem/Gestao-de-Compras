import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Plus, Building, Edit, Check, X, Trash2 } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import AdminRoute from "@/components/AdminRoute";

const departmentSchema = z.object({
  name: z.string().min(1, "Nome é obrigatório"),
  description: z.string().optional(),
});

const costCenterSchema = z.object({
  code: z.string().min(1, "Código é obrigatório"),
  name: z.string().min(1, "Nome é obrigatório"),
  departmentId: z.number({
    required_error: "Departamento é obrigatório",
    invalid_type_error: "Selecione um departamento válido"
  }).min(1, "Departamento é obrigatório"),
  description: z.string().optional(),
});

type DepartmentFormData = z.infer<typeof departmentSchema>;
type CostCenterFormData = z.infer<typeof costCenterSchema>;

export default function DepartmentsPage() {
  const [isDeptModalOpen, setIsDeptModalOpen] = useState(false);
  const [isCostCenterModalOpen, setIsCostCenterModalOpen] = useState(false);
  const [editingDepartment, setEditingDepartment] = useState<any>(null);
  const [editingCostCenter, setEditingCostCenter] = useState<any>(null);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: departments = [], isLoading: isDeptLoading } = useQuery<any[]>({
    queryKey: ["/api/departments"],
  });

  const { data: costCenters = [], isLoading: isCostCenterLoading } = useQuery<any[]>({
    queryKey: ["/api/cost-centers"],
  });

  const deptForm = useForm<DepartmentFormData>({
    resolver: zodResolver(departmentSchema),
    defaultValues: {
      name: "",
      description: "",
    },
  });

  const costCenterForm = useForm<CostCenterFormData>({
    resolver: zodResolver(costCenterSchema),
    defaultValues: {
      code: "",
      name: "",
      departmentId: undefined as any,
      description: "",
    },
  });

  const createDepartmentMutation = useMutation({
    mutationFn: async (data: DepartmentFormData) => {
      const endpoint = editingDepartment 
        ? `/api/departments/${editingDepartment.id}`
        : "/api/departments";
      const method = editingDepartment ? "PUT" : "POST";
      const response = await apiRequest(method, endpoint, data);
      return response.json();
    },
    onMutate: async (data) => {
      // Cancel any outgoing refetches
      await queryClient.cancelQueries({ queryKey: ["/api/departments"] });
      
      // Snapshot the previous value
      const previousDepartments = queryClient.getQueryData(["/api/departments"]);
      
      // Optimistically add new department
      queryClient.setQueryData(["/api/departments"], (old: any[]) => {
        if (!Array.isArray(old)) return old;
        const optimisticDept = {
          id: Date.now(), // Temporary ID
          ...data,
          createdAt: new Date().toISOString()
        };
        return [...old, optimisticDept];
      });
      
      return { previousDepartments };
    },
    onError: (err, variables, context) => {
      // Roll back on error
      if (context?.previousDepartments) {
        queryClient.setQueryData(["/api/departments"], context.previousDepartments);
      }
      
      toast({
        title: "Erro",
        description: "Falha ao criar departamento",
        variant: "destructive",
      });
    },
    onSuccess: () => {
      // Comprehensive cache invalidation for department-related data
      queryClient.invalidateQueries({ queryKey: ["/api/departments"] });
      queryClient.invalidateQueries({ queryKey: ["/api/users"] });
      queryClient.invalidateQueries({ queryKey: ["/api/cost-centers"] });
      
      // Force immediate refetch for real data
      queryClient.refetchQueries({ queryKey: ["/api/departments"] });
      queryClient.refetchQueries({ queryKey: ["/api/users"] });
      
      setIsDeptModalOpen(false);
      setEditingDepartment(null);
      deptForm.reset();
      toast({
        title: "Sucesso",
        description: editingDepartment 
          ? "Departamento atualizado com sucesso"
          : "Departamento criado com sucesso",
      });
    },
  });

  const createCostCenterMutation = useMutation({
    mutationFn: async (data: CostCenterFormData) => {
      const endpoint = editingCostCenter 
        ? `/api/cost-centers/${editingCostCenter.id}`
        : "/api/cost-centers";
      const method = editingCostCenter ? "PUT" : "POST";
      const response = await apiRequest(method, endpoint, data);
      return response.json();
    },
    onMutate: async (data) => {
      // Cancel any outgoing refetches
      await queryClient.cancelQueries({ queryKey: ["/api/cost-centers"] });
      
      // Snapshot the previous value
      const previousCostCenters = queryClient.getQueryData(["/api/cost-centers"]);
      
      // Optimistically add new cost center
      queryClient.setQueryData(["/api/cost-centers"], (old: any[]) => {
        if (!Array.isArray(old)) return old;
        const optimisticCC = {
          id: Date.now(), // Temporary ID
          ...data,
          department: departments.find(d => d.id === data.departmentId),
          createdAt: new Date().toISOString()
        };
        return [...old, optimisticCC];
      });
      
      return { previousCostCenters };
    },
    onError: (err, variables, context) => {
      // Roll back on error
      if (context?.previousCostCenters) {
        queryClient.setQueryData(["/api/cost-centers"], context.previousCostCenters);
      }
      
      console.error("Cost center creation error:", err);
      console.error("Error details:", {
        message: err instanceof Error ? err.message : 'Unknown error',
        variables,
        errorType: typeof err,
        errorKeys: err && typeof err === 'object' ? Object.keys(err) : []
      });
      
      let errorMessage = "Falha ao criar centro de custo";
      
      // Handle fetch errors (non-JSON responses)
      if (err instanceof Error) {
        if (err.message.includes('Unexpected token') && err.message.includes('DOCTYPE')) {
          errorMessage = "Erro de servidor. Tente novamente em alguns instantes.";
        } else if (err.message.includes('unique constraint') || err.message.includes('duplicate')) {
          errorMessage = "Código do centro de custo já existe";
        } else if (err.message.includes('validation')) {
          errorMessage = "Dados inválidos. Verifique os campos obrigatórios";
        } else if (err.message.includes('Failed to fetch')) {
          errorMessage = "Erro de conexão. Verifique sua internet.";
        } else {
          errorMessage = err.message;
        }
      }
      
      toast({
        title: "Erro",
        description: errorMessage,
        variant: "destructive",
      });
    },
    onSuccess: () => {
      // Comprehensive cache invalidation for cost center-related data
      queryClient.invalidateQueries({ queryKey: ["/api/cost-centers"] });
      queryClient.invalidateQueries({ queryKey: ["/api/users"] });
      queryClient.invalidateQueries({ queryKey: ["/api/departments"] });
      
      // Invalidate user-specific cost center queries
      queryClient.invalidateQueries({ 
        predicate: (query) => 
          query.queryKey[0]?.toString().includes(`/api/users/`) &&
          query.queryKey[0]?.toString().includes(`/cost-centers`)
      });
      
      // Force immediate refetch for real data
      queryClient.refetchQueries({ queryKey: ["/api/cost-centers"] });
      queryClient.refetchQueries({ queryKey: ["/api/users"] });
      
      setIsCostCenterModalOpen(false);
      setEditingCostCenter(null);
      costCenterForm.reset();
      toast({
        title: "Sucesso",
        description: editingCostCenter 
          ? "Centro de custo atualizado com sucesso"
          : "Centro de custo criado com sucesso",
      });
    },
  });

  const deleteDepartmentMutation = useMutation({
    mutationFn: async (id: number) => {
      const response = await apiRequest(`/api/departments/${id}`, { method: "DELETE" });
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/departments"] });
      queryClient.invalidateQueries({ queryKey: ["/api/cost-centers"] });
      queryClient.invalidateQueries({ queryKey: ["/api/users"] });
      toast({
        title: "Sucesso",
        description: "Departamento excluído com sucesso",
      });
    },
    onError: (error: any) => {
      console.error("Error deleting department:", error);
      toast({
        title: "Erro",
        description: error.message || "Erro ao excluir departamento",
        variant: "destructive",
      });
    },
  });

  const deleteCostCenterMutation = useMutation({
    mutationFn: async (id: number) => {
      const response = await apiRequest(`/api/cost-centers/${id}`, { method: "DELETE" });
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/cost-centers"] });
      queryClient.invalidateQueries({ queryKey: ["/api/users"] });
      queryClient.invalidateQueries({ 
        predicate: (query) => 
          query.queryKey[0]?.toString().includes(`/api/users/`) &&
          query.queryKey[0]?.toString().includes(`/cost-centers`)
      });
      toast({
        title: "Sucesso",
        description: "Centro de custo excluído com sucesso",
      });
    },
    onError: (error: any) => {
      console.error("Error deleting cost center:", error);
      toast({
        title: "Erro",
        description: error.message || "Erro ao excluir centro de custo",
        variant: "destructive",
      });
    },
  });

  const checkDepartmentCanBeDeleted = async (id: number) => {
    try {
      const response = await apiRequest(`/api/departments/${id}/can-delete`, { method: "GET" });
      return response.json();
    } catch (error) {
      console.error("Error checking department can be deleted:", error);
      return { canDelete: false, reason: "Erro ao verificar se departamento pode ser excluído" };
    }
  };

  const checkCostCenterCanBeDeleted = async (id: number) => {
    try {
      const response = await apiRequest(`/api/cost-centers/${id}/can-delete`, { method: "GET" });
      return response.json();
    } catch (error) {
      console.error("Error checking cost center can be deleted:", error);
      return { canDelete: false, reason: "Erro ao verificar se centro de custo pode ser excluído" };
    }
  };

  const handleDeleteDepartment = async (department: any) => {
    const result = await checkDepartmentCanBeDeleted(department.id);
    if (!result.canDelete) {
      toast({
        title: "Não é possível excluir",
        description: result.reason,
        variant: "destructive",
      });
      return;
    }
    deleteDepartmentMutation.mutate(department.id);
  };

  const handleDeleteCostCenter = async (costCenter: any) => {
    const result = await checkCostCenterCanBeDeleted(costCenter.id);
    if (!result.canDelete) {
      toast({
        title: "Não é possível excluir",
        description: result.reason,
        variant: "destructive",
      });
      return;
    }
    deleteCostCenterMutation.mutate(costCenter.id);
  };

  const onSubmitDepartment = (data: DepartmentFormData) => {
    createDepartmentMutation.mutate(data);
  };

  const onSubmitCostCenter = (data: CostCenterFormData) => {
    console.log("Submitting cost center data:", data);
    
    // Ensure departmentId is a valid number
    if (!data.departmentId || data.departmentId <= 0) {
      toast({
        title: "Erro",
        description: "Selecione um departamento válido",
        variant: "destructive",
      });
      return;
    }
    
    createCostCenterMutation.mutate(data);
  };

  const getDepartmentName = (departmentId: number) => {
    const dept = departments.find((d: any) => d.id === departmentId);
    return dept?.name || "Desconhecido";
  };

  const handleEditDepartment = (department: any) => {
    setEditingDepartment(department);
    deptForm.reset({
      name: department.name || "",
      description: department.description || "",
    });
    setIsDeptModalOpen(true);
  };

  const handleEditCostCenter = (costCenter: any) => {
    setEditingCostCenter(costCenter);
    costCenterForm.reset({
      code: costCenter.code || "",
      name: costCenter.name || "",
      departmentId: costCenter.departmentId || 0,
      description: costCenter.description || "",
    });
    setIsCostCenterModalOpen(true);
  };

  const handleCloseDeptModal = () => {
    setIsDeptModalOpen(false);
    setEditingDepartment(null);
    deptForm.reset();
  };

  const handleCloseCostCenterModal = () => {
    setIsCostCenterModalOpen(false);
    setEditingCostCenter(null);
    costCenterForm.reset({
      code: "",
      name: "",
      departmentId: undefined as any,
      description: "",
    });
    costCenterForm.clearErrors();
  };

  return (
    <AdminRoute>
      <div className="max-w-7xl mx-auto p-6 space-y-6">
      {/* Departments */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center">
              <Building className="mr-2 h-5 w-5" />
              Departamentos
            </CardTitle>
            <Button onClick={() => setIsDeptModalOpen(true)}>
              <Plus className="mr-2 h-4 w-4" />
              Novo Departamento
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {isDeptLoading ? (
            <div className="space-y-2">
              <Skeleton className="h-12 w-full" />
              <Skeleton className="h-12 w-full" />
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nome</TableHead>
                  <TableHead>Descrição</TableHead>
                  <TableHead>Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {departments.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={3} className="text-center py-8">
                      Nenhum departamento encontrado
                    </TableCell>
                  </TableRow>
                ) : (
                  departments.map((dept) => (
                    <TableRow key={dept.id}>
                      <TableCell className="font-medium">{dept.name}</TableCell>
                      <TableCell>{dept.description || "-"}</TableCell>
                      <TableCell>
                        <div className="flex gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleEditDepartment(dept)}
                          >
                            <Edit className="h-4 w-4" />
                          </Button>
                          <AlertDialog>
                            <AlertDialogTrigger asChild>
                              <Button
                                variant="outline"
                                size="sm"
                                className="text-red-600 hover:text-red-700"
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                              <AlertDialogHeader>
                                <AlertDialogTitle>Confirmar exclusão</AlertDialogTitle>
                                <AlertDialogDescription>
                                  Tem certeza que deseja excluir o departamento "{dept.name}"? Esta ação não pode ser desfeita.
                                </AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel>Cancelar</AlertDialogCancel>
                                <AlertDialogAction
                                  onClick={() => handleDeleteDepartment(dept)}
                                  className="bg-red-600 hover:bg-red-700"
                                >
                                  Excluir
                                </AlertDialogAction>
                              </AlertDialogFooter>
                            </AlertDialogContent>
                          </AlertDialog>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Cost Centers */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>Centros de Custo</CardTitle>
            <Button onClick={() => setIsCostCenterModalOpen(true)}>
              <Plus className="mr-2 h-4 w-4" />
              Novo Centro de Custo
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {isCostCenterLoading ? (
            <div className="space-y-2">
              <Skeleton className="h-12 w-full" />
              <Skeleton className="h-12 w-full" />
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Código</TableHead>
                  <TableHead>Nome</TableHead>
                  <TableHead>Departamento</TableHead>
                  <TableHead>Descrição</TableHead>
                  <TableHead>Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {costCenters.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center py-8">
                      Nenhum centro de custo encontrado
                    </TableCell>
                  </TableRow>
                ) : (
                  costCenters.map((cc) => (
                    <TableRow key={cc.id}>
                      <TableCell className="font-medium">{cc.code}</TableCell>
                      <TableCell>{cc.name}</TableCell>
                      <TableCell>{getDepartmentName(cc.departmentId)}</TableCell>
                      <TableCell>{cc.description || "-"}</TableCell>
                      <TableCell>
                        <div className="flex gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleEditCostCenter(cc)}
                          >
                            <Edit className="h-4 w-4" />
                          </Button>
                          <AlertDialog>
                            <AlertDialogTrigger asChild>
                              <Button
                                variant="outline"
                                size="sm"
                                className="text-red-600 hover:text-red-700"
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                              <AlertDialogHeader>
                                <AlertDialogTitle>Confirmar exclusão</AlertDialogTitle>
                                <AlertDialogDescription>
                                  Tem certeza que deseja excluir o centro de custo "{cc.name}"? Esta ação não pode ser desfeita.
                                </AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel>Cancelar</AlertDialogCancel>
                                <AlertDialogAction
                                  onClick={() => handleDeleteCostCenter(cc)}
                                  className="bg-red-600 hover:bg-red-700"
                                >
                                  Excluir
                                </AlertDialogAction>
                              </AlertDialogFooter>
                            </AlertDialogContent>
                          </AlertDialog>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Department Modal */}
      <Dialog open={isDeptModalOpen} onOpenChange={handleCloseDeptModal}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>
              {editingDepartment ? "Editar Departamento" : "Novo Departamento"}
            </DialogTitle>
          </DialogHeader>
          <Form {...deptForm}>
            <form onSubmit={deptForm.handleSubmit(onSubmitDepartment)} className="space-y-4">
              <FormField
                control={deptForm.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Nome *</FormLabel>
                    <FormControl>
                      <Input {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={deptForm.control}
                name="description"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Descrição</FormLabel>
                    <FormControl>
                      <Textarea {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <div className="flex justify-end space-x-3 pt-4 border-t">
                <Button type="button" variant="outline" onClick={handleCloseDeptModal}>
                  Cancelar
                </Button>
                <Button type="submit" disabled={createDepartmentMutation.isPending}>
                  {createDepartmentMutation.isPending 
                    ? (editingDepartment ? "Salvando..." : "Criando...") 
                    : (editingDepartment ? "Salvar" : "Criar")}
                </Button>
              </div>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      {/* Cost Center Modal */}
      <Dialog open={isCostCenterModalOpen} onOpenChange={handleCloseCostCenterModal}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>
              {editingCostCenter ? "Editar Centro de Custo" : "Novo Centro de Custo"}
            </DialogTitle>
          </DialogHeader>
          <Form {...costCenterForm}>
            <form onSubmit={costCenterForm.handleSubmit(onSubmitCostCenter)} className="space-y-4">
              <FormField
                control={costCenterForm.control}
                name="code"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Código *</FormLabel>
                    <FormControl>
                      <Input {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={costCenterForm.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Nome *</FormLabel>
                    <FormControl>
                      <Input {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={costCenterForm.control}
                name="departmentId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Departamento *</FormLabel>
                    <Select
                      onValueChange={(value) => field.onChange(parseInt(value))}
                      value={field.value?.toString() || ""}
                    >
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Selecione um departamento" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {departments.map((dept) => (
                          <SelectItem key={dept.id} value={dept.id.toString()}>
                            {dept.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={costCenterForm.control}
                name="description"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Descrição</FormLabel>
                    <FormControl>
                      <Textarea {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <div className="flex justify-end space-x-3 pt-4 border-t">
                <Button type="button" variant="outline" onClick={handleCloseCostCenterModal}>
                  Cancelar
                </Button>
                <Button type="submit" disabled={createCostCenterMutation.isPending}>
                  {createCostCenterMutation.isPending 
                    ? (editingCostCenter ? "Salvando..." : "Criando...") 
                    : (editingCostCenter ? "Salvar" : "Criar")}
                </Button>
              </div>
            </form>
          </Form>
        </DialogContent>
      </Dialog>
      </div>
    </AdminRoute>
  );
}