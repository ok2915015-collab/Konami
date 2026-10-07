import React from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { loginSchema } from "../../lib/validators";
import { z } from "zod";
import AuthLayout from "./AuthLayout";
import PhoneInput from "./PhoneInput";
import PasswordInput from "./PasswordInput";
import Button from "../ui/Button";
import SocialLogin from "./SocialLogin";
import { useAuthActions } from "../../hooks/useAuthActions";
import { LogIn } from "lucide-react";

type LoginForm = z.infer<typeof loginSchema>;

interface LoginPageProps {
  onSwitchToSignup: () => void;
  onForgotPassword: () => void;
  onSuccess: () => void;
  isEmbed?: boolean;
}

export default function LoginPage({ onSwitchToSignup, onForgotPassword, onSuccess, isEmbed = false }: LoginPageProps) {
  const { login, loading } = useAuthActions();
  const { register, handleSubmit, formState: { errors } } = useForm<LoginForm>({
    resolver: zodResolver(loginSchema)
  });

  const onSubmit = async (data: LoginForm) => {
    const success = await login(data.phone, data.password);
    if (success) onSuccess();
  };

  return (
    <AuthLayout title="Bienvenue" subtitle="Connectez-vous pour parier" isEmbed={isEmbed}>
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
        <div className="space-y-4">
          <PhoneInput 
            {...register("phone")}
            error={errors.phone?.message}
          />
          <PasswordInput 
            {...register("password")}
            error={errors.password?.message}
            placeholder="MOT DE PASSE"
          />
        </div>

        <div className="flex justify-end">
          <button 
            type="button" 
            onClick={onForgotPassword}
            className="text-[10px] font-black uppercase text-brand-gold italic hover:text-white transition-colors"
          >
            Mot de passe oublié ?
          </button>
        </div>

        <Button 
          type="submit" 
          loading={loading}
          className="w-full h-14"
        >
          <LogIn size={18} /> SE CONNECTER
        </Button>

        <SocialLogin />

        <p className="text-center text-[11px] font-bold text-gray-500 uppercase tracking-tighter">
          Pas encore de compte ?{" "}
          <button 
            type="button" 
            onClick={onSwitchToSignup}
            className="text-brand-red font-black italic hover:scale-105 transition-transform"
          >
            S'INSCRIRE MAINTENANT
          </button>
        </p>
      </form>
    </AuthLayout>
  );
}
