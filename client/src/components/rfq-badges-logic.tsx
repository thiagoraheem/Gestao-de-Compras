import React from "react";
import { Badge } from "@/components/ui/badge";

export function getBadges(prItem: any, watchItemCode: string, purchaseRequestItemCode: string) {
  const badges = [];
  
  if (purchaseRequestItemCode) {
    badges.push(
      <Badge key="original" variant="secondary" className="text-xs">
        Original
      </Badge>
    );
  }

  const codeToDisplay = watchItemCode || purchaseRequestItemCode;
  if (codeToDisplay) {
    badges.push(
      <Badge key="code" variant="secondary" className="text-xs">
        {codeToDisplay}
      </Badge>
    );
  }

  if (prItem?.price != null && String(prItem.price).trim() !== "") {
    badges.push(
      <Badge key="price" variant="secondary" className="text-xs">
        Valor Custo: {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(Number(prItem.price))}
      </Badge>
    );
  }

  if (prItem?.partNumber && String(prItem.partNumber).trim() !== "") {
    badges.push(
      <Badge key="partNumber" variant="secondary" className="text-xs">
        Part Number: {prItem.partNumber}
      </Badge>
    );
  }

  return badges;
}
