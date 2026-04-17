import React from "react";
import { render, fireEvent } from "@testing-library/react";
import ReceiptKanbanCard from "../receipt-kanban-card";

describe("ReceiptKanbanCard", () => {
  test("calls onOpen when clicking the card", () => {
    const onOpen = jest.fn();
    const { container } = render(
      <ReceiptKanbanCard
        receipt={{
          id: 1,
          receiptNumber: "REC-1",
          status: "rascunho",
          receiptPhase: "recebimento_fisico",
          receiptType: "produto",
          supplier: { id: 1, name: "Fornecedor" },
          request: { id: 10, requestNumber: "SOL-1", currentPhase: "pedido_concluido" },
          requestFound: true,
        }}
        onOpen={onOpen}
      />,
    );

    const el = container.querySelector('[data-receipt-id="1"]') as HTMLElement;
    fireEvent.click(el);
    expect(onOpen).toHaveBeenCalledTimes(1);
  });

  test("applies final-state styles when receiptPhase is concluido", () => {
    const { container } = render(
      <ReceiptKanbanCard
        receipt={{
          id: 1,
          receiptNumber: "REC-1",
          status: "fiscal_conferida",
          receiptPhase: "concluido",
          receiptType: "produto",
          supplier: { id: 1, name: "Fornecedor" },
          request: { id: 10, requestNumber: "SOL-1", currentPhase: "pedido_concluido" },
          requestFound: true,
        }}
      />,
    );

    const el = container.querySelector('[data-receipt-id="1"]') as HTMLElement;
    expect(el.className).toContain("card-final-state");
  });
});
