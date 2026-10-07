import { useState, useEffect } from "react";
import { doc, onSnapshot, updateDoc, collection, query, orderBy, where } from "firebase/firestore";
import { db } from "../../lib/firebase";
import { AppConfig, Room, Position, User } from "../../types";
import { formatFCFA } from "../../lib/utils";
import { 
  Settings, 
  Play, 
  Pause, 
  DollarSign, 
  Target, 
  ShieldCheck, 
  AlertCircle, 
  Trophy, 
  TrendingUp, 
  Swords, 
  History, 
  Eye, 
  Wallet,
  Sparkles,
  Bot,
  Coins,
  BarChart3,
  Filter,
  CheckCircle2,
  RefreshCw,
  Search
} from "lucide-react";
import { toast } from "sonner";
import RoomHistoryModal from "./RoomHistoryModal";

export default function LeverageControl() {
  const [config, setConfig] = useState<AppConfig | null>(null);
  const [rooms, setRooms] = useState<Room[]>([]);
  const [adminUser, setAdminUser] = useState<User | null>(null);
  const [selectedRoomForHistory, setSelectedRoomForHistory] = useState<Room | null>(null);
  const [showHistoryModal, setShowHistoryModal] = useState(false);

  // Filtres pour l'historique des gains
  const [historyFilter, setHistoryFilter] = useState<"all" | "room_pot" | "pvp_duel">("all");
  const [historySearch, setHistorySearch] = useState("");

  useEffect(() => {
    // Écoute de la configuration globale
    const unsubConfig = onSnapshot(
      doc(db, "config", "global"), 
      (snap) => {
        if (snap.exists()) {
          const data = snap.data();
          const mergedConfig = {
            id: "global",
            leverageUsedToday: 0,
            leverageBudget: 1000000,
            autoAcceptAdminPvP: true,
            leveragePayoutTarget: "admin_balance",
            ...data,
            leverageRules: {
              lowFilling: true,
              maxCapacity: true,
              noHighStakes: true,
              offPeak: true,
              lossAlert: 50000,
              ...(data.leverageRules || {})
            }
          } as unknown as AppConfig;
          setConfig(mergedConfig);
        }
      },
      (err) => {
        console.warn("Leverage config quota/offline:", err?.message);
        setConfig(prev => prev || {
          id: "global",
          leverageUsedToday: 0,
          leverageBudget: 1000000,
          leverageEnabled: true,
          autoAcceptAdminPvP: true,
          leveragePayoutTarget: "admin_balance",
          leverageRules: {
            lowFilling: true,
            maxCapacity: true,
            noHighStakes: true,
            offPeak: true,
            lossAlert: 50000,
          }
        } as unknown as AppConfig);
      }
    );

    // Écoute de toutes les salles pour calculer en temps réel les gains et performances des leviers
    const qRooms = query(collection(db, "rooms"), orderBy("createdAt", "desc"));
    const unsubRooms = onSnapshot(
      qRooms, 
      (snap) => {
        const rList = snap.docs.map(d => ({ id: d.id, ...d.data() } as Room));
        setRooms(rList);
        try {
          localStorage.setItem("konamix_rooms_cache", JSON.stringify(rList));
        } catch (e) {}
      },
      (err) => {
        console.warn("Leverage rooms quota/offline:", err?.message);
        try {
          const cached = localStorage.getItem("konamix_rooms_cache");
          if (cached) setRooms(JSON.parse(cached));
        } catch (e) {}
      }
    );

    // Écoute en direct du compte administrateur récepteur (ok2915015@gmail.com)
    const qAdmin = query(collection(db, "users"), where("email", "==", "ok2915015@gmail.com"));
    const unsubAdmin = onSnapshot(
      qAdmin, 
      (snap) => {
        if (!snap.empty) {
          setAdminUser({ uid: snap.docs[0].id, ...snap.docs[0].data() } as User);
        }
      },
      (err) => console.warn("Admin balance listener quota/offline:", err?.message)
    );

    return () => {
      unsubConfig();
      unsubRooms();
      unsubAdmin();
    };
  }, []);

  const updateConfig = async (updates: Partial<AppConfig>) => {
    if (!config) return;
    try {
      await updateDoc(doc(db, "config", "global"), updates);
      toast.success("Configuration mise à jour");
    } catch (e: any) {
      toast.error("Erreur: " + e?.message);
    }
  };

  if (!config) {
    return (
      <div className="p-8 text-center opacity-50 font-black uppercase italic tracking-widest animate-pulse">
        Chargement de la configuration des leviers...
      </div>
    );
  }

  // --- Profils types de Leviers (P1 à P7) ---
  const LEVER_PROFILES: Record<string, { label: string; role: string; color: string }> = {
    P1: { label: "Levier Alpha", role: "Équilibré / Leader", color: "text-amber-400" },
    P2: { label: "Levier Beta", role: "Tactique / Milieu", color: "text-blue-400" },
    P3: { label: "Levier Delta", role: "Favoris Sécurisé", color: "text-cyan-400" },
    P4: { label: "Levier Gamma", role: "Outsider Agressif", color: "text-orange-400" },
    P5: { label: "Levier Titan", role: "Grosses Cotes", color: "text-purple-400" },
    P6: { label: "Levier Hunter", role: "Défis P vs P", color: "text-red-400" },
    P7: { label: "Levier Chrono", role: "Fin de Salle Express", color: "text-emerald-400" },
  };

  const leverStats: Record<string, {
    key: string;
    label: string;
    role: string;
    color: string;
    participations: number;
    roomWins: number;
    pvpWins: number;
    stakes: number;
    winnings: number;
  }> = {};

  Object.entries(LEVER_PROFILES).forEach(([key, info]) => {
    leverStats[key] = {
      key,
      label: info.label,
      role: info.role,
      color: info.color,
      participations: 0,
      roomWins: 0,
      pvpWins: 0,
      stakes: 0,
      winnings: 0,
    };
  });

  // --- Calculs en direct des gains et performances des leviers ---
  let totalLeverageRoomWins = 0;
  let totalLeverageRoomWinnings = 0;
  let totalLeverageStakesEngaged = 0;
  let totalLeveragePvPWins = 0;
  let totalLeveragePvPWinnings = 0;
  let totalLeverageParticipations = 0;

  // Liste des salles avec gains réalisés par un levier
  const leverageWinningEvents: Array<{
    id: string;
    room: Room;
    type: "room_pot" | "pvp_duel";
    amount: number;
    winnerName: string;
    date: Date;
    duelDetails?: string;
  }> = [];

  rooms.forEach((r) => {
    const isFinished = r.status === "finished" || r.status === "partie_terminee";
    const comm = typeof r.commission === "number" ? r.commission : 0.05;
    const netPot = (r.totalStake || 0) * (1 - comm);

    // Positions remplies par un levier dans la salle
    const positions = (r.positions || {}) as Record<string, Position>;
    Object.entries(positions).forEach(([pKey, p]) => {
      const isBot = Boolean(p.isLeverage || p.isBot || p.playerId?.startsWith("BOT_") || p.playerId?.startsWith("LEV_"));
      if (isBot) {
        totalLeverageParticipations += 1;
        const stake = r.stakePerPosition || 0;
        totalLeverageStakesEngaged += stake;

        if (leverStats[pKey]) {
          leverStats[pKey].participations += 1;
          leverStats[pKey].stakes += stake;
        }
      }
    });

    // 1. Victoire de la salle par un levier
    const isBotWinner = Boolean(
      r.winnerIsBot ||
      r.winnerId?.startsWith("BOT_") ||
      r.winnerId?.startsWith("LEV_") ||
      (r.winnerId && r.positions?.[r.winnerId]?.isBot) ||
      (r.winnerId && r.positions?.[r.winnerId]?.isLeverage)
    );

    if (isFinished && isBotWinner) {
      totalLeverageRoomWins += 1;
      totalLeverageRoomWinnings += netPot;

      // Attribuer la victoire au bon levier (PKey ou défaut)
      const winningKey = Object.keys(positions).find(k => positions[k]?.playerId === r.winnerId) || "P1";
      if (leverStats[winningKey]) {
        leverStats[winningKey].roomWins += 1;
        leverStats[winningKey].winnings += netPot;
      }

      leverageWinningEvents.push({
        id: `room_${r.id}`,
        room: r,
        type: "room_pot",
        amount: netPot,
        winnerName: r.winnerName || "Bot Levier Admin",
        date: r.createdAt?.seconds ? new Date(r.createdAt.seconds * 1000) : new Date(),
      });
    }

    // 2. Victoires des leviers dans les duels P vs P
    if (r.challenges && r.challenges.length > 0) {
      r.challenges.forEach((c) => {
        if (c.status === "resolved") {
          const cPos = positions[c.creatorPKey];
          const aPos = positions[c.accepterPKey];
          const isBotC = Boolean(cPos?.isBot || cPos?.isLeverage || c.creatorUid?.startsWith("BOT_") || c.creatorUid?.startsWith("LEV_"));
          const isBotA = Boolean(aPos?.isBot || aPos?.isLeverage || c.accepterUid?.startsWith("BOT_") || c.accepterUid?.startsWith("LEV_"));

          if ((c.winnerPKey === c.creatorPKey && isBotC) || (c.winnerPKey === c.accepterPKey && isBotA)) {
            totalLeveragePvPWins += 1;
            const wonAmount = c.wonAmount || (c.stake * 2);
            totalLeveragePvPWinnings += wonAmount;

            const winningPKey = c.winnerPKey === c.creatorPKey ? c.creatorPKey : c.accepterPKey;
            if (leverStats[winningPKey]) {
              leverStats[winningPKey].pvpWins += 1;
              leverStats[winningPKey].winnings += wonAmount;
            }

            const botName = c.winnerPKey === c.creatorPKey ? c.creatorDisplayName : c.accepterDisplayName;
            const humanName = c.winnerPKey === c.creatorPKey ? c.accepterDisplayName : c.creatorDisplayName;

            leverageWinningEvents.push({
              id: `pvp_${c.id || Math.random().toString(36)}`,
              room: r,
              type: "pvp_duel",
              amount: wonAmount,
              winnerName: `${botName} (Levier Admin)`,
              duelDetails: `Victoire contre ${humanName || "Joueur"} (Mise ${formatFCFA(c.stake)})`,
              date: r.createdAt?.seconds ? new Date(r.createdAt.seconds * 1000) : new Date(),
            });
          }
        }
      });
    }
  });

  const totalLeverageWinnings = totalLeverageRoomWinnings + totalLeveragePvPWinnings;
  const netLeverageProfit = totalLeverageWinnings - totalLeverageStakesEngaged;
  const winRate = totalLeverageParticipations > 0 
    ? Math.round((totalLeverageRoomWins / totalLeverageParticipations) * 100) 
    : 0;

  const roiPercent = totalLeverageStakesEngaged > 0
    ? Math.round((netLeverageProfit / totalLeverageStakesEngaged) * 100)
    : 0;

  const budgetUsedPercent = ((config.leverageUsedToday || 0) / (config.leverageBudget || 1)) * 100;

  const openRoomHistory = (r: Room) => {
    setSelectedRoomForHistory(r);
    setShowHistoryModal(true);
  };

  // Filtrer les événements de gains
  const filteredWinningEvents = leverageWinningEvents.filter((ev) => {
    if (historyFilter === "room_pot" && ev.type !== "room_pot") return false;
    if (historyFilter === "pvp_duel" && ev.type !== "pvp_duel") return false;
    if (historySearch.trim()) {
      const q = historySearch.toLowerCase();
      const matchRoom = ev.room.id.toLowerCase().includes(q);
      const matchWinner = ev.winnerName.toLowerCase().includes(q);
      const matchMode = (ev.room.mode || "").toLowerCase().includes(q);
      return matchRoom || matchWinner || matchMode;
    }
    return true;
  });

  return (
    <div className="space-y-6">
      {/* 🏆 EN-TÊTE : TABLEAU DE BORD DES GAINS & PERFORMANCES DES LEVIERS */}
      <div className="bg-gradient-to-r from-amber-500/15 via-black/60 to-brand-gold/15 p-5 sm:p-7 rounded-3xl border border-brand-gold/35 shadow-2xl space-y-6">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 rounded-2xl bg-gradient-to-tr from-amber-500 to-brand-gold text-brand-black flex items-center justify-center font-black shadow-xl shadow-brand-gold/25 shrink-0">
              <Trophy size={30} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-xl sm:text-2xl font-black italic tracking-tighter uppercase text-white">
                  Gains & Performances des Leviers
                </h2>
                <span className="text-[9px] font-mono px-2.5 py-0.5 rounded-full bg-brand-gold/20 text-brand-gold border border-brand-gold/30 font-black">
                  Actif
                </span>
              </div>
              <p className="text-[10px] text-gray-400 font-bold uppercase tracking-wider mt-0.5">
                Solde total cumulé, rentabilité nette et performances individuelles des bots
              </p>
            </div>
          </div>

          {/* Solde Compte Admin Récepteur */}
          <div className="flex items-center gap-3 bg-black/70 px-4 py-3 rounded-2xl border border-brand-gold/30 shadow-lg">
            <div className="w-10 h-10 rounded-xl bg-brand-gold/15 text-brand-gold flex items-center justify-center shrink-0">
              <Wallet size={20} />
            </div>
            <div>
              <div className="flex items-center gap-1.5">
                <span className="text-[9px] font-bold text-gray-400 uppercase tracking-wider">
                  Solde Compte Administrateur (ok2915015@gmail.com) :
                </span>
              </div>
              <p className="text-base sm:text-lg font-black text-brand-gold font-mono">
                {adminUser ? formatFCFA(adminUser.balance) : "Synchronisation..."}
              </p>
            </div>
          </div>
        </div>

        {/* Cartes Métriques Clés */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
          <div className="bg-black/60 p-4 sm:p-5 rounded-2xl border border-brand-gold/35 space-y-1 shadow-lg relative overflow-hidden">
            <div className="absolute top-0 right-0 w-24 h-24 bg-brand-gold/5 rounded-full blur-2xl pointer-events-none" />
            <p className="text-[9.5px] font-black uppercase text-gray-300 flex items-center gap-1.5">
              <Coins size={14} className="text-brand-gold" /> Solde Total des Gains
            </p>
            <p className="text-2xl sm:text-3xl font-black italic tracking-tighter text-brand-gold font-mono">
              +{formatFCFA(totalLeverageWinnings)}
            </p>
            <p className="text-[8.5px] text-gray-400 font-medium">
              Cagnottes remportées + Duels P vs P
            </p>
          </div>

          <div className="bg-black/60 p-4 sm:p-5 rounded-2xl border border-green-500/35 space-y-1 shadow-lg relative overflow-hidden">
            <div className="absolute top-0 right-0 w-24 h-24 bg-green-500/5 rounded-full blur-2xl pointer-events-none" />
            <p className="text-[9.5px] font-black uppercase text-green-400 flex items-center gap-1.5">
              <TrendingUp size={14} /> Bénéfice Net (Profit Réel)
            </p>
            <p className={`text-2xl sm:text-3xl font-black italic tracking-tighter font-mono ${netLeverageProfit >= 0 ? "text-green-400" : "text-brand-red"}`}>
              {netLeverageProfit >= 0 ? "+" : ""}{formatFCFA(netLeverageProfit)}
            </p>
            <p className="text-[8.5px] text-gray-400 font-medium flex items-center gap-1">
              <span>ROI :</span>
              <strong className={roiPercent >= 0 ? "text-green-400" : "text-brand-red"}>
                {roiPercent >= 0 ? "+" : ""}{roiPercent}%
              </strong>
              <span>après déduction des mises</span>
            </p>
          </div>

          <div className="bg-black/60 p-4 sm:p-5 rounded-2xl border border-blue-500/35 space-y-1 shadow-lg relative overflow-hidden">
            <div className="absolute top-0 right-0 w-24 h-24 bg-blue-500/5 rounded-full blur-2xl pointer-events-none" />
            <p className="text-[9.5px] font-black uppercase text-blue-400 flex items-center gap-1.5">
              <Swords size={14} /> Duels P vs P Remportés
            </p>
            <p className="text-2xl sm:text-3xl font-black italic tracking-tighter text-blue-400 font-mono">
              {totalLeveragePvPWins} victoires
            </p>
            <p className="text-[8.5px] text-gray-400 font-medium font-mono truncate">
              +{formatFCFA(totalLeveragePvPWinnings)} encaissés contre les joueurs
            </p>
          </div>

          <div className="bg-black/60 p-4 sm:p-5 rounded-2xl border border-purple-500/35 space-y-1 shadow-lg relative overflow-hidden">
            <div className="absolute top-0 right-0 w-24 h-24 bg-purple-500/5 rounded-full blur-2xl pointer-events-none" />
            <p className="text-[9.5px] font-black uppercase text-purple-400 flex items-center gap-1.5">
              <Trophy size={14} /> Salles Gagnées (Win Rate)
            </p>
            <p className="text-2xl sm:text-3xl font-black italic tracking-tighter text-purple-400 font-mono">
              {totalLeverageRoomWins} ({winRate}%)
            </p>
            <p className="text-[8.5px] text-gray-400 font-medium">
              Sur {totalLeverageParticipations} positions jouées par les leviers
            </p>
          </div>
        </div>

        {/* 📊 DÉCOMPOSITION DES PERFORMANCES PAR PROFIL DE LEVIER */}
        <div className="bg-black/60 p-4 sm:p-5 rounded-2xl border border-white/10 space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-xs sm:text-sm font-black uppercase italic tracking-wider text-white flex items-center gap-2">
              <BarChart3 size={16} className="text-brand-gold" />
              Performances Détaillées par Profil de Levier (Alpha, Beta, Delta...)
            </h3>
            <span className="text-[9px] font-bold text-gray-400 uppercase">
              7 Niveaux de Leviers Déployés
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3 pt-1">
            {Object.values(leverStats).map((bot) => {
              const botWinRate = bot.participations > 0 ? Math.round((bot.roomWins / bot.participations) * 100) : 0;
              const botNet = bot.winnings - bot.stakes;
              return (
                <div 
                  key={bot.key}
                  className="bg-white/[0.02] hover:bg-white/[0.05] p-3.5 rounded-2xl border border-white/5 space-y-2.5 transition-all"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="w-6 h-6 rounded-lg bg-white/10 flex items-center justify-center font-mono font-bold text-xs text-white">
                        {bot.key}
                      </span>
                      <div>
                        <h4 className="text-xs font-black text-white uppercase">{bot.label}</h4>
                        <p className={`text-[8px] font-bold uppercase ${bot.color}`}>{bot.role}</p>
                      </div>
                    </div>
                    <span className="text-[9px] font-mono font-bold px-2 py-0.5 rounded-md bg-white/5 text-gray-300">
                      {botWinRate}% WR
                    </span>
                  </div>

                  <div className="grid grid-cols-2 gap-1.5 text-[9px] pt-1 border-t border-white/5">
                    <div>
                      <span className="text-gray-500 font-medium">Matchs :</span>
                      <strong className="text-white ml-1 font-mono">{bot.participations}</strong>
                    </div>
                    <div>
                      <span className="text-gray-500 font-medium">Victoires :</span>
                      <strong className="text-green-400 ml-1 font-mono">{bot.roomWins + bot.pvpWins}</strong>
                    </div>
                    <div className="col-span-2 flex justify-between items-center pt-1 border-t border-white/5">
                      <span className="text-gray-500 font-medium">Gains cumulés :</span>
                      <strong className="text-brand-gold font-mono font-bold">+{formatFCFA(bot.winnings)}</strong>
                    </div>
                    <div className="col-span-2 flex justify-between items-center">
                      <span className="text-gray-500 font-medium">Bénéfice Net :</span>
                      <strong className={`font-mono font-bold ${botNet >= 0 ? "text-green-400" : "text-brand-red"}`}>
                        {botNet >= 0 ? "+" : ""}{formatFCFA(botNet)}
                      </strong>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* 📜 HISTORIQUE DES CAGNOTTES & GAINS ENCAISSÉS PAR LES LEVIERS */}
        <div className="bg-black/50 p-4 sm:p-5 rounded-2xl border border-white/10 space-y-3.5">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h3 className="text-xs sm:text-sm font-black uppercase italic tracking-wider text-white flex items-center gap-2">
                <History size={16} className="text-brand-gold" />
                Historique des Cagnottes & Gains Encaissés par les Leviers ({leverageWinningEvents.length})
              </h3>
              <p className="text-[9px] text-gray-400 font-bold uppercase mt-0.5">
                Chaque gain est directement crédité sur le compte administrateur
              </p>
            </div>

            {/* Filtres de Gains */}
            <div className="flex items-center gap-2">
              <div className="flex bg-black/60 p-1 rounded-xl border border-white/10 text-[9px] font-black">
                <button
                  type="button"
                  onClick={() => setHistoryFilter("all")}
                  className={`px-2.5 py-1 rounded-lg transition-all cursor-pointer ${
                    historyFilter === "all" ? "bg-brand-gold text-brand-black shadow" : "text-gray-400 hover:text-white"
                  }`}
                >
                  Tous ({leverageWinningEvents.length})
                </button>
                <button
                  type="button"
                  onClick={() => setHistoryFilter("room_pot")}
                  className={`px-2.5 py-1 rounded-lg transition-all cursor-pointer ${
                    historyFilter === "room_pot" ? "bg-brand-gold text-brand-black shadow" : "text-gray-400 hover:text-white"
                  }`}
                >
                  Salles ({totalLeverageRoomWins})
                </button>
                <button
                  type="button"
                  onClick={() => setHistoryFilter("pvp_duel")}
                  className={`px-2.5 py-1 rounded-lg transition-all cursor-pointer ${
                    historyFilter === "pvp_duel" ? "bg-brand-gold text-brand-black shadow" : "text-gray-400 hover:text-white"
                  }`}
                >
                  Duels P vs P ({totalLeveragePvPWins})
                </button>
              </div>
            </div>
          </div>

          {filteredWinningEvents.length === 0 ? (
            <div className="py-8 text-center text-gray-500 space-y-1.5 border border-dashed border-white/5 rounded-2xl">
              <Bot size={28} className="mx-auto opacity-30 text-brand-gold" />
              <p className="text-xs font-bold uppercase tracking-wider text-gray-400">Aucun gain de levier enregistré pour l'instant</p>
              <p className="text-[9px] text-gray-500">Dès qu'un bot levier remporte une salle ou un duel contre un joueur, le gain apparaîtra ici avec tous les détails.</p>
            </div>
          ) : (
            <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
              {filteredWinningEvents.map((ev) => (
                <div 
                  key={ev.id}
                  className="bg-white/[0.02] hover:bg-white/[0.05] p-3.5 rounded-2xl border border-white/5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 transition-colors"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <span className="w-2.5 h-2.5 rounded-full bg-green-500 shrink-0 shadow-sm shadow-green-500/50" />
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-black text-white uppercase truncate">
                          {ev.winnerName}
                        </span>
                        <span className={`text-[8px] font-black uppercase px-2 py-0.5 rounded-full ${
                          ev.type === "room_pot" 
                            ? "bg-brand-gold/20 text-brand-gold border border-brand-gold/30" 
                            : "bg-blue-500/20 text-blue-400 border border-blue-500/30"
                        }`}>
                          {ev.type === "room_pot" ? "Cagnotte de Salle" : "Duel P vs P"}
                        </span>
                      </div>
                      <p className="text-[9.5px] text-gray-400 font-mono mt-0.5">
                        Salle #{ev.room.id.slice(0, 8)} • Mode: {ev.room.mode} • {ev.date.toLocaleString()}
                        {ev.duelDetails && (
                          <span className="text-gray-300 ml-1 font-sans">
                            • {ev.duelDetails}
                          </span>
                        )}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-3 shrink-0 self-end sm:self-auto">
                    <span className="font-mono font-black text-sm text-brand-gold">
                      +{formatFCFA(ev.amount)}
                    </span>
                    <button
                      type="button"
                      onClick={() => openRoomHistory(ev.room)}
                      className="flex items-center gap-1 px-3 py-1.5 rounded-xl bg-white/5 hover:bg-brand-gold hover:text-brand-black text-gray-300 text-[9.5px] font-black uppercase transition-all cursor-pointer border border-white/10 hover:border-brand-gold shadow-sm active:scale-95"
                      title="Voir l'historique complet de cette salle"
                    >
                      <Eye size={13} />
                      <span>Historique</span>
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* --- RESTE DES CONTRÔLES DU LEVIER (Configuration & Automatisation) --- */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Configuration Status & Budget */}
        <div className="space-y-6">
          <div className="card bg-white/[0.02] border-brand-gold/20 flex items-center justify-between p-6">
            <div className="flex items-center gap-4">
              <div className={`w-12 h-12 rounded-2xl flex items-center justify-center shadow-xl ${config.leverageEnabled ? 'bg-green-500/10 text-green-500' : 'bg-brand-red/10 text-brand-red'}`}>
                <Settings className={config.leverageEnabled ? "animate-spin-slow" : ""} size={28} />
              </div>
              <div>
                 <h3 className="text-xl font-black italic tracking-tighter uppercase">Statut du Levier</h3>
                 <p className="text-xs text-gray-400 font-bold uppercase">{config.leverageEnabled ? 'Activé et Prêt' : 'Désactivé'}</p>
              </div>
            </div>
            <button 
               onClick={() => updateConfig({ leverageEnabled: !config.leverageEnabled })}
               className={`px-6 py-3 rounded-xl font-black text-xs flex items-center gap-2 shadow-lg transition-all active:scale-95 cursor-pointer ${config.leverageEnabled ? 'bg-brand-red text-white shadow-brand-red/20' : 'bg-green-500 text-white shadow-green-500/20'}`}
            >
              {config.leverageEnabled ? <><Pause size={16} /> DÉSACTIVER</> : <><Play size={16} /> ACTIVER</>}
            </button>
          </div>

          <div className="card space-y-4">
            <h3 className="text-xs font-black uppercase tracking-widest text-gray-500 flex items-center gap-2">
              <DollarSign size={14} /> Budget Quotidien
            </h3>
            <div className="space-y-2">
              <div className="flex justify-between items-end">
                <div>
                  <p className="text-[10px] font-bold text-gray-400 uppercase">Utilisé aujourd'hui</p>
                  <p className="text-2xl font-black italic tracking-tighter text-brand-gold">{formatFCFA(config.leverageUsedToday)}</p>
                </div>
                <div className="text-right">
                  <p className="text-[10px] font-bold text-gray-400 uppercase">Budget Max</p>
                  <p className="text-lg font-black italic tracking-tighter opacity-50">{formatFCFA(config.leverageBudget)}</p>
                </div>
              </div>
              <div className="h-2 bg-white/5 rounded-full overflow-hidden">
                <div 
                   className="h-full bg-brand-gold transition-all duration-500"
                   style={{ width: `${Math.min(100, budgetUsedPercent)}%` }}
                />
              </div>
            </div>

            <div className="pt-2 flex gap-2">
               <button 
                  onClick={() => updateConfig({ leverageBudget: (config.leverageBudget || 1000000) + 500000 })}
                  className="flex-1 py-2 bg-white/5 rounded-lg text-[10px] font-black uppercase hover:bg-white/10"
               >
                 +500K Budget
               </button>
               <button 
                  onClick={() => updateConfig({ leverageUsedToday: 0 })}
                  className="flex-1 py-2 bg-white/5 rounded-lg text-[10px] font-black uppercase hover:bg-white/10 text-brand-gold"
               >
                 Reset Conso
               </button>
            </div>
          </div>

          {/* Règle P vs P Admin */}
          <div className="card space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-xs font-black uppercase tracking-widest text-white flex items-center gap-2">
                  <Swords size={16} className="text-brand-red" /> Acceptation Auto des Duels P vs P
                </h3>
                <p className="text-[9px] text-gray-500 font-bold uppercase mt-0.5">
                  Quand un utilisateur défie le levier / compte admin
                </p>
              </div>

              <button
                type="button"
                onClick={() => updateConfig({ autoAcceptAdminPvP: !config.autoAcceptAdminPvP })}
                className={`px-4 py-2 rounded-xl text-xs font-black uppercase transition-all cursor-pointer ${
                  config.autoAcceptAdminPvP !== false
                    ? "bg-green-500/20 text-green-400 border border-green-500/40"
                    : "bg-brand-red/20 text-brand-red border border-brand-red/40"
                }`}
              >
                {config.autoAcceptAdminPvP !== false ? "ACTIVÉ" : "DÉSACTIVÉ"}
              </button>
            </div>
            <p className="text-[9px] text-gray-400 font-medium leading-relaxed bg-black/40 p-3 rounded-xl border border-white/5">
              {config.autoAcceptAdminPvP !== false 
                ? "✅ Lorsqu'un joueur lance un pari P vs P contre une position remplie par l'admin (bot/levier), le solde de l'administrateur est automatiquement débité de la mise pour répondre au défi et le valider instantanément. Si le bot gagne, 2x la mise est reversée à l'admin."
                : "⛔ DÉSACTIVÉ : Les joueurs ne peuvent pas lancer de défi P vs P contre les positions occupées par l'admin. Tout pari ciblant l'admin sera refusé."}
            </p>
          </div>
        </div>

        {/* Automation Rules */}
        <div className="card space-y-6">
          <div>
            <h3 className="text-sm font-black italic uppercase tracking-tighter flex items-center gap-2 text-brand-gold">
              <Target size={18} /> Règles Automatiques
            </h3>
            <p className="text-[10px] text-gray-500 font-bold uppercase mt-1">Le système jouera automatiquement si :</p>
          </div>

          <div className="space-y-3">
            <RuleItem 
               active={config.leverageRules?.lowFilling}
               label="Remplissage < 50%" 
               desc="Le levier s'active si la salle stagne à moins de la moitié."
               onToggle={() => updateConfig({ leverageRules: { ...config.leverageRules, lowFilling: !config.leverageRules.lowFilling } })}
            />
            <RuleItem 
               active={config.leverageRules?.maxCapacity}
               label="Max 30% de capacité" 
               desc="Le levier ne peut pas occuper plus de 2 positions sur 7."
               onToggle={() => updateConfig({ leverageRules: { ...config.leverageRules, maxCapacity: !config.leverageRules.maxCapacity } })}
            />
            <RuleItem 
               active={config.leverageRules?.noHighStakes}
               label="Ne pas jouer Top > 50K" 
               desc="Éviter les pertes massives sur les modes risqués."
               onToggle={() => updateConfig({ leverageRules: { ...config.leverageRules, noHighStakes: !config.leverageRules.noHighStakes } })}
            />
            <RuleItem 
               active={config.leverageRules?.offPeak}
               label="Heures creuses uniquement" 
               desc="S'active surtout entre 23h et 08h."
               onToggle={() => updateConfig({ leverageRules: { ...config.leverageRules, offPeak: !config.leverageRules.offPeak } })}
            />
          </div>

          <div className="bg-brand-red/10 border border-brand-red/30 p-4 rounded-xl space-y-3">
             <div className="flex items-start gap-3">
                <AlertCircle className="text-brand-red shrink-0 mt-0.5" size={18} />
                <div>
                   <p className="text-[10px] font-black text-brand-red uppercase">Alerte de Perte</p>
                   <p className="text-[9px] text-gray-400 font-bold leading-relaxed mt-1">
                     Le système se coupera automatiquement si les pertes du levier dépassent le seuil défini par jour.
                   </p>
                </div>
             </div>
             <div className="flex gap-2">
                <input 
                   type="number"
                   defaultValue={config.leverageRules?.lossAlert}
                   onBlur={(e) => updateConfig({ leverageRules: { ...config.leverageRules, lossAlert: parseInt(e.target.value) } })}
                   className="flex-1 bg-black/40 border border-white/10 rounded-lg px-3 py-1.5 text-[10px] outline-none focus:border-brand-red font-mono"
                   placeholder="Seuil d'alerte (FCFA)..."
                />
             </div>
          </div>
        </div>
      </div>

      {/* Modal d'Inspection de l'Historique de Salle */}
      <RoomHistoryModal 
        isOpen={showHistoryModal}
        onClose={() => setShowHistoryModal(false)}
        room={selectedRoomForHistory}
      />
    </div>
  );
}

function RuleItem({ label, desc, active, onToggle }: { label: string, desc: string, active: boolean, onToggle: () => void }) {
  return (
    <div 
      onClick={onToggle}
      className={`p-4 rounded-xl border flex items-start gap-3 transition-all cursor-pointer hover:scale-[1.02] active:scale-[0.98] ${active ? 'bg-white/5 border-brand-gold/20' : 'bg-black/20 border-white/5 opacity-50'}`}
    >
      <div className={`mt-1 w-4 h-4 rounded-full flex items-center justify-center ${active ? 'bg-brand-gold text-brand-black' : 'bg-gray-800 text-gray-600'}`}>
        <ShieldCheck size={12} />
      </div>
      <div className="flex-1">
        <div className="flex justify-between items-center">
          <h4 className="text-[10px] font-black uppercase tracking-tight">{label}</h4>
          <div className={`text-[8px] font-black uppercase tracking-widest px-1.5 py-0.5 rounded ${active ? 'bg-brand-gold/20 text-brand-gold' : 'bg-white/5 text-gray-500'}`}>
            {active ? 'ACTIF' : 'INACTIF'}
          </div>
        </div>
        <p className="text-[9px] text-gray-500 font-bold leading-tight mt-1">{desc}</p>
      </div>
    </div>
  );
}
