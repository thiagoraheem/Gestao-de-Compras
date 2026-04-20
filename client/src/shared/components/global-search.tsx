import { useState, useEffect, useRef, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { Input } from "@/shared/ui/input";
import { Button } from "@/shared/ui/button";
import { Badge } from "@/shared/ui/badge";
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
  const [selectedIndex, setSelectedIndex] = useState(0);
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

    // Pesquisa por número de solicitação (formato flexível: R000123, SOL-2025-045, etc.) ou Pedido de Compra
    const isRequestNumberSearch =
      query.match(/^(r|sol|req|po|ped)?[-\s]?(\d+)/i) || query.match(/^\d+$/);
    if (isRequestNumberSearch) {
      // Extrair apenas os números da pesquisa para busca flexível
      const numbers = query.replace(/[^\d]/g, "");
      const matchingRequests = purchaseRequests.filter(
        (req) =>
          req.requestNumber?.toLowerCase().includes(query.toLowerCase()) ||
          req.requestNumber?.replace(/[^\d]/g, "").includes(numbers) ||
          req.id?.toString() === numbers ||
          req.purchaseOrder?.orderNumber?.toLowerCase().includes(query.toLowerCase()) ||
          req.purchaseOrder?.orderNumber?.replace(/[^\d]/g, "").includes(numbers),
      );

      matchingRequests.forEach((req) => {
        let subtitle = `${req.category} - ${req.urgency} - Fase: ${req.currentPhase}`;
        
        // Se tiver número de pedido, adicionar ao subtítulo
        if (req.purchaseOrder?.orderNumber) {
           subtitle = `Pedido: ${req.purchaseOrder.orderNumber} • ${subtitle}`;
        }

        results.push({
          id: `request-${req.id}`,
          type: "request",
          title: `Solicitação ${req.requestNumber}`,
          subtitle: subtitle,
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

    if (query.match(/^r?\d+$/i) || query.match(/^(po|ped)/i)) {
      return "Pesquisando por número de solicitação ou pedido";
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
    setIsOpen(false);

    if (suggestion.type === "request") {
      // Aplicar filtro de busca no kanban para destacar o card
      const request = suggestion.metadata;
      const searchTerm = request.requestNumber || request.title || suggestion.title;
      
      // Navegar para o kanban com filtro de busca
      setLocation(`/?search=${encodeURIComponent(searchTerm)}&request=${request.id}&phase=${request.currentPhase}`);
      
      // Emitir evento para aplicar o filtro
      window.dispatchEvent(new CustomEvent("globalSearchApplied", {
        detail: { searchTerm }
      }));
      
      setSearchValue("");
    } else if (suggestion.type === "supplier") {
      // Para fornecedores, aplicar filtro de busca por nome
      const supplier = suggestion.metadata;
      const searchTerm = supplier.name;
      
      // Navegar para o kanban com filtro de busca por fornecedor
      setLocation(`/?search=${encodeURIComponent(searchTerm)}`);
      
      // Emitir evento para aplicar o filtro
      window.dispatchEvent(new CustomEvent("globalSearchApplied", {
        detail: { searchTerm }
      }));
      
      setSearchValue("");
    } else if (suggestion.type === "recent") {
      // Navegação direta sem filtro
      const path = suggestion.value.replace("/kanban-recent", "/");
      setLocation(path);
      setSearchValue("");
    }
  };

  // Busca direta ao pressionar Enter sem sugestão selecionada
  const handleDirectSearch = () => {
    if (searchValue.trim()) {
      const searchTerm = searchValue.trim();
      
      // Navegar para o kanban com filtro de busca
      setLocation(`/?search=${encodeURIComponent(searchTerm)}`);
      
      // Emitir evento para aplicar o filtro
      window.dispatchEvent(new CustomEvent("globalSearchApplied", {
        detail: { searchTerm }
      }));
      
      setSearchValue("");
      setIsOpen(false);
    }
  };

  // Reset selected index when suggestions change
  useEffect(() => {
    setSelectedIndex(0);
  }, [suggestions]);

  // Executar pesquisa direta ao pressionar Enter e navegação por teclado
  const handleKeyDown = (e: React.KeyboardEvent) => {
    switch (e.key) {
      case "Escape":
        e.preventDefault();
        setIsOpen(false);
        setSearchValue("");
        break;
      case "Enter":
        e.preventDefault();
        if (isOpen && suggestions.length > 0) {
          handleSelect(suggestions[selectedIndex]);
        } else {
          // Busca direta se não há sugestões ou dropdown fechado
          handleDirectSearch();
        }
        break;
      case "ArrowDown":
        if (isOpen && suggestions.length > 0) {
          e.preventDefault();
          setSelectedIndex((prev) => 
            prev < suggestions.length - 1 ? prev + 1 : 0
          );
        }
        break;
      case "ArrowUp":
        if (isOpen && suggestions.length > 0) {
          e.preventDefault();
          setSelectedIndex((prev) => 
            prev > 0 ? prev - 1 : suggestions.length - 1
          );
        }
        break;
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
            }, 150);
          }}
          className="pl-10 pr-4 w-full bg-background/60 border-border/60 focus:bg-background focus:border-border"
        />
      </div>

      {/* Custom dropdown overlay */}
      {isOpen && (
        <>
          {/* Backdrop to close dropdown */}
          <div 
            className="fixed inset-0 z-40" 
            onClick={() => setIsOpen(false)}
            onMouseDown={(e) => e.preventDefault()}
          />
          
          {/* Dropdown content */}
          <div className="absolute top-full left-0 right-0 mt-1 z-50 w-full max-w-[36rem] bg-popover text-popover-foreground rounded-md border border-border shadow-lg">
            <div className="px-3 py-2 text-xs text-muted-foreground border-b">
              {getSearchTypeHint(searchValue)}
            </div>

            <div className="max-h-80 overflow-y-auto">
              {suggestions.length === 0 ? (
                <div className="py-6 text-center text-sm text-muted-foreground">
                  {searchValue
                    ? "Nenhum resultado encontrado."
                    : "Digite para pesquisar..."}
                </div>
              ) : (
                <div>
                  {suggestions.map((suggestion, index) => (
                    <div
                      key={suggestion.id}
                      onClick={() => handleSelect(suggestion)}
                      onMouseEnter={() => setSelectedIndex(index)}
                      className={`flex items-center gap-3 p-3 cursor-pointer transition-colors ${
                        index === selectedIndex 
                          ? "bg-muted" 
                          : "hover:bg-muted"
                      }`}
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
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="px-3 py-2 text-xs text-muted-foreground bg-muted/50 border-t">
              <div className="flex items-center gap-4">
                <span>💡 Dicas:</span>
                <span>SOL-123 ou PO-123 para buscar</span>
                <span>CNPJ para fornecedores</span>
                <span>Ctrl+K para focar</span>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
