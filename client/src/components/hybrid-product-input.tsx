import { useState, useRef, useEffect } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Search, X } from "lucide-react";
import { cn } from "@/lib/utils";
import debug from "@/lib/debug";

interface Product {
  codigo: string;
  descricao: string;
  unidade: string;
}

interface HybridProductInputProps {
  value: string;
  onChange: (value: string) => void;
  onProductSelect?: (product: Product) => void;
  placeholder?: string;
  className?: string;
  resetTrigger?: number; // Prop para forçar reset do componente
  maintainSearchMode?: boolean; // Prop para manter modo de busca ativo
}

export function HybridProductInput({
  value,
  onChange,
  onProductSelect,
  placeholder = "Digite a descrição ou busque no ERP...",
  className,
  resetTrigger,
  maintainSearchMode = false,
}: HybridProductInputProps) {
  const [isSearchMode, setIsSearchMode] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [searchResults, setSearchResults] = useState<Product[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [showResults, setShowResults] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const searchTimeoutRef = useRef<NodeJS.Timeout>();
  const resultsRef = useRef<HTMLDivElement>(null);

  // Função para buscar produtos no ERP
  const searchProducts = async (term: string) => {
    if (term.length < 2) {
      setSearchResults([]);
      setShowResults(false);
      return;
    }

    setIsLoading(true);
    try {
      const response = await fetch(`/api/products/search?q=${encodeURIComponent(term)}`);
      if (response.ok) {
        const products = await response.json();
        setSearchResults(products);
        setShowResults(true);
      }
    } catch (error) {
      debug.error("Erro ao buscar produtos:", error);
      setSearchResults([]);
    } finally {
      setIsLoading(false);
    }
  };

  // Debounce da busca
  useEffect(() => {
    if (isSearchMode && searchTerm) {
      if (searchTimeoutRef.current) {
        clearTimeout(searchTimeoutRef.current);
      }
      searchTimeoutRef.current = setTimeout(() => {
        searchProducts(searchTerm);
      }, 300);
    }

    return () => {
      if (searchTimeoutRef.current) {
        clearTimeout(searchTimeoutRef.current);
      }
    };
  }, [searchTerm, isSearchMode]);

  // Fechar resultados quando clicar fora
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (resultsRef.current && !resultsRef.current.contains(event.target as Node)) {
        setShowResults(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Reset do componente quando resetTrigger mudar
  useEffect(() => {
    if (resetTrigger !== undefined) {
      setSelectedProduct(null);
      if (!maintainSearchMode) {
        setIsSearchMode(false);
      }
      setShowResults(false);
      setSearchTerm("");
    }
  }, [resetTrigger, maintainSearchMode]);

  const handleInputChange = (inputValue: string) => {
    if (isSearchMode) {
      setSearchTerm(inputValue);
    } else {
      // Only call onChange if the value actually changed
      if (inputValue !== value) {
        onChange(inputValue);
      }
    }
  };

  const handleProductSelect = (product: Product) => {
    setSelectedProduct(product);
    setIsSearchMode(false);
    setShowResults(false);
    setSearchTerm("");
    
    // Only call onChange if the value actually changed
    if (product.descricao !== value) {
      onChange(product.descricao);
    }
    
    if (onProductSelect) {
      onProductSelect(product);
    }
  };

  const toggleSearchMode = () => {
    if (isSearchMode) {
      // Saindo do modo busca
      setIsSearchMode(false);
      setShowResults(false);
      setSearchTerm("");
    } else {
      // Entrando no modo busca
      setIsSearchMode(true);
      setSearchTerm("");
    }
  };

  const clearSelection = () => {
    setSelectedProduct(null);
    onChange("");
    setIsSearchMode(false);
    setShowResults(false);
    setSearchTerm("");
  };

  return (
    <div className={cn("relative", className)}>
      <div className="flex gap-2">
        <div className="flex-1 relative">
          <Input
            value={isSearchMode ? searchTerm : value}
            onChange={(e) => handleInputChange(e.target.value)}
            placeholder={isSearchMode ? "Digite para buscar no ERP..." : placeholder}
            className={cn(
              "pr-10",
              selectedProduct && "border-green-500 bg-green-50",
              isSearchMode && "border-blue-500"
            )}
          />
          
          {selectedProduct && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="absolute right-1 top-1/2 -translate-y-1/2 h-8 w-8 p-0 text-green-600 hover:text-green-700"
              onClick={clearSelection}
            >
              <X className="h-4 w-4" />
            </Button>
          )}
        </div>
        
        <Button
          type="button"
          variant={isSearchMode ? "default" : "outline"}
          size="sm"
          onClick={toggleSearchMode}
          className={cn(
            "px-3",
            isSearchMode && "bg-blue-600 hover:bg-blue-700"
          )}
        >
          <Search className="h-4 w-4" />
        </Button>
      </div>

      {/* Indicador de produto selecionado */}
      {selectedProduct && (
        <div className="mt-2 p-2 bg-green-50 border border-green-200 rounded-md">
          <p className="text-sm text-green-800 font-medium">
            ✓ Produto do ERP: {selectedProduct.codigo}
          </p>
        </div>
      )}

      {/* Resultados da busca */}
      {showResults && isSearchMode && (
        <div
          ref={resultsRef}
          className="absolute z-50 w-full mt-1 max-h-60 overflow-y-auto rounded-md border border-border bg-popover text-popover-foreground shadow-lg"
        >
          {isLoading ? (
            <div className="p-3 text-center text-sm text-muted-foreground">
              <div className="animate-spin inline-block w-4 h-4 border-2 border-current border-t-transparent rounded-full mr-2" />
              Buscando produtos...
            </div>
          ) : searchResults.length > 0 ? (
            <div className="py-1">
              {searchResults.map((product) => (
                <button
                  key={product.codigo}
                  type="button"
                  className="w-full px-3 py-2 text-left outline-none transition-colors hover:bg-accent hover:text-accent-foreground focus:bg-accent focus:text-accent-foreground"
                  onClick={() => handleProductSelect(product)}
                >
                  <div className="text-sm font-medium">{product.codigo}</div>
                  <div className="text-xs text-muted-foreground truncate">
                    {product.descricao}
                  </div>
                  <div className="text-xs text-primary">{product.unidade}</div>
                </button>
              ))}
            </div>
          ) : searchTerm.length >= 2 ? (
            <div className="p-3 text-center text-sm text-muted-foreground">
              Nenhum produto encontrado
            </div>
          ) : null}
        </div>
      )}
    </div>
  );
}

export default HybridProductInput;
