import { useState, useEffect } from "react";
import { Input } from "./input";
import { Button } from "./button";
import { Calendar } from "./calendar";
import { Popover, PopoverContent, PopoverTrigger } from "./popover";
import { cn } from "@/lib/utils";
import { CalendarIcon } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

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
  const [calendarOpen, setCalendarOpen] = useState(false);

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
    
    // Limit to maximum 8 digits (DDMMYYYY)
    const limitedNumbers = numbers.substring(0, 8);
    
    // Apply mask DD/MM/YYYY with validation
    let formatted = "";
    
    if (limitedNumbers.length >= 1) {
      // Day validation: limit to 31
      const day = limitedNumbers.substring(0, 2);
      const dayNum = parseInt(day, 10);
      if (dayNum > 31 && limitedNumbers.length >= 2) {
        formatted += "31";
      } else {
        formatted += day;
      }
    }
    if (limitedNumbers.length >= 3) {
      // Month validation: limit to 12
      const month = limitedNumbers.substring(2, 4);
      const monthNum = parseInt(month, 10);
      if (monthNum > 12 && limitedNumbers.length >= 4) {
        formatted += "/12";
      } else {
        formatted += "/" + month;
      }
    }
    if (limitedNumbers.length >= 5) {
      // Year validation: must be 4 digits and reasonable range
      const year = limitedNumbers.substring(4, 8);
      formatted += "/" + year;
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
        const dayNum = parseInt(day, 10);
        const monthNum = parseInt(month, 10);
        const yearNum = parseInt(year, 10);
        
        // Additional validation for reasonable date ranges
        if (dayNum >= 1 && dayNum <= 31 && 
            monthNum >= 1 && monthNum <= 12 && 
            yearNum >= 1900 && yearNum <= 2100) {
          
          const date = new Date(yearNum, monthNum - 1, dayNum);
          // Validate the date exists (e.g., not Feb 30)
          if (date.getFullYear() === yearNum && 
              date.getMonth() === monthNum - 1 && 
              date.getDate() === dayNum) {
            const isoDate = `${year}-${month.padStart(2, "0")}-${day.padStart(2, "0")}`;
            onChange?.(isoDate);
            return;
          }
        }
      }
    }
    
    // Clear the value if incomplete or invalid
    onChange?.("");
  };

  const handleCalendarSelect = (date: Date | undefined) => {
    if (date) {
      // Format as Brazilian date for display
      const formatted = format(date, "dd/MM/yyyy", { locale: ptBR });
      setDisplayValue(formatted);
      
      // Convert to ISO format for form submission
      const isoDate = format(date, "yyyy-MM-dd");
      onChange?.(isoDate);
    }
    setCalendarOpen(false);
  };

  // Convert current value to Date object for calendar
  const getSelectedDate = () => {
    if (value && value.includes("-")) {
      return new Date(value);
    } else if (displayValue && displayValue.length === 10) {
      const [day, month, year] = displayValue.split("/");
      if (day && month && year && year.length === 4) {
        return new Date(parseInt(year), parseInt(month) - 1, parseInt(day));
      }
    }
    return undefined;
  };

  return (
    <div className="relative">
      <Input
        type="text"
        value={displayValue}
        onChange={handleChange}
        onBlur={onBlur}
        placeholder={placeholder}
        className={cn("pr-10", className)}
        disabled={disabled}
        name={name}
        maxLength={10}
      />
      <Popover open={calendarOpen} onOpenChange={setCalendarOpen}>
        <PopoverTrigger asChild>
          <Button
            variant="ghost"
            size="sm"
            className="absolute right-0 top-0 h-full px-3 py-2 hover:bg-transparent"
            disabled={disabled}
            type="button"
          >
            <CalendarIcon className="h-4 w-4" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-0" align="start">
          <Calendar
            mode="single"
            selected={getSelectedDate()}
            onSelect={handleCalendarSelect}
            disabled={disabled}
            initialFocus
            locale={ptBR}
          />
        </PopoverContent>
      </Popover>
    </div>
  );
}