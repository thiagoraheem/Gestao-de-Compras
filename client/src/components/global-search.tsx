import { useState, useEffect, useRef, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { Search, FileText, Building, Clock, Tag, Users } from "lucide-react";
import { cn } from "@/lib/utils";

interface SearchSuggestion {
  id: string;
  type: "request" | "supplier" | "recent";
  title: string;
  subtitle?: string;
  value: string;
  metadata?: any;
}

interface GlobalSearchProps {
  className?: string;
}

export default function GlobalSearch({ className }: GlobalSearchProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [searchValue, setSearchValue] = useState("");
  const [, setLocation] = useLocation();
  const inputRef = useRef<HTMLInputElement>(null);

  // Buscar dados para sugestões
  const { data: purchaseRequests = [] } = useQuery<any[]>({
    queryKey: ["/api/purchase-requests"],
    enabled: isOpen || searchValue.length > 0,
  });

  const { data: suppliers = [] } = useQuery<any[]>({
    queryKey: ["/api/suppliers"],
    enabled: isOpen || searchValue.length > 0,
  });

  // Gerar sugestões baseadas na pesquisa
  const suggestions = useMemo(() => {
    const results: SearchSuggestion[] = [];
    const query = searchValue.toLowerCase().trim();

    if (!query) {
      // Mostrar sugestões padrão quando não há pesquisa
      results.push({
        id: "recent-requests",
        type: "recent",
        title: "Solicitações Recentes",
        subtitle: "Navegue para o kanban",
        value: "/kanban-recent",
      });

      results.push({
        id: "all-suppliers",
        type: "recent",
        title: "Todos os Fornecedores",
        subtitle: "Gerenciar fornecedores",
        value: "/suppliers",
      });

      return results;
    }

    // Pesquisa por número de solicitação (formato flexível: R000123, SOL-2025-045, etc.)
    const isRequestNumberSearch =
      query.match(/^(r|sol|req)?[-\s]?(\d+)/i) || query.match(/^\d+$/);
    if (isRequestNumberSearch) {
      // Extrair apenas os números da pesquisa para busca flexível
      const numbers = query.replace(/[^\d]/g, "");
      const matchingRequests = purchaseRequests.filter(
        (req) =>
          req.requestNumber?.toLowerCase().includes(query.toLowerCase()) ||
          req.requestNumber?.replace(/[^\d]/g, "").includes(numbers) ||
          req.id?.toString() === numbers,
      );

      matchingRequests.forEach((req) => {
        results.push({
          id: `request-${req.id}`,
          type: "request",
          title: `Solicitação ${req.requestNumber}`,
          subtitle: `${req.category} - ${req.urgency} - Fase: ${req.currentPhase}`,
          value: `request-${req.id}`,
          metadata: req,
        });
      });
    }

    // Pesquisa por fornecedores (nome, CNPJ, email)
    const matchingSuppliers = suppliers.filter(
      (supplier) =>
        supplier.name?.toLowerCase().includes(query) ||
        supplier.cnpj?.toLowerCase().includes(query) ||
        supplier.email?.toLowerCase().includes(query) ||
        supplier.contact?.toLowerCase().includes(query),
    );

    matchingSuppliers.forEach((supplier) => {
      results.push({
        id: `supplier-${supplier.id}`,
        type: "supplier",
        title: supplier.name,
        subtitle: `${supplier.cnpj ? "CNPJ: " + supplier.cnpj : ""} ${supplier.email ? "• " + supplier.email : ""}`,
        value: `supplier-${supplier.id}`,
        metadata: supplier,
      });
    });

    // Pesquisa por texto livre em solicitações (justificativa, informações adicionais)
    const textMatchingRequests = purchaseRequests.filter(
      (req) =>
        req.justification?.toLowerCase().includes(query) ||
        req.additionalInfo?.toLowerCase().includes(query) ||
        req.category?.toLowerCase().includes(query),
    );

    textMatchingRequests.forEach((req) => {
      // Evitar duplicatas se já foi encontrada por número
      if (!results.find((r) => r.id === `request-${req.id}`)) {
        results.push({
          id: `request-text-${req.id}`,
          type: "request",
          title: `Solicitação ${req.requestNumber}`,
          subtitle: `${req.justification?.substring(0, 60)}${req.justification?.length > 60 ? "..." : ""}`,
          value: `request-${req.id}`,
          metadata: req,
        });
      }
    });

    return results.slice(0, 8); // Limitar a 8 resultados
  }, [searchValue, purchaseRequests, suppliers]);

  // Detectar tipo de pesquisa para mostrar dicas
  const getSearchTypeHint = (query: string) => {
    if (!query) return "Digite para pesquisar...";

    if (query.match(/^r?\d+$/i)) {
      return "Pesquisando por número de solicitação";
    }

    if (
      query.includes("@") ||
      query.match(/\d{2}\.\d{3}\.\d{3}\/\d{4}-\d{2}/)
    ) {
      return "Pesquisando fornecedores";
    }

    return "Pesquisa livre nas descrições";
  };

  // Lidar com seleção de item
  const handleSelect = (suggestion: SearchSuggestion) => {
    // Use setTimeout to avoid conflicts with onBlur
    setTimeout(() => {
      setIsOpen(false);
      setSearchValue("");

      if (suggestion.type === "request") {
        // Navegar para o kanban e destacar a solicitação
        const request = suggestion.metadata;
        setLocation(`/?request=${request.id}&phase=${request.currentPhase}`);
      } else if (suggestion.type === "supplier") {
        // Navegar para fornecedores e abrir edição
        const supplier = suggestion.metadata;
        setLocation(`/suppliers?edit=${supplier.id}`);
      } else if (suggestion.type === "recent") {
        // Navegação direta
        const path = suggestion.value.replace("/kanban-recent", "/");
        setLocation(path);
      }
    }, 50);
  };

  // Executar pesquisa direta ao pressionar Enter
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && suggestions.length > 0) {
      e.preventDefault();
      handleSelect(suggestions[0]);
    }
  };

  // Atalho de teclado Ctrl+K
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.ctrlKey && e.key === "k") {
        e.preventDefault();
        inputRef.current?.focus();
        setIsOpen(true);
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, []);

  const getIcon = (type: string) => {
    switch (type) {
      case "request":
        return <FileText className="w-4 h-4" />;
      case "supplier":
        return <Building className="w-4 h-4" />;
      case "recent":
        return <Clock className="w-4 h-4" />;
      default:
        return <Search className="w-4 h-4" />;
    }
  };

  const getTypeLabel = (type: string) => {
    switch (type) {
      case "request":
        return "Solicitação";
      case "supplier":
        return "Fornecedor";
      case "recent":
        return "Sugestão";
      default:
        return "";
    }
  };

  return (
    <div className={cn("relative", className)}>
      <div className="relative">
        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground w-4 h-4" />
        <Input
          ref={inputRef}
          data-testid="input-global-search"
          placeholder="Pesquisar solicitações, fornecedores... (Ctrl+K)"
          value={searchValue}
          onChange={(e) => setSearchValue(e.target.value)}
          onKeyDown={handleKeyDown}
          onFocus={() => setIsOpen(true)}
          onBlur={() => {
            // Delay closing to allow clicks on suggestions
            setTimeout(() => {
              setIsOpen(false);
            }, 300);
          }}
          className="pl-10 pr-4 w-full md:w-80 bg-background/60 border-border/60 focus:bg-background focus:border-border"
        />
      </div>

      <Popover open={isOpen} onOpenChange={setIsOpen}>
        <PopoverTrigger asChild>
          <div className="absolute inset-0 pointer-events-none" />
        </PopoverTrigger>

        <PopoverContent className="w-96 p-0" align="start">
          <Command shouldFilter={false}>
            <div className="px-3 py-2 text-xs text-muted-foreground border-b">
              {getSearchTypeHint(searchValue)}
            </div>

            <CommandList className="max-h-80">
              {suggestions.length === 0 ? (
                <CommandEmpty className="py-6 text-center text-sm">
                  {searchValue
                    ? "Nenhum resultado encontrado."
                    : "Digite para pesquisar..."}
                </CommandEmpty>
              ) : (
                <CommandGroup>
                  {suggestions.map((suggestion) => (
                    <CommandItem
                      key={suggestion.id}
                      value={suggestion.value}
                      onSelect={() => handleSelect(suggestion)}
                      className="flex items-center gap-3 p-3 cursor-pointer hover:bg-muted"
                      data-testid={`search-result-${suggestion.type}-${suggestion.id}`}
                    >
                      <div className="flex items-center justify-center w-8 h-8 rounded-md bg-muted">
                        {getIcon(suggestion.type)}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="font-medium text-sm truncate">
                            {suggestion.title}
                          </span>
                          <Badge variant="secondary" className="text-xs">
                            {getTypeLabel(suggestion.type)}
                          </Badge>
                        </div>
                        {suggestion.subtitle && (
                          <p className="text-xs text-muted-foreground truncate mt-1">
                            {suggestion.subtitle}
                          </p>
                        )}
                      </div>
                    </CommandItem>
                  ))}
                </CommandGroup>
              )}
            </CommandList>

            <div className="px-3 py-2 text-xs text-muted-foreground bg-muted/50 border-t">
              <div className="flex items-center gap-4">
                <span>💡 Dicas:</span>
                <span>R123 para solicitações</span>
                <span>CNPJ para fornecedores</span>
                <span>Ctrl+K para focar</span>
              </div>
            </div>
          </Command>
        </PopoverContent>
      </Popover>
    </div>
  );
}
