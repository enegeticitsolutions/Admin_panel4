import * as React from "react";

import { cn } from "./utils";

export interface InputProps extends React.ComponentProps<"input"> {
  dataType?: 'integer' | 'text-only' | 'alphanumeric';
}

const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, type, dataType, onChange, ...props }, ref) => {
    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      if (dataType) {
        let val = e.target.value;
        if (dataType === 'integer') {
          val = val.replace(/[^0-9]/g, '');
        } else if (dataType === 'text-only') {
          val = val.replace(/[^a-zA-Z\s\-]/g, '');
        } else if (dataType === 'alphanumeric') {
          val = val.replace(/[^a-zA-Z0-9\s\-]/g, '');
        }
        e.target.value = val;
      }
      if (onChange) {
        onChange(e);
      }
    };

    return (
      <input
        type={type}
        data-slot="input"
        ref={ref}
        className={cn(
          "file:text-foreground placeholder:text-muted-foreground selection:bg-primary selection:text-primary-foreground dark:bg-input/30 border-input flex h-9 w-full min-w-0 rounded-md border px-3 py-1 text-base bg-input-background transition-[color,box-shadow] outline-none file:inline-flex file:h-7 file:border-0 file:bg-transparent file:text-sm file:font-medium disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50 md:text-sm",
          "focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px]",
          "aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 aria-invalid:border-destructive",
          className,
        )}
        onChange={handleChange}
        {...props}
      />
    );
  }
);
Input.displayName = "Input";

export { Input };
