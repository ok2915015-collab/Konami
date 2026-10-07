import React, { forwardRef, useState } from "react";
import Input, { InputProps } from "../ui/Input";
import { Lock, Eye, EyeOff } from "lucide-react";

interface PasswordInputProps extends InputProps {
  showStrength?: boolean;
}

const PasswordInput = forwardRef<HTMLInputElement, PasswordInputProps>(({ showStrength, value, ...props }, ref) => {
  const [show, setShow] = useState(false);

  // Simple strength calc
  const getStrength = (pwd: string) => {
    if (!pwd) return null;
    let score = 0;
    if (pwd.length >= 8) score++;
    if (/[A-Z]/.test(pwd)) score++;
    if (/[0-9]/.test(pwd)) score++;
    if (/[^A-Za-z0-9]/.test(pwd)) score++;
    
    if (score <= 1) return { label: "Faible", color: "bg-red-500" };
    if (score <= 3) return { label: "Moyen", color: "bg-brand-gold" };
    return { label: "Fort", color: "bg-[#10B981]" };
  };

  const strength = getStrength(String(value || ""));

  return (
    <div className="space-y-2">
      <div className="relative">
        <Input
          ref={ref}
          type={show ? "text" : "password"}
          icon={<Lock size={16} />}
          value={value}
          {...props}
        />
        <button
          type="button"
          onClick={() => setShow(!show)}
          className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-500 hover:text-white transition-colors"
        >
          {show ? <EyeOff size={16} /> : <Eye size={16} />}
        </button>
      </div>
      
      {showStrength && strength && (
        <div className="px-1 space-y-1">
          <div className="flex justify-between items-center">
             <span className="text-[8px] font-black uppercase text-gray-500 tracking-widest">SÉCURITÉ: {strength.label}</span>
          </div>
          <div className="h-1 w-full bg-white/5 rounded-full overflow-hidden">
            <div 
              className={`h-full transition-all duration-500 ${strength.color}`} 
              style={{ width: `${(String(value).length / 12) * 100}%`, maxWidth: "100%" }}
            />
          </div>
        </div>
      )}
    </div>
  );
});

PasswordInput.displayName = "PasswordInput";

export default PasswordInput;
