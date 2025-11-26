const computeConsolidatedDiscount = ({ items, proposal }) => {
  let itemsOriginalSum = 0;
  let itemsDiscountedSum = 0;
  for (const it of items || []) {
    const orig = Number(it.originalTotalPrice ?? it.totalPrice ?? 0) || 0;
    const discCand = Number(it.discountedTotalPrice ?? it.totalPrice ?? 0) || 0;
    const pct = Number(it.discountPercentage ?? 0) || 0;
    const fixed = Number(it.discountValue ?? 0) || 0;
    let discTotal = discCand;
    if (it.discountedTotalPrice == null && (pct > 0 || fixed > 0)) {
      const pctValue = pct > 0 ? (orig * pct) / 100 : 0;
      const totalDisc = Math.max(0, pctValue + fixed);
      discTotal = Math.max(0, orig - totalDisc);
    }
    itemsOriginalSum += orig;
    itemsDiscountedSum += Math.min(orig, Math.max(0, discTotal));
  }
  const subtotalAfterItems = itemsDiscountedSum;
  let proposalDiscount = 0;
  const type = String(proposal?.discountType ?? 'none');
  const value = Number(proposal?.discountValue ?? 0) || 0;
  if (subtotalAfterItems > 0) {
    if (type === 'percentage' && value > 0) {
      proposalDiscount = (subtotalAfterItems * value) / 100;
    } else if (type === 'fixed' && value > 0) {
      proposalDiscount = value;
    } else if (
      proposal?.finalValue != null && proposal?.subtotalValue != null
    ) {
      const sub = Number(proposal.subtotalValue) || 0;
      const fin = Number(proposal.finalValue) || 0;
      proposalDiscount = Math.max(0, sub - fin);
    }
  }
  const finalValue = proposal?.finalValue != null
    ? Number(proposal.finalValue) || 0
    : Math.max(0, subtotalAfterItems - proposalDiscount);
  const originalValue = itemsOriginalSum > 0
    ? itemsOriginalSum
    : Math.max(0, subtotalAfterItems + proposalDiscount);
  const discount = Math.max(0, originalValue - finalValue);
  return { originalValue, proposalDiscount, itemDiscountTotal: Math.max(0, itemsOriginalSum - subtotalAfterItems), discount, finalValue };
};

test('apenas desconto por item', () => {
  const items = [
    { originalTotalPrice: 100, discountedTotalPrice: 90 },
    { originalTotalPrice: 200, discountedTotalPrice: 180 },
  ];
  const proposal = { discountType: 'none', discountValue: 0 };
  const r = computeConsolidatedDiscount({ items, proposal });
  expect(r.itemDiscountTotal).toBe(30);
  expect(r.proposalDiscount).toBe(0);
  expect(r.discount).toBe(30);
  expect(r.finalValue).toBe(270);
});

test('apenas desconto da proposta percentual', () => {
  const items = [
    { originalTotalPrice: 100, discountedTotalPrice: 100 },
    { originalTotalPrice: 200, discountedTotalPrice: 200 },
  ];
  const proposal = { discountType: 'percentage', discountValue: 10 };
  const r = computeConsolidatedDiscount({ items, proposal });
  expect(r.itemDiscountTotal).toBe(0);
  expect(r.proposalDiscount).toBe(30);
  expect(r.discount).toBe(30);
  expect(r.finalValue).toBe(270);
});

test('descontos combinados (item + proposta fixa)', () => {
  const items = [
    { originalTotalPrice: 120, discountedTotalPrice: 110 },
    { originalTotalPrice: 80, discountedTotalPrice: 75 },
  ];
  const proposal = { discountType: 'fixed', discountValue: 10 };
  const r = computeConsolidatedDiscount({ items, proposal });
  expect(r.itemDiscountTotal).toBe(15);
  expect(r.proposalDiscount).toBe(10);
  expect(r.discount).toBe(25);
  expect(r.finalValue).toBe(175);
});

test('fallback por percentual/valor quando discounted_total_price ausente', () => {
  const items = [
    { originalTotalPrice: 100, discountPercentage: 10 },
    { originalTotalPrice: 50, discountValue: 5 },
  ];
  const proposal = { discountType: 'none', discountValue: 0 };
  const r = computeConsolidatedDiscount({ items, proposal });
  expect(r.itemDiscountTotal).toBe(15);
  expect(r.finalValue).toBe(135);
});

test('usa final/subtotal da proposta quando presentes', () => {
  const items = [
    { originalTotalPrice: 100, discountedTotalPrice: 95 },
  ];
  const proposal = { subtotalValue: 95, finalValue: 90 };
  const r = computeConsolidatedDiscount({ items, proposal });
  expect(r.itemDiscountTotal).toBe(5);
  expect(r.proposalDiscount).toBe(5);
  expect(r.discount).toBe(10);
  expect(r.finalValue).toBe(90);
});
