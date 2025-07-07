import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Plus, Building } from "lucide-react";
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
  departmentId: z.number().min(1, "Departamento é obrigatório"),
  description: z.string().optional(),
});

type DepartmentFormData = z.infer<typeof departmentSchema>;
type CostCenterFormData = z.infer<typeof costCenterSchema>;

export default function DepartmentsPage() {
  const [isDeptModalOpen, setIsDeptModalOpen] = useState(false);
  const [isCostCenterModalOpen, setIsCostCenterModalOpen] = useState(false);
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
      departmentId: 0,
      description: "",
    },
  });

  const createDepartmentMutation = useMutation({
    mutationFn: async (data: DepartmentFormData) => {
      await apiRequest("POST", "/api/departments", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/departments"] });
      setIsDeptModalOpen(false);
      deptForm.reset();
      toast({
        title: "Sucesso",
        description: "Departamento criado com sucesso",
      });
    },
    onError: () => {
      toast({
        title: "Erro",
        description: "Falha ao criar departamento",
        variant: "destructive",
      });
    },
  });

  const createCostCenterMutation = useMutation({
    mutationFn: async (data: CostCenterFormData) => {
      await apiRequest("POST", "/api/cost-centers", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/cost-centers"] });
      setIsCostCenterModalOpen(false);
      costCenterForm.reset();
      toast({
        title: "Sucesso",
        description: "Centro de custo criado com sucesso",
      });
    },
    onError: () => {
      toast({
        title: "Erro",
        description: "Falha ao criar centro de custo",
        variant: "destructive",
      });
    },
  });

  const onSubmitDepartment = (data: DepartmentFormData) => {
    createDepartmentMutation.mutate(data);
  };

  const onSubmitCostCenter = (data: CostCenterFormData) => {
    createCostCenterMutation.mutate(data);
  };

  const getDepartmentName = (departmentId: number) => {
    const dept = departments.find((d: any) => d.id === departmentId);
    return dept?.name || "Desconhecido";
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
                </TableRow>
              </TableHeader>
              <TableBody>
                {departments.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={2} className="text-center py-8">
                      Nenhum departamento encontrado
                    </TableCell>
                  </TableRow>
                ) : (
                  departments.map((dept) => (
                    <TableRow key={dept.id}>
                      <TableCell className="font-medium">{dept.name}</TableCell>
                      <TableCell>{dept.description || "-"}</TableCell>
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
                </TableRow>
              </TableHeader>
              <TableBody>
                {costCenters.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={4} className="text-center py-8">
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
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Department Modal */}
      <Dialog open={isDeptModalOpen} onOpenChange={setIsDeptModalOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Novo Departamento</DialogTitle>
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
                <Button type="button" variant="outline" onClick={() => setIsDeptModalOpen(false)}>
                  Cancelar
                </Button>
                <Button type="submit" disabled={createDepartmentMutation.isPending}>
                  {createDepartmentMutation.isPending ? "Criando..." : "Criar"}
                </Button>
              </div>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      {/* Cost Center Modal */}
      <Dialog open={isCostCenterModalOpen} onOpenChange={setIsCostCenterModalOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Novo Centro de Custo</DialogTitle>
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
                <Button type="button" variant="outline" onClick={() => setIsCostCenterModalOpen(false)}>
                  Cancelar
                </Button>
                <Button type="submit" disabled={createCostCenterMutation.isPending}>
                  {createCostCenterMutation.isPending ? "Criando..." : "Criar"}
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