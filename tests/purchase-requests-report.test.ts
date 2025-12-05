import { computeTotalsForReport } from "../client/src/pages/purchase-requests-report";

type PR = {
  id: number;
  phase: string;
  originalValue: number | null;
  discount: number | null;
  totalValue: number;
};

function assert(condition: boolean, message: string) {
  if (!condition) {
    throw new Error(message);
  }
}

async function run() {
  const base: PR[] = [
    { id: 1, phase: "solicitacao", originalValue: 1000, discount: 100, totalValue: 900 },
    { id: 2, phase: "arquivado", originalValue: 500, discount: 50, totalValue: 450 },
    { id: 3, phase: "cotacao", originalValue: 800, discount: 0, totalValue: 800 },
    { id: 4, phase: "arquivado", originalValue: 1200, discount: 200, totalValue: 1000 },
  ];

  const totalsNoArchived = computeTotalsForReport(base as any, false);
  assert(totalsNoArchived.originalValue === 1800, "Original sem arquivados deve ser 1800");
  assert(totalsNoArchived.discount === 100, "Desconto sem arquivados deve ser 100");
  assert(totalsNoArchived.totalValue === 1700, "Total sem arquivados deve ser 1700");

  const totalsWithArchived = computeTotalsForReport(base as any, true);
  assert(totalsWithArchived.originalValue === 3500, "Original com arquivados deve ser 3500");
  assert(totalsWithArchived.discount === 350, "Desconto com arquivados deve ser 350");
  assert(totalsWithArchived.totalValue === 3150, "Total com arquivados deve ser 3150");

  const bigList: PR[] = Array.from({ length: 3000 }, (_, i) => {
    const archived = i % 4 === 0;
    const orig = 100 + (i % 10);
    const disc = i % 3 === 0 ? 5 : 0;
    const total = orig - disc;
    return { id: i + 100, phase: archived ? "arquivado" : "cotacao", originalValue: orig, discount: disc, totalValue: total };
  });

  const t1 = performance.now();
  const a = computeTotalsForReport(bigList as any, false);
  const t2 = performance.now();
  const b = computeTotalsForReport(bigList as any, true);
  const t3 = performance.now();

  const timeNoArchived = t2 - t1;
  const timeWithArchived = t3 - t2;
  console.log(`Tempo sem arquivados: ${timeNoArchived.toFixed(2)}ms`);
  console.log(`Tempo com arquivados: ${timeWithArchived.toFixed(2)}ms`);

  assert(timeNoArchived < 200, "Recalculo sem arquivados deve ser rápido (<200ms)");
  assert(timeWithArchived < 200, "Recalculo com arquivados deve ser rápido (<200ms)");

  console.log("✓ Testes de relatório de solicitações de compra aprovados");
}

run().catch((e) => {
  console.error("Falha nos testes:", e.message);
  process.exit(1);
});
