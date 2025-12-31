
export const MANUAL_ITEM_MATCH_THRESHOLD = 0.45;

export const normalizeText = (value: string) =>
  value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();

export const calculateTokenScore = (left: string, right: string) => {
  const leftTokens = new Set(left.split(" ").filter(Boolean));
  const rightTokens = new Set(right.split(" ").filter(Boolean));
  if (leftTokens.size === 0 || rightTokens.size === 0) return 0;
  let intersection = 0;
  for (const token of Array.from(leftTokens)) {
    if (rightTokens.has(token)) intersection += 1;
  }
  const maxSize = Math.max(leftTokens.size, rightTokens.size);
  return maxSize > 0 ? intersection / maxSize : 0;
};

export const findBestPurchaseOrderMatch = (manualItem: any, poItems: any[]) => {
  if (!manualItem || poItems.length === 0) return null;
  const manualCode = normalizeText(String(manualItem.code || ""));
  const manualDesc = normalizeText(String(manualItem.description || ""));
  let best: { id: number; score: number } | null = null;

  for (const poItem of poItems) {
    const poCode = normalizeText(String(poItem.productCode || poItem.itemCode || poItem.code || ""));
    const poDesc = normalizeText(String(poItem.description || ""));
    let score = 0;

    if (manualCode && poCode) {
      if (manualCode === poCode) {
        score = 1;
      } else if (manualCode.includes(poCode) || poCode.includes(manualCode)) {
        score = Math.max(score, 0.85);
      }
    }

    if (manualDesc && poDesc) {
      if (manualDesc === poDesc) {
        score = Math.max(score, 0.9);
      } else if (manualDesc.includes(poDesc) || poDesc.includes(manualDesc)) {
        score = Math.max(score, 0.7);
      } else {
        score = Math.max(score, calculateTokenScore(manualDesc, poDesc));
      }
    }

    if (!best || score > best.score) {
      best = { id: poItem.id, score };
    }
  }

  return best;
};
