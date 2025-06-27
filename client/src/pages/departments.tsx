import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import Navbar from "@/components/navbar";
import Sidebar from "@/components/sidebar";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { Plus, Building } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

const departmentSchema = z.object({
  name: z.string().min(1, "Nome é obrigatório"),
  description: z.string().optional(),
});

const costCenterSchema = z.object({
  code: z.string().min(1, "Código é obrigatório"),
  name: z.string().min(1, "Nome é obrigatório"),
  departmentId: z.coerce.number().min(1, "Departamento é obrigatório"),
});

type DepartmentFormData = z.infer<typeof departmentSchema>;
type CostCenterFormData = z.infer<typeof costCenterSchema>;

export default function DepartmentsPage() {
  const [isDeptModalOpen, setIsDeptModalOpen] = useState(false);
  const [isCostCenterModalOpen, setIsCostCenterModalOpen] = useState(false);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: departments, isLoading: isLoadingDepts } = useQuery({
    queryKey: ["/api/departments"],
  });

  const { data: costCenters, isLoading: isLoadingCostCenters } = useQuery({
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
    },
  });

  const createDepartmentMutation = useMutation({
    mutationFn: async (data: DepartmentFormData) => {
      await apiRequest("POST", "/api/departments", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/departments"] });
      toast({
        title: "Sucesso",
        description: "Departamento criado com sucesso!",
      });
      deptForm.reset();
      setIsDeptModalOpen(false);
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
      toast({
        title: "Sucesso",
        description: "Centro de custo criado com sucesso!",
      });
      costCenterForm.reset();
      setIsCostCenterModalOpen(false);
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
    const dept = departments?.find((d: any) => d.id === departmentId);
    return dept?.name || "Desconhecido";
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <Navbar />
      <Sidebar />
      
      <div className="ml-64 pt-16 p-6">
        <div className="max-w-7xl mx-auto space-y-6">
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
              {isLoadingDepts ? (
                <div className="space-y-3">
                  {[...Array(3)].map((_, i) => (
                    <Skeleton key={i} className="h-12 w-full" />
                  ))}
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Nome</TableHead>
                      <TableHead>Descrição</TableHead>
                      <TableHead>Data de Criação</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {departments?.map((department: any) => (
                      <TableRow key={department.id}>
                        <TableCell className="font-medium">{department.name}</TableCell>
                        <TableCell>{department.description || "-"}</TableCell>
                        <TableCell>
                          {new Date(department.createdAt).toLocaleDateString('pt-BR')}
                        </TableCell>
                      </TableRow>
                    ))}
                    {departments?.length === 0 && (
                      <TableRow>
                        <TableCell colSpan={3} className="text-center text-gray-500 py-8">
                          Nenhum departamento cadastrado
                        </TableCell>
                      </TableRow>
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
              {isLoadingCostCenters ? (
                <div className="space-y-3">
                  {[...Array(5)].map((_, i) => (
                    <Skeleton key={i} className="h-12 w-full" />
                  ))}
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Código</TableHead>
                      <TableHead>Nome</TableHead>
                      <TableHead>Departamento</TableHead>
                      <TableHead>Data de Criação</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {costCenters?.map((costCenter: any) => (
                      <TableRow key={costCenter.id}>
                        <TableCell className="font-medium">{costCenter.code}</TableCell>
                        <TableCell>{costCenter.name}</TableCell>
                        <TableCell>{getDepartmentName(costCenter.departmentId)}</TableCell>
                        <TableCell>
                          {new Date(costCenter.createdAt).toLocaleDateString('pt-BR')}
                        </TableCell>
                      </TableRow>
                    ))}
                    {costCenters?.length === 0 && (
                      <TableRow>
                        <TableCell colSpan={4} className="text-center text-gray-500 py-8">
                          Nenhum centro de custo cadastrado
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

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
                      <Textarea {...field} rows={3} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="flex justify-end space-x-3 pt-4">
                <Button 
                  type="button" 
                  variant="outline" 
                  onClick={() => setIsDeptModalOpen(false)}
                >
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
                      <Input {...field} placeholder="Ex: TI-DEV-001" />
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
                      <Input {...field} placeholder="Ex: TI - Desenvolvimento" />
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
                    <FormControl>
                      <select 
                        {...field}
                        className="w-full border border-input rounded-md px-3 py-2 text-sm bg-background"
                      >
                        <option value="">Selecione um departamento</option>
                        {departments?.map((dept: any) => (
                          <option key={dept.id} value={dept.id}>
                            {dept.name}
                          </option>
                        ))}
                      </select>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="flex justify-end space-x-3 pt-4">
                <Button 
                  type="button" 
                  variant="outline" 
                  onClick={() => setIsCostCenterModalOpen(false)}
                >
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
  );
}
