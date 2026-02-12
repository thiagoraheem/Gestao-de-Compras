
// import { describe, it, expect } from '@jest/globals';

// Simulate the logic implemented in server/routes.ts
function calculateGrandTotal(updateData: { finalValue?: string | number | null, includesFreight?: boolean, freightValue?: string | number | null }) {
    const fVal = updateData.finalValue ? Number(updateData.finalValue) : 0;
    const frVal = (updateData.includesFreight && updateData.freightValue) ? Number(updateData.freightValue) : 0;
    return fVal + frVal;
}

describe('Quotation Persistence Logic', () => {
    it('should calculate grand total correctly with freight', () => {
        const updateData = {
            finalValue: "100.00",
            includesFreight: true,
            freightValue: "50.00"
        };
        const total = calculateGrandTotal(updateData);
        expect(total).toBe(150.00);
    });

    it('should calculate grand total correctly without freight', () => {
        const updateData = {
            finalValue: "100.00",
            includesFreight: false,
            freightValue: "50.00" // Should be ignored
        };
        const total = calculateGrandTotal(updateData);
        expect(total).toBe(100.00);
    });

    it('should handle null values safely', () => {
        const updateData = {
            finalValue: null,
            includesFreight: true,
            freightValue: null
        };
        const total = calculateGrandTotal(updateData);
        expect(total).toBe(0);
    });
    
    it('should handle numeric values if passed directly', () => {
        const updateData = {
            finalValue: 120.50,
            includesFreight: true,
            freightValue: 10.50
        };
        const total = calculateGrandTotal(updateData);
        expect(total).toBe(131.00);
    });
});
