import { useEffect, useMemo, useState } from "react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue, SelectGroup } from "@/components/ui/select";
import { ChevronDown, ChevronRight } from "lucide-react";

interface Props {
  options: any[];
  value?: number | null;
  onChange: (id: number | null) => void;
  placeholder?: string;
}

export function CostCenterTreeSelect({ options, value, onChange, placeholder }: Props) {
  const tree = useMemo(() => {
    const list = Array.isArray(options) ? options : [];
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
  }, [options]);

  const [expandedLv1, setExpandedLv1] = useState<Set<number>>(new Set());
  const [expandedLv2, setExpandedLv2] = useState<Set<number>>(new Set());

  useEffect(() => {
    const lv1 = tree.map((g: any) => Number(g.parent.idCostCenter ?? g.parent.id)).filter(Boolean);
    const lv2 = tree.flatMap((g: any) => g.children.map((c: any) => Number(c.node.idCostCenter ?? c.node.id))).filter(Boolean);
    setExpandedLv1(new Set(lv1));
    setExpandedLv2(new Set(lv2));
  }, [tree.length]);

  const selectedLabel = useMemo(() => {
    const id = value ? Number(value) : null;
    if (!id) return null;
    for (const g of tree) {
      if (Number(g.parent.idCostCenter ?? g.parent.id) === id) return g.parent.name || null;
      for (const c of g.children) {
        if (Number(c.node.idCostCenter ?? c.node.id) === id) return c.node.name || null;
        for (const gc of c.grandchildren) {
          if (Number(gc.idCostCenter ?? gc.id) === id) return gc.name || null;
        }
      }
    }
    return null;
  }, [tree, value]);

  const toggleLv1 = (id: number) => {
    setExpandedLv1(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };
  const toggleLv2 = (id: number) => {
    setExpandedLv2(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  return (
    <Select value={value ? String(value) : undefined} onValueChange={(v) => onChange(v ? Number(v) : null)}>
      <SelectTrigger className="w-full"><SelectValue placeholder={placeholder || "Selecione"} /></SelectTrigger>
      <SelectContent>
        {tree.map(({ parent, children }: any) => (
          <SelectGroup key={parent.idCostCenter ?? parent.id}>
            <div className="py-1.5 pl-8 pr-2 text-sm font-semibold flex items-center gap-2 cursor-pointer" onClick={() => toggleLv1(Number(parent.idCostCenter ?? parent.id))}>
              {expandedLv1.has(Number(parent.idCostCenter ?? parent.id)) ? <ChevronDown className="h-4 w-4"/> : <ChevronRight className="h-4 w-4"/>}
              {parent.name}
            </div>
            {expandedLv1.has(Number(parent.idCostCenter ?? parent.id)) && children.map((c: any) => (
              <div key={(c.node.idCostCenter ?? c.node.id)}>
                {c.grandchildren.length > 0 ? (
                  <div className="py-1.5 pl-10 pr-2 text-sm font-semibold flex items-center gap-2 cursor-pointer" onClick={() => toggleLv2(Number(c.node.idCostCenter ?? c.node.id))}>
                    {expandedLv2.has(Number(c.node.idCostCenter ?? c.node.id)) ? <ChevronDown className="h-4 w-4"/> : <ChevronRight className="h-4 w-4"/>}
                    {c.node.name}
                  </div>
                ) : null}
                {c.grandchildren.length > 0 ? (
                  c.grandchildren.map((gc: any) => (
                    <SelectItem
                      key={(gc.idCostCenter ?? gc.id)}
                      value={String(gc.idCostCenter ?? gc.id)}
                      className="pl-14"
                      style={{ display: expandedLv2.has(Number(c.node.idCostCenter ?? c.node.id)) ? '' : 'none' }}
                    >
                      {gc.name}
                    </SelectItem>
                  ))
                ) : (
                  c.selectable ? (
                    <SelectItem
                      key={(c.node.idCostCenter ?? c.node.id)}
                      value={String(c.node.idCostCenter ?? c.node.id)}
                      className="pl-10"
                      style={{ display: expandedLv2.has(Number(c.node.idCostCenter ?? c.node.id)) ? '' : 'none' }}
                    >
                      {c.node.name}
                    </SelectItem>
                  ) : null
                )}
              </div>
            ))}
          </SelectGroup>
        ))}
      </SelectContent>
    </Select>
  );
}
