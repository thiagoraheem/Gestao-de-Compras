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
  Settings,
  BarChart3
} from "lucide-react";

export default function FloatingHelpButton() {
  const [isOpen, setIsOpen] = useState(false);

  const helpOptions = [
    {
      icon: BookOpen,
      label: "Manual do Usuário",
      description: "Guia completo do sistema",
      href: "/manual",
      color: "text-blue-600 dark:text-blue-400"
    },
    {
      icon: FileText,
      label: "Fluxo de Compras",
      description: "Entenda as 9 fases",
      href: "/manual",
      color: "text-green-600 dark:text-green-400",
      section: "workflow"
    },
    {
      icon: BarChart3,
      label: "Relatórios",
      description: "Análise e KPIs",
      href: "/manual",
      color: "text-indigo-600 dark:text-indigo-400",
      section: "relatorios"
    },
    {
      icon: Users,
      label: "Perfis e Permissões",
      description: "Tipos de usuário",
      href: "/manual",
      color: "text-purple-600 dark:text-purple-400",
      section: "permissions"
    },
    {
      icon: Settings,
      label: "Solução de Problemas",
      description: "Problemas comuns",
      href: "/manual",
      color: "text-orange-600 dark:text-orange-400",
      section: "troubleshooting"
    }
  ];

  return (
    <TooltipProvider>
      <div className="fixed bottom-14 md:bottom-6 right-6 z-40">
        <DropdownMenu open={isOpen} onOpenChange={setIsOpen}>
          <Tooltip>
            <TooltipTrigger asChild>
              <DropdownMenuTrigger asChild>
                <Button
                  size="lg"
                  className={`h-14 w-14 rounded-full shadow-lg transition-all duration-300 hover:scale-110 ${
                    isOpen 
                      ? 'bg-primary rotate-180 text-primary-foreground' 
                      : 'bg-primary hover:bg-primary/90 text-primary-foreground'
                  }`}
                  aria-label="Central de Ajuda"
                >
                  <HelpCircle className="h-6 w-6" />
                </Button>
              </DropdownMenuTrigger>
            </TooltipTrigger>
            <TooltipContent side="left" className="mb-2 bg-popover text-popover-foreground border-border">
              <p>Precisa de ajuda? Clique aqui!</p>
            </TooltipContent>
          </Tooltip>

          <DropdownMenuContent 
            align="end" 
            side="top" 
            className="w-80 mb-4 shadow-xl border-border bg-popover text-popover-foreground backdrop-blur-sm"
          >
            <div className="p-4 border-b border-border">
              <div className="flex items-center space-x-3">
                <div className="w-10 h-10 bg-primary/10 dark:bg-primary/20 rounded-full flex items-center justify-center">
                  <HelpCircle className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <h3 className="font-semibold text-popover-foreground">Central de Ajuda</h3>
                  <p className="text-sm text-muted-foreground">Como podemos ajudar você?</p>
                </div>
              </div>
            </div>

            <div className="p-2">
              {helpOptions.map((option, index) => {
                const Icon = option.icon;
                return (
                  <DropdownMenuItem key={index} asChild className="p-0 focus:bg-accent focus:text-accent-foreground">
                    <Link 
                      href={option.section ? `${option.href}#${option.section}` : option.href}
                      className="w-full"
                    >
                      <div className="flex items-center space-x-3 p-3 rounded-lg hover:bg-accent transition-colors cursor-pointer w-full">
                        <div className={`w-8 h-8 rounded-lg bg-accent/50 flex items-center justify-center ${option.color}`}>
                          <Icon className="h-4 w-4" />
                        </div>
                        <div className="flex-1">
                          <div className="font-medium text-popover-foreground text-sm">{option.label}</div>
                          <div className="text-xs text-muted-foreground">{option.description}</div>
                        </div>
                        <ExternalLink className="h-3 w-3 text-muted-foreground" />
                      </div>
                    </Link>
                  </DropdownMenuItem>
                );
              })}
            </div>

            <DropdownMenuSeparator className="bg-border" />

            <div className="p-3">
              <div className="text-xs text-muted-foreground text-center mb-2">
                Ainda precisa de ajuda?
              </div>
              <div className="flex justify-center space-x-2">
                <Button 
                  variant="outline" 
                  size="sm" 
                  className="flex-1 border-border hover:bg-accent hover:text-accent-foreground"
                  onClick={() => window.open('mailto:sistema@blomaq.com.br', '_blank')}
                >
                  <Mail className="h-3 w-3 mr-1" />
                  E-mail
                </Button>
                <Button 
                  variant="outline" 
                  size="sm" 
                  className="flex-1 border-border hover:bg-accent hover:text-accent-foreground"
                  onClick={() => window.open('https://app.pipefy.com/public/form/hLJZml3x', '_blank')}
                >
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
