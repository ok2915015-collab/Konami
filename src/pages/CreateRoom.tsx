import { useState, useEffect, DragEvent, ChangeEvent } from "react";
import {
  collection,
  serverTimestamp,
  getDocs,
  query,
  orderBy,
  doc,
  increment,
  writeBatch,
  onSnapshot,
  updateDoc,
} from "firebase/firestore";
import { db } from "../lib/firebase";
import { INITIAL_TEAMS as teams, FALLBACK_LOGO, getMergedTeams } from "../constants/teams";
import { useAuth } from "../contexts/AuthContext";
import { Mode, Team } from "../types";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "motion/react";
import { playMetallicSound } from "../utils/audio";
import {
  Zap,
  Shuffle,
  ArrowBigUp,
  ArrowBigDown,
  Check,
  Trophy,
  X,
  Repeat,
  Lock,
  Upload,
} from "lucide-react";
import { toast } from "sonner";
import { formatFCFA, cn } from "../lib/utils";

const MODES: {
  id: Mode;
  label: string;
  icon: any;
  desc: string;
  color: string;
}[] = [
  {
    id: "Expert",
    label: "MODE EXPERT",
    icon: Zap,
    desc: "Stratégie pure. Choisissez vos équipes.",
    color: "text-brand-gold",
  },
  {
    id: "Random",
    label: "MODE RANDOM",
    icon: Shuffle,
    desc: "Hasard total.",
    color: "text-blue-400",
  },
  {
    id: "Top",
    label: "MODE TOP",
    icon: ArrowBigUp,
    desc: "Buteurs uniquement.",
    color: "text-green-400",
  },
  {
    id: "Flop",
    label: "MODE FLOP",
    icon: ArrowBigDown,
    desc: "Portiers uniquement.",
    color: "text-brand-red",
  },
];

const STAKES = [100, 500, 1000, 2000, 5000];

export default function CreateRoom() {
  const { user, isAdmin } = useAuth();
  const navigate = useNavigate();
  const [teamsList, setTeamsList] = useState<Team[]>(teams);
  const [mode, setMode] = useState<Mode>("Expert");
  const [stakeInput, setStakeInput] = useState<string>("1000");
  const stake = Number(stakeInput) || 0;
  const [loading, setLoading] = useState(false);
  const [copiedTeam, setCopiedTeam] = useState<Team | null>(null);
  const [selectedPKey, setSelectedPKey] = useState("P1");
  const [creatorDraft, setCreatorDraft] = useState<{
    top: Team | null;
    bottom: Team | null;
  }>({ top: null, bottom: null });

  useEffect(() => {
    const unsub = onSnapshot(
      query(collection(db, "teams"), orderBy("name")),
      (snap) => {
        const loaded = snap.docs.map((d) => ({ id: d.id, ...d.data() }) as Team);
        setTeamsList(getMergedTeams(loaded));
      },
      (err) => {
        console.error("Teams listener error:", err);
        setTeamsList(getMergedTeams([]));
      }
    );
    return unsub;
  }, []);

  const handleCatalogDragStart = (e: DragEvent, team: Team) => {
    e.dataTransfer.setData("teamId", team.id);
    setCopiedTeam(team);
  };

  const handleSlotDrop = (e: DragEvent, slot: "top" | "bottom") => {
    e.preventDefault();
    e.currentTarget.classList.remove("border-brand-red");

    if (mode === "Random") {
      toast.error("Mode Random : vous ne pouvez pas choisir d'équipe.");
      return;
    }

    const isTopLocked =
      (mode === "Top" || mode === "Flop") && !!creatorDraft.bottom;
    const isBottomLocked =
      (mode === "Top" || mode === "Flop") && !!creatorDraft.top;

    if (slot === "top" && isTopLocked) {
      toast.error(
        "Le slot Équipe 1 est verrouillé (mode Top/Flop n'autorise qu'une seule équipe)",
      );
      return;
    }
    if (slot === "bottom" && isBottomLocked) {
      toast.error(
        "Le slot Équipe 2 est verrouillé (mode Top/Flop n'autorise qu'une seule équipe)",
      );
      return;
    }

    const teamId = e.dataTransfer.getData("teamId");
    const team = teamsList.find((t) => t.id === teamId);

    if (team) {
      if (mode === "Top" || mode === "Flop") {
        setCreatorDraft({
          top: slot === "top" ? team : null,
          bottom: slot === "bottom" ? team : null,
        });
      } else {
        setCreatorDraft((prev) => ({ ...prev, [slot]: team }));
      }
      toast.success(
        `${team.name} préparé pour ${selectedPKey} (${slot === "top" ? "Équipe 1" : "Équipe 2"})`,
      );
    }
  };

  const handleSlotClick = (slot: "top" | "bottom", pKey: string) => {
    if (selectedPKey !== pKey) {
      setSelectedPKey(pKey);
    }

    if (mode === "Random") {
      toast.error("Le mode Random attribue automatiquement les deux équipes.");
      return;
    }

    const isTopLocked =
      (mode === "Top" || mode === "Flop") && !!creatorDraft.bottom;
    const isBottomLocked =
      (mode === "Top" || mode === "Flop") && !!creatorDraft.top;

    if (slot === "top" && isTopLocked) {
      toast.error(
        "Le slot Équipe 1 est verrouillé (mode Top/Flop n'autorise qu'une seule équipe)",
      );
      return;
    }
    if (slot === "bottom" && isBottomLocked) {
      toast.error(
        "Le slot Équipe 2 est verrouillé (mode Top/Flop n'autorise qu'une seule équipe)",
      );
      return;
    }

    if (!copiedTeam) {
      toast.info("Sélectionnez d'abord une équipe dans la liste ci-dessous");
      return;
    }

    if (mode === "Top" || mode === "Flop") {
      setCreatorDraft({
        top: slot === "top" ? copiedTeam : null,
        bottom: slot === "bottom" ? copiedTeam : null,
      });
    } else {
      setCreatorDraft((prev) => ({ ...prev, [slot]: copiedTeam }));
    }
    toast.success(
      `${copiedTeam.name} sélectionné pour ${pKey} (${slot === "top" ? "Équipe 1" : "Équipe 2"})`,
    );
    setCopiedTeam(null);
  };

  const handleSwap = () => {
    if (mode === "Random") return;
    setCreatorDraft((prev) => ({ top: prev.bottom, bottom: prev.top }));
    toast.success("Équipes inversées");
  };

  const handleDelete = (slot: "top" | "bottom") => {
    setCreatorDraft((prev) => ({ ...prev, [slot]: null }));
    toast.success(`Équipe ${slot === "top" ? "1" : "2"} retirée`);
  };

  const handleSubmit = async () => {
    if (!user) return;
    const parsedStake = Number(stakeInput) || 0;
    if (parsedStake < 100) {
      toast.error("La mise minimum est de 100 FCFA");
      setStakeInput("100");
      return;
    }
    if (user.balance < parsedStake) {
      toast.error(`Solde insuffisant pour la mise de ${formatFCFA(parsedStake)} (votre solde: ${formatFCFA(user.balance)})`);
      return;
    }

    setLoading(true);
    try {
      const positions: any = {};
      const randomTeam = () => teamsList[Math.floor(Math.random() * teamsList.length)];
      const randomTeamExclude = (excludeId: string) => {
        const filtered = teamsList.filter((t) => t.id !== excludeId);
        return (
          filtered[Math.floor(Math.random() * filtered.length)] || teamsList[0]
        );
      };

      for (let i = 1; i <= 7; i++) {
        const pKey = `P${i}`;
        if (pKey === selectedPKey) {
          let top: Team | null = null;
          let bottom: Team | null = null;

          if (mode === "Expert") {
            top = creatorDraft.top;
            bottom = creatorDraft.bottom;
          } else if (mode === "Random") {
            top = null;
            bottom = null;
          } else if (mode === "Top" || mode === "Flop") {
            const common = creatorDraft.top || creatorDraft.bottom;
            if (!common) {
              toast.error("Veuillez d'abord choisir l'équipe commune");
              setLoading(false);
              return;
            }
            if (creatorDraft.top) {
              top = common;
              bottom = null;
            } else {
              bottom = common;
              top = null;
            }
          }

          positions[pKey] = {
            playerId: user.uid,
            displayName:
              user.displayName || user.email?.split("@")[0] || "Joueur",
            isBot: false,
            teams: { top, bottom },
          };
        } else {
          let top: Team | null = null;
          let bottom: Team | null = null;
          if (mode === "Top" || mode === "Flop") {
            const common = creatorDraft.top || creatorDraft.bottom;
            if (common) {
              top = common;
            }
          }
          positions[`P${i}`] = {
            playerId: null,
            isBot: false,
            teams: { top, bottom },
          };
        }
      }

      const batch = writeBatch(db);
      const roomRef = doc(collection(db, "rooms"));
      const userRef = doc(db, "users", user.uid);

      batch.set(roomRef, {
        creatorId: user.uid,
        creatorDisplayName: user.displayName || user.email?.split("@")[0] || "Joueur",
        league: "Salle Ouverte",
        maxPlayers: 7,
        mode,
        stakePerPosition: parsedStake,
        totalStake: parsedStake * 7,
        status: "created",
        positions,
        secondaryBets: [],
        commission: 0.05,
        isPrivate: false,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });

      batch.update(userRef, { balance: increment(-parsedStake) });

      await batch.commit();
      toast.success(`Salle créée et ${selectedPKey} rejoint !`);
      navigate(`/room/${roomRef.id}`);
    } catch (e) {
      toast.error("Erreur de création");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6 pb-24">
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex items-center justify-between"
      >
        <div>
          <h2 className="text-2xl font-black italic tracking-tighter uppercase text-white">
            CRÉER UNE SALLE
          </h2>
          <p className="text-[9px] text-gray-500 font-bold uppercase tracking-widest">
            Configurez votre salon avant de lancer l'oracle
          </p>
        </div>
        <div className="flex items-center gap-1.5 bg-brand-red/10 border border-brand-red/20 px-3 py-1.5 rounded-2xl">
          <Zap size={12} className="text-brand-red animate-pulse" />
          <span className="text-[9px] font-black text-white italic">KONAMIX ORACLE</span>
        </div>
      </motion.div>

      {/* Main Split Layout: LEFT = Catalog, RIGHT = Config */}
      <div className="grid grid-cols-[1fr_1.25fr] sm:grid-cols-[1fr_1.4fr] lg:grid-cols-[1fr_1.5fr] gap-2 xs:gap-3.5 sm:gap-4 lg:gap-6 items-start">
        
        {/* LEFT COLUMN: Team Selection (Scrollable) */}
        <section className="bg-black/20 p-2 sm:p-4 rounded-3xl border border-white/5 space-y-3 flex flex-col h-[540px] xs:h-[580px] sm:h-[620px] overflow-hidden">
          <div className="flex justify-between items-center pb-1.5 border-b border-white/5 shrink-0">
            <h3 className="text-[8px] xs:text-[9.5px] font-black text-brand-gold uppercase tracking-wider italic flex items-center gap-1 sm:gap-1.5">
              <Trophy size={11} className="sm:w-3.5 sm:h-3.5" /> CHOIX DES ÉQUIPES
            </h3>
            <span className="text-[7px] xs:text-[8px] font-bold text-gray-500 uppercase tracking-wider">
              BASSIN OFFICIEL
            </span>
          </div>

          {/* Vertically scrollable list of Leagues */}
          <div className="flex-1 overflow-y-auto space-y-4 pr-1 scrollbar-thin scrollbar-thumb-white/10">
            {[
              {
                key: "ENG",
                name: "PREMIER LEAGUE",
                gradient: "from-purple-900/40 via-purple-950/20 to-transparent",
                border: "border-purple-500/20 text-purple-300",
              },
              {
                key: "FRA",
                name: "LIGUE 1",
                gradient: "from-blue-900/40 via-blue-950/20 to-transparent",
                border: "border-blue-500/20 text-blue-300",
              },
              {
                key: "ESP",
                name: "LA LIGA",
                gradient: "from-yellow-900/40 via-yellow-950/20 to-transparent",
                border: "border-yellow-500/20 text-yellow-300",
              },
              {
                key: "GER",
                name: "BUNDESLIGA",
                gradient: "from-red-900/40 via-red-950/20 to-transparent",
                border: "border-red-500/20 text-red-300",
              },
              {
                key: "ITA",
                name: "SERIE A",
                gradient: "from-emerald-900/40 via-emerald-950/20 to-transparent",
                border: "border-emerald-500/20 text-emerald-300",
              },
              {
                key: "NED",
                name: "EREDIVISIE",
                gradient: "from-orange-900/40 via-orange-950/20 to-transparent",
                border: "border-orange-500/20 text-orange-300",
              },
              {
                key: "NAT",
                name: "EUROPE",
                gradient: "from-teal-900/40 via-teal-950/20 to-transparent",
                border: "border-teal-500/20 text-teal-300",
              },
              {
                key: "AFR",
                name: "AFRIQUE",
                gradient: "from-amber-900/40 via-amber-950/20 to-transparent",
                border: "border-amber-500/20 text-amber-300",
              },
              {
                key: "SAM",
                name: "S. AMÉRIQUE",
                gradient: "from-cyan-900/40 via-cyan-950/20 to-transparent",
                border: "border-cyan-500/20 text-cyan-300",
              },
              {
                key: "OTHER",
                name: "ASIE",
                gradient: "from-gray-900/40 via-gray-950/20 to-transparent",
                border: "border-gray-500/30 text-gray-400",
              },
            ].map((group) => {
              const matchedTeams = Array.from(
                new Map(
                  teamsList
                    .filter((t) => {
                      if (group.key === "OTHER") {
                        return !["ENG", "FRA", "ESP", "GER", "ITA", "NED", "NAT", "AFR", "SAM"].includes(t.league);
                      }
                      return t.league === group.key;
                    })
                    .map((t) => [t.id, t]),
                ).values(),
              ) as Team[];

              if (matchedTeams.length === 0) return null;

              return (
                <div key={group.key} className="space-y-2">
                  {/* Premium Brand Banner matching screenshot */}
                  <div className={cn(
                    "relative overflow-hidden px-2.5 sm:px-4 py-1 rounded-xl border font-black tracking-wider text-[8px] xs:text-[9.5px] uppercase bg-gradient-to-r",
                    group.gradient,
                    group.border
                  )}>
                    {group.name}
                  </div>

                  {/* Horizontal row of Circular team buttons with micro sizes for maximum density side-by-side */}
                  <div className="flex flex-wrap items-center gap-1.5 xs:gap-2.5 sm:gap-3.5 py-1 px-0.5">
                    {matchedTeams.map((team) => {
                      const isPickedTop = creatorDraft.top?.id === team.id;
                      const isPickedBottom = creatorDraft.bottom?.id === team.id;
                      const isAnyPicked = isPickedTop || isPickedBottom;

                      return (
                        <div
                          key={team.id}
                          onClick={() => {
                            if (mode === "Random") {
                              toast.error("Le mode Random attribue automatiquement les deux équipes.");
                              return;
                            }
                            // Auto assign to first empty slot
                            if (!creatorDraft.top) {
                              setCreatorDraft(p => ({ ...p, top: team }));
                              toast.success(`${team.name} placé dans Équipe 1`);
                            } else if (!creatorDraft.bottom && mode !== "Top" && mode !== "Flop") {
                              setCreatorDraft(p => ({ ...p, bottom: team }));
                              toast.success(`${team.name} placé dans Équipe 2`);
                            } else {
                              setCopiedTeam(team);
                              toast.info(`${team.name} prêt. Cliquez sur un slot pour l'associer`);
                            }
                          }}
                          onMouseEnter={playMetallicSound}
                          className={cn(
                            "w-7 h-7 xs:w-9 xs:h-9 sm:w-11 sm:h-11 rounded-full bg-white border-2 flex items-center justify-center p-1 xs:p-1.5 sm:p-2 transition-all cursor-pointer select-none shrink-0 relative hover:scale-110 active:scale-95 shadow-md",
                            isAnyPicked
                              ? "border-brand-gold shadow-[0_0_12px_rgba(234,179,8,0.35)]"
                              : "border-neutral-900 hover:border-brand-red font-bold"
                          )}
                          title={team.name}
                        >
                          <img
                            src={team.logo || FALLBACK_LOGO}
                            className="max-w-full max-h-full object-contain"
                            alt=""
                            referrerPolicy="no-referrer"
                            onError={(e) => { (e.target as HTMLImageElement).src = FALLBACK_LOGO }}
                          />
                          {isAnyPicked && (
                            <div className="absolute -top-1 -right-1 w-3.5 h-3.5 sm:w-4 sm:h-4 rounded-full bg-brand-gold text-black font-black text-[7px] sm:text-[8.5px] flex items-center justify-center border border-black italic">
                              {isPickedTop ? "1" : "2"}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        </section>

        {/* RIGHT COLUMN: Configuration (Fixed Height Column matching height of Left Selection) */}
        <section className="bg-black/20 p-2 sm:p-4 rounded-3xl border border-white/5 flex flex-col justify-between h-[540px] xs:h-[580px] sm:h-[620px] overflow-hidden">
          
          {/* 1. Game Mode Selection */}
          <div className="space-y-1 shrink-0">
            <span className="text-[7.5px] xs:text-[9px] font-black text-gray-500 uppercase tracking-widest px-1">
              GAME MODE
            </span>
            <div className="grid grid-cols-4 gap-1 sm:gap-1.5">
              {MODES.map((m) => {
                const isActive = mode === m.id;
                return (
                  <button
                    key={m.id}
                    onClick={() => {
                      setMode(m.id);
                      setCreatorDraft({ top: null, bottom: null });
                    }}
                    className={cn(
                      "text-[7px] xs:text-[8px] font-black tracking-wider py-1 sm:py-1.5 rounded-lg sm:rounded-xl border uppercase transition-all shrink-0 cursor-pointer select-none",
                      isActive
                        ? m.id === "Expert" ? "border-brand-gold text-brand-gold bg-brand-gold/10 shadow-[0_0_12px_rgba(234,179,8,0.2)]"
                          : m.id === "Random" ? "border-blue-500 text-blue-400 bg-blue-500/10 shadow-[0_0_12px_rgba(59,130,246,0.2)]"
                          : m.id === "Top" ? "border-green-500 text-green-400 bg-green-500/10 shadow-[0_0_12px_rgba(34,197,94,0.2)]"
                          : "border-rose-500 text-rose-400 bg-rose-500/10 shadow-[0_0_12px_rgba(244,63,94,0.2)]"
                        : "border-white/5 text-gray-400 bg-white/[0.01] hover:border-white/15"
                    )}
                  >
                    {m.id}
                  </button>
                );
              })}
            </div>
          </div>

          {/* 2. Coin chips for Stakes */}
          <div className="space-y-1.5 shrink-0">
            <span className="text-[7.5px] xs:text-[9px] font-black text-gray-500 uppercase tracking-widest px-1">
              BET AMOUNT
            </span>
            <div className="flex items-center justify-between px-1.5 py-0.5 sm:py-1 rounded-2xl border border-white/5 bg-black/10 gap-1 overflow-x-auto scrollbar-none">
              {STAKES.map((s) => {
                const isSelected = stake === s;
                return (
                  <button
                    key={s}
                    type="button"
                    onClick={() => setStakeInput(s.toString())}
                    className={cn(
                      "w-9 h-9 xs:w-11 xs:h-11 sm:w-13 sm:h-13 rounded-full flex flex-col items-center justify-center font-mono transition-all border relative cursor-pointer shadow-lg select-none shrink-0",
                      isSelected
                        ? "bg-gradient-to-b from-brand-gold/25 via-black/90 to-brand-gold/15 border-brand-gold ring-1 ring-brand-gold/30 text-brand-gold scale-105 shadow-[0_0_15px_rgba(234,179,8,0.25)]"
                        : "bg-gradient-to-b from-zinc-700/20 via-black/85 to-zinc-900/20 border-white/10 text-gray-300 hover:border-white/20 hover:scale-102"
                    )}
                  >
                    <span className="text-[8px] xs:text-[9.5px] sm:text-[10px] md:text-[11px] font-black leading-none">{s}</span>
                    <span className="text-[4px] xs:text-[5px] sm:text-[5.5px] font-black text-gray-500 tracking-wider mt-0.5">FCFA</span>
                  </button>
                );
              })}
            </div>
            {/* Custom Input: freely editable, clearable, min 100 FCFA */}
            <div className="px-1 relative flex items-center">
              <input
                type="number"
                min="100"
                step="50"
                value={stakeInput}
                onChange={(e) => setStakeInput(e.target.value)}
                onBlur={() => {
                  const val = Number(stakeInput);
                  if (!stakeInput || isNaN(val) || val < 100) {
                    setStakeInput("100");
                    toast.info("La mise minimum est de 100 FCFA");
                  }
                }}
                className="w-full bg-black/35 border border-white/10 rounded-xl px-3 py-1.5 text-[8px] xs:text-[9.5px] font-mono text-brand-gold font-bold focus:outline-none focus:border-brand-gold/50 text-center placeholder:text-gray-600"
                placeholder="Montant personnalisé (Min. 100 FCFA)"
              />
              {stakeInput && stakeInput !== "100" && (
                <button
                  type="button"
                  onClick={() => setStakeInput("")}
                  className="absolute right-3 text-gray-400 hover:text-white text-[10px] font-black uppercase tracking-tighter"
                  title="Effacer le montant"
                >
                  ✕
                </button>
              )}
            </div>
          </div>

          {/* 3. Non-scrollable Positions P1-P7 header but vertically scrollable body */}
          <div className="flex-1 flex flex-col justify-start space-y-1.5 overflow-hidden">
            <div className="flex justify-between items-center px-1 shrink-0">
              <span className="text-[7.5px] xs:text-[9px] font-black text-gray-400 uppercase tracking-widest leading-none">
                POSITIONS SALLE
              </span>
              <span className="text-[6.5px] xs:text-[8px] font-black italic text-brand-gold shrink-0 leading-none">
                P1-P7 AVEC SWAP
              </span>
            </div>
            
            <div className="space-y-1.5 flex-1 overflow-y-auto overflow-x-auto pb-1.5 pr-1.5 scrollbar-thin scrollbar-thumb-white/10 pt-1 w-full">
              <div className="min-w-max flex flex-col space-y-1.5 pb-1">
                {[1, 2, 3, 4, 5, 6, 7].map((i) => {
                  const pKey = `P${i}`;
                  const isSelected = selectedPKey === pKey;

                  return (
                    <div
                      key={pKey}
                      onClick={() => {
                        if (selectedPKey !== pKey) {
                          setSelectedPKey(pKey);
                        }
                      }}
                      className={cn(
                        "h-[34px] xs:h-[38px] sm:h-[44px] rounded-xl flex items-center px-2 xs:px-3 justify-between transition-all border select-none cursor-pointer shrink-0 min-w-[200px] max-w-[260px] mx-auto",
                        isSelected
                          ? "bg-white/10 border-brand-gold/60 shadow-[0_0_12px_rgba(255,215,0,0.15)] ring-1 ring-brand-gold/35"
                          : "bg-black/35 border-white/10 hover:bg-neutral-800/40 hover:border-white/15"
                      )}
                    >
                    <div className="flex items-center justify-center shrink-0 w-8 h-8 xs:w-10 xs:h-10 sm:w-12 sm:h-12 rounded-lg bg-black/40 border border-white/10 ml-1">
                      <span className={cn(
                        "text-xs xs:text-sm sm:text-lg font-black italic tracking-widest text-center",
                        isSelected ? "text-brand-gold font-black" : "text-white/90 font-bold"
                      )}>
                        {pKey}
                      </span>
                    </div>

                    {/* Slots in the middle/right stretching dynamically */}
                    <div className="flex items-center gap-1.5 sm:gap-2 flex-1 justify-end ml-1.5 xs:ml-3">
                      {mode === "Random" ? (
                        <div className="text-[6.5px] xs:text-[7.5px] sm:text-[8.5px] font-black text-gray-300 uppercase tracking-widest bg-black/40 px-2 py-1.5 rounded-lg border border-white/5">
                          🎲 HASARD
                        </div>
                      ) : (
                        <>
                          {/* Slot 1 Team */}
                          <div
                            onClick={(e) => {
                              if (!isSelected) return;
                              e.stopPropagation();
                              handleSlotClick("top", pKey);
                            }}
                            className={cn(
                              "h-6.5 xs:h-7.5 sm:h-8.5 rounded-lg bg-black/50 border flex items-center justify-center transition-all flex-1 min-w-[40px] max-w-[70px]",
                              isSelected ? "border-white/25 hover:border-brand-gold/50 cursor-pointer bg-white/[0.03]" : "border-white/5 text-gray-500 cursor-default",
                              isSelected && creatorDraft.top ? "bg-white/10 border-white/30 shadow-inner" : ""
                            )}
                          >
                            {isSelected && creatorDraft.top ? (
                              <div className="flex items-center justify-center w-full h-full relative group">
                                <div className="w-5 h-5 xs:w-6 xs:h-6 bg-white border border-black rounded flex items-center justify-center p-0.5 shadow-sm">
                                  <img 
                                    src={creatorDraft.top.logo || FALLBACK_LOGO} 
                                    className="max-w-full max-h-full object-contain shrink-0" 
                                    alt="" 
                                    referrerPolicy="no-referrer" 
                                    onError={(e) => { (e.target as HTMLImageElement).src = FALLBACK_LOGO }}
                                  />
                                </div>
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleDelete("top");
                                  }}
                                  className="absolute -top-1 -right-1 opacity-0 group-hover:opacity-100 bg-red-500 text-white rounded-full p-0.5 shadow-sm transition-all z-10"
                                >
                                  <X size={8} strokeWidth={3} />
                                </button>
                              </div>
                            ) : (
                              <span className="text-[6.5px] xs:text-[7px] text-zinc-300 font-extrabold italic uppercase text-center w-full">
                                Équipe 1
                              </span>
                            )}
                          </div>

                          {/* Swap Button Icon */}
                          <button
                            onClick={(e) => {
                              if (!isSelected) return;
                              e.stopPropagation();
                              handleSwap();
                            }}
                            className={cn(
                              "w-[16px] h-[16px] xs:w-5 xs:h-5 rounded-full flex items-center justify-center transition-all bg-black/50 text-gray-400 shrink-0",
                              isSelected ? "hover:text-brand-gold hover:bg-black border border-white/15 active:scale-90" : "opacity-30 border-transparent cursor-default"
                            )}
                          >
                            <Repeat size={9} />
                          </button>

                          {/* Slot 2 Team */}
                          <div
                            onClick={(e) => {
                              if (!isSelected) return;
                              e.stopPropagation();
                              handleSlotClick("bottom", pKey);
                            }}
                            className={cn(
                              "h-6.5 xs:h-7.5 sm:h-8.5 rounded-lg bg-black/50 border flex items-center justify-center transition-all flex-1 min-w-[40px] max-w-[70px]",
                              isSelected ? "border-white/25 hover:border-brand-gold/50 cursor-pointer bg-white/[0.03]" : "border-white/5 text-gray-500 cursor-default",
                              isSelected && creatorDraft.bottom ? "bg-white/10 border-white/30 shadow-inner" : ""
                            )}
                          >
                            {isSelected && creatorDraft.bottom ? (
                              <div className="flex items-center justify-center w-full h-full relative group">
                                <div className="w-5 h-5 xs:w-6 xs:h-6 bg-white border border-black rounded flex items-center justify-center p-0.5 shadow-sm">
                                  <img 
                                    src={creatorDraft.bottom.logo || FALLBACK_LOGO} 
                                    className="max-w-full max-h-full object-contain shrink-0" 
                                    alt="" 
                                    referrerPolicy="no-referrer" 
                                    onError={(e) => { (e.target as HTMLImageElement).src = FALLBACK_LOGO }}
                                  />
                                </div>
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleDelete("bottom");
                                  }}
                                  className="absolute -top-1 -right-1 opacity-0 group-hover:opacity-100 bg-red-500 text-white rounded-full p-0.5 shadow-sm transition-all z-10"
                                >
                                  <X size={8} strokeWidth={3} />
                                </button>
                              </div>
                            ) : (
                              <span className="text-[6.5px] xs:text-[7px] text-zinc-300 font-extrabold italic uppercase text-center w-full">
                                Équipe 2
                              </span>
                            )}
                          </div>
                        </>
                      )}
                    </div>
                  </div>
                );
              })}
              </div>
            </div>
          </div>

          {/* 4. Action Launch Bar at the bottom of Right Column */}
          <div className="pt-2 shrink-0">
            <button
              disabled={
                loading ||
                (mode === "Expert" &&
                  (!creatorDraft.top || !creatorDraft.bottom)) ||
                ((mode === "Top" || mode === "Flop") &&
                  !creatorDraft.top &&
                  !creatorDraft.bottom)
              }
              onClick={handleSubmit}
              className="w-full h-[42px] sm:h-[46px] rounded-2xl bg-gradient-to-r from-red-600 to-brand-red border border-red-500/30 text-white flex items-center overflow-hidden hover:brightness-110 active:scale-98 transition-all disabled:opacity-30 disabled:pointer-events-none"
            >
              {/* Cost indicator matching screenshot */}
              <div className="w-[38%] h-full bg-black/30 flex flex-col items-center justify-center border-r border-white/10 select-none">
                <span className="text-[6.5px] xs:text-[7.5px] uppercase font-bold text-gray-400 tracking-wider">
                  Coût {selectedPKey}
                </span>
                <span className="text-[9.5px] xs:text-[11px] font-mono font-black text-brand-gold">
                  {formatFCFA(stake >= 100 ? stake : 100)}
                </span>
              </div>
              <div className="flex-1 flex items-center justify-center gap-1 xs:gap-1.5 font-black uppercase text-[8.5px] xs:text-[10px] tracking-wider italic">
                <span>{loading ? "TRAITEMENT..." : "CRÉER LA SALLE"}</span>
                <Zap size={10} className="text-brand-gold animate-bounce" />
              </div>
            </button>
          </div>
        </section>

      </div>
    </div>
  );
}
