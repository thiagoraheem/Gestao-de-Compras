
export function buildCostCenterTreeData(listInput: any[]) {
  const list = Array.isArray(listInput) ? listInput : [];
  const parents = list.filter((cc: any) => cc.parentId == null);
  const childrenMap = new Map<number, any[]>();
  for (const cc of list) {
    if (cc.parentId != null) {
      const pid = Number(cc.parentId);
      const arr = childrenMap.get(pid) || [];
      arr.push(cc);
      childrenMap.set(pid, arr);
    }
  }
  const result = parents.map((p: any) => {
    const pid = Number(p.idCostCenter ?? p.id);
    const childrenAll = (childrenMap.get(pid) || []).sort((a: any, b: any) => String(a.name || '').localeCompare(String(b.name || '')));
    const childrenWithGrand = childrenAll.map((c: any) => {
      const cid = Number(c.idCostCenter ?? c.id);
      const grandAll = (childrenMap.get(cid) || []).sort((a: any, b: any) => String(a.name || '').localeCompare(String(b.name || '')));
      return { node: c, grandchildren: grandAll, selectable: grandAll.length === 0 };
    });
    return { parent: p, children: childrenWithGrand };
  }).sort((a: any, b: any) => String(a.parent.name || '').localeCompare(String(b.parent.name || '')));
  return result;
}

export function computeInitialCcExpand(tree: any[]) {
  const lv1 = tree.map((g: any) => Number(g.parent.idCostCenter ?? g.parent.id)).filter(Boolean);
  const lv2 = tree.flatMap((g: any) => g.children.map((c: any) => Number(c.node.idCostCenter ?? c.node.id))).filter(Boolean);
  return { lv1, lv2 };
}
