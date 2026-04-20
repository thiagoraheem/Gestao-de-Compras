import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/shared/ui/table";
import { Badge } from "@/shared/ui/badge";
import { Button } from "@/shared/ui/button";
import { Skeleton } from "@/shared/ui/skeleton";
import { Edit, Key, Lock, Trash2 } from "lucide-react";
import { getUserRoles } from "../utils/user-roles";

interface UserListProps {
  users: any[];
  isLoading: boolean;
  searchTerm: string;
  isDeletePending: boolean;
  onEdit: (user: any) => void;
  onResetPassword: (user: any) => void;
  onSetPassword: (user: any) => void;
  onDelete: (user: any) => void;
}

export function UserList({
  users = [],
  isLoading,
  searchTerm,
  isDeletePending,
  onEdit,
  onResetPassword,
  onSetPassword,
  onDelete
}: UserListProps) {

  if (isLoading) {
    return (
      <div className="space-y-3">
        {[...Array(5)].map((_, i) => (
          <Skeleton key={i} className="h-12 w-full" />
        ))}
      </div>
    );
  }

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
                <div className="flex flex-col gap-2">
                  <div>
                    <Badge variant={user.isActive !== false ? "default" : "destructive"} className={user.isActive !== false ? "bg-green-500 hover:bg-green-600" : ""}>
                      {user.isActive !== false ? "Ativo" : "Inativo"}
                    </Badge>
                  </div>
                  <div className="flex flex-wrap gap-1 mt-1">
                    {getUserRoles(user).map((role) => (
                      <Badge key={role} variant="secondary" className="text-xs">
                        {role}
                      </Badge>
                    ))}
                    {getUserRoles(user).length === 0 && (
                      <span className="text-gray-500 text-sm">Usuário</span>
                    )}
                  </div>
                </div>
              </TableCell>
              <TableCell>
                <div className="flex space-x-2">
                  <Button variant="outline" size="sm" onClick={() => onEdit(user)}>
                    <Edit className="h-4 w-4" />
                  </Button>
                  <Button variant="outline" size="sm" onClick={() => onResetPassword(user)} title="Redefinir Senha">
                    <Key className="h-4 w-4" />
                  </Button>
                  <Button variant="outline" size="sm" onClick={() => onSetPassword(user)} title="Definir Senha">
                    <Lock className="h-4 w-4" />
                  </Button>
                  <Button variant="outline" size="sm" onClick={() => onDelete(user)} disabled={isDeletePending}>
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
}
