
import React, { useEffect, useState } from "react";
import { Input } from "@/components/ui/input";
import { formatBrazilianNumber, parseBrazilianNumber } from "@/lib/number-parser";
import { cn } from "@/lib/utils";

interface DecimalInputProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, "onChange" | "value"> {
  value: number | string | null | undefined;
  onChange: (value: string) => void; // Returns the string representation of the number (e.g. "1000.50") suitable for backend
  precision?: number;
  prefix?: string;
  allowNegative?: boolean;
}

/**
 * A robust Decimal Input component for Brazilian format (pt-BR).
 * - Displays values as "1.000,00".
 * - Returns values as "1000.00" (standard decimal string) to the parent.
 * - Handles input masking and validation.
 */
export function DecimalInput({
  value,
  onChange,
  precision = 2,
  prefix,
  className,
  allowNegative = false,
  ...props
}: DecimalInputProps) {
  // Internal state for the display value (what the user sees)
  const [displayValue, setDisplayValue] = useState("");

  // Sync internal state with external value prop
  useEffect(() => {
    if (value === null || value === undefined || value === "") {
      setDisplayValue("");
    } else {
      // If the user is currently typing (focused), we might not want to force format 
      // UNLESS the external value changed significantly (e.g. form reset).
      // But for simplicity in this implementation, we format on blur or init.
      // Here we assume value comes from parent as a number or standard string.
      const num = typeof value === "string" ? parseFloat(value) : value;
      if (!isNaN(num)) {
        // Only update display if the parsed current display value is different from new value
        // to avoid jumping cursor issues if we were to format on every keystroke (which we won't do fully here).
        // Actually, for a controlled input that formats on blur, we just update on prop change.
        // But if the prop change is due to our own onChange, we might want to avoid re-formatting while typing.
        
        // Strategy: We keep local state. We only update local state from prop if the prop value 
        // doesn't match the current parsed local state (approx).
        const currentParsed = parseBrazilianNumber(displayValue);
        if (Math.abs(currentParsed - num) > Number.EPSILON || isNaN(currentParsed)) {
           setDisplayValue(formatBrazilianNumber(num, precision, precision)); // Force precision for display
        }
      } else {
        setDisplayValue("");
      }
    }
  }, [value, precision]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    let inputValue = e.target.value;

    // Remove invalid characters
    // Allow digits, one comma, dots (thousands), and minus if allowed
    // But while typing, user might have multiple dots or commas temporarily? 
    // Let's restrict input to valid chars only.
    const validCharsRegex = allowNegative ? /[^\d.,-]/g : /[^\d.,]/g;
    inputValue = inputValue.replace(validCharsRegex, "");

    // Prevent multiple commas
    const commas = (inputValue.match(/,/g) || []).length;
    if (commas > 1) {
       // Remove the last comma entered
       inputValue = inputValue.substring(0, inputValue.lastIndexOf(","));
    }
    
    // Prevent minus not at start
    if (inputValue.includes("-") && inputValue.indexOf("-") !== 0) {
       inputValue = inputValue.replace(/-/g, ""); // naive, but safe
    }

    setDisplayValue(inputValue);

    // Parse and notify parent
    // We notify parent with the standard string format "1234.56" or "" if invalid
    const parsed = parseBrazilianNumber(inputValue);
    if (!isNaN(parsed)) {
      onChange(parsed.toString());
    } else {
      onChange(""); // or "0"? standard form behavior usually expects empty string for invalid
    }
  };

  const handleBlur = () => {
    // On blur, force format to look nice
    const parsed = parseBrazilianNumber(displayValue);
    if (!isNaN(parsed)) {
      setDisplayValue(formatBrazilianNumber(parsed, precision, precision));
    } else {
       // If invalid, clear or keep? 
       // If it's partial garbage, maybe clear. 
       if (displayValue.trim() !== "") {
           // Try to recover?
       }
    }
  };

  return (
    <div className="relative">
       {prefix && (
         <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground pointer-events-none">
           {prefix}
         </span>
       )}
       <Input
          {...props}
          type="text" // Must be text to support commas
          inputMode="decimal"
          value={displayValue}
          onChange={handleChange}
          onBlur={handleBlur}
          className={cn(prefix ? "pl-8" : "", "text-right", className)}
          autoComplete="off"
       />
    </div>
  );
}
