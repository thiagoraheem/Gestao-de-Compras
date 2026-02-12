import { useEffect, useMemo, useState } from "react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue, SelectGroup } from "@/components/ui/select";
import { ChevronDown, ChevronRight } from "lucide-react";

interface Props {
  options: any[];
  value?: number | null;
  onChange: (id: number | null) => void;
  placeholder?: string;
}

export function ChartAccountTreeSelect({ options, value, onChange, placeholder }: Props) {
  const tree = useMemo(() => {
    const list = Array.isArray(options) ? options : [];
    const parents = list.filter((pc: any) => pc.parentId == null);
    const childrenMap = new Map<number, any[]>();
    for (const pc of list) {
      if (pc.parentId != null) {
        const arr = childrenMap.get(pc.parentId) || [];
        arr.push(pc);
        childrenMap.set(pc.parentId, arr);
      }
    }
    const result = parents.map((p: any) => {
      const pid = Number(p.idChartOfAccounts ?? p.id);
      const childrenAll = (childrenMap.get(pid) || []).sort((a: any, b: any) => String((a.accountName ?? a.name) || '').localeCompare(String((b.accountName ?? b.name) || '')));
      const childrenWithGrand = childrenAll.map((c: any) => {
        const cid = Number(c.idChartOfAccounts ?? c.id);
        const grandAll = (childrenMap.get(cid) || []).sort((a: any, b: any) => String((a.accountName ?? a.name) || '').localeCompare(String((b.accountName ?? b.name) || '')));
        const grandPayable = grandAll.filter((g: any) => g.isPayable === true);
        const isChildPayable = c.isPayable === true;
        return { node: c, grandchildren: grandPayable, selectable: isChildPayable && grandPayable.length === 0 };
      });
      const childrenFiltered = childrenWithGrand.filter((c: any) => c.selectable || c.grandchildren.length > 0);
      return {
        parent: p,
        children: childrenFiltered
      };
    }).filter((g: any) => g.children.length > 0)
      .sort((a: any, b: any) => String((a.parent.accountName ?? a.parent.name) || '').localeCompare(String((b.parent.accountName ?? b.parent.name) || '')));
    return result;
  }, [options]);

  const [expandedLv1, setExpandedLv1] = useState<Set<number>>(new Set());
  const [expandedLv2, setExpandedLv2] = useState<Set<number>>(new Set());

  useEffect(() => {
    const parents = tree.map((g: any) => Number(g.parent.idChartOfAccounts ?? g.parent.id)).filter(Boolean);
    setExpandedLv1(new Set(parents));
    const subs = tree.flatMap((g: any) => g.children.map((c: any) => Number(c.node.idChartOfAccounts ?? c.node.id))).filter(Boolean);
    setExpandedLv2(new Set(subs));
  }, [tree.length]);

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
          <SelectGroup key={(parent.idChartOfAccounts ?? parent.id)}>
            <div className="py-1.5 pl-8 pr-2 text-sm font-semibold flex items-center gap-2 cursor-pointer" onClick={() => toggleLv1(Number(parent.idChartOfAccounts ?? parent.id))}>
              {expandedLv1.has(Number(parent.idChartOfAccounts ?? parent.id)) ? <ChevronDown className="h-4 w-4"/> : <ChevronRight className="h-4 w-4"/>}
              {(parent.accountName ?? parent.name)}
            </div>
            {expandedLv1.has(Number(parent.idChartOfAccounts ?? parent.id)) && children.map((c: any) => (
              <div key={(c.node.idChartOfAccounts ?? c.node.id)}>
                {c.grandchildren.length > 0 ? (
                  <div className="py-1.5 pl-10 pr-2 text-sm font-semibold flex items-center gap-2 cursor-pointer" onClick={() => toggleLv2(Number(c.node.idChartOfAccounts ?? c.node.id))}>
                    {expandedLv2.has(Number(c.node.idChartOfAccounts ?? c.node.id)) ? <ChevronDown className="h-4 w-4"/> : <ChevronRight className="h-4 w-4"/>}
                    {(c.node.accountName ?? c.node.name)}
                  </div>
                ) : null}
                {c.grandchildren.length > 0 ? (
                  expandedLv2.has(Number(c.node.idChartOfAccounts ?? c.node.id)) && c.grandchildren.map((pc: any) => (
                    <SelectItem key={(pc.idChartOfAccounts ?? pc.id)} value={String(pc.idChartOfAccounts ?? pc.id)} className="pl-14">
                      {(pc.accountName ?? pc.name)}
                    </SelectItem>
                  ))
                ) : (
                  c.selectable ? (
                    <SelectItem key={(c.node.idChartOfAccounts ?? c.node.id)} value={String(c.node.idChartOfAccounts ?? c.node.id)} className="pl-10">
                      {(c.node.accountName ?? c.node.name)}
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
