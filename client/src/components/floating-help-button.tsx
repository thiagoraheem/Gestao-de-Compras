import { useState } from "react";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  HelpCircle,
  BookOpen,
  MessageCircle,
  Phone,
  Mail,
  ExternalLink,
  FileText,
  Users,
  ShoppingCart,
  Settings
} from "lucide-react";

export default function FloatingHelpButton() {
  const [isOpen, setIsOpen] = useState(false);

  const helpOptions = [
    {
      icon: BookOpen,
      label: "Manual do Usuário",
      description: "Guia completo do sistema",
      href: "/manual",
      color: "text-blue-600"
    },
    {
      icon: FileText,
      label: "Fluxo de Compras",
      description: "Entenda as 8 fases",
      href: "/manual",
      color: "text-green-600",
      section: "workflow"
    },
    {
      icon: Users,
      label: "Perfis e Permissões",
      description: "Tipos de usuário",
      href: "/manual",
      color: "text-purple-600",
      section: "permissions"
    },
    {
      icon: Settings,
      label: "Solução de Problemas",
      description: "Problemas comuns",
      href: "/manual",
      color: "text-orange-600",
      section: "troubleshooting"
    }
  ];

  return (
    <TooltipProvider>
      <div className="fixed bottom-6 right-6 z-40">
        <DropdownMenu open={isOpen} onOpenChange={setIsOpen}>
          <Tooltip>
            <TooltipTrigger asChild>
              <DropdownMenuTrigger asChild>
                <Button
                  size="lg"
                  className={`h-14 w-14 rounded-full shadow-lg transition-all duration-300 hover:scale-110 ${
                    isOpen 
                      ? 'bg-primary/90 rotate-180' 
                      : 'bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700'
                  }`}
                >
                  <HelpCircle className="h-6 w-6 text-white" />
                </Button>
              </DropdownMenuTrigger>
            </TooltipTrigger>
            <TooltipContent side="left" className="mb-2">
              <p>Precisa de ajuda? Clique aqui!</p>
            </TooltipContent>
          </Tooltip>

          <DropdownMenuContent 
            align="end" 
            side="top" 
            className="w-80 mb-4 shadow-xl border-0 bg-white/95 backdrop-blur-sm"
          >
            <div className="p-4 border-b">
              <div className="flex items-center space-x-3">
                <div className="w-10 h-10 bg-gradient-to-r from-blue-500 to-purple-600 rounded-full flex items-center justify-center">
                  <HelpCircle className="h-5 w-5 text-white" />
                </div>
                <div>
                  <h3 className="font-semibold text-gray-900">Central de Ajuda</h3>
                  <p className="text-sm text-gray-600">Como podemos ajudar você?</p>
                </div>
              </div>
            </div>

            <div className="p-2">
              {helpOptions.map((option, index) => {
                const Icon = option.icon;
                return (
                  <DropdownMenuItem key={index} asChild className="p-0">
                    <Link 
                      href={option.section ? `${option.href}#${option.section}` : option.href}
                      className="w-full"
                    >
                      <div className="flex items-center space-x-3 p-3 rounded-lg hover:bg-gray-50 transition-colors cursor-pointer w-full">
                        <div className={`w-8 h-8 rounded-lg bg-gray-100 flex items-center justify-center ${option.color}`}>
                          <Icon className="h-4 w-4" />
                        </div>
                        <div className="flex-1">
                          <div className="font-medium text-gray-900 text-sm">{option.label}</div>
                          <div className="text-xs text-gray-600">{option.description}</div>
                        </div>
                        <ExternalLink className="h-3 w-3 text-gray-400" />
                      </div>
                    </Link>
                  </DropdownMenuItem>
                );
              })}
            </div>

            <DropdownMenuSeparator />

            <div className="p-3">
              <div className="text-xs text-gray-500 text-center mb-2">
                Ainda precisa de ajuda?
              </div>
              <div className="flex justify-center space-x-2">
                <Button variant="outline" size="sm" className="flex-1">
                  <Mail className="h-3 w-3 mr-1" />
                  E-mail
                </Button>
                <Button variant="outline" size="sm" className="flex-1">
                  <Phone className="h-3 w-3 mr-1" />
                  Suporte
                </Button>
              </div>
            </div>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </TooltipProvider>
  );
}