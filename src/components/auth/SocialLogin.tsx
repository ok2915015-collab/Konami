import React from "react";
import Button from "../ui/Button";
import { Chrome, Instagram, Smartphone } from "lucide-react";
import { signInWithGoogle } from "../../lib/firebase";
import { toast } from "sonner";

export default function SocialLogin() {
  const handleGoogleLogin = async () => {
    try {
      await signInWithGoogle();
      toast.success("Connexion réussie !");
    } catch (error) {
      toast.error("Erreur lors de la connexion Google");
    }
  };

  return (
    <div className="space-y-3">
      <div className="relative">
        <div className="absolute inset-0 flex items-center">
          <div className="w-full border-t border-white/5"></div>
        </div>
        <div className="relative flex justify-center text-[10px]">
          <span className="bg-[#111111] px-4 text-gray-600 font-black uppercase tracking-widest italic">OU CONTINUER AVEC</span>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <Button 
          type="button" 
          variant="secondary" 
          onClick={handleGoogleLogin}
          className="h-14 bg-white text-black hover:bg-gray-200"
        >
          <Chrome size={18} /> GOOGLE
        </Button>
        <Button 
          type="button" 
          variant="outline" 
          onClick={() => toast.info("Bientôt disponible")}
          className="h-14 border-white/5"
        >
          <Smartphone size={18} className="text-brand-gold" /> SMS
        </Button>
      </div>
    </div>
  );
}
