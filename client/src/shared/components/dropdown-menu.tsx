import React, { useState, useRef, useEffect } from 'react';
import { ChevronDown } from 'lucide-react';
import { cn } from '@/lib/utils';

interface DropdownMenuItem {
  label: string;
  href: string;
  icon?: React.ReactNode;
}

interface DropdownMenuProps {
  trigger: string;
  items: DropdownMenuItem[];
  className?: string;
}

export function DropdownMenu({ trigger, items, className }: DropdownMenuProps) {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  return (
    <div className={cn('relative', className)} ref={dropdownRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center space-x-1 px-3 py-2 text-sm font-medium rounded-md transition-colors duration-200 text-muted-foreground hover:text-foreground hover:bg-muted"
      >
        <span>{trigger}</span>
        <ChevronDown 
          className={cn(
            'h-4 w-4 transition-transform duration-200',
            isOpen && 'rotate-180'
          )} 
        />
      </button>

      {isOpen && (
        <div className="absolute left-0 mt-2 w-56 rounded-md shadow-lg z-50 border border-border bg-popover text-popover-foreground">
          <div className="py-1">
            {items.map((item, index) => (
              <a
                key={index}
                href={item.href}
                className="group flex items-center px-4 py-2 text-sm transition-colors duration-150 rounded-sm hover:bg-accent hover:text-accent-foreground"
                onClick={() => setIsOpen(false)}
              >
                {item.icon && (
                  <span className="mr-3 text-muted-foreground group-hover:text-accent-foreground">
                    {item.icon}
                  </span>
                )}
                {item.label}
              </a>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
