import React from "react";
import { cn } from "../../lib/utils";

interface ButtonProps {
  variant?: "primary" | "secondary" | "outline" | "ghost" | "danger" | "success" | "gold";
  size?: "sm" | "md" | "lg" | "xl";
  loading?: boolean;
  children?: React.ReactNode;
  className?: string;
  type?: "button" | "submit" | "reset";
  disabled?: boolean;
  onClick?: (e: React.MouseEvent<HTMLButtonElement>) => void;
}

export default function Button({ 
  children, 
  className, 
  variant = "primary", 
  size = "md", 
  loading = false, 
  disabled,
  ...props 
}: ButtonProps) {
  const variants = {
    primary: "bg-brand-red text-white shadow-lg shadow-brand-red/20 active:bg-red-800",
    secondary: "bg-white/10 text-white hover:bg-white/20 active:bg-white/30",
    outline: "border border-white/10 text-white hover:bg-white/5 active:bg-white/10",
    ghost: "text-gray-400 hover:text-white hover:bg-white/5",
    danger: "bg-red-500/10 text-red-500 hover:bg-red-500 hover:text-white",
    success: "bg-[#10B981] text-white shadow-lg shadow-[#10B981]/20",
    gold: "bg-brand-gold text-brand-black shadow-lg shadow-brand-gold/20 font-black",
  };

  const sizes = {
    sm: "px-3 py-1.5 text-[10px]",
    md: "px-5 py-3 text-xs",
    lg: "px-8 py-4 text-sm",
    xl: "px-10 py-5 text-base font-black tracking-widest",
  };

  return (
    <button
      disabled={disabled || loading}
      className={cn(
        "rounded-2xl font-black uppercase italic tracking-tighter transition-all duration-200 flex items-center justify-center gap-3 disabled:opacity-50 disabled:grayscale disabled:cursor-not-allowed",
        variants[variant],
        sizes[size],
        className
      )}
      {...props}
    >
      {loading ? (
        <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
      ) : children}
    </button>
  );
}
