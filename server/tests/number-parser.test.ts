
import { NumberParser } from "../utils/number-parser";
import { describe, it, expect } from "vitest";

describe("NumberParser", () => {
  describe("parse", () => {
    it("should parse integer strings", () => {
      expect(NumberParser.parse("123")).toBe(123);
    });

    it("should parse float strings with dot", () => {
      expect(NumberParser.parse("123.45")).toBe(123.45);
    });

    it("should parse float strings with comma (BRL)", () => {
      expect(NumberParser.parse("123,45")).toBe(123.45);
    });

    it("should parse thousands separator (dot) and decimal (comma)", () => {
      expect(NumberParser.parse("1.234,56")).toBe(1234.56);
    });

    it("should parse thousands separator (comma) and decimal (dot)", () => {
      expect(NumberParser.parse("1,234.56")).toBe(1234.56);
    });

    it("should handle multiple thousands separators", () => {
      expect(NumberParser.parse("1.234.567,89")).toBe(1234567.89);
    });

    it("should handle currency symbols", () => {
      expect(NumberParser.parse("R$ 1.234,56")).toBe(1234.56);
      expect(NumberParser.parse("$ 1,234.56")).toBe(1234.56);
    });

    it("should handle whitespace", () => {
      expect(NumberParser.parse("  1.234,56  ")).toBe(1234.56);
    });

    it("should return 0 for invalid inputs", () => {
      expect(NumberParser.parse("abc")).toBe(0);
      expect(NumberParser.parse(null)).toBe(0);
      expect(NumberParser.parse(undefined)).toBe(0);
      expect(NumberParser.parse("")).toBe(0);
    });

    it("should handle numbers correctly", () => {
      expect(NumberParser.parse(123.45)).toBe(123.45);
    });
  });
});
