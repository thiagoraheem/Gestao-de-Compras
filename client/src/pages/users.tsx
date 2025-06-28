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
import { Plus, Edit } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

const userSchema = z.object({
  username: z.string().min(1, "Username é obrigatório"),
  email: z.string().email("Email inválido"),
  password: z.string().min(6, "Senha deve ter pelo menos 6 caracteres"),
  firstName: z.string().optional(),
  lastName: z.string().optional(),
  departmentId: z.number().nullable().optional(),
  isBuyer: z.boolean().default(false),
  isApproverA1: z.boolean().default(false),
  isApproverA2: z.boolean().default(false),
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
    onError: () => {
      toast({
        title: "Erro",
        description: "Falha ao salvar usuário",
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
    });
    setIsModalOpen(true);
  };

  const onSubmit = (data: UserFormData) => {
    createUserMutation.mutate(data);
  };

  const getUserRoles = (user: any) => {
    const roles = [];
    if (user.isBuyer) roles.push("Comprador");
    if (user.isApproverA1) roles.push("Aprovador A1");
    if (user.isApproverA2) roles.push("Aprovador A2");
    return roles;
  };

  return (
    <div className="max-w-7xl mx-auto">
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
        <DialogContent className="sm:max-w-lg max-h-[85vh] flex flex-col">
          <DialogHeader>
            <DialogTitle>
              {editingUser ? "Editar Usuário" : "Novo Usuário"}
            </DialogTitle>
          </DialogHeader>
          
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="flex flex-col flex-1 overflow-hidden">
              <div className="flex-1 overflow-y-auto pr-2 space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="firstName"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Primeiro Nome</FormLabel>
                        <FormControl>
                          <Input {...field} />
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
                        <FormLabel>Último Nome</FormLabel>
                        <FormControl>
                          <Input {...field} />
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
                    <FormLabel>Username *</FormLabel>
                    <FormControl>
                      <Input {...field} />
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
                      <Input {...field} type="email" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="password"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>
                      Senha * {editingUser && "(deixe em branco para manter atual)"}
                    </FormLabel>
                    <FormControl>
                      <Input {...field} type="password" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

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
                          <SelectValue placeholder="Selecione um departamento" />
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

              <div className="space-y-2">
                <FormLabel>Centros de Custo</FormLabel>
                <div className="border rounded-md p-3 max-h-40 overflow-y-auto">
                  {Array.isArray(costCenters) && costCenters.map((cc: any) => (
                    <div key={cc.id} className="flex items-center space-x-2 py-1">
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
                      <label 
                        htmlFor={`cc-${cc.id}`} 
                        className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                      >
                        {cc.code} - {cc.name}
                      </label>
                    </div>
                  ))}
                  {(!Array.isArray(costCenters) || costCenters.length === 0) && (
                    <p className="text-sm text-muted-foreground">Nenhum centro de custo disponível</p>
                  )}
                </div>
              </div>

              <div className="space-y-3">
                <FormLabel>Permissões</FormLabel>
                
                <FormField
                  control={form.control}
                  name="isBuyer"
                  render={({ field }) => (
                    <FormItem className="flex flex-row items-start space-x-3 space-y-0">
                      <FormControl>
                        <Checkbox
                          checked={field.value}
                          onCheckedChange={field.onChange}
                        />
                      </FormControl>
                      <div className="space-y-1 leading-none">
                        <FormLabel>É Comprador</FormLabel>
                        <p className="text-sm text-muted-foreground">
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
                    <FormItem className="flex flex-row items-start space-x-3 space-y-0">
                      <FormControl>
                        <Checkbox
                          checked={field.value}
                          onCheckedChange={field.onChange}
                        />
                      </FormControl>
                      <div className="space-y-1 leading-none">
                        <FormLabel>É Aprovador A1</FormLabel>
                        <p className="text-sm text-muted-foreground">
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
                    <FormItem className="flex flex-row items-start space-x-3 space-y-0">
                      <FormControl>
                        <Checkbox
                          checked={field.value}
                          onCheckedChange={field.onChange}
                        />
                      </FormControl>
                      <div className="space-y-1 leading-none">
                        <FormLabel>É Aprovador A2</FormLabel>
                        <p className="text-sm text-muted-foreground">
                          Pode aprovar compras finais
                        </p>
                      </div>
                    </FormItem>
                  )}
                />
              </div>
              </div>
              
              <div className="flex justify-end space-x-3 pt-4 border-t">
                <Button type="button" variant="outline" onClick={handleCloseModal}>
                  Cancelar
                </Button>
                <Button type="submit" disabled={createUserMutation.isPending}>
                  {createUserMutation.isPending 
                    ? "Salvando..." 
                    : editingUser ? "Atualizar" : "Criar"
                  }
                </Button>
              </div>
            </form>
          </Form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
