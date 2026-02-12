import React from "react";
import { useReceipt } from "./ReceiptContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Building, Truck, AlertCircle } from "lucide-react";
import { formatCurrency } from "@/lib/currency";

export function ReceiptSupplierInfo() {
  const {
    activeTab,
    selectedSupplierQuotation,
    selectedSupplier,
    freightValue,
  } = useReceipt();

  if (activeTab !== 'fiscal' || !selectedSupplierQuotation) return null;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Building className="h-5 w-5 text-green-600" />
          Fornecedor Selecionado
        </CardTitle>
      </CardHeader>
      <CardContent>
        {selectedSupplier && !selectedSupplier.idSupplierERP && (
           <div className="mb-4 p-4 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg flex items-center gap-3">
             <AlertCircle className="h-5 w-5 text-amber-600 dark:text-amber-400" />
             <span className="text-sm font-medium text-amber-800 dark:text-amber-300">
               Fornecedor não sincronizado com o ERP - não gerará registro no Contas a Pagar
             </span>
           </div>
        )}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-4">
          <div>
            <p className="text-sm font-medium text-gray-500">Nome do Fornecedor</p>
            <p className="text-sm font-semibold mt-1">{selectedSupplierQuotation.supplier?.name || 'N/A'}</p>
          </div>
          <div>
            <p className="text-sm font-medium text-gray-500">E-mail</p>
            <p className="text-sm mt-1">{selectedSupplierQuotation.supplier?.email || 'N/A'}</p>
          </div>
          <div>
            <p className="text-sm font-medium text-gray-500">Contato</p>
            <p className="text-sm mt-1">{selectedSupplierQuotation.supplier?.contact || 'N/A'}</p>
          </div>
          <div>
            <p className="text-sm font-medium text-gray-500">CNPJ</p>
            <p className="text-sm mt-1">{selectedSupplierQuotation.supplier?.cnpj || 'N/A'}</p>
          </div>
          <div>
            <p className="text-sm font-medium text-gray-500">Valor Total da Proposta</p>
            <p className="text-lg font-bold text-green-600 mt-1">
              {formatCurrency(selectedSupplierQuotation.totalValue)}
            </p>
          </div>

          {/* Freight Information */}
          <div className="col-span-full">
            <div className="p-4 bg-blue-50 dark:bg-blue-900/20 border-2 border-blue-200 dark:border-blue-800 rounded-lg">
              <div className="flex items-center gap-2 mb-2">
                <Truck className="h-5 w-5 text-blue-600 dark:text-blue-300" />
                <p className="text-sm font-semibold text-blue-800 dark:text-blue-300">Informações de Frete</p>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <p className="text-sm font-medium text-blue-700 dark:text-blue-300">Frete Incluso</p>
                  <p className="text-sm mt-1 text-slate-700 dark:text-slate-300">
                    {selectedSupplierQuotation.includesFreight ? 'Sim' : 'Não'}
                  </p>
                </div>
                <div>
                  <p className="text-sm font-medium text-blue-700 dark:text-blue-300">Valor do Frete</p>
                  <p className="text-lg font-bold text-blue-800 dark:text-blue-300 mt-1">
                    {freightValue > 0 ? formatCurrency(freightValue) : 'Não incluso'}
                  </p>
                </div>
              </div>
            </div>
          </div>
          <div>
            <p className="text-sm font-medium text-gray-500">Condições de Pagamento</p>
            <p className="text-sm mt-1">{selectedSupplierQuotation.paymentTerms || 'N/A'}</p>
          </div>

          {/* Desconto da Proposta */}
          {(selectedSupplierQuotation.discountType && selectedSupplierQuotation.discountType !== 'none' && selectedSupplierQuotation.discountValue) && (
            <div>
              <p className="text-sm font-medium text-gray-500">Desconto da Proposta</p>
              <p className="text-lg font-bold text-green-600 mt-1">
                {selectedSupplierQuotation.discountType === 'percentage'
                  ? `${selectedSupplierQuotation.discountValue}%`
                  : formatCurrency(selectedSupplierQuotation.discountValue)
                }
              </p>
            </div>
          )}
        </div>

        {selectedSupplierQuotation.choiceReason && (
          <div className="p-3 bg-green-50 border border-green-200 rounded-lg">
            <p className="text-sm font-medium text-green-800">Justificativa da Escolha:</p>
            <p className="text-sm text-green-700 mt-1">{selectedSupplierQuotation.choiceReason}</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
