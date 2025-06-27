import { Link, useLocation } from "wouter";
import { cn } from "@/lib/utils";
import {
  BarChart3,
  Building,
  Columns,
  Plus,
  Settings,
  Truck,
  Users,
} from "lucide-react";

const navigation = [
  { name: "Kanban Board", href: "/", icon: Columns },
  { name: "Nova Solicitação", href: "/new-request", icon: Plus },
  { name: "Fornecedores", href: "/suppliers", icon: Truck },
  { name: "Usuários", href: "/users", icon: Users },
  { name: "Departamentos", href: "/departments", icon: Building },
  { name: "Relatórios", href: "/reports", icon: BarChart3 },
  { name: "Configurações", href: "/settings", icon: Settings },
];

export default function Sidebar() {
  const [location] = useLocation();

  return (
    <div className="fixed inset-y-0 left-0 z-40 w-64 bg-white shadow-lg transform translate-x-0 transition-transform duration-200 ease-in-out mt-16">
      <div className="flex flex-col h-full">
        <div className="flex-1 flex flex-col pt-5 pb-4 overflow-y-auto">
          <nav className="flex-1 px-2 space-y-1">
            {navigation.map((item) => {
              const Icon = item.icon;
              const isActive = location === item.href;
              
              return (
                <Link key={item.name} href={item.href}>
                  <a
                    className={cn(
                      "group flex items-center px-2 py-2 text-sm font-medium rounded-md",
                      isActive
                        ? "bg-primary-50 text-primary-700"
                        : "text-gray-600 hover:bg-gray-50 hover:text-gray-900"
                    )}
                  >
                    <Icon
                      className={cn(
                        "mr-3 flex-shrink-0 h-5 w-5",
                        isActive ? "text-primary-500" : "text-gray-400"
                      )}
                    />
                    {item.name}
                  </a>
                </Link>
              );
            })}
          </nav>
        </div>
      </div>
    </div>
  );
}
