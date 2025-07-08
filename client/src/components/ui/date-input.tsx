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