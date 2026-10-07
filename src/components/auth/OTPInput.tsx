import React, { useRef, useEffect } from "react";
import { cn } from "../../lib/utils";

interface OTPInputProps {
  value: string;
  onChange: (value: string) => void;
  error?: string;
}

export default function OTPInput({ value, onChange, error }: OTPInputProps) {
  const inputRefs = [
    useRef<HTMLInputElement>(null),
    useRef<HTMLInputElement>(null),
    useRef<HTMLInputElement>(null),
    useRef<HTMLInputElement>(null),
  ];

  useEffect(() => {
    // Focus first input on mount
    inputRefs[0].current?.focus();
  }, []);

  const handleChange = (index: number, e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value.replace(/[^0-9]/g, "");
    if (!val) return;

    const newValue = value.split("");
    newValue[index] = val[val.length - 1]; // Use last char if multiple entered
    const finalValue = newValue.join("");
    onChange(finalValue);

    // Auto-tab to next input
    if (index < 3) {
      inputRefs[index + 1].current?.focus();
    }
  };

  const handleKeyDown = (index: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Backspace" && !value[index] && index > 0) {
      inputRefs[index - 1].current?.focus();
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex justify-center gap-4">
        {[0, 1, 2, 3].map((i) => (
          <input
            key={i}
            ref={inputRefs[i]}
            type="text"
            inputMode="numeric"
            maxLength={1}
            value={value[i] || ""}
            onChange={(e) => handleChange(i, e)}
            onKeyDown={(e) => handleKeyDown(i, e)}
            className={cn(
              "w-14 h-16 bg-black/40 border border-white/10 rounded-2xl text-center text-2xl font-black text-brand-gold outline-none focus:border-brand-gold focus:bg-black/60 transition-all",
              error && "border-brand-red text-brand-red"
            )}
          />
        ))}
      </div>
      {error && (
        <p className="text-center text-[10px] font-black uppercase italic text-brand-red px-2 animate-in fade-in slide-in-from-top-1">
          {error}
        </p>
      )}
    </div>
  );
}
