import { useState, useEffect } from "react";
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
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Plus, Edit, Shield, User, Building, Shield as ShieldIcon } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import AdminRoute from "@/components/AdminRoute";

const userSchema = z.object({
  username: z.string().min(1, "Username é obrigatório"),
  email: z.string().email("Email inválido"),
  password: z.string().optional(),
  firstName: z.string().optional(),
  lastName: z.string().optional(),
  departmentId: z.number().nullable().optional(),
  isBuyer: z.boolean().default(false),
  isApproverA1: z.boolean().default(false),
  isApproverA2: z.boolean().default(false),
  isAdmin: z.boolean().default(false),
  isManager: z.boolean().default(false),
  isReceiver: z.boolean().default(false),
}).refine((data) => {
  // Password is required only when creating a new user
  if (!data.password || data.password === "") {
    return true; // Password is optional for editing
  }
  return data.password.length >= 6;
}, {
  message: "Senha deve ter pelo menos 6 caracteres",
  path: ["password"],
});

type UserFormData = z.infer<typeof userSchema>;

export default function UsersPage() {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<any>(null);
  const [selectedCostCenters, setSelectedCostCenters] = useState<number[]>([]);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: users = [], isLoading } = useQuery<any[]>({
    queryKey: ["/api/users"],
  });

  const { data: departments = [] } = useQuery<any[]>({
    queryKey: ["/api/departments"],
  });

  const { data: costCenters = [] } = useQuery<any[]>({
    queryKey: ["/api/cost-centers"],
  });

  const form = useForm<UserFormData>({
    resolver: zodResolver(userSchema),
    defaultValues: {
      username: "",
      email: "",
      password: "",
      firstName: "",
      lastName: "",
      departmentId: null,
      isBuyer: false,
      isApproverA1: false,
      isApproverA2: false,
      isAdmin: false,
      isManager: false,
      isReceiver: false,
    },
  });

  const createUserMutation = useMutation({
    mutationFn: async (data: UserFormData) => {
      const endpoint = editingUser 
        ? `/api/users/${editingUser.id}`
        : "/api/users";
      const method = editingUser ? "PUT" : "POST";
      await apiRequest(method, endpoint, {
        ...data,
        costCenterIds: selectedCostCenters
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/users"] });
      toast({
        title: "Sucesso",
        description: editingUser 
          ? "Usuário atualizado com sucesso!"
          : "Usuário criado com sucesso!",
      });
      handleCloseModal();
    },
    onError: (error: any) => {
      let errorMessage = "Falha ao salvar usuário";
      
      // Try to extract the specific error message from the API response
      if (error?.response?.data?.message) {
        errorMessage = error.response.data.message;
      } else if (error?.message) {
        errorMessage = error.message;
      }

      toast({
        title: "Erro",
        description: errorMessage,
        variant: "destructive",
      });
    },
  });

  const handleCloseModal = () => {
    setIsModalOpen(false);
    setEditingUser(null);
    form.reset();
  };

  useEffect(() => {
    if (editingUser) {
      // Load user's cost centers when editing
      fetch(`/api/users/${editingUser.id}/cost-centers`)
        .then(res => res.json())
        .then(data => setSelectedCostCenters(data))
        .catch(() => setSelectedCostCenters([]));
    }
  }, [editingUser]);

  const handleEditUser = (user: any) => {
    setEditingUser(user);
    form.reset({
      username: user.username || "",
      email: user.email || "",
      password: "", // Don't pre-fill password for security
      firstName: user.firstName || "",
      lastName: user.lastName || "",
      departmentId: user.departmentId || null,
      isBuyer: user.isBuyer || false,
      isApproverA1: user.isApproverA1 || false,
      isApproverA2: user.isApproverA2 || false,
      isAdmin: user.isAdmin || false,
      isManager: user.isManager || false,
      isReceiver: user.isReceiver || false,
    });
    setIsModalOpen(true);
  };

  const onSubmit = (data: UserFormData) => {
    // For editing users, don't send password if it's empty
    if (editingUser && !data.password) {
      const { password, ...dataWithoutPassword } = data;
      createUserMutation.mutate(dataWithoutPassword as UserFormData);
    } else {
      createUserMutation.mutate(data);
    }
  };

  const getUserRoles = (user: any) => {
    const roles = [];
    if (user.isAdmin) roles.push("Admin");
    if (user.isManager) roles.push("Gerente");
    if (user.isBuyer) roles.push("Comprador");
    if (user.isApproverA1) roles.push("Aprovador A1");
    if (user.isApproverA2) roles.push("Aprovador A2");
    return roles;
  };

  return (
    <AdminRoute>
      <div className="max-w-7xl mx-auto p-6">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle>Usuários</CardTitle>
                <Button onClick={() => setIsModalOpen(true)}>
                  <Plus className="mr-2 h-4 w-4" />
                  Novo Usuário
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <div className="space-y-3">
                  {[...Array(5)].map((_, i) => (
                    <Skeleton key={i} className="h-12 w-full" />
                  ))}
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Nome</TableHead>
                      <TableHead>Username</TableHead>
                      <TableHead>Email</TableHead>
                      <TableHead>Roles</TableHead>
                      <TableHead>Ações</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {users?.map((user: any) => (
                      <TableRow key={user.id}>
                        <TableCell className="font-medium">
                          {user.firstName || user.lastName 
                            ? `${user.firstName || ""} ${user.lastName || ""}`.trim()
                            : "-"
                          }
                        </TableCell>
                        <TableCell>{user.username}</TableCell>
                        <TableCell>{user.email}</TableCell>
                        <TableCell>
                          <div className="flex flex-wrap gap-1">
                            {getUserRoles(user).map((role) => (
                              <Badge key={role} variant="secondary" className="text-xs">
                                {role}
                              </Badge>
                            ))}
                            {getUserRoles(user).length === 0 && (
                              <span className="text-gray-500 text-sm">Usuário</span>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleEditUser(user)}
                          >
                            <Edit className="h-4 w-4" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                    {users?.length === 0 && (
                      <TableRow>
                        <TableCell colSpan={5} className="text-center text-gray-500 py-8">
                          Nenhum usuário cadastrado
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>

      <Dialog open={isModalOpen} onOpenChange={handleCloseModal}>
        <DialogContent className="sm:max-w-2xl max-h-[85vh] flex flex-col">
          <DialogHeader>
            <DialogTitle>
              {editingUser ? "Editar Usuário" : "Novo Usuário"}
            </DialogTitle>
          </DialogHeader>
          
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="flex flex-col flex-1 overflow-hidden">
              <Tabs defaultValue="dados-pessoais" className="flex-1 flex flex-col overflow-hidden">
                <TabsList className="grid w-full grid-cols-3 mb-6">
                  <TabsTrigger value="dados-pessoais" className="flex items-center gap-2">
                    <User className="h-4 w-4" />
                    Dados Pessoais
                  </TabsTrigger>
                  <TabsTrigger value="departamento" className="flex items-center gap-2">
                    <Building className="h-4 w-4" />
                    Departamento
                  </TabsTrigger>
                  <TabsTrigger value="permissoes" className="flex items-center gap-2">
                    <ShieldIcon className="h-4 w-4" />
                    Permissões
                  </TabsTrigger>
                </TabsList>

                <div className="flex-1 overflow-y-auto pr-2">
                  <TabsContent value="dados-pessoais" className="space-y-4 mt-0">
                    <div className="grid grid-cols-2 gap-4">
                      <FormField
                        control={form.control}
                        name="firstName"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Primeiro Nome *</FormLabel>
                            <FormControl>
                              <Input {...field} placeholder="Digite o primeiro nome" />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <FormField
                        control={form.control}
                        name="lastName"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Último Nome *</FormLabel>
                            <FormControl>
                              <Input {...field} placeholder="Digite o último nome" />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>

                    <FormField
                      control={form.control}
                      name="username"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Username</FormLabel>
                          <FormControl>
                            <Input {...field} placeholder="Digite o nome de usuário" />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="email"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Email *</FormLabel>
                          <FormControl>
                            <Input {...field} type="email" placeholder="Digite o email" />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    {!editingUser && (
                      <FormField
                        control={form.control}
                        name="password"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Senha *</FormLabel>
                            <FormControl>
                              <Input {...field} type="password" placeholder="Digite a senha" />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    )}
                  </TabsContent>

                  <TabsContent value="departamento" className="space-y-4 mt-0">
                    <FormField
                      control={form.control}
                      name="departmentId"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Departamento</FormLabel>
                          <Select 
                            onValueChange={(value) => field.onChange(value === "none" ? null : parseInt(value))} 
                            value={field.value?.toString() || "none"}
                          >
                            <FormControl>
                              <SelectTrigger>
                                <SelectValue placeholder="Selecione o departamento" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              <SelectItem value="none">Nenhum departamento</SelectItem>
                              {Array.isArray(departments) && departments.map((dept: any) => (
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

                    <div className="space-y-3">
                      <FormLabel>Centros de Custo</FormLabel>
                      <div className="space-y-2">
                        {Array.isArray(costCenters) && costCenters.map((cc: any) => (
                          <div key={cc.id} className="flex items-start space-x-3 p-3 border rounded-lg hover:bg-gray-50">
                            <Checkbox
                              id={`cc-${cc.id}`}
                              checked={selectedCostCenters.includes(cc.id)}
                              onCheckedChange={(checked) => {
                                if (checked) {
                                  setSelectedCostCenters([...selectedCostCenters, cc.id]);
                                } else {
                                  setSelectedCostCenters(selectedCostCenters.filter(id => id !== cc.id));
                                }
                              }}
                            />
                            <div className="flex-1 space-y-1">
                              <label 
                                htmlFor={`cc-${cc.id}`} 
                                className="text-sm font-medium leading-none cursor-pointer"
                              >
                                {cc.name}
                              </label>
                              <p className="text-xs text-muted-foreground">
                                {cc.code}
                              </p>
                            </div>
                          </div>
                        ))}
                        {(!Array.isArray(costCenters) || costCenters.length === 0) && (
                          <p className="text-sm text-muted-foreground py-4 text-center">
                            Nenhum centro de custo disponível
                          </p>
                        )}
                      </div>
                    </div>
                  </TabsContent>

                  <TabsContent value="permissoes" className="space-y-4 mt-0">
                    <div className="space-y-1 mb-4">
                      <h3 className="text-sm font-medium">Permissões do Sistema</h3>
                    </div>
                    
                    <div className="space-y-3">
                      <FormField
                        control={form.control}
                        name="isBuyer"
                        render={({ field }) => (
                          <FormItem className="flex items-start space-x-3 space-y-0 p-3 border rounded-lg">
                            <FormControl>
                              <Checkbox
                                checked={field.value}
                                onCheckedChange={field.onChange}
                              />
                            </FormControl>
                            <div className="flex-1 space-y-1">
                              <FormLabel className="text-sm font-medium">É Comprador</FormLabel>
                              <p className="text-xs text-muted-foreground">
                                Pode gerenciar a fase de cotação
                              </p>
                            </div>
                          </FormItem>
                        )}
                      />

                      <FormField
                        control={form.control}
                        name="isApproverA1"
                        render={({ field }) => (
                          <FormItem className="flex items-start space-x-3 space-y-0 p-3 border rounded-lg">
                            <FormControl>
                              <Checkbox
                                checked={field.value}
                                onCheckedChange={field.onChange}
                              />
                            </FormControl>
                            <div className="flex-1 space-y-1">
                              <FormLabel className="text-sm font-medium">É Aprovador A1</FormLabel>
                              <p className="text-xs text-muted-foreground">
                                Pode aprovar solicitações iniciais
                              </p>
                            </div>
                          </FormItem>
                        )}
                      />

                      <FormField
                        control={form.control}
                        name="isApproverA2"
                        render={({ field }) => (
                          <FormItem className="flex items-start space-x-3 space-y-0 p-3 border rounded-lg">
                            <FormControl>
                              <Checkbox
                                checked={field.value}
                                onCheckedChange={field.onChange}
                              />
                            </FormControl>
                            <div className="flex-1 space-y-1">
                              <FormLabel className="text-sm font-medium">É Aprovador A2</FormLabel>
                              <p className="text-xs text-muted-foreground">
                                Pode aprovar compras finais
                              </p>
                            </div>
                          </FormItem>
                        )}
                      />

                      <FormField
                        control={form.control}
                        name="isManager"
                        render={({ field }) => (
                          <FormItem className="flex items-start space-x-3 space-y-0 p-3 border rounded-lg">
                            <FormControl>
                              <Checkbox
                                checked={field.value}
                                onCheckedChange={field.onChange}
                              />
                            </FormControl>
                            <div className="flex-1 space-y-1">
                              <FormLabel className="text-sm font-medium">É Gerente</FormLabel>
                              <p className="text-xs text-muted-foreground">
                                Pode acessar dashboard executivo
                              </p>
                            </div>
                          </FormItem>
                        )}
                      />

                      <FormField
                        control={form.control}
                        name="isReceiver"
                        render={({ field }) => (
                          <FormItem className="flex items-start space-x-3 space-y-0 p-3 border rounded-lg">
                            <FormControl>
                              <Checkbox
                                checked={field.value}
                                onCheckedChange={field.onChange}
                              />
                            </FormControl>
                            <div className="flex-1 space-y-1">
                              <FormLabel className="text-sm font-medium">É Recebedor</FormLabel>
                              <p className="text-xs text-muted-foreground">
                                Pode acessar fase de recebimento de materiais
                              </p>
                            </div>
                          </FormItem>
                        )}
                      />
                    </div>
                  </TabsContent>
                </div>
              </Tabs>
              
              <div className="flex justify-end space-x-3 pt-4 border-t mt-6">
                <Button type="button" variant="outline" onClick={handleCloseModal}>
                  Cancelar
                </Button>
                <Button 
                  type="submit" 
                  disabled={createUserMutation.isPending}
                >
                  {createUserMutation.isPending 
                    ? "Salvando..." 
                    : editingUser ? "Atualizar Usuário" : "Criar Usuário"
                  }
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
