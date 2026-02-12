// Simple runtime test for Chart of Accounts 3-level tree building
const BASE = process.env.BASE_URL || 'http://127.0.0.1:5201';

async function fetchJson(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return await res.json();
}

function buildTree3(list) {
  const parents = list.filter((pc) => pc.parentId == null);
  const map = new Map();
  for (const pc of list) {
    if (pc.parentId != null) {
      const arr = map.get(pc.parentId) || [];
      arr.push(pc);
      map.set(pc.parentId, arr);
    }
  }
  return parents.map((p) => {
    const pid = Number(p.idChartOfAccounts ?? p.id);
    const children = (map.get(pid) || []).map((c) => {
      const cid = Number(c.idChartOfAccounts ?? c.id);
      const grand = map.get(cid) || [];
      return { node: c, grandchildren: grand };
    });
    return { parent: p, children };
  });
}

async function main() {
  console.log('Test: Plano de Contas - árvore 3 níveis');
  const data = await fetchJson(`${BASE}/api/plano-contas`);
  const tree = buildTree3(Array.isArray(data) ? data : []);
  const parentCount = tree.length;
  const childCount = tree.reduce((acc, g) => acc + g.children.length, 0);
  const grandCount = tree.reduce((acc, g) => acc + g.children.reduce((a, c) => a + c.grandchildren.length, 0), 0);
  console.log(`Pais=${parentCount} Subcats=${childCount} Itens=${grandCount}`);
  if (parentCount === 0) throw new Error('Nenhuma categoria principal encontrada');
  // basic assertions
  const hasAtLeastOneGrandchild = grandCount > 0 || childCount === 0; // allow datasets sem nível 3
  if (!hasAtLeastOneGrandchild) throw new Error('Nenhum item detalhado encontrado');
  console.log('✓ Estrutura válida em até 3 níveis');
}

main().catch((e) => { console.error(e); process.exit(1); });

