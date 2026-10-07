import React, { useState, useEffect, useCallback, useRef } from "react";
import { collection, addDoc, query, where, orderBy, onSnapshot, serverTimestamp, doc, runTransaction, increment } from "firebase/firestore";
import { db } from "../lib/firebase";
import { useAuth } from "../contexts/AuthContext";
import { Transaction } from "../types";
import { formatFCFA, cn } from "../lib/utils";
import { motion, AnimatePresence } from "motion/react";
import { 
  Wallet as WalletIcon, 
  Plus, 
  Minus, 
  ExternalLink, 
  AlertTriangle, 
  CheckCircle2, 
  Clock, 
  XCircle, 
  History, 
  Smartphone, 
  User, 
  Check, 
  Loader2, 
  ShieldCheck,
  Zap,
  Info,
  Volume2,
  VolumeX
} from "lucide-react";
import { toast } from "sonner";

interface WavePack {
  id: string;
  amount: number;
  label: string;
  url: string;
  tag?: string;
}

const WAVE_PACKS: WavePack[] = [
  {
    id: "pack-500",
    amount: 500,
    label: "500 FCFA",
    url: "https://pay.wave.com/m/M_ci_OrEToM3DJILj/c/ci/?amount=500",
    tag: "Débutant",
  },
  {
    id: "pack-1000",
    amount: 1000,
    label: "1 000 FCFA",
    url: "https://pay.wave.com/m/M_ci_OrEToM3DJILj/c/ci/?amount=1000",
  },
  {
    id: "pack-2000",
    amount: 2000,
    label: "2 000 FCFA",
    url: "https://pay.wave.com/m/M_ci_OrEToM3DJILj/c/ci/?amount=2000",
  },
  {
    id: "pack-5000",
    amount: 5000,
    label: "5 000 FCFA",
    url: "https://pay.wave.com/m/M_ci_OrEToM3DJILj/c/ci/?amount=5000",
    tag: "Populaire",
  },
  {
    id: "pack-10000",
    amount: 10000,
    label: "10 000 FCFA",
    url: "https://pay.wave.com/m/M_ci_OrEToM3DJILj/c/ci/?amount=10000",
    tag: "Pro",
  },
  {
    id: "pack-50000",
    amount: 50000,
    label: "50 000 FCFA",
    url: "https://pay.wave.com/m/M_ci_OrEToM3DJILj/c/ci/?amount=50000",
  },
  {
    id: "pack-100000",
    amount: 100000,
    label: "100 000 FCFA",
    url: "https://pay.wave.com/m/M_ci_OrEToM3DJILj/c/ci/?amount=100000",
    tag: "VIP",
  },
];

export default function Wallet() {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState<"deposit" | "withdrawal">("deposit");
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(false);

  // Form State: Deposit (Wave)
  const [selectedPackAmount, setSelectedPackAmount] = useState<number | null>(null);
  const [depositPseudo, setDepositPseudo] = useState(user?.displayName || "");
  const [depositAmount, setDepositAmount] = useState("");
  const [depositTxId, setDepositTxId] = useState("");

  // Audio Guidance State for Deposit
  const [isPlayingAudio, setIsPlayingAudio] = useState(false);
  const audioAutoPlayedRef = useRef(false);

  // Play spoken deposit instructions
  const playDepositAudioGuidance = useCallback(() => {
    if (typeof window === "undefined" || !("speechSynthesis" in window)) {
      toast.info(
        "Important : Après le dépôt Wave, renseignez impérativement votre pseudo, le montant et l'ID de transaction pour faire approuver votre dépôt.",
        { duration: 6000 }
      );
      return;
    }

    try {
      window.speechSynthesis.cancel(); // Cancel any existing speech

      const text =
        "Attention ! Après avoir effectué votre dépôt avec Wave, il est obligatoire de renseigner votre pseudo, le montant et l'identifiant de la transaction dans le formulaire ci-dessous afin que votre dépôt soit approuvé et crédité sur votre compte.";

      const utterance = new SpeechSynthesisUtterance(text);
      utterance.lang = "fr-FR";
      utterance.rate = 0.95;
      utterance.pitch = 1.0;

      // Select French voice if available
      const voices = window.speechSynthesis.getVoices();
      const frenchVoice = voices.find((v) => v.lang.startsWith("fr") || v.lang.includes("FR"));
      if (frenchVoice) {
        utterance.voice = frenchVoice;
      }

      utterance.onstart = () => {
        setIsPlayingAudio(true);
      };
      utterance.onend = () => {
        setIsPlayingAudio(false);
      };
      utterance.onerror = (err) => {
        console.warn("Speech synthesis error:", err);
        setIsPlayingAudio(false);
      };

      window.speechSynthesis.speak(utterance);
    } catch (err) {
      console.warn("Audio playback error:", err);
      setIsPlayingAudio(false);
    }
  }, []);

  const stopDepositAudioGuidance = () => {
    if (typeof window !== "undefined" && "speechSynthesis" in window) {
      window.speechSynthesis.cancel();
      setIsPlayingAudio(false);
    }
  };

  // Trigger audio message automatically when user lands on the deposit tab
  useEffect(() => {
    if (activeTab === "deposit" && !audioAutoPlayedRef.current) {
      audioAutoPlayedRef.current = true;
      const timer = setTimeout(() => {
        playDepositAudioGuidance();
      }, 600);

      return () => {
        clearTimeout(timer);
        stopDepositAudioGuidance();
      };
    }
  }, [activeTab, playDepositAudioGuidance]);

  // Stop audio if user leaves deposit tab
  useEffect(() => {
    if (activeTab !== "deposit") {
      stopDepositAudioGuidance();
    }
    return () => {
      stopDepositAudioGuidance();
    };
  }, [activeTab]);

  // Form State: Withdrawal (Wave)
  const [withdrawAmount, setWithdrawAmount] = useState("");
  const [withdrawPhone, setWithdrawPhone] = useState("");

  // Keep depositPseudo updated with user's displayName if it was empty initially
  useEffect(() => {
    if (user?.displayName && !depositPseudo) {
      setDepositPseudo(user.displayName);
    }
  }, [user?.displayName, depositPseudo]);

  // Real-time listener for user's transactions
  useEffect(() => {
    if (!user) return;
    const q = query(
      collection(db, "transactions"),
      where("userId", "==", user.uid),
      orderBy("createdAt", "desc")
    );
    return onSnapshot(
      q,
      (snap) => {
        setTransactions(snap.docs.map((doc) => ({ id: doc.id, ...doc.data() } as Transaction)));
      },
      (error) => {
        console.error("Wallet transactions listener error:", error);
      }
    );
  }, [user]);

  // Handle clicking a Wave Pack
  const handleSelectPack = (pack: WavePack) => {
    setSelectedPackAmount(pack.amount);
    setDepositAmount(pack.amount.toString());

    // Safely attempt window.open with _blank - NEVER do window.location.href as it kills the app session!
    try {
      window.open(pack.url, "_blank", "noopener,noreferrer");
    } catch (e) {
      console.warn("Could not auto-open wave link:", e);
    }
    toast.success(
      `Pack ${pack.label} sélectionné ! Ouvrez Wave dans un nouvel onglet pour effectuer le paiement.`
    );
  };

  // Submit Deposit
  const handleDepositSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) {
      toast.error("Veuillez vous connecter");
      return;
    }

    const cleanPseudo = depositPseudo.trim();
    if (!cleanPseudo) {
      toast.error("Veuillez renseigner votre Pseudo (obligatoire)");
      return;
    }

    const numAmount = parseInt(depositAmount);
    if (isNaN(numAmount) || numAmount < 500) {
      toast.error("Le montant du dépôt doit être d'au moins 500 FCFA");
      return;
    }

    const cleanTxId = depositTxId.trim();
    if (!cleanTxId) {
      toast.error(
        "L'ID de la transaction Wave est obligatoire ! Sans cet ID, votre compte ne pourra pas être crédité."
      );
      return;
    }

    setLoading(true);
    try {
      await addDoc(collection(db, "transactions"), {
        userId: user.uid,
        userName: cleanPseudo,
        type: "deposit",
        amount: numAmount,
        transactionId: cleanTxId,
        reference: cleanTxId,
        method: "Wave",
        provider: "Wave",
        status: "pending",
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });

      toast.success(
        "Demande de dépôt enregistrée avec succès ! Votre compte sera crédité après validation de la transaction."
      );
      setDepositTxId("");
      setSelectedPackAmount(null);
    } catch (err: any) {
      console.error("Erreur dépot:", err);
      toast.error(err.message || "Erreur lors de l'enregistrement de votre dépôt");
    } finally {
      setLoading(false);
    }
  };

  // Submit Withdrawal
  const handleWithdrawalSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) {
      toast.error("Veuillez vous connecter");
      return;
    }

    const currentBalance = user.balance || 0;

    // Strict requirement: User balance must contain at least 1000 FCFA
    if (currentBalance < 1000) {
      toast.error(
        `Retrait impossible : Votre solde actuel est de ${formatFCFA(currentBalance)}. Un solde minimum de 1 000 FCFA est requis pour effectuer un retrait.`
      );
      return;
    }

    const numAmount = parseInt(withdrawAmount);
    if (isNaN(numAmount) || numAmount < 1000) {
      toast.error("Le montant minimum de retrait est de 1 000 FCFA");
      return;
    }

    if (numAmount > currentBalance) {
      toast.error(`Solde insuffisant ! Votre solde disponible est de ${formatFCFA(currentBalance)}.`);
      return;
    }

    const cleanPhone = withdrawPhone.trim();
    if (!cleanPhone) {
      toast.error("Veuillez renseigner votre numéro de téléphone Wave");
      return;
    }

    setLoading(true);
    try {
      await runTransaction(db, async (transaction) => {
        const userRef = doc(db, "users", user.uid);
        const userDoc = await transaction.get(userRef);
        if (!userDoc.exists()) throw new Error("Compte utilisateur introuvable");
        const freshBalance = userDoc.data().balance || 0;

        if (freshBalance < numAmount) {
          throw new Error(`Solde insuffisant ! Votre solde disponible est de ${formatFCFA(freshBalance)}.`);
        }

        // 1. Débiter immédiatement le solde du joueur pour bloquer/réserver les fonds
        transaction.update(userRef, {
          balance: increment(-numAmount),
        });

        // 2. Créer l'enregistrement de la demande de retrait en attente
        const newTxRef = doc(collection(db, "transactions"));
        transaction.set(newTxRef, {
          userId: user.uid,
          userName: user.displayName || depositPseudo || "Joueur",
          type: "withdrawal",
          amount: numAmount,
          phoneNumber: cleanPhone,
          method: "Wave",
          provider: "Wave",
          status: "pending",
          debitedAtRequest: true,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
      });

      toast.success(
        `Demande de retrait de ${formatFCFA(numAmount)} envoyée avec succès sur le numéro Wave ${cleanPhone} ! (Fonds réservés)`,
      );
      setWithdrawAmount("");
      setWithdrawPhone("");
    } catch (err: any) {
      console.error("Erreur retrait:", err);
      toast.error(err.message || "Erreur lors de la demande de retrait");
    } finally {
      setLoading(false);
    }
  };

  const userBalance = user?.balance || 0;
  const isWithdrawalAllowed = userBalance >= 1000;

  return (
    <div className="space-y-6 pb-24 pt-2 max-w-2xl mx-auto">
      {/* Solde Visual Header */}
      <motion.div
        initial={{ opacity: 0, y: -15 }}
        animate={{ opacity: 1, y: 0 }}
        className="card relative overflow-hidden bg-gradient-to-br from-[#121212] via-[#1a1a1a] to-[#121212] p-6 border-white/10 shadow-2xl rounded-2xl"
      >
        <div className="relative z-10">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[10px] font-black uppercase text-gray-400 tracking-[0.2em]">
              Solde Disponible
            </span>
            <div className="flex items-center gap-1.5 bg-brand-gold/10 border border-brand-gold/20 px-2.5 py-0.5 rounded-full">
              <Zap size={12} className="text-brand-gold" />
              <span className="text-[9px] font-black text-brand-gold uppercase">Paiements Wave</span>
            </div>
          </div>
          <div className="flex items-baseline gap-3">
            <h2 className="text-4xl sm:text-5xl font-black italic tracking-tighter text-white font-mono">
              {formatFCFA(userBalance)}
            </h2>
            <div className="w-2.5 h-2.5 bg-emerald-500 rounded-full animate-pulse shadow-lg shadow-emerald-500/50" />
          </div>
          <p className="text-[10px] text-gray-400 mt-2">
            Rechargez votre compte instantanément par Wave ou retirez vos gains en toute sécurité.
          </p>
        </div>
        <div className="absolute -bottom-4 -right-4 p-4 opacity-5 pointer-events-none text-white">
          <WalletIcon size={140} strokeWidth={1.2} />
        </div>
      </motion.div>

      {/* Tabs Switcher */}
      <div className="flex p-1 bg-black/40 rounded-2xl border border-white/10">
        <button
          onClick={() => setActiveTab("deposit")}
          className={cn(
            "flex-1 py-3 rounded-xl font-black text-xs uppercase tracking-wider transition-all flex items-center justify-center gap-2",
            activeTab === "deposit"
              ? "bg-brand-red text-white shadow-lg shadow-brand-red/20 font-extrabold"
              : "text-gray-400 hover:text-white"
          )}
        >
          <Plus size={16} /> Dépôt Wave
        </button>
        <button
          onClick={() => setActiveTab("withdrawal")}
          className={cn(
            "flex-1 py-3 rounded-xl font-black text-xs uppercase tracking-wider transition-all flex items-center justify-center gap-2",
            activeTab === "withdrawal"
              ? "bg-brand-red text-white shadow-lg shadow-brand-red/20 font-extrabold"
              : "text-gray-400 hover:text-white"
          )}
        >
          <Minus size={16} /> Retrait Wave
        </button>
      </div>

      <AnimatePresence mode="wait">
        {activeTab === "deposit" ? (
          /* ============================================================ */
          /*                       SECTION DÉPÔT                          */
          /* ============================================================ */
          <motion.div
            key="deposit-tab"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.2 }}
            className="space-y-6"
          >
            {/* 🔊 Consigne Audio Obligatoire */}
            <div
              className={cn(
                "p-4 rounded-2xl border transition-all duration-300 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 shadow-lg",
                isPlayingAudio
                  ? "bg-gradient-to-r from-brand-red/20 via-black to-brand-gold/15 border-brand-red/50 ring-1 ring-brand-red/40"
                  : "bg-white/[0.03] border-white/10 hover:border-white/20"
              )}
            >
              <div className="flex items-start gap-3 min-w-0">
                <button
                  type="button"
                  onClick={isPlayingAudio ? stopDepositAudioGuidance : playDepositAudioGuidance}
                  className={cn(
                    "w-10 h-10 rounded-xl flex items-center justify-center shrink-0 transition-all cursor-pointer shadow-md",
                    isPlayingAudio
                      ? "bg-brand-red text-white animate-pulse"
                      : "bg-brand-gold/15 text-brand-gold hover:bg-brand-gold hover:text-black"
                  )}
                  title={isPlayingAudio ? "Arrêter la consigne audio" : "Écouter la consigne audio"}
                >
                  {isPlayingAudio ? <VolumeX size={20} /> : <Volume2 size={20} />}
                </button>
                <div className="space-y-0.5 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] font-black uppercase tracking-wider text-brand-gold flex items-center gap-1.5">
                      <span className={cn("w-2 h-2 rounded-full", isPlayingAudio ? "bg-emerald-400 animate-ping" : "bg-brand-gold")} />
                      {isPlayingAudio ? "Consigne Vocale en cours d'écoute..." : "Consigne Vocale Obligatoire"}
                    </span>
                    {isPlayingAudio && (
                      <span className="flex items-center gap-0.5 text-brand-red">
                        <span className="w-1 h-3 bg-brand-red animate-pulse rounded-full" />
                        <span className="w-1 h-4 bg-brand-gold animate-pulse delay-75 rounded-full" />
                        <span className="w-1 h-2 bg-brand-red animate-pulse delay-150 rounded-full" />
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-white font-medium leading-relaxed">
                    Après votre paiement Wave, renseignez obligatoirement votre <strong>Pseudo</strong>, le <strong>Montant</strong> et <strong>l&apos;ID de transaction Wave</strong> dans le formulaire ci-dessous pour que votre dépôt soit approuvé.
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2 shrink-0 self-end sm:self-center">
                <button
                  type="button"
                  onClick={isPlayingAudio ? stopDepositAudioGuidance : playDepositAudioGuidance}
                  className={cn(
                    "px-3 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-wider transition-all flex items-center gap-1.5 cursor-pointer",
                    isPlayingAudio
                      ? "bg-white/10 hover:bg-white/20 text-white"
                      : "bg-brand-gold text-black hover:bg-yellow-400 shadow-md active:scale-95"
                  )}
                >
                  {isPlayingAudio ? (
                    <>
                      <VolumeX size={13} /> Couper l&apos;audio
                    </>
                  ) : (
                    <>
                      <Volume2 size={13} /> Écouter l&apos;audio
                    </>
                  )}
                </button>
              </div>
            </div>

            {/* Step 1: Credit Packs Wave */}
            <div className="card bg-[#121212] border-white/10 p-5 rounded-2xl space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-black uppercase text-white tracking-wide flex items-center gap-2">
                    <span className="w-5 h-5 rounded-full bg-brand-red text-white text-[10px] flex items-center justify-center font-bold">
                      1
                    </span>
                    Choisissez votre Pack de Crédit
                  </h3>
                  <p className="text-[10px] text-gray-400 mt-0.5">
                    Cliquez sur un pack pour être redirigé vers l&apos;application ou le lien de paiement Wave
                  </p>
                </div>
              </div>

              {/* Grid of Wave Packs */}
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2.5">
                {WAVE_PACKS.map((pack) => {
                  const isSelected = selectedPackAmount === pack.amount;
                  return (
                    <a
                      key={pack.id}
                      href={pack.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      onClick={() => {
                        setSelectedPackAmount(pack.amount);
                        setDepositAmount(pack.amount.toString());
                        toast.success(`Pack ${pack.label} sélectionné ! Le lien Wave s'ouvre dans un nouvel onglet.`);
                      }}
                      className={cn(
                        "relative p-3.5 rounded-xl border text-left transition-all duration-200 group active:scale-95 flex flex-col justify-between min-h-[90px] cursor-pointer",
                        isSelected
                          ? "bg-gradient-to-br from-brand-red/20 to-black border-brand-red ring-1 ring-brand-red shadow-lg"
                          : "bg-white/[0.03] border-white/10 hover:bg-white/[0.06] hover:border-white/20"
                      )}
                    >
                      {pack.tag && (
                        <span className="absolute -top-2 right-2 bg-brand-gold text-black text-[8px] font-black uppercase px-2 py-0.5 rounded-full shadow">
                          {pack.tag}
                        </span>
                      )}
                      <div>
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-[9px] font-black uppercase text-gray-400">Pack Wave</span>
                          <ExternalLink size={12} className="text-gray-500 group-hover:text-white transition-colors" />
                        </div>
                        <p className="text-base sm:text-lg font-black italic tracking-tighter text-white font-mono leading-none">
                          {pack.label}
                        </p>
                      </div>
                      <div className="mt-2 pt-2 border-t border-white/5 flex items-center justify-between text-[9px] font-bold text-brand-gold uppercase">
                        <span className="flex items-center gap-1">
                          Payer Wave <ExternalLink size={10} />
                        </span>
                        <Check size={12} className={cn(isSelected ? "opacity-100 text-emerald-400" : "opacity-0 group-hover:opacity-50")} />
                      </div>
                    </a>
                  );
                })}
              </div>

              {/* Quick Info & Active Pack Helper */}
              {selectedPackAmount && (
                <div className="p-3 bg-brand-gold/10 border border-brand-gold/25 rounded-xl flex items-center justify-between gap-2">
                  <div className="min-w-0">
                    <p className="text-[11px] font-bold text-brand-gold truncate">
                      Pack sélectionné : {formatFCFA(selectedPackAmount)}
                    </p>
                    <p className="text-[9px] text-gray-400">
                      Effectuez le paiement dans l&apos;onglet Wave, puis revenez ici sans fermer cette page.
                    </p>
                  </div>
                  {(() => {
                    const currentPack = WAVE_PACKS.find(p => p.amount === selectedPackAmount);
                    if (!currentPack) return null;
                    return (
                      <div className="flex items-center gap-1.5 shrink-0">
                        <a
                          href={currentPack.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-[9px] font-black uppercase px-2.5 py-1.5 rounded-lg bg-brand-gold text-black hover:bg-yellow-400 flex items-center gap-1"
                        >
                          Ouvrir Wave <ExternalLink size={10} />
                        </a>
                        <button
                          type="button"
                          onClick={() => {
                            navigator.clipboard.writeText(currentPack.url);
                            toast.success("Lien Wave copié dans le presse-papiers !");
                          }}
                          className="text-[9px] font-bold uppercase px-2 py-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-white"
                        >
                          Copier
                        </button>
                      </div>
                    );
                  })()}
                </div>
              )}
            </div>

            {/* Step 2: Confirmation Form */}
            <div className="card bg-[#121212] border-white/10 p-5 rounded-2xl space-y-4">
              <div>
                <h3 className="text-sm font-black uppercase text-white tracking-wide flex items-center gap-2">
                  <span className="w-5 h-5 rounded-full bg-brand-red text-white text-[10px] flex items-center justify-center font-bold">
                    2
                  </span>
                  Validez votre Dépôt
                </h3>
                <p className="text-[10px] text-gray-400 mt-0.5">
                  Renseignez les détails du paiement effectué pour créditer votre compte
                </p>
              </div>

              {/* Warning Callout */}
              <div className="p-3.5 rounded-xl bg-amber-500/10 border border-amber-500/25 flex items-start gap-3">
                <AlertTriangle className="text-amber-400 shrink-0 mt-0.5" size={18} />
                <p className="text-[11px] text-amber-200/90 leading-relaxed font-medium">
                  <strong className="text-amber-300 font-bold uppercase block mb-0.5">
                    Obligatoire pour créditer votre compte :
                  </strong>
                  Après avoir payé via Wave, saisissez votre <strong>Pseudo</strong>, le <strong>Montant</strong> et{" "}
                  <strong>l&apos;ID de transaction Wave</strong> figurant sur votre reçu SMS ou dans l&apos;application Wave.{" "}
                  <em>Sans cet identifiant, votre compte ne pourra pas être crédité.</em>
                </p>
              </div>

              <form onSubmit={handleDepositSubmit} className="space-y-4">
                {/* Champ 1: Pseudo */}
                <div className="space-y-1.5">
                  <label className="text-[10px] font-black uppercase text-gray-300 px-1 flex items-center gap-1.5">
                    <User size={13} className="text-brand-red" />
                    Pseudo Joueur <span className="text-brand-red">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={depositPseudo}
                    onChange={(e) => setDepositPseudo(e.target.value)}
                    placeholder="Entrez votre pseudo"
                    className="w-full bg-black/50 border border-white/10 p-3.5 rounded-xl focus:outline-none focus:border-brand-red text-sm font-bold text-white transition-all"
                  />
                  <p className="text-[9px] text-gray-500 px-1">
                    Votre nom ou pseudo de compte Konamix à créditer.
                  </p>
                </div>

                {/* Champ 2: Montant du dépôt */}
                <div className="space-y-1.5">
                  <label className="text-[10px] font-black uppercase text-gray-300 px-1 flex items-center gap-1.5">
                    <Zap size={13} className="text-brand-gold" />
                    Montant du Dépôt (FCFA) <span className="text-brand-red">*</span>
                  </label>
                  <div className="relative">
                    <input
                      type="number"
                      required
                      min={500}
                      value={depositAmount}
                      onChange={(e) => {
                        setDepositAmount(e.target.value);
                        setSelectedPackAmount(null);
                      }}
                      placeholder="Ex: 5000"
                      className="w-full bg-black/50 border border-white/10 p-3.5 rounded-xl focus:outline-none focus:border-brand-red font-mono font-black text-base text-white transition-all"
                    />
                    <div className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-500 font-black italic text-xs">
                      FCFA
                    </div>
                  </div>
                  <p className="text-[9px] text-gray-500 px-1">
                    Montant minimum 500 FCFA. Il est automatiquement prérempli si vous avez cliqué sur un pack.
                  </p>
                </div>

                {/* Champ 3: ID de la transaction */}
                <div className="space-y-1.5">
                  <label className="text-[10px] font-black uppercase text-gray-300 px-1 flex items-center gap-1.5">
                    <ShieldCheck size={13} className="text-emerald-400" />
                    ID de la Transaction Wave <span className="text-brand-red">* (Indispensable)</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={depositTxId}
                    onChange={(e) => setDepositTxId(e.target.value)}
                    placeholder="Ex: T-123456789 ou Réf de la transaction Wave"
                    className="w-full bg-black/50 border border-brand-gold/30 p-3.5 rounded-xl focus:outline-none focus:border-brand-gold font-mono font-bold text-sm text-brand-gold placeholder-gray-600 transition-all"
                  />
                  <p className="text-[10px] text-brand-gold/90 font-bold px-1">
                    ⚠️ Sans l&apos;ID de la transaction Wave, votre compte ne sera pas crédité.
                  </p>
                </div>

                {/* Submit Deposit */}
                <button
                  type="submit"
                  disabled={loading || !depositTxId.trim() || !depositAmount || !depositPseudo.trim()}
                  className="w-full bg-brand-red hover:bg-brand-red/90 text-white py-4 rounded-xl font-black uppercase italic tracking-wider shadow-lg shadow-brand-red/20 active:scale-[0.99] transition-all disabled:opacity-40 flex items-center justify-center gap-2 text-sm"
                >
                  {loading ? <Loader2 size={18} className="animate-spin" /> : <CheckCircle2 size={18} />}
                  Confirmer et Valider mon Dépôt
                </button>
              </form>
            </div>
          </motion.div>
        ) : (
          /* ============================================================ */
          /*                       SECTION RETRAIT                        */
          /* ============================================================ */
          <motion.div
            key="withdraw-tab"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.2 }}
            className="space-y-6"
          >
            <div className="card bg-[#121212] border-white/10 p-5 sm:p-6 rounded-2xl space-y-5">
              <div>
                <h3 className="text-sm font-black uppercase text-white tracking-wide flex items-center gap-2">
                  <Minus size={16} className="text-brand-red" />
                  Demande de Retrait Wave
                </h3>
                <p className="text-[10px] text-gray-400 mt-0.5">
                  Recevez vos gains directement sur votre compte Wave Mobile Money
                </p>
              </div>

              {/* Balance Verification Banner */}
              {!isWithdrawalAllowed ? (
                <div className="p-4 rounded-xl bg-brand-red/10 border border-brand-red/30 space-y-2">
                  <div className="flex items-center gap-2 text-brand-red font-black text-xs uppercase">
                    <XCircle size={18} />
                    Retrait Indisponible
                  </div>
                  <p className="text-xs text-gray-300 leading-relaxed">
                    Votre solde actuel est de <strong className="text-brand-gold font-mono">{formatFCFA(userBalance)}</strong>.
                    Vous devez disposer d&apos;un <strong>solde minimum de 1 000 FCFA</strong> pour pouvoir envoyer une demande de retrait.
                  </p>
                  <p className="text-[10px] text-gray-500 font-bold uppercase">
                    Gagnez des parties dans les salles ou effectuez un rechargement pour atteindre le seuil de 1 000 FCFA.
                  </p>
                </div>
              ) : (
                <div className="p-3.5 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center gap-2.5">
                  <CheckCircle2 size={18} className="text-emerald-400 shrink-0" />
                  <p className="text-[11px] text-emerald-200">
                    Votre solde est éligible au retrait (<strong className="font-mono text-white">{formatFCFA(userBalance)}</strong> disponible).
                  </p>
                </div>
              )}

              <form onSubmit={handleWithdrawalSubmit} className="space-y-4">
                {/* Montant à retirer */}
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between px-1">
                    <label className="text-[10px] font-black uppercase text-gray-300">
                      Montant à Retirer (FCFA) <span className="text-brand-red">*</span>
                    </label>
                    <span className="text-[10px] text-gray-500 font-mono">
                      Max: {formatFCFA(userBalance)}
                    </span>
                  </div>
                  <div className="relative">
                    <input
                      type="number"
                      required
                      min={1000}
                      max={userBalance}
                      disabled={!isWithdrawalAllowed}
                      value={withdrawAmount}
                      onChange={(e) => setWithdrawAmount(e.target.value)}
                      placeholder="Min. 1000"
                      className="w-full bg-black/50 border border-white/10 p-3.5 rounded-xl focus:outline-none focus:border-brand-red font-mono font-black text-base text-white transition-all disabled:opacity-40 disabled:cursor-not-allowed"
                    />
                    <div className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-500 font-black italic text-xs">
                      FCFA
                    </div>
                  </div>

                  {/* Quick percentage buttons */}
                  {isWithdrawalAllowed && (
                    <div className="flex gap-2 pt-1">
                      {[
                        { label: "Min (1 000 F)", val: 1000 },
                        { label: "5 000 F", val: 5000 },
                        { label: "10 000 F", val: 10000 },
                        { label: "Tout retirer", val: userBalance },
                      ]
                        .filter((btn) => btn.val <= userBalance)
                        .map((btn, idx) => (
                          <button
                            key={idx}
                            type="button"
                            onClick={() => setWithdrawAmount(btn.val.toString())}
                            className="text-[9px] font-black uppercase px-2.5 py-1 rounded-lg bg-white/5 hover:bg-white/10 text-gray-300 border border-white/5 transition-all"
                          >
                            {btn.label}
                          </button>
                        ))}
                    </div>
                  )}
                </div>

                {/* Numéro de téléphone Wave */}
                <div className="space-y-1.5">
                  <label className="text-[10px] font-black uppercase text-gray-300 px-1 flex items-center gap-1.5">
                    <Smartphone size={13} className="text-brand-red" />
                    Numéro de Téléphone Wave <span className="text-brand-red">*</span>
                  </label>
                  <input
                    type="tel"
                    required
                    disabled={!isWithdrawalAllowed}
                    value={withdrawPhone}
                    onChange={(e) => setWithdrawPhone(e.target.value)}
                    placeholder="Ex: 0701020304 ou +225..."
                    className="w-full bg-black/50 border border-white/10 p-3.5 rounded-xl focus:outline-none focus:border-brand-red font-mono font-bold text-sm text-white transition-all disabled:opacity-40 disabled:cursor-not-allowed"
                  />
                  <p className="text-[9px] text-gray-500 px-1">
                    Indiquez le numéro de téléphone associé à votre compte Wave sur lequel vous souhaitez recevoir l&apos;argent.
                  </p>
                </div>

                {/* Submit button */}
                <button
                  type="submit"
                  disabled={loading || !isWithdrawalAllowed || !withdrawAmount || !withdrawPhone.trim()}
                  className="w-full bg-brand-red hover:bg-brand-red/90 text-white py-4 rounded-xl font-black uppercase italic tracking-wider shadow-lg shadow-brand-red/20 active:scale-[0.99] transition-all disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2 text-sm"
                >
                  {loading ? <Loader2 size={18} className="animate-spin" /> : <Minus size={18} />}
                  {!isWithdrawalAllowed
                    ? "Solde minimum de 1 000 FCFA requis"
                    : "Envoyer ma Demande de Retrait"}
                </button>
              </form>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ============================================================ */}
      {/*                 HISTORIQUE DES TRANSACTIONS                  */}
      {/* ============================================================ */}
      <div className="space-y-3 pt-4">
        <div className="flex items-center justify-between px-1">
          <h3 className="text-xs font-black italic text-white flex items-center gap-2 uppercase tracking-wide">
            <History size={15} className="text-brand-red" /> Historique des Opérations
          </h3>
          <span className="text-[9px] font-bold text-gray-500 uppercase font-mono">
            {transactions.length} opération(s)
          </span>
        </div>

        <div className="space-y-2">
          {transactions.length > 0 ? (
            transactions.map((tx) => {
              const isDeposit = tx.type === "deposit";
              const isPending = tx.status === "pending";
              const isApproved = tx.status === "approved";

              return (
                <div
                  key={tx.id}
                  className="card bg-[#121212] border-white/5 p-4 rounded-xl flex items-center justify-between group hover:border-white/20 transition-all"
                >
                  <div className="flex items-center gap-3">
                    <div
                      className={cn(
                        "w-10 h-10 rounded-xl flex items-center justify-center transition-transform group-hover:scale-105 shrink-0",
                        isDeposit ? "bg-emerald-500/10 text-emerald-400" : "bg-brand-red/10 text-brand-red"
                      )}
                    >
                      {isDeposit ? <Plus size={18} /> : <Minus size={18} />}
                    </div>
                    <div className="space-y-0.5">
                      <p className="text-xs font-black uppercase text-white flex items-center gap-1.5">
                        <span>{isDeposit ? "Dépôt Wave" : "Retrait Wave"}</span>
                      </p>
                      <div className="flex flex-wrap items-center gap-2 text-[9px] text-gray-400 font-medium">
                        {tx.transactionId && (
                          <span className="font-mono text-gray-300">ID: {tx.transactionId}</span>
                        )}
                        {tx.phoneNumber && (
                          <span className="font-mono text-gray-300">Tél: {tx.phoneNumber}</span>
                        )}
                        <span>•</span>
                        <span>
                          {tx.createdAt?.seconds
                            ? new Date(tx.createdAt.seconds * 1000).toLocaleString("fr-FR", {
                                day: "2-digit",
                                month: "short",
                                hour: "2-digit",
                                minute: "2-digit",
                              })
                            : "À l'instant"}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="text-right space-y-1">
                    <p
                      className={cn(
                        "text-xs sm:text-sm font-mono font-black",
                        isDeposit ? "text-emerald-400" : "text-brand-red"
                      )}
                    >
                      {isDeposit ? "+" : "-"}
                      {formatFCFA(tx.amount)}
                    </p>
                    <div
                      className={cn(
                        "inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[8px] font-black uppercase tracking-wider",
                        isPending
                          ? "bg-amber-500/10 border border-amber-500/25 text-amber-300 animate-pulse"
                          : isApproved
                          ? "bg-emerald-500/10 border border-emerald-500/25 text-emerald-400"
                          : "bg-red-500/10 border border-red-500/25 text-red-400"
                      )}
                    >
                      {isPending && <Clock size={10} />}
                      {isApproved && <CheckCircle2 size={10} />}
                      {!isPending && !isApproved && <XCircle size={10} />}
                      <span>
                        {isPending ? "En attente" : isApproved ? "Validé" : "Rejeté"}
                      </span>
                    </div>
                  </div>
                </div>
              );
            })
          ) : (
            <div className="card py-10 bg-white/[0.01] border-dashed border-white/10 rounded-2xl flex flex-col items-center justify-center text-gray-500 gap-1.5">
              <History size={24} className="opacity-40" />
              <p className="text-[11px] font-bold uppercase tracking-wider">Aucune transaction pour le moment</p>
              <p className="text-[9px] text-gray-600">Vos dépôts et retraits Wave apparaîtront ici.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
