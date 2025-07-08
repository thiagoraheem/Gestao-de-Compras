import { useState, useEffect } from "react";
import { Input } from "./input";
import { cn } from "@/lib/utils";

interface DateInputProps {
  value?: string;
  onChange?: (value: string) => void;
  onBlur?: () => void;
  className?: string;
  placeholder?: string;
  disabled?: boolean;
  name?: string;
}

export function DateInput({
  value = "",
  onChange,
  onBlur,
  className,
  placeholder = "DD/MM/AAAA",
  disabled = false,
  name
}: DateInputProps) {
  const [displayValue, setDisplayValue] = useState("");

  // Convert ISO date to Brazilian format for display
  useEffect(() => {
    if (value && value.includes("-")) {
      // Convert from ISO format (YYYY-MM-DD) to Brazilian format (DD/MM/YYYY)
      const [year, month, day] = value.split("-");
      setDisplayValue(`${day}/${month}/${year}`);
    } else if (value && value.includes("/")) {
      // Already in Brazilian format
      setDisplayValue(value);
    } else {
      setDisplayValue("");
    }
  }, [value]);

  const formatDate = (input: string) => {
    // Remove all non-numeric characters
    const numbers = input.replace(/\D/g, "");
    
    // Apply mask DD/MM/YYYY
    let formatted = "";
    
    if (numbers.length >= 1) {
      formatted += numbers.substring(0, 2);
    }
    if (numbers.length >= 3) {
      formatted += "/" + numbers.substring(2, 4);
    }
    if (numbers.length >= 5) {
      formatted += "/" + numbers.substring(4, 8);
    }
    
    return formatted;
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const input = e.target.value;
    const formatted = formatDate(input);
    setDisplayValue(formatted);

    // Convert to ISO format for form submission if date is complete
    if (formatted.length === 10) {
      const [day, month, year] = formatted.split("/");
      if (day && month && year && year.length === 4) {
        const date = new Date(parseInt(year), parseInt(month) - 1, parseInt(day));
        // Validate the date
        if (date.getFullYear() === parseInt(year) && 
            date.getMonth() === parseInt(month) - 1 && 
            date.getDate() === parseInt(day)) {
          const isoDate = `${year}-${month.padStart(2, "0")}-${day.padStart(2, "0")}`;
          onChange?.(isoDate);
        }
      }
    } else {
      // Clear the value if incomplete
      onChange?.("");
    }
  };

  return (
    <Input
      type="text"
      value={displayValue}
      onChange={handleChange}
      onBlur={onBlur}
      placeholder={placeholder}
      className={cn(className)}
      disabled={disabled}
      name={name}
      maxLength={10}
    />
  );
}