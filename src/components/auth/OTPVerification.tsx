import React, { useState, useEffect } from "react";
import AuthLayout from "./AuthLayout";
import OTPInput from "./OTPInput";
import Button from "../ui/Button";
import { toast } from "sonner";
import { CheckCircle2, ArrowLeft, RefreshCw } from "lucide-react";
import { useAuthActions } from "../../hooks/useAuthActions";

interface OTPVerificationProps {
  phone: string;
  type: "signup" | "reset";
  onBack: () => void;
  onSuccess: () => void;
  isEmbed?: boolean;
}

export default function OTPVerification({ phone, type, onBack, onSuccess, isEmbed = false }: OTPVerificationProps) {
  const { verifyOTP, loading } = useAuthActions();
  const [otp, setOtp] = useState("");
  const [timer, setTimer] = useState(60);
  const [canResend, setCanResend] = useState(false);

  useEffect(() => {
    let interval: any;
    if (timer > 0 && !canResend) {
      interval = setInterval(() => {
        setTimer((t) => t - 1);
      }, 1000);
    } else {
      setCanResend(true);
    }
    return () => clearInterval(interval);
  }, [timer, canResend]);

  const handleVerify = async () => {
    if (otp.length !== 4) return toast.error("Code complet requis");
    const success = await verifyOTP(otp);
    if (success) {
      toast.success(type === "signup" ? "Compte vérifié avec succès !" : "Code validé !");
      onSuccess();
    }
  };

  const handleResend = () => {
    if (!canResend) return;
    setTimer(60);
    setCanResend(false);
    toast.success("Nouveau code envoyé");
  };

  const maskedPhone = phone.replace(/(\+225\s\d{2})\d{4}/, "$1 **** ");

  return (
    <AuthLayout 
      title="Vérification" 
      subtitle={type === "signup" ? "Vérifiez votre numéro" : "Réinitialisation"}
      isEmbed={isEmbed}
    >
      <div className="space-y-8">
        <div className="text-center space-y-2">
          <p className="text-[10px] font-bold text-gray-500 uppercase tracking-widest">
            Saisissez le code envoyé au
          </p>
          <p className="text-sm font-black italic text-brand-gold tracking-tighter">
            {maskedPhone}
          </p>
        </div>

        <OTPInput 
          value={otp} 
          onChange={setOtp} 
        />

        <div className="space-y-4">
          <Button 
            onClick={handleVerify}
            loading={loading}
            className="w-full h-14"
            disabled={otp.length !== 4}
          >
            <CheckCircle2 size={18} /> VALIDER LE CODE
          </Button>

          <div className="flex flex-col items-center gap-4">
             <button
               type="button"
               disabled={!canResend}
               onClick={handleResend}
               className="flex items-center gap-2 text-[10px] font-black uppercase italic tracking-widest text-gray-500 hover:text-brand-gold disabled:opacity-50 transition-colors"
             >
               <RefreshCw size={12} className={!canResend ? "" : "animate-spin-slow"} />
               {canResend ? "Renvoyer le code" : `Renvoyer dans ${timer}s`}
             </button>

             <button
               type="button"
               onClick={onBack}
               className="flex items-center gap-2 text-[10px] font-black uppercase italic tracking-widest text-brand-red hover:scale-105 transition-transform"
             >
               <ArrowLeft size={12} /> Modifier le numéro
             </button>
          </div>
        </div>
      </div>
    </AuthLayout>
  );
}
