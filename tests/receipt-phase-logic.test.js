const { computeTabsVisibility, isPhysicalModeActive, getInitialTabForMode } = require("../client/src/components/receipt-phase-logic");

describe("receipt-phase-logic", () => {
  test("isPhysicalModeActive returns true only for physical", () => {
    expect(isPhysicalModeActive('physical')).toBe(true);
    expect(isPhysicalModeActive('view')).toBe(false);
    expect(isPhysicalModeActive(undefined)).toBe(false);
  });

  test("getInitialTabForMode maps modes to tabs", () => {
    expect(getInitialTabForMode('physical')).toBe('items');
    expect(getInitialTabForMode('view')).toBe('items');
    expect(getInitialTabForMode(undefined)).toBe('items');
  });

  test("computeTabsVisibility hides tabs for physical mode", () => {
    expect(computeTabsVisibility({ fromKanban: false, activeTab: 'xml', mode: 'physical' })).toBe(false);
  });

  test("computeTabsVisibility hides tabs when activeTab is items", () => {
    expect(computeTabsVisibility({ fromKanban: false, activeTab: 'items', mode: 'view' })).toBe(false);
    expect(computeTabsVisibility({ fromKanban: true, activeTab: 'items', mode: 'view' })).toBe(false);
  });

  test("computeTabsVisibility shows tabs from kanban only for xml/manual_nf/financeiro", () => {
    expect(computeTabsVisibility({ fromKanban: true, activeTab: 'xml', mode: 'view' })).toBe(true);
    expect(computeTabsVisibility({ fromKanban: true, activeTab: 'manual_nf', mode: 'view' })).toBe(true);
    expect(computeTabsVisibility({ fromKanban: true, activeTab: 'financeiro', mode: 'view' })).toBe(true);
  });

  test("computeTabsVisibility shows tabs by default in view mode", () => {
    expect(computeTabsVisibility({ fromKanban: false, activeTab: 'xml', mode: 'view' })).toBe(true);
    expect(computeTabsVisibility({ fromKanban: false, activeTab: 'financeiro', mode: 'view' })).toBe(true);
  });
});
