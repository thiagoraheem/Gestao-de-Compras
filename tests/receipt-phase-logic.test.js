const { computeTabsVisibility, isFiscalModeActive, isPhysicalModeActive, getInitialTabForMode } = require("../client/src/components/receipt-phase-logic");

describe("receipt-phase-logic", () => {
  test("isFiscalModeActive returns true only for fiscal", () => {
    expect(isFiscalModeActive('fiscal')).toBe(true);
    expect(isFiscalModeActive('physical')).toBe(false);
    expect(isFiscalModeActive('view')).toBe(false);
    expect(isFiscalModeActive(undefined)).toBe(false);
  });

  test("isPhysicalModeActive returns true only for physical", () => {
    expect(isPhysicalModeActive('physical')).toBe(true);
    expect(isPhysicalModeActive('fiscal')).toBe(false);
    expect(isPhysicalModeActive('view')).toBe(false);
    expect(isPhysicalModeActive(undefined)).toBe(false);
  });

  test("getInitialTabForMode maps modes to tabs", () => {
    expect(getInitialTabForMode('physical')).toBe('items');
    expect(getInitialTabForMode('fiscal')).toBe('xml');
    expect(getInitialTabForMode('view')).toBe('fiscal');
    expect(getInitialTabForMode(undefined)).toBe('fiscal');
  });

  test("computeTabsVisibility hides tabs for physical mode", () => {
    expect(computeTabsVisibility({ fromKanban: false, activeTab: 'fiscal', mode: 'physical' })).toBe(false);
    expect(computeTabsVisibility({ fromKanban: false, activeTab: 'xml', mode: 'physical' })).toBe(false);
  });

  test("computeTabsVisibility hides tabs when activeTab is items", () => {
    expect(computeTabsVisibility({ fromKanban: false, activeTab: 'items', mode: 'view' })).toBe(false);
    expect(computeTabsVisibility({ fromKanban: true, activeTab: 'items', mode: 'view' })).toBe(false);
  });

  test("computeTabsVisibility shows tabs from kanban only for xml/manual_nf/financeiro", () => {
    expect(computeTabsVisibility({ fromKanban: true, activeTab: 'fiscal', mode: 'view' })).toBe(false);
    expect(computeTabsVisibility({ fromKanban: true, activeTab: 'xml', mode: 'view' })).toBe(true);
    expect(computeTabsVisibility({ fromKanban: true, activeTab: 'manual_nf', mode: 'view' })).toBe(true);
    expect(computeTabsVisibility({ fromKanban: true, activeTab: 'financeiro', mode: 'view' })).toBe(true);
  });

  test("computeTabsVisibility shows tabs by default in view mode", () => {
    expect(computeTabsVisibility({ fromKanban: false, activeTab: 'fiscal', mode: 'view' })).toBe(true);
    expect(computeTabsVisibility({ fromKanban: false, activeTab: 'xml', mode: 'view' })).toBe(true);
    expect(computeTabsVisibility({ fromKanban: false, activeTab: 'financeiro', mode: 'view' })).toBe(true);
  });
});
