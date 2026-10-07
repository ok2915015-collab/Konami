import React, { forwardRef } from "react";
import { cn } from "../../lib/utils";

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  error?: string;
  icon?: React.ReactNode;
}

const Input = forwardRef<HTMLInputElement, InputProps>(({ className, error, icon, ...props }, ref) => {
  return (
    <div className="space-y-1.5 w-full">
      <div className="relative group">
        {icon && (
          <div className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500 group-focus-within:text-brand-red transition-colors duration-300">
            {icon}
          </div>
        )}
        <input
          ref={ref}
          className={cn(
            "w-full bg-black/40 border border-white/5 rounded-2xl py-4 pr-4 transition-all duration-300 text-xs font-bold text-white outline-none focus:border-brand-red focus:bg-black/60 placeholder:text-gray-600 placeholder:font-bold",
            icon ? "pl-12" : "pl-6",
            error && "border-brand-red focus:border-brand-red",
            className
          )}
          {...props}
        />
      </div>
      {error && (
        <p className="text-[10px] font-black uppercase italic text-brand-red px-2 animate-in fade-in slide-in-from-top-1">
          {error}
        </p>
      )}
    </div>
  );
});

Input.displayName = "Input";

export default Input;
