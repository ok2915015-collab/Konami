import React, { forwardRef } from "react";
import Input, { InputProps } from "../ui/Input";
import { Phone } from "lucide-react";

const PhoneInput = forwardRef<HTMLInputElement, InputProps>((props, ref) => {
  return (
    <div className="relative">
      <Input
        ref={ref}
        type="tel"
        placeholder="07 XX XX XX XX ou +225..."
        icon={<Phone size={16} />}
        {...props}
        className={props.className}
      />
      <div className="absolute right-4 top-1/2 -translate-y-1/2 flex items-center gap-2 pointer-events-none">
        <span className="text-[10px] font-black italic text-gray-700 uppercase tracking-widest">+225</span>
        <img 
          src="https://flagcdn.com/w20/ci.png" 
          alt="CIV" 
          className="w-4 h-3 object-cover rounded-[1px] opacity-40" 
        />
      </div>
    </div>
  );
});

PhoneInput.displayName = "PhoneInput";

export default PhoneInput;
