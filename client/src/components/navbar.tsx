import {
  ShoppingCart,
  LogOut,
  User,
  Key,
  Menu,
  X,
  Kanban,
  BarChart3,
  Building,
  Users,
  MapPin,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useAuth } from "@/hooks/useAuth";
import { Link, useLocation } from "wouter";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import { useState } from "react";
import Notifications from "./notifications";

export default function Navbar() {
  const { user, logout } = useAuth();
  const [location] = useLocation();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  const handleLogout = () => {
    logout();
  };

  const getInitials = () => {
    if (user?.firstName && user?.lastName) {
      return `${user.firstName[0]}${user.lastName[0]}`.toUpperCase();
    }
    return user?.username?.substring(0, 2).toUpperCase() || "U";
  };

  const getDisplayName = () => {
    if (user?.firstName && user?.lastName) {
      return `${user.firstName} ${user.lastName}`;
    }
    return user?.username || "Usuário";
  };

  const getRoles = () => {
    const roles = [];
    if (user?.isBuyer) roles.push("Comprador");
    if (user?.isApproverA1) roles.push("Aprovador A1");
    if (user?.isApproverA2) roles.push("Aprovador A2");
    return roles.length > 0 ? roles.join(", ") : "Usuário";
  };

  const getNavigation = () => {
    const baseNavigation = [
      { name: "Kanban", href: "/kanban", icon: Kanban },
      { name: "Gerenciar", href: "/request-management", icon: ShoppingCart },
      { name: "Fornecedores", href: "/suppliers", icon: Building },
    ];

    const managerNavigation = [
      { name: "Dashboard", href: "/dashboard", icon: BarChart3 },
    ];

    const adminNavigation = [
      { name: "Usuários", href: "/users", icon: Users },
      { name: "Departamentos", href: "/departments", icon: Building },
      { name: "Locais de Entrega", href: "/delivery-locations", icon: MapPin },
      { name: "Empresas", href: "/companies", icon: Building },
    ];

    let navigation = [...baseNavigation];

    if (user?.isManager || user?.isAdmin) {
      navigation = [...navigation, ...managerNavigation];
    }

    if (user?.isAdmin) {
      navigation = [...navigation, ...adminNavigation];
    }

    return navigation;
  };

  const navigation = getNavigation();

  return (
    <nav className="bg-white shadow-sm border-b border-gray-200 fixed w-full top-0 z-50">
      <div className="max-w-full mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between h-16">
          <div className="flex items-center">
            <div className="flex-shrink-0 flex items-center">
              <ShoppingCart className="text-primary text-2xl mr-3" />
              <h1 className="text-xl font-semibold text-foreground hidden sm:block">
                Sistema de Compras
              </h1>
              <h1 className="text-lg font-semibold text-foreground sm:hidden">
                Compras
              </h1>
            </div>
          </div>

          {/* Desktop Navigation */}
          <div className="hidden lg:flex items-center space-x-4">
            {navigation.map((item) => {
              const Icon = item.icon;
              const isActive = location === item.href;
              return (
                <Link key={item.name} href={item.href}>
                  <Button
                    variant={isActive ? "default" : "ghost"}
                    className="flex items-center space-x-2 text-sm"
                  >
                    <Icon className="w-4 h-4" />
                    <span>{item.name}</span>
                  </Button>
                </Link>
              );
            })}
          </div>

          <div className="flex items-center space-x-2">
            <Notifications />

            {/* Mobile Menu Button */}
            <div className="lg:hidden">
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
                className="h-9 w-9"
              >
                {isMobileMenuOpen ? (
                  <X className="h-5 w-5" />
                ) : (
                  <Menu className="h-5 w-5" />
                )}
              </Button>
            </div>

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="ghost"
                  className="flex items-center space-x-2 px-2"
                >
                  <Avatar className="h-8 w-8">
                    <AvatarFallback>{getInitials()}</AvatarFallback>
                  </Avatar>
                  <div className="text-sm text-left hidden sm:block">
                    <p className="font-medium text-foreground">
                      {getDisplayName()}
                    </p>
                    <p className="text-muted-foreground text-xs">
                      {user?.department?.name || "Sem departamento"} •{" "}
                      {getRoles()}
                    </p>
                  </div>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                <DropdownMenuLabel>Minha Conta</DropdownMenuLabel>
                <DropdownMenuSeparator />
                <Link href="/profile">
                  <DropdownMenuItem className="cursor-pointer">
                    <User className="mr-2 h-4 w-4" />
                    Perfil
                  </DropdownMenuItem>
                </Link>
                <Link href="/change-password">
                  <DropdownMenuItem className="cursor-pointer">
                    <Key className="mr-2 h-4 w-4" />
                    Alterar Senha
                  </DropdownMenuItem>
                </Link>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  className="cursor-pointer"
                  onClick={handleLogout}
                >
                  <LogOut className="mr-2 h-4 w-4" />
                  Sair
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </div>

      {/* Mobile Menu */}
      {isMobileMenuOpen && (
        <div className="lg:hidden">
          <div className="px-2 pt-2 pb-3 space-y-1 bg-background border-t border-border shadow-lg">
            {navigation.map((item) => {
              const Icon = item.icon;
              const isActive = location === item.href;
              return (
                <Link key={item.name} href={item.href}>
                  <div
                    className={cn(
                      "flex items-center space-x-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors",
                      isActive
                        ? "bg-primary/10 text-primary"
                        : "text-muted-foreground hover:text-foreground hover:bg-muted",
                    )}
                    onClick={() => setIsMobileMenuOpen(false)}
                  >
                    <Icon className="w-5 h-5" />
                    <span>{item.name}</span>
                  </div>
                </Link>
              );
            })}
          </div>
        </div>
      )}
    </nav>
  );
}
