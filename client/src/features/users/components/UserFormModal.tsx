import { useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/shared/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/shared/ui/form";
import { Input } from "@/shared/ui/input";
import { Switch } from "@/shared/ui/switch";
import { Checkbox } from "@/shared/ui/checkbox";
import { Button } from "@/shared/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/shared/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/shared/ui/tabs";
import { Crown, Shield, UserCheck, User, Building, Shield as ShieldIcon } from "lucide-react";
import { UseFormReturn } from "react-hook-form";
import { UserFormData } from "../schemas/user.schema";

interface UserFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  form: UseFormReturn<UserFormData>;
  editingUser: any;
  departments: any[];
  costCenters: any[];
  selectedCostCenters: number[];
  setSelectedCostCenters: (ids: number[]) => void;
  onSubmit: (data: UserFormData) => void;
  onFormError: (errors: any) => void;
  isPending: boolean;
}

export function UserFormModal({
  isOpen,
  onClose,
  form,
  editingUser,
  departments,
  costCenters,
  selectedCostCenters,
  setSelectedCostCenters,
  onSubmit,
  onFormError,
  isPending
}: UserFormModalProps) {

  useEffect(() => {
    if (editingUser) {
      fetch(`/api/users/${editingUser.id}/cost-centers`)
        .then(res => res.json())
        .then(data => setSelectedCostCenters(data))
        .catch(() => setSelectedCostCenters([]));
    } else {
      setSelectedCostCenters([]);
    }
  }, [editingUser, setSelectedCostCenters]);

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
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
          {/* Note: changed standard onSubmit to work seamlessly with RHF */}
          <form onSubmit={form.handleSubmit(onSubmit, onFormError)} className="flex flex-col flex-1 overflow-hidden">
            <div className="flex items-center justify-between mb-4 p-4 rounded-lg border bg-muted/20">
              <div className="space-y-0.5">
                <FormLabel className="text-base font-semibold">Status do Usuário</FormLabel>
                <p className="text-sm text-muted-foreground">
                  Define se o usuário pode acessar o sistema e ser atribuído a tarefas.
                </p>
              </div>
              <FormField
                control={form.control}
                name="isActive"
                render={({ field }) => (
                  <FormItem className="flex items-center space-x-3">
                    <FormControl>
                      <Switch
                        checked={field.value}
                        onCheckedChange={field.onChange}
                        className="data-[state=checked]:bg-green-500"
                      />
                    </FormControl>
                    <span className={`font-medium ${field.value ? "text-green-600" : "text-gray-500"}`}>
                      {field.value ? "Ativo" : "Inativo"}
                    </span>
                  </FormItem>
                )}
              />
            </div>
            
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
                    <FormField control={form.control} name="firstName" render={({ field }) => (
                      <FormItem>
                        <FormLabel>Primeiro Nome *</FormLabel>
                        <FormControl>
                          <Input {...field} placeholder="Digite o primeiro nome" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )} />
                    <FormField control={form.control} name="lastName" render={({ field }) => (
                      <FormItem>
                        <FormLabel>Último Nome *</FormLabel>
                        <FormControl>
                          <Input {...field} placeholder="Digite o último nome" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )} />
                  </div>

                  <FormField control={form.control} name="username" render={({ field }) => (
                    <FormItem>
                      <FormLabel>Username</FormLabel>
                      <FormControl><Input {...field} placeholder="Digite o nome de usuário" /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )} />

                  <FormField control={form.control} name="email" render={({ field }) => (
                    <FormItem>
                      <FormLabel>Email *</FormLabel>
                      <FormControl><Input {...field} type="email" placeholder="Digite o email" /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )} />

                  {!editingUser && (
                    <FormField control={form.control} name="password" render={({ field }) => (
                      <FormItem>
                        <FormLabel>Senha *</FormLabel>
                        <FormControl><Input {...field} type="password" placeholder="Digite a senha" /></FormControl>
                        <FormMessage />
                      </FormItem>
                    )} />
                  )}
                </TabsContent>

                <TabsContent value="departamento" className="space-y-4 mt-0">
                  <FormField control={form.control} name="departmentId" render={({ field }) => (
                    <FormItem>
                      <FormLabel>Departamento</FormLabel>
                      <Select 
                        onValueChange={(value) => field.onChange(value === "none" ? null : parseInt(value))} 
                        value={field.value?.toString() || "none"}
                      >
                        <FormControl>
                          <SelectTrigger><SelectValue placeholder="Selecione o departamento" /></SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="none">Nenhum departamento</SelectItem>
                          {Array.isArray(departments) && departments.map((dept: any) => (
                            <SelectItem key={dept.id} value={dept.id.toString()}>{dept.name}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )} />

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
                            <label htmlFor={`cc-${cc.id}`} className="text-sm font-medium leading-none cursor-pointer">
                              {cc.name}
                            </label>
                            <p className="text-xs text-muted-foreground">{cc.code}</p>
                          </div>
                        </div>
                      ))}
                      {(!Array.isArray(costCenters) || costCenters.length === 0) && (
                        <p className="text-sm text-muted-foreground py-4 text-center">Nenhum centro de custo disponível</p>
                      )}
                    </div>
                  </div>
                </TabsContent>

                <TabsContent value="permissoes" className="space-y-4 mt-0">
                  <div className="space-y-1 mb-4">
                    <h3 className="text-sm font-medium">Permissões do Sistema</h3>
                  </div>
                  
                  <div className="space-y-3">
                    <FormField control={form.control} name="isBuyer" render={({ field }) => (
                      <FormItem className="flex items-start space-x-3 space-y-0 p-3 border rounded-lg">
                        <FormControl><Checkbox checked={field.value} onCheckedChange={field.onChange} /></FormControl>
                        <div className="flex-1 space-y-1">
                          <FormLabel className="text-sm font-medium">É Comprador</FormLabel>
                          <p className="text-xs text-muted-foreground">Pode gerenciar a fase de cotação</p>
                        </div>
                      </FormItem>
                    )} />

                    <FormField control={form.control} name="isApproverA1" render={({ field }) => (
                      <FormItem className="flex items-start space-x-3 space-y-0 p-3 border rounded-lg">
                        <FormControl><Checkbox checked={field.value} onCheckedChange={field.onChange} /></FormControl>
                        <div className="flex-1 space-y-1">
                          <FormLabel className="text-sm font-medium">É Aprovador A1</FormLabel>
                          <p className="text-xs text-muted-foreground">Pode aprovar solicitações iniciais</p>
                        </div>
                      </FormItem>
                    )} />

                    <FormField control={form.control} name="isApproverA2" render={({ field }) => (
                      <FormItem className="flex items-start space-x-3 space-y-0 p-3 border rounded-lg">
                        <FormControl><Checkbox checked={field.value} onCheckedChange={field.onChange} /></FormControl>
                        <div className="flex-1 space-y-1">
                          <FormLabel className="text-sm font-medium">É Aprovador A2</FormLabel>
                          <p className="text-xs text-muted-foreground">Pode aprovar compras finais</p>
                        </div>
                      </FormItem>
                    )} />

                    <FormField control={form.control} name="isManager" render={({ field }) => (
                      <FormItem className="flex items-start space-x-3 space-y-0 p-3 border rounded-lg">
                        <FormControl><Checkbox checked={field.value} onCheckedChange={field.onChange} /></FormControl>
                        <div className="flex-1 space-y-1">
                          <FormLabel className="text-sm font-medium">É Gerente</FormLabel>
                          <p className="text-xs text-muted-foreground">Pode acessar dashboard executivo</p>
                        </div>
                      </FormItem>
                    )} />

                    <FormField control={form.control} name="isReceiver" render={({ field }) => (
                      <FormItem className="flex items-start space-x-3 space-y-0 p-3 border rounded-lg">
                        <FormControl><Checkbox checked={field.value} onCheckedChange={field.onChange} /></FormControl>
                        <div className="flex-1 space-y-1">
                          <FormLabel className="text-sm font-medium">É Recebedor</FormLabel>
                          <p className="text-xs text-muted-foreground">Pode acessar fase de recebimento de materiais</p>
                        </div>
                      </FormItem>
                    )} />

                    <FormField control={form.control} name="isCEO" render={({ field }) => (
                      <FormItem className="flex items-start space-x-3 space-y-0 p-3 border rounded-lg bg-purple-50 border-purple-200">
                        <FormControl><Checkbox checked={field.value} onCheckedChange={field.onChange} /></FormControl>
                        <div className="flex-1 space-y-1">
                          <FormLabel className="text-sm font-medium text-purple-700">
                            <Crown className="inline h-4 w-4 mr-1" /> É CEO
                          </FormLabel>
                          <p className="text-xs text-purple-600">Pode aprovar compras de alto valor na dupla aprovação</p>
                        </div>
                      </FormItem>
                    )} />

                    <FormField control={form.control} name="isDirector" render={({ field }) => (
                      <FormItem className="flex items-start space-x-3 space-y-0 p-3 border rounded-lg bg-blue-50 border-blue-200">
                        <FormControl><Checkbox checked={field.value} onCheckedChange={field.onChange} /></FormControl>
                        <div className="flex-1 space-y-1">
                          <FormLabel className="text-sm font-medium text-blue-700">
                            <UserCheck className="inline h-4 w-4 mr-1" /> É Diretor
                          </FormLabel>
                          <p className="text-xs text-blue-600">Pode iniciar aprovação de compras de alto valor</p>
                        </div>
                      </FormItem>
                    )} />

                    <FormField control={form.control} name="isAdmin" render={({ field }) => (
                      <FormItem className="flex items-start space-x-3 space-y-0 p-3 border rounded-lg bg-red-50 border-red-200">
                        <FormControl><Checkbox checked={field.value} onCheckedChange={field.onChange} /></FormControl>
                        <div className="flex-1 space-y-1">
                          <FormLabel className="text-sm font-medium text-red-700">
                            <Shield className="inline h-4 w-4 mr-1" /> É Administrador
                          </FormLabel>
                          <p className="text-xs text-red-600">Acesso total ao sistema - Gerenciar usuários, empresas, departamentos e configurações</p>
                        </div>
                      </FormItem>
                    )} />
                  </div>
                </TabsContent>
              </div>
            </Tabs>
            
            <div className="flex justify-end space-x-3 pt-4 border-t mt-6">
              <Button type="button" variant="outline" onClick={onClose}>
                Cancelar
              </Button>
              <Button type="submit" disabled={isPending}>
                {isPending ? "Salvando..." : editingUser ? "Atualizar Usuário" : "Criar Usuário"}
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
