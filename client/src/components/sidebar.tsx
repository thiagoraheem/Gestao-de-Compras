import { Link, useLocation } from "wouter";
import { cn } from "@/lib/utils";
import { useState } from "react";
import {
  Building,
  Columns,
  Truck,
  Users,
  Menu,
  X,
  FileText,
  Plus,
  BarChart3,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import NewRequestModal from "./new-request-modal";
import { useAuth } from "@/hooks/useAuth";

const navigation = [
  { name: "Kanban Board", href: "/", icon: Columns },
  {
    name: "Dashboard",
    href: "/dashboard",
    icon: BarChart3,
    requiresManager: true,
  },
  {
    name: "Gerenciar Solicitações",
    href: "/request-management",
    icon: FileText,
  },
  { name: "Empresas", href: "/companies", icon: Building, requiresAdmin: true },
  { name: "Fornecedores", href: "/suppliers", icon: Truck },
  { name: "Usuários", href: "/users", icon: Users },
  { name: "Departamentos", href: "/departments", icon: Building },
];

const actionItems = [
  { name: "Nova Solicitação", action: "new-request", icon: Plus },
];

interface SidebarProps {
  isCollapsed: boolean;
  setIsCollapsed: (collapsed: boolean) => void;
}

export default function Sidebar({ isCollapsed, setIsCollapsed }: SidebarProps) {
  const [location] = useLocation();
  const [isMobileOpen, setIsMobileOpen] = useState(false);
  const [isNewRequestModalOpen, setIsNewRequestModalOpen] = useState(false);
  const { user } = useAuth();

  return (
    <>
      {/* Mobile overlay */}
      {isMobileOpen && (
        <div
          className="fixed inset-0 z-40 bg-black bg-opacity-50 lg:hidden"
          onClick={() => setIsMobileOpen(false)}
        />
      )}

      {/* Mobile menu button */}
      <Button
        variant="ghost"
        size="icon"
        onClick={() => setIsMobileOpen(!isMobileOpen)}
        className="fixed top-20 left-4 z-50 lg:hidden"
      >
        <Menu className="h-5 w-5" />
      </Button>

      {/* Mobile Sidebar */}
      <div
        className={cn(
          "fixed inset-y-0 left-0 bg-white shadow-lg transform transition-all duration-200 ease-in-out mt-16 z-50 w-64",
          "lg:hidden", // Only show on mobile
          isMobileOpen ? "translate-x-0" : "-translate-x-full",
        )}
      >
        <div className="flex flex-col h-full">
          <div className="flex items-center justify-between p-2">
            <span className="font-semibold text-gray-900 ml-2">Menu</span>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setIsMobileOpen(false)}
            >
              <X className="h-5 w-5" />
            </Button>
          </div>

          <nav className="flex-1 px-2 space-y-1 mt-4">
            {navigation.map((item) => {
              const Icon = item.icon;
              const isActive = location === item.href;

              // Check if user has permission to access this item
              if (item.requiresManager && !user?.isManager && !user?.isAdmin) {
                return null;
              }
              if (item.requiresAdmin && !user?.isAdmin) {
                return null;
              }

              // Show suppliers for admins and buyers
              if (
                item.name === "Fornecedores" &&
                !user?.isAdmin &&
                !user?.isBuyer
              ) {
                return null;
              }

              return (
                <Link key={item.name} href={item.href}>
                  <div
                    className={cn(
                      "group flex items-center px-2 py-2 text-sm font-medium rounded-md cursor-pointer transition-colors",
                      isActive
                        ? "bg-primary-50 text-primary-700"
                        : "text-gray-600 hover:bg-gray-50 hover:text-gray-900",
                    )}
                    onClick={() => setIsMobileOpen(false)}
                  >
                    <Icon
                      className={cn(
                        "mr-3 flex-shrink-0 h-5 w-5",
                        isActive ? "text-primary-500" : "text-gray-400",
                      )}
                    />
                    <span>{item.name}</span>
                  </div>
                </Link>
              );
            })}
          </nav>
        </div>
      </div>

      {/* Desktop Sidebar */}
      <div
        className={cn(
          "fixed inset-y-0 left-0 bg-white shadow-lg transform transition-all duration-200 ease-in-out mt-16 z-30",
          "hidden lg:block", // Only show on desktop
          isCollapsed ? "w-16" : "w-64",
        )}
      >
        <div className="flex flex-col h-full">
          <div className="flex items-center justify-between p-2">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setIsCollapsed(!isCollapsed)}
              className="ml-auto"
            >
              {isCollapsed ? (
                <Menu className="h-5 w-5" />
              ) : (
                <X className="h-5 w-5" />
              )}
            </Button>
          </div>

          <div className="flex-1 flex flex-col pt-2 pb-4 overflow-y-auto">
            <TooltipProvider>
              <nav className="flex-1 px-2 space-y-1">
                {navigation.map((item) => {
                  const Icon = item.icon;
                  const isActive = location === item.href;

                  // Check if user has permission to access this item
                  if (
                    item.requiresManager &&
                    !user?.isManager &&
                    !user?.isAdmin
                  ) {
                    return null;
                  }
                  if (item.requiresAdmin && !user?.isAdmin) {
                    return null;
                  }

                  // Show suppliers for admins and buyers
                  if (
                    item.name === "Fornecedores" &&
                    !user?.isAdmin &&
                    !user?.isBuyer
                  ) {
                    return null;
                  }

                  return (
                    <Tooltip key={item.name} delayDuration={0}>
                      <TooltipTrigger asChild>
                        <Link href={item.href}>
                          <div
                            className={cn(
                              "group flex items-center px-2 py-2 text-sm font-medium rounded-md cursor-pointer transition-colors",
                              isActive
                                ? "bg-primary-50 text-primary-700"
                                : "text-gray-600 hover:bg-gray-50 hover:text-gray-900",
                              isCollapsed && "justify-center",
                            )}
                          >
                            <Icon
                              className={cn(
                                "flex-shrink-0 h-5 w-5",
                                isActive ? "text-primary-500" : "text-gray-400",
                                !isCollapsed && "mr-3",
                              )}
                            />
                            {!isCollapsed && (
                              <span className="truncate">{item.name}</span>
                            )}
                          </div>
                        </Link>
                      </TooltipTrigger>
                      {isCollapsed && (
                        <TooltipContent side="right">
                          {item.name}
                        </TooltipContent>
                      )}
                    </Tooltip>
                  );
                })}

                {/* Action Items Section */}
                <div className="mt-6 pt-4 border-t border-gray-200">
                  <div className="px-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">
                    {!isCollapsed && "Ações"}
                  </div>
                  <div className="mt-2 space-y-1">
                    {actionItems.map((item) => {
                      const Icon = item.icon;

                      return (
                        <Tooltip key={item.name} delayDuration={0}>
                          <TooltipTrigger asChild>
                            <Button
                              variant="ghost"
                              onClick={() => setIsNewRequestModalOpen(true)}
                              className={cn(
                                "w-full justify-start px-2 py-2 text-sm font-medium rounded-md transition-colors",
                                "text-gray-600 hover:bg-primary-50 hover:text-primary-700",
                              )}
                            >
                              <Icon
                                className={cn(
                                  "flex-shrink-0 h-5 w-5",
                                  isCollapsed ? "mx-auto" : "mr-3",
                                  "text-gray-400",
                                )}
                              />
                              {!isCollapsed && <span>{item.name}</span>}
                            </Button>
                          </TooltipTrigger>
                          {isCollapsed && (
                            <TooltipContent side="right">
                              {item.name}
                            </TooltipContent>
                          )}
                        </Tooltip>
                      );
                    })}
                  </div>
                </div>
              </nav>
            </TooltipProvider>
          </div>
        </div>
      </div>

      {/* New Request Modal */}
      <NewRequestModal
        open={isNewRequestModalOpen}
        onOpenChange={setIsNewRequestModalOpen}
      />
    </>
  );
}
