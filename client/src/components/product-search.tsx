import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Search, Package, AlertCircle } from "lucide-react";
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

export default function ProductSearch({ 
  onProductSelect, 
  selectedProduct: externalSelectedProduct = null,
  disabled = false,
  placeholder = "Buscar produto..."
}: ProductSearchProps) {
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(externalSelectedProduct);
  const { toast } = useToast();

  // Sincronizar com produto selecionado externamente
  useEffect(() => {
    setSelectedProduct(externalSelectedProduct);
  }, [externalSelectedProduct]);

  const getBaseUrl = () => {
    return import.meta.env.VITE_BASE_API_URL || "http://54.232.194.197:5001/api/Produtos";
  };

  // Buscar todos os produtos da API externa
  const { 
    data: products = [], 
    isLoading, 
    error,
    refetch 
  } = useQuery<Product[]>({
    queryKey: ["external-products"],
    queryFn: async () => {
      const baseUrl = getBaseUrl();
      const response = await fetch(`${baseUrl}/GetAll`);
      
      if (!response.ok) {
        throw new Error(`Erro ao buscar produtos: ${response.status}`);
      }
      
      const data = await response.json();
      
      // Mapear os dados da API para a estrutura esperada
      const mappedProducts = Array.isArray(data) ? data.map((item: any) => ({
        id: item.id,
        codigo: item.sku?.trim() || '',
        descricao: item.description || item.name || '',
        unidade: item.unit || '',
        preco: item.price || 0,
        categoria: item.category || ''
      })) : [];
      
      return mappedProducts;
    },
    retry: 2,
    retryDelay: 1000,
    staleTime: 5 * 60 * 1000, // 5 minutos
  });

  // Buscar contagem de produtos (opcional, para validação)
  const { data: productCount } = useQuery<number>({
    queryKey: ["external-products-count"],
    queryFn: async () => {
      const response = await fetch(`${getBaseUrl()}/GetCount`);
      
      if (!response.ok) {
        throw new Error(`Erro ao buscar contagem: ${response.status}`);
      }
      
      const data = await response.json();
      return typeof data === 'number' ? data : 0;
    },
    retry: 1,
  });

  // Filtrar produtos baseado no termo de busca
  const filteredProducts = products.filter((product) => {
    if (!searchTerm) return true;
    
    const searchLower = searchTerm.toLowerCase();
    return (
      product.descricao?.toLowerCase().includes(searchLower) ||
      product.codigo?.toLowerCase().includes(searchLower) ||
      product.categoria?.toLowerCase().includes(searchLower)
    );
  });

  const handleProductSelect = (productId: string) => {
    const product = products.find(p => p.id.toString() === productId);
    if (product) {
      setSelectedProduct(product);
      onProductSelect(product);
      
      toast({
        title: "Produto selecionado",
        description: `${product.codigo} - ${product.descricao}`,
      });
    }
  };

  const clearSelection = () => {
    setSelectedProduct(null);
    setSearchTerm("");
  };

  if (error) {
    return (
      <div className="space-y-3">
        <div className="flex items-center gap-2 text-red-600">
          <AlertCircle className="h-4 w-4" />
          <span className="text-sm">Erro ao carregar produtos da API</span>
        </div>
        <Button 
          variant="outline" 
          size="sm" 
          onClick={() => refetch()}
          disabled={isLoading}
        >
          Tentar novamente
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <Package className="h-4 w-4 text-gray-500" />
        <span className="text-sm font-medium">Buscar Produto no ERP</span>
        {productCount !== undefined && (
          <Badge variant="secondary" className="text-xs">
            {productCount} produtos disponíveis
          </Badge>
        )}
      </div>

      {selectedProduct ? (
        <div className="p-3 border rounded-lg bg-green-50 border-green-200">
          <div className="flex items-center justify-between">
            <div>
              <div className="font-medium text-green-800">
                {selectedProduct.codigo} - {selectedProduct.descricao}
              </div>
              <div className="text-sm text-green-600">
                {selectedProduct.categoria && (
                  <span>Categoria: {selectedProduct.categoria}</span>
                )}
                {selectedProduct.unidade && (
                  <span className="ml-2">Unidade: {selectedProduct.unidade}</span>
                )}
              </div>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={clearSelection}
              disabled={disabled}
            >
              Alterar
            </Button>
          </div>
        </div>
      ) : (
        <div className="space-y-2">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
            <Input
              placeholder="Digite para filtrar produtos..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
              disabled={disabled || isLoading}
            />
          </div>

          <Select
            onValueChange={handleProductSelect}
            disabled={disabled || isLoading}
          >
            <SelectTrigger>
              <SelectValue 
                placeholder={
                  isLoading 
                    ? "Carregando produtos..." 
                    : filteredProducts.length === 0 
                      ? "Nenhum produto encontrado"
                      : placeholder
                } 
              />
            </SelectTrigger>
            <SelectContent className="max-h-60">
              {filteredProducts.length === 0 ? (
                <div className="p-2 text-center text-gray-500 text-sm">
                  {isLoading ? "Carregando..." : "Nenhum produto encontrado"}
                </div>
              ) : (
                filteredProducts.slice(0, 50).map((product) => (
                  <SelectItem 
                    key={product.id} 
                    value={product.id.toString()}
                    className="cursor-pointer"
                  >
                    <div className="flex flex-col items-start">
                      <div className="font-medium">
                        {product.codigo} - {product.descricao}
                      </div>
                      {(product.categoria || product.unidade) && (
                        <div className="text-xs text-gray-500">
                          {product.categoria && `${product.categoria}`}
                          {product.categoria && product.unidade && " • "}
                          {product.unidade && `Unidade: ${product.unidade}`}
                        </div>
                      )}
                    </div>
                  </SelectItem>
                ))
              )}
              {filteredProducts.length > 50 && (
                <div className="p-2 text-center text-gray-500 text-xs border-t">
                  Mostrando 50 de {filteredProducts.length} produtos. 
                  Use o filtro para refinar a busca.
                </div>
              )}
            </SelectContent>
          </Select>
        </div>
      )}
    </div>
  );
}