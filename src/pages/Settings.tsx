import React, { useState, useEffect } from "react";
import { useAuth } from "../contexts/AuthContext";
import { updateProfile } from "firebase/auth";
import { auth, db } from "../lib/firebase";
import { doc, updateDoc } from "firebase/firestore";
import { toast } from "sonner";
import { 
  Settings as SettingsIcon, 
  User, 
  Shield, 
  Languages, 
  Save, 
  Loader2, 
  ChevronRight, 
  Smartphone,
  MapPin,
  Mail,
  Volume2,
  VolumeX,
  Volume1,
  Sparkles
} from "lucide-react";
import { isSoundEnabled, setSoundEnabled, playMetallicSound, getSoundVolume, setSoundVolume } from "../utils/audio";

export default function Settings() {
  const { user } = useAuth();
  const [soundActive, setSoundActive] = useState(isSoundEnabled());
  const [soundVolume, setSoundVolumeState] = useState(getSoundVolume());

  useEffect(() => {
    const handleSoundChange = (e: any) => {
      setSoundActive(e.detail?.enabled ?? isSoundEnabled());
    };
    const handleVolumeChange = (e: any) => {
      setSoundVolumeState(e.detail?.volume ?? getSoundVolume());
    };
    window.addEventListener("konamix_sound_change", handleSoundChange);
    window.addEventListener("konamix_volume_change", handleVolumeChange);
    return () => {
      window.removeEventListener("konamix_sound_change", handleSoundChange);
      window.removeEventListener("konamix_volume_change", handleVolumeChange);
    };
  }, []);
  const [displayName, setDisplayName] = useState(user?.displayName || "");
  const [gender, setGender] = useState<"homme" | "femme">(user?.gender || "homme");
  const [contactEmail, setContactEmail] = useState(user?.contactEmail || "");
  const [address, setAddress] = useState(user?.address || "");
  const [postalCode, setPostalCode] = useState(user?.postalCode || "");
  const [loading, setLoading] = useState(false);

  const handleUpdateProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!auth.currentUser) return;
    
    setLoading(true);
    try {
      await updateProfile(auth.currentUser, { displayName });
      if (user?.uid) {
        await updateDoc(doc(db, "users", user.uid), {
          displayName,
          username: displayName,
          gender,
          contactEmail: contactEmail.trim(),
          address: address.trim(),
          postalCode: postalCode.trim(),
        });
      }
      toast.success("Profil et informations mis à jour !");
    } catch (e) {
      console.error(e);
      toast.error("Erreur lors de la mise à jour");
    } finally {
      setLoading(false);
    }
  };

  const handleOptionClick = (option: string) => {
    if (option === "Changer le mot de passe") {
      if (user?.email) {
        import("firebase/auth").then(({ sendPasswordResetEmail }) => {
          sendPasswordResetEmail(auth, user.email!)
            .then(() => toast.success("Email de réinitialisation envoyé !"))
            .catch(() => toast.error("Erreur lors de l'envoi de l'email"));
        });
      } else {
        toast.error("Aucun email associé à ce compte");
      }
    } else {
      toast.info(`${option} : Fonctionnalité bientôt disponible`);
    }
  };

  const sections = [
    { title: "Préférences", icon: Smartphone, options: ["Notifications Push", "Mode Data Faible"] },
    { title: "Sécurité", icon: Shield, options: ["Changer le mot de passe", "Vérification 2 étapes"] },
    { title: "Langue", icon: Languages, options: ["Français"] },
  ];

  return (
    <div className="space-y-6 pb-20 pt-4">
      <div className="px-1 space-y-1">
        <h1 className="text-2xl font-black italic tracking-tighter uppercase leading-none flex items-center gap-2">
            <SettingsIcon className="text-gray-400" size={24} />
            Configuration
        </h1>
        <p className="text-[10px] text-gray-500 font-bold uppercase tracking-widest italic">Gère ton compte & coordonnées</p>
      </div>

      {/* Profil Form */}
      <section className="card bg-white/[0.02] border-white/5 p-5 space-y-4">
        <div className="flex items-center gap-2">
            <User size={16} className="text-brand-red" />
            <h3 className="text-[10px] font-black uppercase text-white/70 italic tracking-wider">Identité & Coordonnées</h3>
        </div>
        <form onSubmit={handleUpdateProfile} className="space-y-4">
            {/* Pseudonyme */}
            <div className="space-y-1.5">
                <label className="text-[9px] font-black uppercase text-gray-400 px-1">Pseudonyme</label>
                <input 
                    type="text"
                    value={displayName}
                    onChange={(e) => setDisplayName(e.target.value)}
                    className="w-full bg-black/40 border border-white/10 p-3 rounded-xl focus:outline-none focus:border-brand-red font-black text-xs transition-all text-white"
                    placeholder="Ton pseudo"
                />
            </div>

            {/* Sexe / Genre */}
            <div className="space-y-1.5">
                <label className="text-[9px] font-black uppercase text-gray-400 px-1">Sexe / Genre</label>
                <div className="grid grid-cols-2 gap-2">
                    <button
                        type="button"
                        onClick={() => setGender("homme")}
                        className={`h-10 rounded-xl font-black text-xs uppercase flex items-center justify-center gap-2 border transition-all cursor-pointer ${
                            gender === "homme"
                                ? "bg-white/10 border-white text-white"
                                : "bg-black/40 border-white/10 text-gray-400"
                        }`}
                    >
                        👨 Homme
                    </button>
                    <button
                        type="button"
                        onClick={() => setGender("femme")}
                        className={`h-10 rounded-xl font-black text-xs uppercase flex items-center justify-center gap-2 border transition-all cursor-pointer ${
                            gender === "femme"
                                ? "bg-white/10 border-white text-white"
                                : "bg-black/40 border-white/10 text-gray-400"
                        }`}
                    >
                        👩 Femme
                    </button>
                </div>
            </div>

            {/* Email de contact */}
            <div className="space-y-1.5">
                <label className="text-[9px] font-black uppercase text-gray-400 px-1 flex items-center gap-1">
                    <Mail size={11} className="text-brand-gold" /> Email de contact (Facultatif)
                </label>
                <input 
                    type="email"
                    value={contactEmail}
                    onChange={(e) => setContactEmail(e.target.value)}
                    className="w-full bg-black/40 border border-white/10 p-3 rounded-xl focus:outline-none focus:border-brand-red font-bold text-xs transition-all text-white"
                    placeholder="Ex: joueur@gmail.com"
                />
            </div>

            {/* Adresse */}
            <div className="space-y-1.5">
                <label className="text-[9px] font-black uppercase text-gray-400 px-1 flex items-center gap-1">
                    <MapPin size={11} className="text-brand-gold" /> Adresse de résidence
                </label>
                <input 
                    type="text"
                    value={address}
                    onChange={(e) => setAddress(e.target.value)}
                    className="w-full bg-black/40 border border-white/10 p-3 rounded-xl focus:outline-none focus:border-brand-red font-bold text-xs transition-all text-white"
                    placeholder="Ex: Cocody Angré, Abidjan"
                />
            </div>

            {/* Code Postal */}
            <div className="space-y-1.5">
                <label className="text-[9px] font-black uppercase text-gray-400 px-1 flex items-center gap-1">
                    <Mail size={11} className="text-brand-gold" /> Code Postal
                </label>
                <input 
                    type="text"
                    value={postalCode}
                    onChange={(e) => setPostalCode(e.target.value)}
                    className="w-full bg-black/40 border border-white/10 p-3 rounded-xl focus:outline-none focus:border-brand-red font-bold text-xs transition-all text-white"
                    placeholder="Ex: 00225 ou BP 123"
                />
            </div>

            <button 
                type="submit" 
                disabled={loading}
                className="w-full bg-brand-red text-white py-3 rounded-xl font-black uppercase text-[10px] tracking-widest shadow-lg shadow-brand-red/20 active:scale-95 transition-all flex items-center justify-center gap-2 cursor-pointer"
            >
                {loading ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
                Sauvegarder les modifications
            </button>
        </form>
      </section>

      {/* 🔊 Effets Sonores Métalliques & Ambiance */}
      <section className="card bg-white/[0.03] border-white/10 p-5 space-y-4 backdrop-blur-md">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            {soundActive ? (
              <div className="w-8 h-8 rounded-lg bg-brand-gold/15 border border-brand-gold/30 flex items-center justify-center text-brand-gold">
                <Volume2 size={18} />
              </div>
            ) : (
              <div className="w-8 h-8 rounded-lg bg-white/5 border border-white/10 flex items-center justify-center text-gray-500">
                <VolumeX size={18} />
              </div>
            )}
            <div>
              <h3 className="text-xs font-black uppercase text-white tracking-wider flex items-center gap-1.5">
                Son Métallique
                <span className={`text-[8px] font-black uppercase px-1.5 py-0.5 rounded tracking-widest ${
                  soundActive 
                    ? "bg-emerald-500/15 text-emerald-400 border border-emerald-500/30" 
                    : "bg-white/5 text-gray-400 border border-white/10"
                }`}>
                  {soundActive ? "Activé" : "Désactivé"}
                </span>
              </h3>
              <p className="text-[10px] text-gray-400 font-medium">
                Sons et cliquetis métalliques lors de la navigation, des clics et des validations
              </p>
            </div>
          </div>

          {/* Toggle Button */}
          <button
            type="button"
            onClick={() => {
              const next = !soundActive;
              setSoundActive(next);
              setSoundEnabled(next);
              if (next) {
                toast.success("Son métallique activé !");
                playMetallicSound();
              } else {
                toast.info("Son métallique désactivé");
              }
            }}
            className={`w-13 h-7 rounded-full transition-colors relative p-1 cursor-pointer ${
              soundActive ? "bg-emerald-500" : "bg-white/20"
            }`}
            title={soundActive ? "Désactiver le son métallique" : "Activer le son métallique"}
          >
            <div
              className={`w-5 h-5 rounded-full bg-white transition-transform ${
                soundActive ? "translate-x-6 shadow-md" : "translate-x-0"
              }`}
            />
          </button>
        </div>

        {/* Volume Level Controls (Visible when active) */}
        {soundActive && (
          <div className="pt-3 border-t border-white/5 space-y-2">
            <div className="flex items-center justify-between text-[10px]">
              <span className="font-bold text-gray-300 uppercase tracking-wider flex items-center gap-1.5">
                <Volume1 size={13} className="text-brand-gold" />
                Puissance du volume sonore :
              </span>
              <span className="font-mono font-black text-brand-gold">
                {Math.round(soundVolume * 100)}%
              </span>
            </div>

            <div className="grid grid-cols-3 gap-2">
              {[
                { label: "Modéré (50%)", val: 0.5 },
                { label: "Normal (85%)", val: 0.85 },
                { label: "Maximum (100%)", val: 1.0 },
              ].map((p) => {
                const isSelected = Math.abs(soundVolume - p.val) < 0.08;
                return (
                  <button
                    key={p.val}
                    type="button"
                    onClick={() => {
                      setSoundVolume(p.val);
                      setSoundVolumeState(p.val);
                      toast.success(`Volume réglé sur ${Math.round(p.val * 100)}%`);
                      playMetallicSound({ volume: 0.8 });
                    }}
                    className={`py-1.5 px-2 rounded-lg text-[9px] font-black uppercase tracking-wider border transition-all cursor-pointer ${
                      isSelected
                        ? "bg-brand-gold/20 text-brand-gold border-brand-gold/40 shadow-sm"
                        : "bg-white/5 text-gray-400 border-white/10 hover:bg-white/10 hover:text-white"
                    }`}
                  >
                    {p.label}
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* Test button & status detail */}
        <div className="pt-2 border-t border-white/5 flex items-center justify-between gap-3">
          <span className="text-[9px] font-bold text-gray-400 uppercase tracking-wider flex items-center gap-1">
            <Sparkles size={11} className={soundActive ? "text-brand-gold" : "text-gray-600"} />
            Statut : <strong className={soundActive ? "text-emerald-400" : "text-gray-500"}>{soundActive ? "ACTIVÉ" : "DÉSACTIVÉ"}</strong>
          </span>

          <button
            type="button"
            onClick={() => {
              if (!soundActive) {
                setSoundActive(true);
                setSoundEnabled(true);
                toast.success("Son métallique réactivé !");
              }
              playMetallicSound({ volume: 0.85 });
            }}
            className="px-3.5 py-1.5 bg-brand-gold/15 hover:bg-brand-gold/25 border border-brand-gold/30 rounded-lg text-[9px] font-black uppercase text-brand-gold tracking-widest flex items-center gap-1.5 active:scale-95 transition-all cursor-pointer"
          >
            <Volume2 size={13} />
            Tester le son
          </button>
        </div>
      </section>

      {/* Menu Sections */}
      {sections.map((section, idx) => (
        <section key={idx} className="space-y-3">
          <div className="flex items-center gap-2 px-1">
              <section.icon size={16} className="text-gray-500" />
              <h3 className="text-[10px] font-black uppercase text-gray-600 italic tracking-wider">{section.title}</h3>
          </div>
          <div className="grid gap-2">
              {section.options.map((opt, i) => (
                <button 
                    key={i}
                    onClick={() => handleOptionClick(opt)}
                    className="card flex items-center justify-between p-4 bg-white/[0.02] border-white/5 hover:bg-white/5 transition-all group"
                >
                    <span className="text-xs font-bold text-gray-300">{opt}</span>
                    <div className="flex items-center gap-2">
                         <span className="text-[8px] font-black uppercase text-gray-700 italic">Paramétrer</span>
                         <div className="flex items-center text-gray-600 transform group-hover:translate-x-1 transition-transform">
                            <ChevronRight size={14} />
                         </div>
                    </div>
                </button>
              ))}
          </div>
        </section>
      ))}

      {/* Danger Zone */}
      <section className="pt-4">
        <button className="w-full p-4 card bg-red-500/5 border-red-500/20 text-red-500 hover:bg-red-500/10 transition-all flex items-center justify-between group">
            <div className="flex items-center gap-3">
                <Shield size={18} />
                <span className="text-xs font-black uppercase italic">Supprimer mon compte</span>
            </div>
            <ChevronRight size={18} className="opacity-30 group-hover:opacity-100" />
        </button>
      </section>
    </div>
  );
}
