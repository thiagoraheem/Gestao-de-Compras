
import * as React from "react"
import { Check, ChevronsUpDown, Loader2, Search, X } from "lucide-react"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import { useQuery } from "@tanstack/react-query"
import { apiRequest } from "@/lib/queryClient"

interface ItemSearchInputProps {
  value: string
  onChange: (value: string) => void
  placeholder?: string
}

export function ItemSearchInput({ value, onChange, placeholder = "Buscar item..." }: ItemSearchInputProps) {
  const [open, setOpen] = React.useState(false)
  const [inputValue, setInputValue] = React.useState("")
  const [debouncedInput, setDebouncedInput] = React.useState("")

  // Initialize input value when opened or value changes externally (optional)
  React.useEffect(() => {
    if (!open) {
        setInputValue(value || "")
    }
  }, [open, value])

  // Update debounced input after delay
  React.useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedInput(inputValue)
    }, 300)
    return () => clearTimeout(timer)
  }, [inputValue])

  // Fetch distinct items based on debounced input
  const { data: items = [], isLoading, isFetching, error } = useQuery<string[], Error>({
    queryKey: ["distinct-items", debouncedInput],
    queryFn: async () => {
      const params = new URLSearchParams()
      if (debouncedInput.trim()) params.append("query", debouncedInput.trim())

      const result = await apiRequest(
        `/api/purchase-request-items/distinct-descriptions?${params.toString()}`,
      )

      const rawList = Array.isArray(result)
        ? result
        : Array.isArray(result?.data)
          ? result.data
          : []

      return rawList
        .map((v: any) => (v == null ? "" : String(v)))
        .map((v: string) => v.trim())
        .filter(Boolean)
    },
    enabled: open && debouncedInput.trim().length > 0, // Only fetch when open and user typed
    staleTime: 60000, // Cache for 1 minute
  });

  const handleClear = React.useCallback(() => {
    onChange("")
    setInputValue("")
    setDebouncedInput("")
    setOpen(false)
  }, [onChange])

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className="w-full justify-between font-normal"
        >
          {value ? (
            <span className="truncate">{value}</span>
          ) : (
            <span className="text-muted-foreground">{placeholder}</span>
          )}
          <span className="ml-2 flex items-center gap-2 shrink-0">
            {value ? (
              <span
                role="button"
                tabIndex={0}
                aria-label="Limpar seleção"
                className="rounded-sm p-0.5 text-muted-foreground hover:text-foreground"
                onPointerDown={(e) => {
                  e.preventDefault()
                  e.stopPropagation()
                }}
                onClick={(e) => {
                  e.preventDefault()
                  e.stopPropagation()
                  handleClear()
                }}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault()
                    e.stopPropagation()
                    handleClear()
                  }
                }}
              >
                <X className="h-4 w-4" />
              </span>
            ) : null}
            <ChevronsUpDown className="h-4 w-4 opacity-50" />
          </span>
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[300px] p-0" align="start">
        <Command shouldFilter={false}>
          <CommandInput 
            placeholder="Digite para buscar..." 
            value={inputValue}
            onValueChange={setInputValue}
          />
          <CommandList>
            {isLoading || isFetching ? (
              <div className="flex items-center justify-center p-4">
                <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
              </div>
            ) : error ? (
              <div className="py-3 px-4 text-sm text-destructive">
                {error.message || "Falha ao buscar itens."}
              </div>
            ) : items.length === 0 && !inputValue ? (
              <div className="py-6 text-center text-sm text-muted-foreground">
                Digite para buscar itens...
              </div>
            ) : items.length === 0 ? (
              <CommandEmpty>Nenhum item encontrado.</CommandEmpty>
            ) : (
              <CommandGroup heading="Sugestões">
                {items.map((item: string) => (
                  <CommandItem
                    key={item}
                    value={item}
                    onSelect={(currentValue) => {
                      // CommandItem converts value to lowercase usually, so use the item string directly
                      onChange(item)
                      setOpen(false)
                    }}
                  >
                    <Check
                      className={cn(
                        "mr-2 h-4 w-4",
                        value === item ? "opacity-100" : "opacity-0"
                      )}
                    />
                    <span className="truncate">{item}</span>
                  </CommandItem>
                ))}
              </CommandGroup>
            )}
            
            {/* Allow searching for custom text if typed and not exactly in list */}
            {!isLoading && !isFetching && inputValue && (
                 <CommandGroup heading="Busca livre">
                    <CommandItem
                        value={`custom-search-${inputValue}`}
                        onSelect={() => {
                            onChange(inputValue)
                            setOpen(false)
                        }}
                    >
                        <Search className="mr-2 h-4 w-4" />
                        Buscar contendo "{inputValue}"
                    </CommandItem>
                 </CommandGroup>
            )}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  )
}
