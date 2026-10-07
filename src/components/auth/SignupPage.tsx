import React, { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { signupSchema } from "../../lib/validators";
import { useAuthActions } from "../../hooks/useAuthActions";
import AuthLayout from "./AuthLayout";
import { 
  UserPlus, 
  User, 
  Gift, 
  CheckCircle2, 
  Phone, 
  Lock, 
  Sparkles, 
  Shield, 
  MapPin, 
  Mail,
  Home,
  Check
} from "lucide-react";
import { toast } from "sonner";

type SignupFormInputs = z.infer<typeof signupSchema>;

interface SignupPageProps {
  onSwitchToLogin: () => void;
  onSignupSuccess: (phone: string) => void;
  defaultRefCode?: string;
  isEmbed?: boolean;
}

export default function SignupPage({ onSwitchToLogin, onSignupSuccess, defaultRefCode, isEmbed = false }: SignupPageProps) {
  const { signup, loading } = useAuthActions();
  const [showRefField, setShowRefField] = useState(!!defaultRefCode);
  const [pseudoAvailable, setPseudoAvailable] = useState<"checking" | "available" | "unavailable" | null>(null);

  const { register, handleSubmit, watch, setValue, formState: { errors } } = useForm<SignupFormInputs>({
    resolver: zodResolver(signupSchema),
    defaultValues: {
      gender: "homme",
      email: "",
      referralCode: defaultRefCode || "",
      postalCode: "",
      address: "",
      isAdult: false,
      acceptTerms: false
    }
  });

  const usernameValue = watch("username") || "";
  const genderValue = watch("gender") || "homme";
  const phoneValue = watch("phone") || "";
  const passwordValue = watch("password") || "";
  const confirmPasswordValue = watch("confirmPassword") || "";
  const isAdultChecked = watch("isAdult");
  const acceptTermsChecked = watch("acceptTerms");

  // Real-time completeness check
  const isUsernameValid = usernameValue.trim().length >= 3 && pseudoAvailable !== "unavailable";
  const isPhoneValid = phoneValue.replace(/\D/g, "").length >= 8;
  const isPasswordValid = passwordValue.length >= 6;
  const isConfirmValid = confirmPasswordValue.length >= 6 && confirmPasswordValue === passwordValue;
  const isCheckboxesValid = Boolean(isAdultChecked && acceptTermsChecked);

  // Form is 100% complete and valid -> button becomes bright red
  const isFormValid = isUsernameValid && isPhoneValid && isPasswordValid && isConfirmValid && isCheckboxesValid;

  // Simulated live checking for username availability
  useEffect(() => {
    if (!usernameValue || usernameValue.length < 3) {
      setPseudoAvailable(null);
      return;
    }

    setPseudoAvailable("checking");
    const timer = setTimeout(() => {
      const upper = usernameValue.toUpperCase();
      if (["ADMIN", "TEST", "ROOT", "KONAMIX", "MODO"].includes(upper)) {
        setPseudoAvailable("unavailable");
      } else {
        setPseudoAvailable("available");
      }
    }, 400);

    return () => clearTimeout(timer);
  }, [usernameValue]);

  const onSubmit = async (data: SignupFormInputs) => {
    const success = await signup(data);
    if (success) {
      toast.success("🏆 Inscription réussie sur Konamix !");
      onSignupSuccess(data.phone);
    }
  };

  const onError = (formErrors: any) => {
    const firstKey = Object.keys(formErrors)[0];
    const firstErr = formErrors[firstKey];
    if (firstErr?.message) {
      toast.error(firstErr.message);
    } else {
      toast.error("Veuillez vérifier les informations du formulaire");
    }
  };

  const handleButtonClick = (e: React.MouseEvent) => {
    if (!isFormValid) {
      e.preventDefault();
      if (!isUsernameValid) {
        toast.error("Veuillez renseigner un pseudo valide (au moins 3 caractères)");
        return;
      }
      if (!isPhoneValid) {
        toast.error("Veuillez renseigner un numéro de téléphone valide");
        return;
      }
      if (!isPasswordValid) {
        toast.error("Le mot de passe doit contenir au moins 6 caractères");
        return;
      }
      if (!isConfirmValid) {
        toast.error("Les deux mots de passe doivent être identiques (au moins 6 caractères)");
        return;
      }
      if (!isAdultChecked) {
        toast.error("Veuillez attester avoir 18 ans ou plus");
        return;
      }
      if (!acceptTermsChecked) {
        toast.error("Veuillez accepter les CGU");
        return;
      }
    }
  };

  return (
    <AuthLayout title="Créer mon compte Konamix" subtitle="Rejoignez la communauté des parieurs champions" isEmbed={isEmbed}>
      <form onSubmit={handleSubmit(onSubmit, onError)} className="space-y-4">
        
        {/* 1. Sexe / Genre (Homme ou Femme) */}
        <div>
          <label className="block text-[10px] font-black uppercase text-gray-400 tracking-wider mb-1.5 flex items-center justify-between">
            <span>Sexe / Genre</span>
            <span className="text-[9px] text-[#10B981] font-bold flex items-center gap-1">
              <Check size={11} /> {genderValue === "femme" ? "Femme" : "Homme"} sélectionné
            </span>
          </label>
          <div className="grid grid-cols-2 gap-2.5">
            <button
              type="button"
              onClick={() => setValue("gender", "homme", { shouldValidate: true })}
              className={`h-12 rounded-xl font-black text-xs uppercase flex items-center justify-center gap-2 border transition-all cursor-pointer ${
                genderValue === "homme"
                  ? "bg-white/10 border-white text-white shadow-md shadow-white/5 ring-1 ring-white/20"
                  : "bg-black/40 border-white/10 text-gray-400 hover:text-white hover:border-white/20"
              }`}
            >
              <span className="text-base">👨</span>
              <span>Homme</span>
              {genderValue === "homme" && <CheckCircle2 size={14} className="text-[#10B981] ml-1" />}
            </button>
            <button
              type="button"
              onClick={() => setValue("gender", "femme", { shouldValidate: true })}
              className={`h-12 rounded-xl font-black text-xs uppercase flex items-center justify-center gap-2 border transition-all cursor-pointer ${
                genderValue === "femme"
                  ? "bg-white/10 border-white text-white shadow-md shadow-white/5 ring-1 ring-white/20"
                  : "bg-black/40 border-white/10 text-gray-400 hover:text-white hover:border-white/20"
              }`}
            >
              <span className="text-base">👩</span>
              <span>Femme</span>
              {genderValue === "femme" && <CheckCircle2 size={14} className="text-[#10B981] ml-1" />}
            </button>
          </div>
          <input type="hidden" {...register("gender")} />
        </div>

        {/* 2. Champ Pseudo */}
        <div>
          <label className="block text-[10px] font-black uppercase text-gray-400 tracking-wider mb-1.5 flex items-center justify-between">
            <span>Pseudo de Joueur</span>
            {isUsernameValid && (
              <span className="text-[9px] font-bold text-[#10B981] flex items-center gap-1">
                <CheckCircle2 size={11} /> Pseudo valide
              </span>
            )}
          </label>
          <div className="relative">
            <div className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500">
              <User size={16} />
            </div>
            <input
              type="text"
              placeholder="Pseudo (ex: CHAMPION_225)"
              {...register("username")}
              onChange={(e) => {
                e.target.value = e.target.value.toUpperCase().replace(/[^A-Z0-9_]/g, "");
                setValue("username", e.target.value, { shouldValidate: true });
              }}
              className={`w-full h-12 pl-10 pr-24 bg-black/50 border rounded-xl text-xs font-bold text-white placeholder-gray-500 focus:outline-none focus:border-[#DC2626] transition-colors ${
                errors.username ? "border-[#DC2626]" : isUsernameValid ? "border-[#10B981]/50" : "border-white/10"
              }`}
            />

            {/* Pseudo availability status indicator */}
            <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center">
              {pseudoAvailable === "checking" && (
                <div className="w-4 h-4 border-2 border-[#FBBF24] border-t-transparent rounded-full animate-spin" />
              )}
              {pseudoAvailable === "available" && (
                <span className="text-[9px] font-black uppercase text-[#10B981] bg-[#10B981]/10 px-2 py-0.5 rounded-md border border-[#10B981]/20">
                  Disponible
                </span>
              )}
              {pseudoAvailable === "unavailable" && (
                <span className="text-[9px] font-black uppercase text-[#DC2626] bg-[#DC2626]/10 px-2 py-0.5 rounded-md border border-[#DC2626]/20">
                  Déjà pris
                </span>
              )}
            </div>
          </div>
          {errors.username && (
            <p className="text-[10px] text-[#DC2626] font-extrabold uppercase mt-1">
              {errors.username.message}
            </p>
          )}
        </div>

        {/* 3. Champ Téléphone */}
        <div>
          <label className="block text-[10px] font-black uppercase text-gray-400 tracking-wider mb-1.5 flex items-center justify-between">
            <span>Numéro de téléphone</span>
            {isPhoneValid ? (
              <span className="text-[9px] font-bold text-[#10B981] flex items-center gap-1">
                <CheckCircle2 size={11} /> Format valide
              </span>
            ) : (
              <span className="text-[9px] font-bold text-gray-500">ex: 07 12 34 56 78</span>
            )}
          </label>
          <div className="relative">
            <div className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500">
              <Phone size={16} />
            </div>
            <input
              type="tel"
              placeholder="07 00 00 00 00 ou +225 05..."
              {...register("phone")}
              className={`w-full h-12 pl-10 pr-20 bg-black/50 border rounded-xl text-xs font-bold text-white placeholder-gray-500 focus:outline-none focus:border-[#DC2626] transition-colors ${
                errors.phone ? "border-[#DC2626]" : isPhoneValid ? "border-[#10B981]/50" : "border-white/10"
              }`}
            />
            <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-1.5 pointer-events-none">
              <span className="text-[9px] font-black text-gray-400 uppercase">CI</span>
              <img 
                src="https://flagcdn.com/w20/ci.png" 
                alt="CIV" 
                className="w-4 h-3 object-cover rounded-[1px] opacity-80" 
              />
            </div>
          </div>
          {errors.phone ? (
            <p className="text-[10px] text-[#DC2626] font-extrabold uppercase mt-1">
              {errors.phone.message}
            </p>
          ) : (
            <p className="text-[9px] text-gray-500 font-bold mt-1">
              Tous formats acceptés : 07..., 05..., 01... ou avec indicatif +225
            </p>
          )}
        </div>

        {/* 4. Champ Email (Facultatif) */}
        <div>
          <label className="block text-[10px] font-black uppercase text-gray-400 tracking-wider mb-1.5 flex items-center justify-between">
            <span className="flex items-center gap-1.5">
              <Mail size={12} className="text-[#FBBF24]" />
              <span>Adresse Email</span>
            </span>
            <span className="text-[9px] text-[#FBBF24] font-black uppercase bg-[#FBBF24]/10 px-2 py-0.5 rounded border border-[#FBBF24]/20 tracking-wider">
              Facultatif
            </span>
          </label>
          <div className="relative">
            <div className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500">
              <Mail size={16} />
            </div>
            <input
              type="email"
              placeholder="ex: parieur@gmail.com (optionnel)"
              {...register("email")}
              className={`w-full h-12 pl-10 pr-4 bg-black/50 border rounded-xl text-xs font-bold text-white placeholder-gray-500 focus:outline-none focus:border-[#DC2626] transition-colors ${
                errors.email ? "border-[#DC2626]" : "border-white/10"
              }`}
            />
          </div>
          {errors.email && (
            <p className="text-[10px] text-[#DC2626] font-extrabold uppercase mt-1">
              {errors.email.message}
            </p>
          )}
        </div>

        {/* 5. Adresse & Code Postal */}
        <div className="space-y-3">
          <div>
            <label className="block text-[10px] font-black uppercase text-gray-400 tracking-wider mb-1.5 flex items-center gap-1">
              <MapPin size={12} className="text-[#FBBF24]" />
              <span>Adresse de résidence</span>
            </label>
            <div className="relative">
              <div className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500">
                <Home size={15} />
              </div>
              <input
                type="text"
                placeholder="Ex: Cocody Angré 8ème tranche, Abidjan"
                {...register("address")}
                className="w-full h-12 pl-10 pr-4 bg-black/50 border border-white/10 rounded-xl text-xs font-bold text-white placeholder-gray-500 focus:outline-none focus:border-[#DC2626] transition-colors"
              />
            </div>
          </div>

          <div>
            <label className="block text-[10px] font-black uppercase text-gray-400 tracking-wider mb-1.5 flex items-center gap-1">
              <Mail size={12} className="text-[#FBBF24]" />
              <span>Code Postal</span>
            </label>
            <input
              type="text"
              placeholder="Ex: 00225 ou BP 123..."
              {...register("postalCode")}
              className="w-full h-12 px-3.5 bg-black/50 border border-white/10 rounded-xl text-xs font-bold text-white placeholder-gray-500 focus:outline-none focus:border-[#DC2626] transition-colors"
            />
          </div>
        </div>

        {/* 6. Champ Mot de passe */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-[10px] font-black uppercase text-gray-400 tracking-wider mb-1.5 flex items-center justify-between">
              <span>Mot de passe</span>
              {isPasswordValid ? (
                <span className="text-[9px] font-bold text-[#10B981] flex items-center gap-1">
                  <CheckCircle2 size={11} /> 6+ caractères
                </span>
              ) : (
                <span className="text-[9px] text-gray-500">min 6 caractères</span>
              )}
            </label>
            <div className="relative">
              <div className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500">
                <Lock size={16} />
              </div>
              <input
                type="password"
                placeholder="Au moins 6 caractères"
                {...register("password")}
                className={`w-full h-12 pl-10 pr-4 bg-black/50 border rounded-xl text-xs font-bold text-white placeholder-gray-500 focus:outline-none focus:border-[#DC2626] transition-colors ${
                  errors.password ? "border-[#DC2626]" : isPasswordValid ? "border-[#10B981]/50" : "border-white/10"
                }`}
              />
            </div>
            {errors.password && (
              <p className="text-[10px] text-[#DC2626] font-extrabold uppercase mt-1 leading-snug">
                {errors.password.message}
              </p>
            )}
          </div>

          {/* Confirmer Mot de passe */}
          <div>
            <label className="block text-[10px] font-black uppercase text-gray-400 tracking-wider mb-1.5 flex items-center justify-between">
              <span>Confirmer mot de passe</span>
              {confirmPasswordValue.length > 0 && (
                isConfirmValid ? (
                  <span className="text-[9px] font-bold text-[#10B981] flex items-center gap-1">
                    <CheckCircle2 size={11} /> Identique
                  </span>
                ) : (
                  <span className="text-[9px] font-bold text-[#DC2626]">
                    Ne correspond pas
                  </span>
                )
              )}
            </label>
            <div className="relative">
              <div className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500">
                <Lock size={16} />
              </div>
              <input
                type="password"
                placeholder="Répétez le mot de passe"
                {...register("confirmPassword")}
                className={`w-full h-12 pl-10 pr-4 bg-black/50 border rounded-xl text-xs font-bold text-white placeholder-gray-500 focus:outline-none focus:border-[#DC2626] transition-colors ${
                  errors.confirmPassword ? "border-[#DC2626]" : isConfirmValid ? "border-[#10B981]/50" : "border-white/10"
                }`}
              />
            </div>
            {errors.confirmPassword && (
              <p className="text-[10px] text-[#DC2626] font-extrabold uppercase mt-1">
                {errors.confirmPassword.message}
              </p>
            )}
          </div>
        </div>

        {/* Code de parrainage Optionnel */}
        {showRefField ? (
          <div className="relative border border-[#FBBF24]/20 bg-[#FBBF24]/5 p-3 rounded-xl animate-in fade-in slide-in-from-top-2 duration-200">
            <label className="block text-[10px] font-black uppercase text-[#FBBF24] tracking-wider mb-1">
              Code de Parrainage
            </label>
            <div className="relative">
              <div className="absolute left-3 top-1/2 -translate-y-1/2 text-[#FBBF24]">
                <Gift size={16} />
              </div>
              <input
                type="text"
                placeholder="Entrez le code de parrainage"
                {...register("referralCode")}
                className="w-full h-10 pl-10 pr-24 bg-black/60 border border-[#FBBF24]/30 rounded-lg text-xs font-black text-white uppercase focus:outline-none focus:border-[#FBBF24]"
              />
              <div className="absolute right-2 top-1/2 -translate-y-1/2">
                <span className="text-[8px] font-black uppercase bg-[#FBBF24] text-black px-2 py-1 rounded shadow-md flex items-center gap-1.5">
                  <Sparkles size={10} />
                  🎁 Bonus
                </span>
              </div>
            </div>
            <p className="text-[9px] text-[#FBBF24]/80 font-bold uppercase mt-1 leading-normal">
              Bonus de bienvenue de 1 000 FCFA offert après validation du premier pari !
            </p>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => setShowRefField(true)}
            className="w-full h-11 border border-dashed border-white/10 rounded-xl hover:border-[#FBBF24]/30 hover:text-[#FBBF24] text-gray-500 font-extrabold text-[10px] uppercase tracking-wider transition-colors cursor-pointer"
          >
            🔥 J'ai un code de parrainage (Optionnel)
          </button>
        )}

        {/* Checkboxes de validation légale */}
        <div className="space-y-2.5 pt-2 border-t border-white/5">
          {/* Checkbox 18 ans obligatoire */}
          <label className="flex items-start gap-3 cursor-pointer group">
            <div className="relative flex items-center h-5 mt-0.5">
              <input
                type="checkbox"
                {...register("isAdult")}
                className="peer w-5 h-5 opacity-0 absolute cursor-pointer"
              />
              <div className="w-5 h-5 bg-black/40 border-2 border-white/15 rounded-md peer-checked:bg-[#DC2626] peer-checked:border-[#DC2626] transition-all flex items-center justify-center">
                <CheckCircle2 size={12} className="text-white opacity-0 peer-checked:opacity-100" />
              </div>
            </div>
            <div>
              <p className="text-[10px] font-bold text-gray-400 group-hover:text-white transition-colors leading-tight uppercase">
                J'atteste et j'affirme avoir <span className="text-white font-black italic">18 ANS OU PLUS</span>
              </p>
              {errors.isAdult && (
                <p className="text-[9px] text-[#DC2626] font-black uppercase mt-0.5">
                  Légalement obligatoire pour parier
                </p>
              )}
            </div>
          </label>

          {/* Checkbox CGU */}
          <label className="flex items-start gap-3 cursor-pointer group">
            <div className="relative flex items-center h-5 mt-0.5">
              <input
                type="checkbox"
                {...register("acceptTerms")}
                className="peer w-5 h-5 opacity-0 absolute cursor-pointer"
              />
              <div className="w-5 h-5 bg-black/40 border-2 border-white/15 rounded-md peer-checked:bg-[#10B981] peer-checked:border-[#10B981] transition-all flex items-center justify-center">
                <CheckCircle2 size={12} className="text-white opacity-0 peer-checked:opacity-100" />
              </div>
            </div>
            <div>
              <p className="text-[10px] font-bold text-gray-400 group-hover:text-white transition-colors leading-tight uppercase">
                J'accepte sans réserve les <span className="text-white font-black italic">CGU</span> et politiques
              </p>
              {errors.acceptTerms && (
                <p className="text-[9px] text-[#DC2626] font-black uppercase mt-0.5">
                  Veuillez accepter les CGU
                </p>
              )}
            </div>
          </label>
        </div>

        {/* Bouton de confirmation d'inscription : devient ROUGE dès que tout est rempli correctement */}
        <button
          type="submit"
          disabled={loading}
          onClick={handleButtonClick}
          className={`w-full h-13 font-black uppercase tracking-wider rounded-xl transition-all duration-300 flex items-center justify-center gap-2 cursor-pointer ${
            isFormValid
              ? "bg-[#DC2626] hover:bg-[#b91c1c] text-white shadow-xl shadow-[#DC2626]/30 border border-red-500 scale-[1.01] active:scale-[0.98]"
              : "bg-neutral-800 hover:bg-neutral-750 text-neutral-400 border border-white/10"
          }`}
        >
          {loading ? (
            <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
          ) : (
            <>
              <UserPlus size={18} className={isFormValid ? "text-white" : "text-neutral-400"} />
              <span>CRÉER MON COMPTE CHAMPION</span>
            </>
          )}
        </button>

        {/* Indicateur de statut sous le bouton */}
        {isFormValid ? (
          <p className="text-center text-[10px] text-[#10B981] font-bold flex items-center justify-center gap-1.5 animate-in fade-in duration-300">
            <CheckCircle2 size={12} />
            <span>Formulaire complet ! Cliquez pour valider votre compte</span>
          </p>
        ) : (
          <p className="text-center text-[10px] text-gray-500 font-medium">
            Renseignez votre pseudo, téléphone, mot de passe (6+ caractères) et cochez les conditions pour activer le bouton en rouge.
          </p>
        )}

        {/* Lien de redirection */}
        <p className="text-center text-[11px] font-bold text-gray-500 uppercase tracking-tighter pt-2">
          Déjà inscrit chez les vainqueurs ?{" "}
          <button
            type="button"
            onClick={onSwitchToLogin}
            className="text-[#DC2626] font-black italic hover:scale-105 transition-transform ml-1 border-b border-dashed border-[#DC2626] cursor-pointer"
          >
            SE CONNECTER
          </button>
        </p>

        {/* Protection indicielle */}
        <div className="flex items-center justify-center gap-1.5 text-[9px] text-gray-600 font-extrabold uppercase pt-1">
          <Shield size={12} className="text-gray-500" />
          <span>Données chiffrées selon le règlement de l'ANR Côte d'Ivoire</span>
        </div>
      </form>
    </AuthLayout>
  );
}
