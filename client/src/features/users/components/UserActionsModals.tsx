import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/shared/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/shared/ui/alert-dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/shared/ui/form";
import { Input } from "@/shared/ui/input";
import { Button } from "@/shared/ui/button";
import { AlertTriangle } from "lucide-react";
import { UseFormReturn } from "react-hook-form";
import { SetPasswordFormData } from "../schemas/user.schema";

interface ResetPasswordDialogProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  resettingUser: any;
  newTemporaryPassword: string | null;
  onConfirm: () => void;
  isPending: boolean;
}

export function ResetPasswordDialog({
  isOpen, onOpenChange, resettingUser, newTemporaryPassword, onConfirm, isPending
}: ResetPasswordDialogProps) {
  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Redefinir Senha</DialogTitle>
          <DialogDescription asChild>
            <div>
              {newTemporaryPassword ? (
                <div className="space-y-4 mt-2">
                  <p>A senha foi redefinida com sucesso.</p>
                  <div className="p-4 bg-muted rounded-md text-center">
                    <span className="font-mono text-lg font-bold">{newTemporaryPassword}</span>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    Esta senha é temporária. O usuário deverá alterá-la no próximo login. Um email também foi enviado para o usuário.
                  </p>
                </div>
              ) : (
                <div className="mt-2">
                  Tem certeza que deseja redefinir a senha do usuário <strong>{resettingUser?.username}</strong>?
                  <br/><br/>
                  Uma nova senha aleatória será gerada e enviada por email. O usuário será forçado a alterar a senha no próximo login.
                </div>
              )}
            </div>
          </DialogDescription>
        </DialogHeader>
        <div className="flex justify-end space-x-2">
          {newTemporaryPassword ? (
            <Button onClick={() => onOpenChange(false)}>Fechar</Button>
          ) : (
            <>
              <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
              <Button onClick={onConfirm} disabled={isPending}>
                {isPending ? "Redefinindo..." : "Confirmar Redefinição"}
              </Button>
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}


interface SetPasswordDialogProps {
  isOpen: boolean;
  onClose: () => void;
  settingPasswordUser: any;
  form: UseFormReturn<SetPasswordFormData>;
  onSubmit: (data: SetPasswordFormData) => void;
  isPending: boolean;
}

export function SetPasswordDialog({
  isOpen, onClose, settingPasswordUser, form, onSubmit, isPending
}: SetPasswordDialogProps) {
  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Definir Senha</DialogTitle>
          <DialogDescription>
            Defina uma nova senha para o usuário <strong>{settingPasswordUser?.username}</strong>.
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField control={form.control} name="password" render={({ field }) => (
              <FormItem>
                <FormLabel>Nova Senha</FormLabel>
                <FormControl><Input {...field} type="password" placeholder="Digite a nova senha" /></FormControl>
                <FormMessage />
                <ul className="text-xs text-muted-foreground list-disc pl-4 space-y-1 mt-2">
                  <li>Mínimo de 8 caracteres</li>
                  <li>Pelo menos uma letra maiúscula e minúscula</li>
                  <li>Pelo menos um número e caractere especial</li>
                </ul>
              </FormItem>
            )} />
            <FormField control={form.control} name="confirmPassword" render={({ field }) => (
              <FormItem>
                <FormLabel>Confirmar Senha</FormLabel>
                <FormControl><Input {...field} type="password" placeholder="Confirme a nova senha" /></FormControl>
                <FormMessage />
              </FormItem>
            )} />
            <div className="flex justify-end space-x-2 pt-4">
              <Button type="button" variant="outline" onClick={onClose}>Cancelar</Button>
              <Button type="submit" disabled={isPending}>
                {isPending ? "Salvando..." : "Definir Senha"}
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}

interface DeleteConfirmDialogProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  deletingUser: any;
  onConfirm: () => void;
  isPending: boolean;
}

export function DeleteConfirmDialog({
  isOpen, onOpenChange, deletingUser, onConfirm, isPending
}: DeleteConfirmDialogProps) {
  return (
    <AlertDialog open={isOpen} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle className="flex items-center">
            <AlertTriangle className="h-5 w-5 text-red-500 mr-2" /> Confirmar Exclusão
          </AlertDialogTitle>
          <AlertDialogDescription asChild>
            <div>
              Tem certeza que deseja excluir o usuário{" "}
              <strong>
                {deletingUser?.firstName && deletingUser?.lastName
                  ? `${deletingUser.firstName} ${deletingUser.lastName}`
                  : deletingUser?.username}
              </strong>?
              <br /><br />
              Esta ação não pode ser desfeita e removerá permanentemente:
              <ul className="list-disc list-inside mt-2 space-y-1 text-sm">
                <li>Dados do usuário</li>
                <li>Associações com departamentos e centros de custo</li>
                <li>Permissões de acesso</li>
              </ul>
            </div>
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel onClick={() => onOpenChange(false)}>Cancelar</AlertDialogCancel>
          <AlertDialogAction onClick={onConfirm} disabled={isPending} className="bg-red-600 hover:bg-red-700">
            {isPending ? "Excluindo..." : "Excluir"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
