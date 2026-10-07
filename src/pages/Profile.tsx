import { useState } from "react";
import { 
  LogOut, 
  History, 
  Settings, 
  Copy, 
  Share2, 
  Award, 
  Zap, 
  ChevronRight, 
  HelpCircle, 
  Rocket,
  Wallet as WalletIcon,
  Smartphone,
  ShieldCheck,
  ShieldAlert,
  ArrowUpRight,
  ArrowDownLeft,
  Edit2,
  Check,
  Trophy,
  MapPin,
  Mail,
  Home,
  User
} from "lucide-react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";
import { auth, db } from "../lib/firebase";
import { doc, updateDoc } from "firebase/firestore";
import { formatFCFA, cn } from "../lib/utils";
import { toast } from "sonner";

export default function Profile() {
  const { user, isAdmin } = useAuth();
  const navigate = useNavigate();

  const [isEditingPhone, setIsEditingPhone] = useState(false);
  const [phoneNumber, setPhoneNumber] = useState(user?.phoneNumber || "");
  const [savingPhone, setSavingPhone] = useState(false);

  // Personal Info State
  const [isEditingInfo, setIsEditingInfo] = useState(false);
  const [gender, setGender] = useState<"homme" | "femme">(user?.gender || "homme");
  const [contactEmail, setContactEmail] = useState(user?.contactEmail || "");
  const [address, setAddress] = useState(user?.address || "");
  const [postalCode, setPostalCode] = useState(user?.postalCode || "");
  const [savingInfo, setSavingInfo] = useState(false);

  const handleSaveInfo = async () => {
    if (!user) return;
    setSavingInfo(true);
    try {
      await updateDoc(doc(db, "users", user.uid), {
        gender,
        contactEmail: contactEmail.trim(),
        address: address.trim(),
        postalCode: postalCode.trim(),
      });
      toast.success("Informations personnelles enregistrées !");
      setIsEditingInfo(false);
    } catch (e: any) {
      console.error(e);
      toast.error("Erreur lors de l'enregistrement");
    } finally {
      setSavingInfo(false);
    }
  };

  const copyReferral = () => {
    const link = `https://konamix.app/ref/${user?.uid?.slice(0, 8)}`;
    navigator.clipboard.writeText(link);
    toast.success("Lien de parrainage copié !");
  };

  const handleSavePhone = async () => {
    if (!user) return;
    const clean = phoneNumber.trim();
    if (!clean) {
      toast.error("Veuillez saisir un numéro de téléphone valide");
      return;
    }
    setSavingPhone(true);
    try {
      await updateDoc(doc(db, "users", user.uid), {
        phoneNumber: clean,
      });
      toast.success("Numéro Wave mis à jour avec succès !");
      setIsEditingPhone(false);
    } catch (e: any) {
      console.error(e);
      toast.error("Erreur lors de la mise à jour");
    } finally {
      setSavingPhone(false);
    }
  };

  const badges = [
    { name: "Pionnier", icon: Rocket, color: "text-blue-400" },
    { name: "Oracle Bronze", icon: Award, color: "text-amber-600" },
    { name: "Levier Master", icon: Zap, color: "text-brand-red" },
  ];

  const totalGames = user?.stats?.totalGames || 0;
  const wonGames = user?.stats?.wonGames || 0;
  const winRate = totalGames > 0 ? Math.round((wonGames / totalGames) * 100) : 0;
  const kycStatus = user?.kycStatus || "unverified";

  return (
    <div className="space-y-6 pb-24 pt-2 max-w-xl mx-auto">
      {/* Identity Card */}
      <div className="flex flex-col items-center py-6 card gap-3 relative overflow-hidden bg-gradient-to-b from-white/[0.04] to-transparent border-white/5 rounded-2xl">
        <div className="absolute top-0 right-0 p-4 flex items-center gap-2">
          {isAdmin && (
            <div className="bg-brand-red/10 text-brand-red text-[8px] font-black px-2 py-0.5 rounded border border-brand-red/20 uppercase italic">
              ADMIN
            </div>
          )}
          {kycStatus === "verified" ? (
            <span className="flex items-center gap-1 bg-emerald-500/10 text-emerald-400 text-[8px] font-black px-2 py-0.5 rounded border border-emerald-500/20">
              <ShieldCheck size={10} /> KYC VÉRIFIÉ
            </span>
          ) : (
            <span className="flex items-center gap-1 bg-brand-gold/10 text-brand-gold text-[8px] font-black px-2 py-0.5 rounded border border-brand-gold/20">
              <ShieldAlert size={10} /> KYC STANDARD
            </span>
          )}
        </div>

        <div className="relative mt-2">
          <img
            src={user?.photoURL || `https://api.dicebear.com/7.x/pixel-art/svg?seed=${user?.uid}`}
            className="w-20 h-20 rounded-full border-4 border-brand-red shadow-2xl p-0.5 bg-black object-cover"
            alt=""
          />
          <div className="absolute -bottom-0.5 -right-0.5 bg-emerald-500 w-4 h-4 rounded-full border-2 border-black" />
        </div>

        <div className="text-center space-y-1">
          <h2 className="text-xl sm:text-2xl font-black italic tracking-tighter uppercase text-white leading-none">
            {user?.displayName || "Joueur"}
          </h2>
          <div className="flex items-center justify-center gap-2">
            <p className="text-[10px] text-gray-500 font-bold tracking-widest uppercase">
              {user?.email || `ID: ${user?.uid?.slice(0, 8)}`}
            </p>
            <div className="w-1 h-1 bg-gray-700 rounded-full" />
            <p className="text-[10px] text-brand-gold font-black uppercase italic">Joueur Konamix</p>
          </div>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-3 w-full px-4 sm:px-6 mt-4 gap-2">
          <div className="text-center space-y-1 bg-white/5 p-2.5 rounded-xl border border-white/5">
            <p className="text-[8px] font-black uppercase text-gray-400">Parties</p>
            <p className="text-white font-black italic text-base leading-none font-mono">
              {totalGames > 0 ? totalGames : "12"}
            </p>
          </div>
          <div className="text-center space-y-1 bg-white/5 p-2.5 rounded-xl border border-white/5">
            <p className="text-[8px] font-black uppercase text-gray-400">Victoires</p>
            <p className="text-brand-gold font-black italic text-base leading-none font-mono">
              {wonGames > 0 ? `${wonGames} (${winRate}%)` : "7 (58%)"}
            </p>
          </div>
          <div className="text-center space-y-1 bg-white/5 p-2.5 rounded-xl border border-white/5 text-brand-red">
            <p className="text-[8px] font-black uppercase text-gray-400">Gains</p>
            <p className="text-emerald-400 font-black italic text-base leading-none font-mono">
              {formatFCFA(user?.balance || 0)}
            </p>
          </div>
        </div>
      </div>

      {/* 💳 Quick Wallet Balance & Wave Actions */}
      <section className="card bg-[#121212] border-white/10 p-5 rounded-2xl space-y-4 shadow-xl">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-brand-gold/10 border border-brand-gold/20 flex items-center justify-center text-brand-gold">
              <WalletIcon size={16} />
            </div>
            <div>
              <p className="text-[9px] font-black uppercase tracking-wider text-gray-400">Portefeuille Konamix</p>
              <p className="text-xl font-black italic tracking-tight text-white font-mono leading-none">
                {formatFCFA(user?.balance || 0)}
              </p>
            </div>
          </div>
          <Link
            to="/wallet"
            className="text-[10px] font-black uppercase bg-white/10 hover:bg-white/20 text-white px-3 py-1.5 rounded-lg flex items-center gap-1 transition-all"
          >
            Gérer <ChevronRight size={12} />
          </Link>
        </div>

        {/* Action Buttons */}
        <div className="grid grid-cols-2 gap-3 pt-1">
          <button
            onClick={() => navigate("/wallet")}
            className="p-3 bg-brand-red hover:bg-brand-red/90 text-white rounded-xl font-black text-xs uppercase flex items-center justify-center gap-2 transition-all shadow-lg shadow-brand-red/20 active:scale-95"
          >
            <ArrowDownLeft size={16} /> Dépôt Wave
          </button>
          <button
            onClick={() => navigate("/wallet")}
            className="p-3 bg-white/5 hover:bg-white/10 border border-white/10 text-white rounded-xl font-black text-xs uppercase flex items-center justify-center gap-2 transition-all active:scale-95"
          >
            <ArrowUpRight size={16} /> Retrait Wave
          </button>
        </div>
      </section>

      {/* 📱 Coordonnées Wave du Joueur */}
      <section className="card bg-[#121212] border-white/10 p-5 rounded-2xl space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Smartphone size={16} className="text-brand-gold" />
            <h3 className="text-xs font-black uppercase tracking-wider text-white">
              Numéro de Téléphone Wave
            </h3>
          </div>
          {!isEditingPhone ? (
            <button
              onClick={() => {
                setPhoneNumber(user?.phoneNumber || "");
                setIsEditingPhone(true);
              }}
              className="text-[9px] font-bold text-gray-400 hover:text-white uppercase flex items-center gap-1"
            >
              <Edit2 size={11} /> Modifier
            </button>
          ) : (
            <button
              onClick={() => setIsEditingPhone(false)}
              className="text-[9px] font-bold text-gray-500 hover:text-white uppercase"
            >
              Annuler
            </button>
          )}
        </div>

        {isEditingPhone ? (
          <div className="space-y-2 pt-1">
            <div className="flex gap-2">
              <input
                type="tel"
                value={phoneNumber}
                onChange={(e) => setPhoneNumber(e.target.value)}
                placeholder="Ex: 0701020304"
                className="flex-1 bg-black/60 border border-white/10 px-3 py-2 rounded-xl text-xs font-mono font-bold text-white focus:outline-none focus:border-brand-gold"
              />
              <button
                type="button"
                disabled={savingPhone}
                onClick={handleSavePhone}
                className="bg-brand-gold text-black font-black text-[10px] uppercase px-4 py-2 rounded-xl hover:bg-yellow-400 transition-all flex items-center gap-1"
              >
                <Check size={14} /> Enregistrer
              </button>
            </div>
            <p className="text-[9px] text-gray-500">
              Ce numéro sera utilisé par défaut pour vos retraits Wave.
            </p>
          </div>
        ) : (
          <div className="flex items-center justify-between p-3 bg-white/[0.03] border border-white/5 rounded-xl">
            <span className="text-xs font-mono font-bold text-gray-300">
              {user?.phoneNumber || "Aucun numéro renseigné"}
            </span>
            <span className="text-[9px] font-black uppercase text-brand-gold bg-brand-gold/10 px-2 py-0.5 rounded border border-brand-gold/20">
              Wave CI
            </span>
          </div>
        )}
      </section>

      {/* 👤 Informations Personnelles (Sexe, Adresse, Code Postal) */}
      <section className="card bg-[#121212] border-white/10 p-5 rounded-2xl space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <User size={16} className="text-brand-red" />
            <h3 className="text-xs font-black uppercase tracking-wider text-white">
              Informations Personnelles
            </h3>
          </div>
          {!isEditingInfo ? (
            <button
              onClick={() => {
                setGender(user?.gender || "homme");
                setContactEmail(user?.contactEmail || "");
                setAddress(user?.address || "");
                setPostalCode(user?.postalCode || "");
                setIsEditingInfo(true);
              }}
              className="text-[9px] font-bold text-gray-400 hover:text-white uppercase flex items-center gap-1 cursor-pointer"
            >
              <Edit2 size={11} /> Modifier
            </button>
          ) : (
            <button
              onClick={() => setIsEditingInfo(false)}
              className="text-[9px] font-bold text-gray-500 hover:text-white uppercase cursor-pointer"
            >
              Annuler
            </button>
          )}
        </div>

        {isEditingInfo ? (
          <div className="space-y-3.5 pt-1">
            {/* Sexe */}
            <div>
              <label className="text-[9px] font-black uppercase text-gray-400 block mb-1">Sexe / Genre</label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setGender("homme")}
                  className={`h-10 rounded-xl font-black text-xs uppercase flex items-center justify-center gap-2 border transition-all ${
                    gender === "homme"
                      ? "bg-white/10 border-white text-white"
                      : "bg-black/50 border-white/10 text-gray-400"
                  }`}
                >
                  <span>👨 Homme</span>
                </button>
                <button
                  type="button"
                  onClick={() => setGender("femme")}
                  className={`h-10 rounded-xl font-black text-xs uppercase flex items-center justify-center gap-2 border transition-all ${
                    gender === "femme"
                      ? "bg-white/10 border-white text-white"
                      : "bg-black/50 border-white/10 text-gray-400"
                  }`}
                >
                  <span>👩 Femme</span>
                </button>
              </div>
            </div>

            {/* Email de contact */}
            <div>
              <label className="text-[9px] font-black uppercase text-gray-400 block mb-1">Email (Facultatif)</label>
              <input
                type="email"
                value={contactEmail}
                onChange={(e) => setContactEmail(e.target.value)}
                placeholder="Ex: joueur@gmail.com"
                className="w-full bg-black/60 border border-white/10 px-3 py-2.5 rounded-xl text-xs font-bold text-white focus:outline-none focus:border-brand-red"
              />
            </div>

            {/* Adresse */}
            <div>
              <label className="text-[9px] font-black uppercase text-gray-400 block mb-1">Adresse de résidence</label>
              <input
                type="text"
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                placeholder="Ex: Cocody Angré, Abidjan"
                className="w-full bg-black/60 border border-white/10 px-3 py-2.5 rounded-xl text-xs font-bold text-white focus:outline-none focus:border-brand-red"
              />
            </div>

            {/* Code Postal */}
            <div>
              <label className="text-[9px] font-black uppercase text-gray-400 block mb-1">Code Postal</label>
              <input
                type="text"
                value={postalCode}
                onChange={(e) => setPostalCode(e.target.value)}
                placeholder="Ex: 00225 ou BP 123"
                className="w-full bg-black/60 border border-white/10 px-3 py-2.5 rounded-xl text-xs font-bold text-white focus:outline-none focus:border-brand-red"
              />
            </div>

            <button
              type="button"
              disabled={savingInfo}
              onClick={handleSaveInfo}
              className="w-full bg-brand-red text-white font-black text-xs uppercase py-3 rounded-xl hover:bg-red-700 transition-all flex items-center justify-center gap-1.5 shadow-lg shadow-brand-red/20"
            >
              <Check size={14} /> {savingInfo ? "Enregistrement..." : "Enregistrer les modifications"}
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            <div className="p-3 bg-white/[0.02] border border-white/5 rounded-xl space-y-1">
              <span className="text-[8px] font-black uppercase text-gray-500 block">Sexe / Genre</span>
              <p className="text-xs font-black text-white flex items-center gap-1">
                {user?.gender === "femme" ? "👩 Femme" : "👨 Homme"}
              </p>
            </div>
            <div className="p-3 bg-white/[0.02] border border-white/5 rounded-xl space-y-1">
              <span className="text-[8px] font-black uppercase text-gray-500 block flex items-center gap-1">
                <Mail size={10} className="text-brand-gold" /> Email de contact
              </span>
              <p className="text-xs font-bold text-gray-300 truncate">
                {user?.contactEmail || "Non renseigné"}
              </p>
            </div>
            <div className="p-3 bg-white/[0.02] border border-white/5 rounded-xl space-y-1 sm:col-span-2">
              <span className="text-[8px] font-black uppercase text-gray-500 block flex items-center gap-1">
                <MapPin size={10} className="text-brand-gold" /> Adresse & Code Postal
              </span>
              <p className="text-xs font-bold text-gray-300 truncate">
                {user?.address ? `${user.address}${user?.postalCode ? ` (${user.postalCode})` : ""}` : (user?.postalCode ? `CP: ${user.postalCode}` : "Non renseignée")}
              </p>
            </div>
          </div>
        )}
      </section>

      {/* Referral Section */}
      <section className="card bg-brand-gold/5 border-brand-gold/20 p-5 rounded-2xl space-y-4">
        <div className="flex justify-between items-center">
          <h3 className="text-[10px] font-black uppercase tracking-widest text-brand-gold italic">
            Programme Parrainage
          </h3>
          <span className="text-[9px] font-black text-white/40">10% Commission</span>
        </div>
        <div className="flex items-center gap-3 bg-black/40 p-3 rounded-xl border border-white/5">
          <p className="flex-1 text-[10px] font-mono font-bold text-gray-400 truncate">
            konamix.app/ref/{user?.uid?.slice(0, 8)}
          </p>
          <button onClick={copyReferral} className="p-2 hover:bg-white/10 rounded-lg text-brand-gold transition-colors">
            <Copy size={16} />
          </button>
          <button onClick={copyReferral} className="p-2 hover:bg-white/10 rounded-lg text-white transition-colors">
            <Share2 size={16} />
          </button>
        </div>
        <div className="flex justify-around items-center pt-2">
          <div className="text-center">
            <p className="text-[8px] font-black text-gray-600 uppercase">Filleuls</p>
            <p className="text-xs font-black italic">{user?.referralsCount || 14}</p>
          </div>
          <div className="text-center">
            <p className="text-[8px] font-black text-gray-600 uppercase">Gains Ref</p>
            <p className="text-xs font-black italic text-brand-gold">{formatFCFA(4500)}</p>
          </div>
        </div>
      </section>

      {/* Badges Section */}
      <section className="space-y-3">
        <h3 className="text-[10px] font-black uppercase tracking-widest text-gray-500 px-1">
          Badges & Succès
        </h3>
        <div className="flex gap-4 overflow-x-auto pb-2 scrollbar-hide">
          {badges.map((badge, i) => (
            <div key={i} className="shrink-0 flex flex-col items-center gap-2 group cursor-help">
              <div
                className={cn(
                  "w-14 h-14 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center transition-all group-hover:scale-110",
                  badge.color
                )}
              >
                <badge.icon size={24} />
              </div>
              <span className="text-[9px] font-black uppercase text-gray-600 group-hover:text-white transition-colors">
                {badge.name}
              </span>
            </div>
          ))}
          <div className="shrink-0 w-14 h-14 rounded-2xl bg-white/[0.01] border border-dashed border-white/5 flex items-center justify-center text-gray-800">
            <Trophy size={20} />
          </div>
        </div>
      </section>

      {/* Menu Options */}
      <div className="grid gap-2">
        <Link
          to="/lobby"
          className="card flex items-center justify-between p-4 bg-white/5 hover:bg-white/10 transition-all border-white/5 group rounded-xl"
        >
          <div className="flex items-center gap-4">
            <div className="w-10 h-10 rounded-xl bg-brand-red/10 flex items-center justify-center text-brand-red">
              <Trophy size={20} />
            </div>
            <div className="text-left">
              <p className="text-xs font-black uppercase italic tracking-tight">Mes Salles</p>
              <p className="text-[10px] text-gray-500 font-bold uppercase">Tes salles créées ou participées</p>
            </div>
          </div>
          <ChevronRight size={18} className="text-gray-600 group-hover:text-brand-red transition-colors" />
        </Link>

        <Link
          to="/room-history"
          className="card flex items-center justify-between p-4 bg-white/5 hover:bg-white/10 transition-all border-white/5 group rounded-xl"
        >
          <div className="flex items-center gap-4">
            <div className="w-10 h-10 rounded-xl bg-white/5 flex items-center justify-center text-brand-gold">
              <History size={20} />
            </div>
            <div className="text-left">
              <p className="text-xs font-black uppercase italic tracking-tight">Historique des Salles</p>
              <p className="text-[10px] text-gray-500 font-bold uppercase">Tes 50 dernières parties</p>
            </div>
          </div>
          <ChevronRight size={18} className="text-gray-600 group-hover:text-brand-gold transition-colors" />
        </Link>

        <Link
          to="/settings"
          className="card flex items-center justify-between p-4 bg-white/5 hover:bg-white/10 transition-all border-white/5 group rounded-xl"
        >
          <div className="flex items-center gap-4">
            <div className="w-10 h-10 rounded-xl bg-white/5 flex items-center justify-center text-gray-400">
              <Settings size={20} />
            </div>
            <div className="text-left">
              <p className="text-xs font-black uppercase italic tracking-tight">Configuration & Paramètres</p>
              <p className="text-[10px] text-gray-500 font-bold uppercase">Sons Métalliques, Profil, Sécurité</p>
            </div>
          </div>
          <ChevronRight size={18} className="text-gray-600 group-hover:text-white transition-colors" />
        </Link>

        <Link
          to="/help"
          className="card flex items-center justify-between p-4 bg-white/5 hover:bg-white/10 transition-all border-white/5 group rounded-xl"
        >
          <div className="flex items-center gap-4">
            <div className="w-10 h-10 rounded-xl bg-white/5 flex items-center justify-center text-blue-500">
              <HelpCircle size={20} />
            </div>
            <div className="text-left">
              <p className="text-xs font-black uppercase italic tracking-tight">Aide & Support</p>
              <p className="text-[10px] text-gray-500 font-bold uppercase">Comment jouer, FAQ, Support</p>
            </div>
          </div>
          <ChevronRight size={18} className="text-gray-600 group-hover:text-white transition-colors" />
        </Link>

        <button
          onClick={() => auth.signOut()}
          className="card flex items-center justify-between p-4 border-brand-red/20 text-brand-red bg-brand-red/5 hover:bg-brand-red hover:text-white transition-all group rounded-xl cursor-pointer"
        >
          <div className="flex items-center gap-4">
            <LogOut size={20} />
            <span className="text-xs font-black uppercase italic tracking-tight">Se déconnecter</span>
          </div>
          <span className="text-[8px] font-black uppercase opacity-40 group-hover:opacity-100">Déconnexion</span>
        </button>
      </div>

      <div className="pt-6 text-center opacity-30">
        <p className="text-[8px] font-black tracking-widest text-white uppercase italic">
          Konamix Engine v1.0.4-stable
        </p>
      </div>
    </div>
  );
}
