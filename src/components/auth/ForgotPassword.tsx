import React from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { forgotPasswordSchema } from "../../lib/validators";
import { z } from "zod";
import AuthLayout from "./AuthLayout";
import PhoneInput from "./PhoneInput";
import Button from "../ui/Button";
import { toast } from "sonner";
import { ArrowLeft, Send } from "lucide-react";
import { useAuthActions } from "../../hooks/useAuthActions";

type ForgotForm = z.infer<typeof forgotPasswordSchema>;

interface ForgotPasswordProps {
  onBack: () => void;
  onCodeSent: (phone: string) => void;
  isEmbed?: boolean;
}

export default function ForgotPassword({ onBack, onCodeSent, isEmbed = false }: ForgotPasswordProps) {
  const { sendOTP, loading } = useAuthActions();
  const { register, handleSubmit, formState: { errors } } = useForm<ForgotForm>({
    resolver: zodResolver(forgotPasswordSchema)
  });

  const onSubmit = async (data: ForgotForm) => {
    const success = await sendOTP(data.phone);
    if (success) {
      toast.success("Code de réinitialisation envoyé !");
      onCodeSent(data.phone);
    } else {
      toast.error("Erreur lors de l'envoi");
    }
  };

  return (
    <AuthLayout 
      title="Oubli ?" 
      subtitle="Récupérez votre accès"
      isEmbed={isEmbed}
    >
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-8">
        <div className="space-y-4">
          <p className="text-[10px] font-bold text-gray-500 uppercase tracking-tighter leading-relaxed">
            Entrez votre numéro de téléphone. Nous vous enverrons un code OTP pour réinitialiser votre mot de passe.
          </p>
          <PhoneInput 
            {...register("phone")}
            error={errors.phone?.message}
          />
        </div>

        <div className="space-y-4">
          <Button 
            type="submit" 
            loading={loading}
            className="w-full h-14"
          >
            <Send size={18} /> ENVOYER LE CODE
          </Button>

          <button
            type="button"
            onClick={onBack}
            className="w-full flex items-center justify-center gap-2 text-[10px] font-black uppercase italic tracking-widest text-gray-500 hover:text-white transition-colors"
          >
            <ArrowLeft size={12} /> Retour à la connexion
          </button>
        </div>
      </form>
    </AuthLayout>
  );
}
