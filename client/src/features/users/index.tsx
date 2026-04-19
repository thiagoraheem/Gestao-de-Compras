import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Card, CardContent, CardHeader, CardTitle } from "@/shared/ui/card";
import { Button } from "@/shared/ui/button";
import { Input } from "@/shared/ui/input";
import { Plus } from "lucide-react";
import { useUsers } from "@/features/users/hooks/useUsers";
import { useToast } from "@/hooks/use-toast";
import AdminRoute from "@/components/AdminRoute";

// Modular Components
import { UserList } from "./components/UserList";
import { UserFormModal } from "./components/UserFormModal";
import { 
  ResetPasswordDialog, 
  SetPasswordDialog, 
  DeleteConfirmDialog 
} from "./components/UserActionsModals";

// Schemas
import { 
  userSchema, 
  UserFormData, 
  setPasswordSchema, 
  SetPasswordFormData 
} from "./schemas/user.schema";

export function UsersManagement() {
  const { toast } = useToast();
  const [searchTerm, setSearchTerm] = useState("");
  
  // Modals state
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<any>(null);
  
  const [resettingUser, setResettingUser] = useState<any>(null);
  const [isResetPasswordDialogOpen, setIsResetPasswordDialogOpen] = useState(false);
  const [newTemporaryPassword, setNewTemporaryPassword] = useState<string | null>(null);

  const [settingPasswordUser, setSettingPasswordUser] = useState<any>(null);
  const [isSetPasswordModalOpen, setIsSetPasswordModalOpen] = useState(false);

  const [deletingUser, setDeletingUser] = useState<any>(null);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [deleteCheckResult, setDeleteCheckResult] = useState<any>(null);

  const [selectedCostCenters, setSelectedCostCenters] = useState<number[]>([]);

  // Hooks
  const {
    users,
    departments,
    costCenters,
    isLoading,
    createUserMutation,
    checkDeleteUserMutation,
    deleteUserMutation,
    resetPasswordMutation,
    setPasswordMutation
  } = useUsers();

  // Forms
  const form = useForm<UserFormData>({
    resolver: zodResolver(userSchema),
    defaultValues: {
      username: "", email: "", password: "", firstName: "", lastName: "", departmentId: null,
      isBuyer: false, isApproverA1: false, isApproverA2: false, isAdmin: false, isManager: false, 
      isReceiver: false, isCEO: false, isDirector: false, isActive: true,
    },
  });

  const setPasswordForm = useForm<SetPasswordFormData>({
    resolver: zodResolver(setPasswordSchema),
    defaultValues: { password: "", confirmPassword: "" },
  });

  // Handlers - User Form
  const handleOpenNewUser = () => {
    setEditingUser(null);
    form.reset();
    setIsModalOpen(true);
  };

  const handleEditUser = (user: any) => {
    setEditingUser(user);
    form.reset({
      username: user.username || "",
      email: user.email || "",
      password: "", // Security
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
      isActive: user.isActive ?? true,
    });
    setIsModalOpen(true);
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
    setEditingUser(null);
    form.reset();
  };

  const onSubmitUser = (data: UserFormData) => {
    if (editingUser && !data.password) {
      const { password, ...dataWithoutPassword } = data;
      createUserMutation.mutate({ data: dataWithoutPassword as UserFormData, editingUser, selectedCostCenters }, {
        onSuccess: () => {
          toast({ title: "Sucesso", description: "Usuário atualizado com sucesso!" });
          handleCloseModal();
        },
        onError: (err: any) => {
          toast({ title: "Erro", description: err?.response?.data?.message || err?.message || "Falha ao salvar usuário", variant: "destructive" });
        }
      });
    } else {
      createUserMutation.mutate({ data, editingUser, selectedCostCenters }, {
        onSuccess: () => {
          toast({ title: "Sucesso", description: "Usuário criado com sucesso!" });
          handleCloseModal();
        },
        onError: (err: any) => {
          toast({ title: "Erro", description: err?.response?.data?.message || err?.message || "Falha ao salvar usuário", variant: "destructive" });
        }
      });
    }
  };

  const onFormError = () => {
    toast({ title: "Erro no preenchimento", description: "Por favor, preencha todos os campos obrigatórios corretamente.", variant: "destructive" });
  };

  // Handlers - Delete
  const handleDeleteUser = (user: any) => {
    setDeletingUser(user);
    checkDeleteUserMutation.mutate(user.id, {
      onSuccess: (data) => {
        setDeleteCheckResult(data);
        if (data.canDelete) {
          setIsDeleteDialogOpen(true);
        } else {
          toast({ title: "Não é possível excluir", description: `${data.reason}. ${data.associatedRequests ? `Registros associados: ${data.associatedRequests}` : ""}`, variant: "destructive" });
        }
      },
      onError: () => toast({ title: "Erro", description: "Falha ao verificar exclusão", variant: "destructive" })
    });
  };

  const confirmDeleteUser = () => {
    if (deletingUser) {
      deleteUserMutation.mutate(deletingUser.id, {
        onSuccess: () => {
          toast({ title: "Sucesso", description: "Usuário excluído com sucesso" });
          setIsDeleteDialogOpen(false); setDeletingUser(null); setDeleteCheckResult(null);
        },
        onError: () => toast({ title: "Erro", description: "Falha ao excluir usuário", variant: "destructive" })
      });
    }
  };

  // Handlers - Reset / Set Passwords
  const handleResetPassword = (user: any) => {
    setResettingUser(user); setNewTemporaryPassword(null); setIsResetPasswordDialogOpen(true);
  };
  
  const confirmResetPassword = () => {
    if (resettingUser) {
      resetPasswordMutation.mutate(resettingUser.id, {
        onSuccess: (data: any) => {
          setNewTemporaryPassword(data.tempPassword);
          toast({ title: "Sucesso", description: "Senha redefinida com sucesso." });
        },
        onError: (err: any) => {
          toast({ title: "Erro", description: "Falha ao redefinir senha: " + err.message, variant: "destructive" });
          setIsResetPasswordDialogOpen(false); setResettingUser(null);
        }
      });
    }
  };

  const handleSetPassword = (user: any) => {
    setSettingPasswordUser(user); setPasswordForm.reset(); setIsSetPasswordModalOpen(true);
  };

  const handleCloseSetPasswordModal = () => {
    setIsSetPasswordModalOpen(false); setSettingPasswordUser(null); setPasswordForm.reset();
  };

  const onSetPasswordSubmit = (data: SetPasswordFormData) => {
    if (settingPasswordUser) {
      setPasswordMutation.mutate({ userId: settingPasswordUser.id, password: data.password }, {
        onSuccess: () => {
          toast({ title: "Sucesso", description: "Senha alterada com sucesso." });
          handleCloseSetPasswordModal();
        },
        onError: (err: any) => {
          toast({ title: "Erro", description: err?.response?.data?.message || err.message || "Falha ao alterar senha", variant: "destructive" });
        }
      });
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
                  placeholder="Filtrar por nome, username, email..."
                  className="w-80"
                />
                <Button onClick={handleOpenNewUser}>
                  <Plus className="mr-2 h-4 w-4" />
                  Novo Usuário
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent className="overflow-y-auto max-h-[calc(100vh-220px)]">
            <UserList 
              users={users}
              isLoading={isLoading}
              searchTerm={searchTerm}
              isDeletePending={checkDeleteUserMutation.isPending}
              onEdit={handleEditUser}
              onResetPassword={handleResetPassword}
              onSetPassword={handleSetPassword}
              onDelete={handleDeleteUser}
            />
          </CardContent>
        </Card>

        {/* Modals */}
        <UserFormModal 
          isOpen={isModalOpen}
          onClose={handleCloseModal}
          form={form}
          editingUser={editingUser}
          departments={departments}
          costCenters={costCenters}
          selectedCostCenters={selectedCostCenters}
          setSelectedCostCenters={setSelectedCostCenters}
          onSubmit={onSubmitUser}
          onFormError={onFormError}
          isPending={createUserMutation.isPending}
        />

        <ResetPasswordDialog 
          isOpen={isResetPasswordDialogOpen}
          onOpenChange={(open) => {
            if (!open) { setIsResetPasswordDialogOpen(false); setResettingUser(null); setNewTemporaryPassword(null); }
          }}
          resettingUser={resettingUser}
          newTemporaryPassword={newTemporaryPassword}
          onConfirm={confirmResetPassword}
          isPending={resetPasswordMutation.isPending}
        />

        <SetPasswordDialog 
          isOpen={isSetPasswordModalOpen}
          onClose={handleCloseSetPasswordModal}
          settingPasswordUser={settingPasswordUser}
          form={setPasswordForm}
          onSubmit={onSetPasswordSubmit}
          isPending={setPasswordMutation.isPending}
        />

        <DeleteConfirmDialog 
          isOpen={isDeleteDialogOpen}
          onOpenChange={(open) => {
            if (!open) { setIsDeleteDialogOpen(false); setDeletingUser(null); setDeleteCheckResult(null); }
          }}
          deletingUser={deletingUser}
          onConfirm={confirmDeleteUser}
          isPending={deleteUserMutation.isPending}
        />
      </div>
    </AdminRoute>
  );
}

export default UsersManagement;
