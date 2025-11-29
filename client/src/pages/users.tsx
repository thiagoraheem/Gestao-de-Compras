import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Plus, Edit, Shield, User, Building, Shield as ShieldIcon, Trash2, AlertTriangle, Crown, UserCheck } from "lucide-react";
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
  isCEO: z.boolean().default(false),
  isDirector: z.boolean().default(false),
}).refine((data) => {
  // Password is required only when creating a new user
  if (!data.password || data.password === "") {
    return true; // Password is optional for editing
  }
  return data.password.length >= 6;
}, {
  message: "Senha deve ter pelo menos 6 caracteres",
  path: ["password"],
}).refine((data) => {
  // CEO and Director validation: CEO cannot be Director and vice versa
  if (data.isCEO && data.isDirector) {
    return false;
  }
  return true;
}, {
  message: "Um usuário não pode ser CEO e Diretor ao mesmo tempo",
  path: ["isCEO"],
});

type UserFormData = z.infer<typeof userSchema>;

export default function UsersPage() {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<any>(null);
  const [selectedCostCenters, setSelectedCostCenters] = useState<number[]>([]);
  const [deletingUser, setDeletingUser] = useState<any>(null);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [deleteCheckResult, setDeleteCheckResult] = useState<any>(null);
  const [searchTerm, setSearchTerm] = useState("");
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
      isCEO: false,
      isDirector: false,
    },
  });

  const createUserMutation = useMutation({
    mutationFn: async (data: UserFormData) => {
      const endpoint = editingUser 
        ? `/api/users/${editingUser.id}`
        : "/api/users";
      const method = editingUser ? "PUT" : "POST";
      const response = await apiRequest(endpoint, {
        method,
        body: {
          ...data,
          costCenterIds: selectedCostCenters
        }
      });
      return response;
    },
    onMutate: async (data) => {
      // Cancel any outgoing refetches (so they don't overwrite our optimistic update)
      await queryClient.cancelQueries({ queryKey: ["/api/users"] });
      
      // Snapshot the previous value
      const previousUsers = queryClient.getQueryData(["/api/users"]);
      
      if (!editingUser) {
        // For new users, add optimistic entry
        queryClient.setQueryData(["/api/users"], (old: any[]) => {
          if (!Array.isArray(old)) return old;
          const optimisticUser = {
            id: Date.now(), // Temporary ID
            ...data,
            department: data.departmentId ? departments.find(d => d.id === data.departmentId) : null,
            costCenters: selectedCostCenters.map(id => costCenters.find(cc => cc.id === id)).filter(Boolean)
          };
          return [...old, optimisticUser];
        });
      } else {
        // For editing, update existing user
        queryClient.setQueryData(["/api/users"], (old: any[]) => {
          if (!Array.isArray(old)) return old;
          return old.map(user => 
            user.id === editingUser.id 
              ? { 
                  ...user, 
                  ...data,
                  department: data.departmentId ? departments.find(d => d.id === data.departmentId) : null,
                  costCenters: selectedCostCenters.map(id => costCenters.find(cc => cc.id === id)).filter(Boolean)
                }
              : user
          );
        });
      }
      
      // Return a context object with the snapshotted value
      return { previousUsers };
    },
    onError: (err, variables, context) => {
      // If the mutation fails, use the context returned from onMutate to roll back
      if (context?.previousUsers) {
        queryClient.setQueryData(["/api/users"], context.previousUsers);
      }
      
      let errorMessage = "Falha ao salvar usuário";
      if (err?.response?.data?.message) {
        errorMessage = err.response.data.message;
      } else if (err?.message) {
        errorMessage = err.message;
      }

      toast({
        title: "Erro",
        description: errorMessage,
        variant: "destructive",
      });
    },
    onSuccess: () => {
      // Comprehensive cache invalidation for user-related data
      queryClient.invalidateQueries({ queryKey: ["/api/users"] });
      queryClient.invalidateQueries({ queryKey: ["/api/cost-centers"] });
      queryClient.invalidateQueries({ queryKey: ["/api/departments"] });
      
      // Invalidate user-specific cost center queries
      queryClient.invalidateQueries({ 
        predicate: (query) => 
          !!(query.queryKey[0]?.toString().includes(`/api/users/`) &&
          query.queryKey[0]?.toString().includes(`/cost-centers`))
      });
      
      // Force immediate refetch for real data
      queryClient.refetchQueries({ queryKey: ["/api/users"] });
      queryClient.refetchQueries({ queryKey: ["/api/cost-centers"] });
      queryClient.refetchQueries({ queryKey: ["/api/departments"] });
      
      toast({
        title: "Sucesso",
        description: editingUser 
          ? "Usuário atualizado com sucesso!"
          : "Usuário criado com sucesso!",
      });
      handleCloseModal();
    },
  });

  const checkDeleteUserMutation = useMutation({
    mutationFn: async (userId: number) => {
      const response = await apiRequest(`/api/users/${userId}/can-delete`, { method: "GET" });
      return response;
    },
    onSuccess: (data, userId) => {
      setDeleteCheckResult(data);
      if (data.canDelete) {
        setIsDeleteDialogOpen(true);
      } else {
        toast({
          title: "Não é possível excluir",
          description: `${data.reason}. ${data.associatedRequests ? `Registros associados: ${data.associatedRequests}` : ""}`,
          variant: "destructive",
        });
      }
    },
    onError: () => {
      toast({
        title: "Erro",
        description: "Falha ao verificar se o usuário pode ser excluído",
        variant: "destructive",
      });
    },
  });

  const deleteUserMutation = useMutation({
    mutationFn: async (userId: number) => {
      const response = await apiRequest(`/api/users/${userId}`, { method: "DELETE" });
      return response;
    },
    onMutate: async (userId) => {
      // Cancel any outgoing refetches
      await queryClient.cancelQueries({ queryKey: ["/api/users"] });
      
      // Snapshot the previous value
      const previousUsers = queryClient.getQueryData(["/api/users"]);
      
      // Optimistically remove user
      queryClient.setQueryData(["/api/users"], (old: any[]) => {
        if (!Array.isArray(old)) return old;
        return old.filter(user => user.id !== userId);
      });
      
      return { previousUsers };
    },
    onError: (err, variables, context) => {
      // Roll back on error
      if (context?.previousUsers) {
        queryClient.setQueryData(["/api/users"], context.previousUsers);
      }
      
      toast({
        title: "Erro",
        description: "Falha ao excluir usuário",
        variant: "destructive",
      });
    },
    onSuccess: () => {
      // Comprehensive cache invalidation for user-related data
      queryClient.invalidateQueries({ queryKey: ["/api/users"] });
      queryClient.invalidateQueries({ queryKey: ["/api/cost-centers"] });
      queryClient.invalidateQueries({ queryKey: ["/api/departments"] });
      
      // Force immediate refetch for real data
      queryClient.refetchQueries({ queryKey: ["/api/users"] });
      
      toast({
        title: "Sucesso",
        description: "Usuário excluído com sucesso",
      });
      setIsDeleteDialogOpen(false);
      setDeletingUser(null);
      setDeleteCheckResult(null);
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
      isCEO: user.isCEO || false,
      isDirector: user.isDirector || false,
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
    if (user.isReceiver) roles.push("Recebedor");
    if (user.isCEO) roles.push("CEO");
    if (user.isDirector) roles.push("Diretor");
    return roles;
  };

  const handleDeleteUser = (user: any) => {
    setDeletingUser(user);
    checkDeleteUserMutation.mutate(user.id);
  };

  const confirmDeleteUser = () => {
    if (deletingUser) {
      deleteUserMutation.mutate(deletingUser.id);
    }
  };

  return (
    <AdminRoute>
      <div className="h-screen overflow-y-auto max-w-7xl mx-auto p-6">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle>Usuários</CardTitle>
                <div className="flex items-center gap-3">
                  <Input
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    placeholder="Filtrar por nome, username, email, departamento, função"
                    className="w-80"
                  />
                  <Button onClick={() => setIsModalOpen(true)}>
                    <Plus className="mr-2 h-4 w-4" />
                    Novo Usuário
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent className="overflow-y-auto max-h-[calc(100vh-220px)]">
              {isLoading ? (
                <div className="space-y-3">
                  {[...Array(5)].map((_, i) => (
                    <Skeleton key={i} className="h-12 w-full" />
                  ))}
                </div>
              ) : (
                (() => {
                  const normalize = (s: any) => (s ?? "").toString().toLowerCase();
                  const fullNameOf = (u: any) => `${u.firstName || ""} ${u.lastName || ""}`.trim() || u.username || "";
                  const matches = (u: any) => {
                    const term = normalize(searchTerm);
                    if (!term) return true;
                    const dept = u.department ? `${u.department.name ?? ""} ${u.department.code ?? ""}` : "";
                    const ccs = Array.isArray(u.costCenters) ? u.costCenters.map((cc: any) => `${cc.name ?? ""} ${cc.code ?? ""}`).join(" ") : "";
                    const rolesText = getUserRoles(u).join(" ");
                    const haystack = [
                      fullNameOf(u),
                      u.username,
                      u.email,
                      dept,
                      ccs,
                      rolesText,
                    ].map(normalize).join(" ");
                    return haystack.includes(normalize(searchTerm));
                  };
                  const sorted = [...users].sort((a: any, b: any) => {
                    const an = normalize(fullNameOf(a));
                    const bn = normalize(fullNameOf(b));
                    if (an < bn) return -1;
                    if (an > bn) return 1;
                    return 0;
                  }).filter(matches);
                  return (
                    <div className="overflow-x-auto">
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
                    {sorted?.map((user: any) => (
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
                              <div className="flex space-x-2">
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => handleEditUser(user)}
                                >
                                  <Edit className="h-4 w-4" />
                                </Button>
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => handleDeleteUser(user)}
                                  disabled={checkDeleteUserMutation.isPending}
                                >
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              </div>
                            </TableCell>
                          </TableRow>
                        ))}
                    {sorted?.length === 0 && (
                          <TableRow>
                            <TableCell colSpan={5} className="text-center text-gray-500 py-8">
                              Nenhum usuário cadastrado
                            </TableCell>
                          </TableRow>
                        )}
                      </TableBody>
                    </Table>
                    </div>
                  );
                })()
              )}
            </CardContent>
          </Card>

      <Dialog open={isModalOpen} onOpenChange={handleCloseModal}>
        <DialogContent className="sm:max-w-2xl max-h-[85vh] flex flex-col">
          <DialogHeader>
            <DialogTitle>
              {editingUser ? "Editar Usuário" : "Novo Usuário"}
            </DialogTitle>
            <DialogDescription>
              {editingUser ? "Edite as informações do usuário selecionado." : "Preencha os dados para criar um novo usuário no sistema."}
            </DialogDescription>
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

                      <FormField
                        control={form.control}
                        name="isCEO"
                        render={({ field }) => (
                          <FormItem className="flex items-start space-x-3 space-y-0 p-3 border rounded-lg bg-purple-50 border-purple-200">
                            <FormControl>
                              <Checkbox
                                checked={field.value}
                                onCheckedChange={field.onChange}
                              />
                            </FormControl>
                            <div className="flex-1 space-y-1">
                              <FormLabel className="text-sm font-medium text-purple-700">
                                <Crown className="inline h-4 w-4 mr-1" />
                                É CEO
                              </FormLabel>
                              <p className="text-xs text-purple-600">
                                Pode aprovar compras de alto valor na dupla aprovação
                              </p>
                            </div>
                          </FormItem>
                        )}
                      />

                      <FormField
                        control={form.control}
                        name="isDirector"
                        render={({ field }) => (
                          <FormItem className="flex items-start space-x-3 space-y-0 p-3 border rounded-lg bg-blue-50 border-blue-200">
                            <FormControl>
                              <Checkbox
                                checked={field.value}
                                onCheckedChange={field.onChange}
                              />
                            </FormControl>
                            <div className="flex-1 space-y-1">
                              <FormLabel className="text-sm font-medium text-blue-700">
                                <UserCheck className="inline h-4 w-4 mr-1" />
                                É Diretor
                              </FormLabel>
                              <p className="text-xs text-blue-600">
                                Pode iniciar aprovação de compras de alto valor
                              </p>
                            </div>
                          </FormItem>
                        )}
                      />

                      <FormField
                        control={form.control}
                        name="isAdmin"
                        render={({ field }) => (
                          <FormItem className="flex items-start space-x-3 space-y-0 p-3 border rounded-lg bg-red-50 border-red-200">
                            <FormControl>
                              <Checkbox
                                checked={field.value}
                                onCheckedChange={field.onChange}
                              />
                            </FormControl>
                            <div className="flex-1 space-y-1">
                              <FormLabel className="text-sm font-medium text-red-700">
                                <Shield className="inline h-4 w-4 mr-1" />
                                É Administrador
                              </FormLabel>
                              <p className="text-xs text-red-600">
                                Acesso total ao sistema - Gerenciar usuários, empresas, departamentos e configurações
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

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center">
              <AlertTriangle className="h-5 w-5 text-red-500 mr-2" />
              Confirmar Exclusão
            </AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja excluir o usuário{" "}
              <strong>
                {deletingUser?.firstName && deletingUser?.lastName
                  ? `${deletingUser.firstName} ${deletingUser.lastName}`
                  : deletingUser?.username}
              </strong>
              ?
              <br />
              <br />
              Esta ação não pode ser desfeita e removerá permanentemente:
              <ul className="list-disc list-inside mt-2 space-y-1 text-sm">
                <li>Dados do usuário</li>
                <li>Associações com departamentos e centros de custo</li>
                <li>Permissões de acesso</li>
              </ul>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel
              onClick={() => {
                setIsDeleteDialogOpen(false);
                setDeletingUser(null);
                setDeleteCheckResult(null);
              }}
            >
              Cancelar
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmDeleteUser}
              disabled={deleteUserMutation.isPending}
              className="bg-red-600 hover:bg-red-700"
            >
              {deleteUserMutation.isPending ? "Excluindo..." : "Excluir"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      </div>
    </AdminRoute>
  );
}
