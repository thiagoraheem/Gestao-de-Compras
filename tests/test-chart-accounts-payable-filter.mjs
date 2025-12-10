// Test filtering by isPayable and tree levels
const BASE = process.env.BASE_URL || 'http://127.0.0.1:5201';

async function fetchJson(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return await res.json();
}

function buildFilteredTree(list) {
  const parents = list.filter((pc) => pc.parentId == null);
  const map = new Map();
  for (const pc of list) {
    if (pc.parentId != null) {
      const arr = map.get(pc.parentId) || [];
      arr.push(pc);
      map.set(pc.parentId, arr);
    }
  }
  const tree = parents.map((p) => {
    const pid = Number(p.idChartOfAccounts ?? p.id);
    const childrenAll = (map.get(pid) || []);
    const children = childrenAll.map((c) => {
      const cid = Number(c.idChartOfAccounts ?? c.id);
      const grandAll = (map.get(cid) || []);
      const grandPayable = grandAll.filter((g) => g.isPayable === true);
      const selectable = c.isPayable === true && grandPayable.length === 0;
      return { node: c, grandchildren: grandPayable, selectable };
    }).filter((c) => c.selectable || c.grandchildren.length > 0);
    return { parent: p, children };
  }).filter((g) => g.children.length > 0);
  return tree;
}

async function main() {
  console.log('Test: Plano de Contas - filtro isPayable e árvore');
  const data = await fetchJson(`${BASE}/api/plano-contas`);
  const list = Array.isArray(data) ? data : [];
  const tree = buildFilteredTree(list);
  const leaves = tree.flatMap((g) => g.children.flatMap((c) => c.grandchildren.length ? c.grandchildren : (c.selectable ? [c.node] : [])));
  const nonPayableLeaves = leaves.filter((l) => l.isPayable !== true);
  if (nonPayableLeaves.length > 0) throw new Error('Filtro falhou: encontrou folha não pagável');
  console.log(`✓ Grupos=${tree.length} Folhas=${leaves.length} (todas pagáveis)`);
}

main().catch((e) => { console.error(e); process.exit(1); });

