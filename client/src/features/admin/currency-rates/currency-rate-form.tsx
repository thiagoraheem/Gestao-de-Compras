import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/shared/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/shared/ui/form";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/shared/ui/select";
import { Textarea } from "@/shared/ui/textarea";
import { Button } from "@/shared/ui/button";
import { DateInput } from "@/shared/ui/date-input";
import { DecimalInput } from "@/shared/ui/decimal-input";
import { SUPPORTED_CURRENCIES, CURRENCY_LABELS } from "../../../../../shared/utils/currency-utils";
import type { CurrencyCode } from "../../../../../shared/utils/currency-utils";
import type { CurrencyRate, CreateCurrencyRatePayload } from "./types";

export const currencyRateSchema = z.object({
  currencyCode: z.enum(SUPPORTED_CURRENCIES as unknown as [string, ...string[]], {
    required_error: "Moeda é obrigatória",
  }) as z.ZodType<CurrencyCode>,
  rateDate: z.string().min(1, "Data da cotação é obrigatória"),
  rateValue: z
    .number({
      required_error: "Taxa é obrigatória",
      invalid_type_error: "Taxa deve ser um número",
    })
    .min(0.000001, "Taxa deve ser maior que 0"),
  observations: z.string().optional(),
});

export type CurrencyRateFormData = z.infer<typeof currencyRateSchema>;

interface CurrencyRateFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  editingRate: CurrencyRate | null;
  onSubmit: (data: CreateCurrencyRatePayload) => void;
  isPending: boolean;
}

function getTodayISO(): string {
  const today = new Date();
  const year = today.getFullYear();
  const month = String(today.getMonth() + 1).padStart(2, "0");
  const day = String(today.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function CurrencyRateFormModal({
  isOpen,
  onClose,
  editingRate,
  onSubmit,
  isPending,
}: CurrencyRateFormModalProps) {
  const form = useForm<CurrencyRateFormData>({
    resolver: zodResolver(currencyRateSchema),
    defaultValues: {
      currencyCode: "USD",
      rateDate: getTodayISO(),
      rateValue: 0,
      observations: "",
    },
  });

  useEffect(() => {
    if (editingRate) {
      form.reset({
        currencyCode: editingRate.currencyCode,
        rateDate: editingRate.rateDate,
        rateValue: editingRate.rateValue,
        observations: editingRate.observations ?? "",
      });
    } else if (isOpen) {
      form.reset({
        currencyCode: "USD",
        rateDate: getTodayISO(),
        rateValue: 0,
        observations: "",
      });
    }
  }, [editingRate, isOpen, form]);

  const isEditing = !!editingRate;

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-2xl w-[95vw] max-h-[95vh] flex flex-col p-0">
        <DialogHeader className="px-6 py-4 border-b flex-shrink-0">
          <DialogTitle>
            {isEditing ? "Editar Cotação de Moeda" : "Nova Cotação de Moeda"}
          </DialogTitle>
        </DialogHeader>
        <div className="flex-1 overflow-y-auto px-6 py-4">
          <Form {...form}>
            <form
              id="currency-rate-form"
              onSubmit={form.handleSubmit((data) => {
                const payload: CreateCurrencyRatePayload = {
                  currencyCode: data.currencyCode,
                  rateDate: data.rateDate,
                  rateValue: data.rateValue,
                  observations: data.observations || undefined,
                };
                onSubmit(payload);
              })}
              className="space-y-5"
            >
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="currencyCode"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Moeda *</FormLabel>
                      <Select
                        onValueChange={field.onChange}
                        value={field.value}
                        disabled={isPending}
                      >
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Selecione a moeda" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {SUPPORTED_CURRENCIES.map((code) => (
                            <SelectItem key={code} value={code}>
                              {code} - {CURRENCY_LABELS[code]}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="rateDate"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Data da Cotação *</FormLabel>
                      <FormControl>
                        <DateInput
                          value={field.value}
                          onChange={field.onChange}
                          disabled={isPending}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <FormField
                control={form.control}
                name="rateValue"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Taxa (para BRL) *</FormLabel>
                    <FormControl>
                      <DecimalInput
                        value={field.value}
                        onChange={(val) => {
                          const num = parseFloat(val);
                          field.onChange(isNaN(num) ? 0 : num);
                        }}
                        precision={6}
                        disabled={isPending}
                        placeholder="0,000000"
                      />
                    </FormControl>
                    <div className="text-xs text-muted-foreground">
                      Valor de 1 unidade da moeda selecionada em Reais (BRL). Mínimo: 0,000001
                    </div>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="observations"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Observações</FormLabel>
                    <FormControl>
                      <Textarea
                        rows={3}
                        placeholder="Observações adicionais (opcional)"
                        className="resize-none"
                        disabled={isPending}
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </form>
          </Form>
        </div>

        <div className="flex-shrink-0 px-6 py-4 border-t bg-gray-50/50">
          <div className="flex flex-col sm:flex-row justify-end gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={onClose}
              disabled={isPending}
              className="w-full sm:w-auto order-2 sm:order-1"
            >
              Cancelar
            </Button>
            <Button
              type="submit"
              form="currency-rate-form"
              disabled={isPending}
              className="w-full sm:w-auto order-1 sm:order-2"
            >
              {isPending
                ? "Salvando..."
                : isEditing
                ? "Atualizar"
                : "Criar"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
