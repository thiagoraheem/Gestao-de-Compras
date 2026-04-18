import { useState } from "react";
import { useDepartments } from "@/features/departments/hooks/useDepartments";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Button } from "@/shared/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/shared/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/shared/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/shared/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/shared/ui/alert-dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/shared/ui/form";
import { Input } from "@/shared/ui/input";
import { Textarea } from "@/shared/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/shared/ui/select";
import { Skeleton } from "@/shared/ui/skeleton";
import { Plus, Building, Edit, Check, X, Trash2 } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import AdminRoute from "@/components/AdminRoute";
import debug from "@/lib/debug";

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
  const {
    departments,
    isDeptLoading,
    costCenters,
    isCostCenterLoading,
    createDepartmentMutation,
    updateDepartmentMutation,
    createCostCenterMutation,
    deleteDepartmentMutation,
    deleteCostCenterMutation,
    checkDepartmentCanBeDeleted,
    checkCostCenterCanBeDeleted
  } = useDepartments();

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
    deleteDepartmentMutation.mutate(department.id, {
      onSuccess: () => toast({ title: "Sucesso", description: "Departamento excluído com sucesso" }),
      onError: (err: any) => toast({ title: "Erro", description: err.message || "Erro ao excluir departamento", variant: "destructive" })
    });
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
    deleteCostCenterMutation.mutate(costCenter.id, {
      onSuccess: () => toast({ title: "Sucesso", description: "Centro de custo excluído com sucesso" }),
      onError: (err: any) => toast({ title: "Erro", description: err.message || "Erro ao excluir centro de custo", variant: "destructive" })
    });
  };

  const onSubmitDepartment = (data: DepartmentFormData) => {
    if (editingDepartment) {
      updateDepartmentMutation.mutate({ id: editingDepartment.id, data }, {
        onSuccess: () => {
          setIsDeptModalOpen(false);
          setEditingDepartment(null);
          deptForm.reset();
          toast({
            title: "Sucesso",
            description: "Departamento atualizado com sucesso",
          });
        },
        onError: () => toast({ title: "Erro", description: "Falha ao salvar departamento", variant: "destructive" })
      });
    } else {
      createDepartmentMutation.mutate(data, {
        onSuccess: () => {
          setIsDeptModalOpen(false);
          setEditingDepartment(null);
          deptForm.reset();
          toast({
            title: "Sucesso",
            description: "Departamento criado com sucesso",
          });
        },
        onError: () => toast({ title: "Erro", description: "Falha ao salvar departamento", variant: "destructive" })
      });
    }
  };

  const onSubmitCostCenter = (data: CostCenterFormData) => {
    if (!data.departmentId || data.departmentId <= 0) {
      toast({
        title: "Erro",
        description: "Selecione um departamento válido",
        variant: "destructive",
      });
      return;
    }
    
    createCostCenterMutation.mutate({ data, editingCostCenter }, {
      onSuccess: () => {
        setIsCostCenterModalOpen(false);
        setEditingCostCenter(null);
        costCenterForm.reset();
        toast({
          title: "Sucesso",
          description: editingCostCenter ? "Centro de custo atualizado com sucesso" : "Centro de custo criado com sucesso",
        });
      },
      onError: (err: any) => toast({ title: "Erro", description: err.message || "Falha ao salvar centro de custo", variant: "destructive" })
    });
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
      <div className="h-full overflow-y-auto">
        <div className="max-w-7xl mx-auto p-6 space-y-6 bg-background">
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
                                className="text-destructive"
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
                                  className="bg-destructive hover:bg-destructive/90 text-destructive-foreground"
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
                                className="text-destructive"
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
                                  className="bg-destructive hover:bg-destructive/90 text-destructive-foreground"
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
              <div className="flex justify-end space-x-2 pt-4">
                <Button type="button" variant="outline" onClick={handleCloseDeptModal}>
                  Cancelar
                </Button>
                <Button type="submit" disabled={editingDepartment ? updateDepartmentMutation.isPending : createDepartmentMutation.isPending}>
                  {(editingDepartment ? updateDepartmentMutation.isPending : createDepartmentMutation.isPending) ? "Salvando..." : "Salvar"}
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
                      onValueChange={(val) => field.onChange(parseInt(val))} 
                      value={field.value ? field.value.toString() : ""}
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
              <div className="flex justify-end space-x-2 pt-4">
                <Button type="button" variant="outline" onClick={handleCloseCostCenterModal}>
                  Cancelar
                </Button>
                <Button type="submit" disabled={createCostCenterMutation.isPending}>
                  {createCostCenterMutation.isPending ? "Salvando..." : "Salvar"}
                </Button>
              </div>
            </form>
          </Form>
        </DialogContent>
      </Dialog>
      </div>
      </div>
    </AdminRoute>
  );
}
