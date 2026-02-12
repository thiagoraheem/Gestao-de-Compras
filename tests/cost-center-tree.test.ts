import { buildCostCenterTreeData, computeInitialCcExpand } from "../client/src/components/receipt-phase.tsx";

describe("Centro de Custo - árvore 3 níveis", () => {
  const sample = [
    { idCostCenter: 1, parentId: null, name: "Administração" },
    { idCostCenter: 2, parentId: 1, name: "Financeiro" },
    { idCostCenter: 3, parentId: 2, name: "Contas a Pagar" },
    { idCostCenter: 4, parentId: 2, name: "Contas a Receber" },
    { idCostCenter: 5, parentId: 1, name: "RH" },
    { idCostCenter: 6, parentId: 5, name: "Recrutamento" },
    { idCostCenter: 7, parentId: null, name: "Operações" },
    { idCostCenter: 8, parentId: 7, name: "Campo" },
  ];

  it("constrói árvore com 3 níveis", () => {
    const tree = buildCostCenterTreeData(sample);
    expect(tree.length).toBe(2);
    const admin = tree.find((g: any) => (g.parent.idCostCenter === 1));
    const oper = tree.find((g: any) => (g.parent.idCostCenter === 7));
    expect(admin.children.length).toBe(2);
    const financeiro = admin.children.find((c: any) => c.node.idCostCenter === 2);
    expect(financeiro.grandchildren.map((gc: any) => gc.idCostCenter)).toEqual([3,4]);
    const rh = admin.children.find((c: any) => c.node.idCostCenter === 5);
    expect(rh.grandchildren.map((gc: any) => gc.idCostCenter)).toEqual([6]);
    expect(oper.children.length).toBe(1);
    expect(oper.children[0].node.idCostCenter).toBe(8);
  });

  it("marca filhos sem netos como selecionáveis", () => {
    const tree = buildCostCenterTreeData(sample);
    const admin = tree.find((g: any) => (g.parent.idCostCenter === 1));
    const financeiro = admin.children.find((c: any) => c.node.idCostCenter === 2);
    const rh = admin.children.find((c: any) => c.node.idCostCenter === 5);
    expect(financeiro.selectable).toBe(false);
    expect(rh.selectable).toBe(false);
    const oper = tree.find((g: any) => (g.parent.idCostCenter === 7));
    expect(oper.children[0].selectable).toBe(true);
  });

  it("expande níveis iniciais corretamente", () => {
    const tree = buildCostCenterTreeData(sample);
    const { lv1, lv2 } = computeInitialCcExpand(tree);
    expect(lv1.sort()).toEqual([1,7]);
    expect(lv2.sort()).toEqual([2,5,8]);
  });
});

