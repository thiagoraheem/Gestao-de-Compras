import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { Badge } from "@/components/ui/badge";
import {
  ChevronsUpDown,
  Check,
  Package,
  AlertCircle,
  Loader2,
  Search,
  X,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface Product {
  id: number;
  codigo: string;
  descricao: string;
  unidade?: string;
  preco?: number;
  categoria?: string;
}

interface ProductSearchProps {
  onProductSelect: (product: Product) => void;
  selectedProduct?: Product | null;
  disabled?: boolean;
  placeholder?: string;
}

// ÚNICO CAMPO: Combobox pesquisável com Command + Popover
export default function ProductSearch({
  onProductSelect,
  selectedProduct: externalSelectedProduct = null,
  disabled = false,
  placeholder = "Buscar produto...",
}: ProductSearchProps) {
  const [open, setOpen] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(externalSelectedProduct);
  const { toast } = useToast();

  useEffect(() => {
    setSelectedProduct(externalSelectedProduct);
  }, [externalSelectedProduct]);

  const BASE_URL = "http://54.232.194.197:5001/api/Produtos"; // único endpoint base

  const {
    data: products = [],
    isLoading,
    isFetching,
    error,
    refetch,
  } = useQuery<Product[]>({
    queryKey: ["external-products"],
    queryFn: async () => {
      const response = await fetch(`${BASE_URL}/GetAll`);
      if (!response.ok) throw new Error(`Erro ao buscar produtos: ${response.status}`);
      const data = await response.json();
      const mapped = Array.isArray(data)
        ? data.map((item: any) => ({
            id: item.id,
            codigo: item.sku?.trim() || "",
            descricao: item.description || item.name || "",
            unidade: item.unit || "",
            preco: item.price || 0,
            categoria: item.category || "",
          }))
        : [];
      return mapped;
    },
    retry: 2,
    retryDelay: 1000,
    staleTime: 5 * 60 * 1000,
  });

  const productCount = products.length;

  const itemsForList = useMemo(() => products.slice(0, 500), [products]);

  const handleSelect = (productId: number) => {
    const product = products.find((p) => p.id === productId);
    if (!product) return;
    setSelectedProduct(product);
    onProductSelect(product);
    setOpen(false);
  };

  const clearSelection = () => {
    setSelectedProduct(null);
    // Não chamamos onProductSelect(null) para manter tipagem; o pai decide limpar se quiser
  };

  if (error) {
    return (
      <div className="space-y-3">
        <div className="flex items-center gap-2 text-destructive">
          <AlertCircle className="h-4 w-4" />
          <span className="text-sm">Erro ao carregar produtos da API</span>
        </div>
        <Button variant="outline" size="sm" onClick={() => refetch()} disabled={isLoading}>
          Tentar novamente
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        <Package className="h-4 w-4 text-muted-foreground" />
        <span className="text-sm font-medium">Buscar Produto no ERP</span>
        {productCount > 0 && (
          <Badge variant="secondary" className="text-xs">
            {productCount} disponíveis
          </Badge>
        )}
      </div>

      {/* Campo ÚNICO */}
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            role="combobox"
            aria-expanded={open}
            className="w-full justify-between"
            disabled={disabled || isLoading}
          >
            {selectedProduct ? (
              <div className="flex min-w-0 items-center gap-2">
                <Search className="h-4 w-4 text-muted-foreground shrink-0" />
                <span className="truncate text-left">
                  {selectedProduct.codigo} - {selectedProduct.descricao}
                </span>
              </div>
            ) : (
              <div className="flex min-w-0 items-center gap-2 text-muted-foreground">
                <Search className="h-4 w-4 shrink-0" />
                <span className="truncate">{isLoading ? "Carregando produtos..." : placeholder}</span>
              </div>
            )}
            <div className="flex items-center gap-1">
              {selectedProduct && !disabled && (
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="h-6 w-6"
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    clearSelection();
                  }}
                  aria-label="Limpar seleção"
                >
                  <X className="h-3.5 w-3.5" />
                </Button>
              )}
              {isFetching ? <Loader2 className="h-4 w-4 animate-spin" /> : <ChevronsUpDown className="h-4 w-4 opacity-50" />}
            </div>
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-[var(--radix-popover-trigger-width)] p-0" align="start">
          <Command shouldFilter>
            <CommandInput placeholder="Digite para buscar..." />
            <CommandList>
              <CommandEmpty>Nenhum produto encontrado.</CommandEmpty>
              <CommandGroup heading="Produtos">
                {itemsForList.map((product) => (
                  <CommandItem
                    key={product.id}
                    value={`${product.codigo} ${product.descricao} ${product.categoria ?? ""}`}
                    onSelect={() => handleSelect(product.id)}
                    className="cursor-pointer"
                  >
                    <div className="flex min-w-0 flex-col">
                      <span className="font-medium truncate">{product.codigo} - {product.descricao}</span>
                      {(product.categoria || product.unidade) && (
                        <span className="text-xs text-muted-foreground truncate">
                          {product.categoria ?? ""}{product.categoria && product.unidade ? " • " : ""}{product.unidade ? `Unidade: ${product.unidade}` : ""}
                        </span>
                      )}
                    </div>
                    <Check
                      className={`ml-auto h-4 w-4 ${selectedProduct?.id === product.id ? "opacity-100" : "opacity-0"}`}
                    />
                  </CommandItem>
                ))}
              </CommandGroup>
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>
    </div>
  );
}