import React, { useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/shared/ui/dialog";
import { Button } from "@/shared/ui/button";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
  FormDescription,
} from "@/shared/ui/form";
import { Input } from "@/shared/ui/input";
import { Switch } from "@/shared/ui/switch";
import type { UnitOfMeasure } from "@shared/schema";

const unitSchema = z.object({
  code: z
    .string()
    .min(1, "Código é obrigatório")
    .max(10, "Código pode ter no máximo 10 caracteres")
    .regex(/^[A-Za-z0-9²³%]+$/, "Código deve conter apenas letras, números ou símbolos comuns (ex: M2, M3)"),
  description: z.string().min(2, "Descrição deve ter no mínimo 2 caracteres"),
  active: z.boolean().default(true),
});

export type UnitFormData = z.infer<typeof unitSchema>;

interface UnitOfMeasureFormModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (data: UnitFormData) => void;
  editingUnit: UnitOfMeasure | null;
  isLoading?: boolean;
}

export function UnitOfMeasureFormModal({
  open,
  onOpenChange,
  onSubmit,
  editingUnit,
  isLoading = false,
}: UnitOfMeasureFormModalProps) {
  const form = useForm<UnitFormData>({
    resolver: zodResolver(unitSchema),
    defaultValues: {
      code: "",
      description: "",
      active: true,
    },
  });

  useEffect(() => {
    if (editingUnit) {
      form.reset({
        code: editingUnit.code,
        description: editingUnit.description,
        active: editingUnit.active,
      });
    } else {
      form.reset({
        code: "",
        description: "",
        active: true,
      });
    }
  }, [editingUnit, open, form]);

  const handleSubmit = (data: UnitFormData) => {
    onSubmit({
      ...data,
      code: data.code.toUpperCase().trim(),
      description: data.description.trim(),
    });
  };

  const isEditing = !!editingUnit;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>
            {isEditing ? `Editar Unidade: ${editingUnit.code}` : "Nova Unidade de Medida"}
          </DialogTitle>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4 py-2">
            <FormField
              control={form.control}
              name="code"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Código da Unidade *</FormLabel>
                  <FormControl>
                    <Input
                      {...field}
                      placeholder="Ex: UN, KG, MT, M2"
                      disabled={isEditing || isLoading}
                      onChange={(e) => field.onChange(e.target.value.toUpperCase())}
                      className="font-mono uppercase"
                    />
                  </FormControl>
                  <FormDescription>
                    Sigla única utilizada para identificar a unidade.
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="description"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Descrição *</FormLabel>
                  <FormControl>
                    <Input
                      {...field}
                      placeholder="Ex: Unidade, Quilograma, Metro Quadrado"
                      disabled={isLoading}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="active"
              render={({ field }) => (
                <FormItem className="flex flex-row items-center justify-between rounded-lg border p-3 shadow-sm">
                  <div className="space-y-0.5">
                    <FormLabel>Status Ativo</FormLabel>
                    <FormDescription>
                      Unidades ativas ficam disponíveis na seleção de solicitações.
                    </FormDescription>
                  </div>
                  <FormControl>
                    <Switch
                      checked={field.value}
                      onCheckedChange={field.onChange}
                      disabled={isLoading}
                    />
                  </FormControl>
                </FormItem>
              )}
            />

            <DialogFooter className="pt-4">
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
                disabled={isLoading}
              >
                Cancelar
              </Button>
              <Button type="submit" disabled={isLoading}>
                {isLoading ? "Salvando..." : isEditing ? "Salvar Alterações" : "Cadastrar Unidade"}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
