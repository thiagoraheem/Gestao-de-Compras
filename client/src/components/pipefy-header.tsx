import { Link, useLocation } from "wouter";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import GlobalSearch from "@/components/global-search";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { DropdownMenu as CustomDropdownMenu } from "@/components/dropdown-menu";
import { useAuth } from "@/hooks/useAuth";
import {
  ShoppingCart,
  Users,
  Building,
  Settings,
  LogOut,
  User,
  FileText,
  Menu,
  X,
  Database,
  BarChart3,
  MapPin,
  BookOpen,
  HelpCircle,
  FolderOpen,
  ClipboardList,
} from "lucide-react";
import { useState } from "react";

export default function PipefyHeader() {
  const [location] = useLocation();
  const { user, logout } = useAuth();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  const getNavigation = () => {
    const baseNavigation = [
      { name: "Kanban", href: "/", icon: ShoppingCart },
      {
        name: "Gerenciar",
        href: "/request-management",
        icon: FileText,
      },
    ];

    return baseNavigation;
  };

  const getCadastrosItems = () => {
    const items = [
      { label: "Fornecedores", href: "/suppliers", icon: <Building className="w-4 h-4" /> },
    ];

    // Admin-only cadastros
    if (user?.isAdmin) {
      items.push(
        { label: "Usuários", href: "/users", icon: <Users className="w-4 h-4" /> },
        { label: "Departamentos", href: "/departments", icon: <Building className="w-4 h-4" /> },
        { label: "Locais de Entrega", href: "/delivery-locations", icon: <MapPin className="w-4 h-4" /> },
        { label: "Empresas", href: "/companies", icon: <Building className="w-4 h-4" /> },
        { label: "Limpeza de Dados", href: "/admin/cleanup", icon: <Database className="w-4 h-4" /> },
        { label: "Super Usuário", href: "/admin/super-user", icon: <Settings className="w-4 h-4" /> }
      );
    }

    return items;
  };

  const getRelatoriosItems = () => {
    const items = [];

    // Manager/Admin-only reports
    if (user?.isManager || user?.isAdmin || user?.isBuyer) {
      items.push(
        { label: "Dashboard", href: "/dashboard", icon: <BarChart3 className="w-4 h-4" /> }
      );
    }
    items.push(
        { label: "Solicitações de Compra", href: "/reports/purchase-requests", icon: <ClipboardList className="w-4 h-4" /> }
      );

    return items;
  };

  const navigation = getNavigation();

  const handleLogout = async () => {
    // Provide immediate visual feedback
    setIsMobileMenuOpen(false);
    await logout();
  };

  return (
    <header className="fixed top-0 left-0 right-0 z-50 bg-background border-b border-border shadow-sm">
      <div className="flex items-center justify-between px-4 md:px-6 py-3 mobile-header">
        {/* Logo e Nome */}
        <div className="flex items-center space-x-2 md:space-x-8 flex-1 min-w-0">
          <Link href="/">
            <div className="flex items-center space-x-2">
              <div className="w-8 h-8 bg-primary rounded-lg flex items-center justify-center">
                <ShoppingCart className="w-5 h-5 text-primary-foreground" />
              </div>
              <span className="text-xl font-semibold text-foreground hidden sm:inline">
                Compras
              </span>
            </div>
          </Link>

          {/* Navegação Desktop */}
          <nav className="hidden md:flex space-x-6 items-center">
            {navigation.map((item) => {
              const Icon = item.icon;
              const isActive = location === item.href;
              return (
                <Link key={item.name} href={item.href}>
                  <div
                    className={cn(
                      "flex items-center space-x-2 px-3 py-2 rounded-lg text-sm font-medium transition-colors",
                      isActive
                        ? "bg-primary/10 text-primary"
                        : "text-muted-foreground hover:text-foreground hover:bg-muted",
                    )}
                  >
                    <Icon className="w-4 h-4" />
                    <span>{item.name}</span>
                  </div>
                </Link>
              );
            })}
            
            {/* Menu Dropdown Cadastros */}
            <CustomDropdownMenu 
              trigger="Cadastros" 
              items={getCadastrosItems()}
              className="text-muted-foreground hover:text-foreground"
            />
            
            {/* Menu Dropdown Relatórios */}
              <CustomDropdownMenu 
                trigger="Relatórios" 
                items={getRelatoriosItems()}
                className="text-muted-foreground hover:text-foreground"
              />            
          </nav>

          {/* Campo de Pesquisa Global - Centralizado */}
          <div className="hidden md:flex flex-1 justify-center max-w-2xl mx-4">
            <GlobalSearch />
          </div>
        </div>

        {/* Right Side - User Menu Desktop + Mobile Menu Button */}
        <div className="flex items-center space-x-2">
          {/* User Menu Desktop */}
          <div className="hidden md:flex items-center">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="ghost"
                  className="relative h-9 w-9 rounded-full"
                >
                  <Avatar className="h-9 w-9">
                    <AvatarFallback className="bg-primary text-primary-foreground">
                      {user?.firstName?.[0] || user?.username?.[0] || "U"}
                    </AvatarFallback>
                  </Avatar>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent className="w-56" align="end" forceMount>
                <div className="flex items-center justify-start gap-2 p-2">
                  <div className="flex flex-col space-y-1 leading-none">
                    <p className="font-medium">
                      {user?.firstName} {user?.lastName}
                    </p>
                    <p className="w-[200px] truncate text-sm text-muted-foreground">
                      {user?.email}
                    </p>
                  </div>
                </div>
                <DropdownMenuSeparator />
                <DropdownMenuItem asChild>
                  <Link href="/profile">
                    <User className="mr-2 h-4 w-4" />
                    <span>Perfil</span>
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuItem asChild>
                  <Link href="/change-password">
                    <Settings className="mr-2 h-4 w-4" />
                    <span>Alterar Senha</span>
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuItem asChild>
                  <Link href="/manual">
                    <BookOpen className="mr-2 h-4 w-4" />
                    <span>Manual do Usuário</span>
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={handleLogout}>
                  <LogOut className="mr-2 h-4 w-4" />
                  <span>Sair</span>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>

          {/* Mobile Menu Button */}
          <div className="md:hidden">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
              className="h-9 w-9 mobile-menu-button"
            >
              {isMobileMenuOpen ? (
                <X className="h-5 w-5" />
              ) : (
                <Menu className="h-5 w-5" />
              )}
            </Button>
          </div>
        </div>
      </div>

      {/* Mobile Menu */}
      {isMobileMenuOpen && (
        <div className="md:hidden">
          <div className="px-2 pt-2 pb-3 space-y-1 bg-background border-t border-border shadow-lg">
            {/* Campo de Pesquisa Mobile */}
            <div className="px-2 py-2">
              <GlobalSearch />
            </div>
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

            {/* User info and logout for mobile */}
            <div className="pt-4 border-t border-border mt-4">
              <div className="flex items-center px-3 py-2">
                <Avatar className="h-8 w-8 mr-3">
                  <AvatarFallback className="bg-primary text-primary-foreground text-sm">
                    {user?.firstName?.[0] || user?.username?.[0] || "U"}
                  </AvatarFallback>
                </Avatar>
                <div className="flex flex-col">
                  <p className="text-sm font-medium text-foreground">
                    {user?.firstName} {user?.lastName}
                  </p>
                  <p className="text-xs text-muted-foreground">{user?.email}</p>
                </div>
              </div>

              <Link href="/profile">
                <div className="flex items-center space-x-3 px-3 py-2 text-sm text-muted-foreground hover:text-foreground hover:bg-muted rounded-lg">
                  <User className="w-5 h-5" />
                  <span>Perfil</span>
                </div>
              </Link>

              <Link href="/change-password">
                <div className="flex items-center space-x-3 px-3 py-2 text-sm text-muted-foreground hover:text-foreground hover:bg-muted rounded-lg">
                  <Settings className="w-5 h-5" />
                  <span>Alterar Senha</span>
                </div>
              </Link>

              <Link href="/manual">
                <div className="flex items-center space-x-3 px-3 py-2 text-sm text-muted-foreground hover:text-foreground hover:bg-muted rounded-lg">
                  <BookOpen className="w-5 h-5" />
                  <span>Manual do Usuário</span>
                </div>
              </Link>

              <button
                onClick={handleLogout}
                className="flex items-center space-x-3 px-3 py-2 text-sm text-muted-foreground hover:text-foreground hover:bg-muted rounded-lg w-full text-left"
              >
                <LogOut className="w-5 h-5" />
                <span>Sair</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </header>
  );
}
