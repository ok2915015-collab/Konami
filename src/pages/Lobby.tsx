import { useEffect, useState } from "react";
import { collection, query, onSnapshot } from "firebase/firestore";
import { db } from "../lib/firebase";
import { Link, useNavigate } from "react-router-dom";
import { Room, Team } from "../types";
import { INITIAL_TEAMS as teams, FALLBACK_LOGO, getMergedTeams } from "../constants/teams";
import { useAuth } from "../contexts/AuthContext";
import { motion } from "motion/react";
import {
  Users,
  Trophy,
  ChevronRight,
  PlusCircle,
  Clock,
  CheckCircle2,
  Crown,
  Search,
  Gamepad2,
  Sparkles,
} from "lucide-react";
import { formatFCFA, cn } from "../lib/utils";

export default function Lobby() {
  const [rooms, setRooms] = useState<Room[]>([]);
  const [teamsList, setTeamsList] = useState<Team[]>(teams);
  const [activeTab, setActiveTab] = useState<"ALL" | "ACTIVE" | "FINISHED" | "CREATED">("ALL");
  const [searchQuery, setSearchQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const { user } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    const unsubTeams = onSnapshot(
      query(collection(db, "teams")),
      (snap) => {
        const loaded = snap.docs.map((d) => ({ id: d.id, ...d.data() }) as Team);
        setTeamsList(getMergedTeams(loaded));
      },
      (err) => {
        console.error("Teams listener error:", err);
        setTeamsList(getMergedTeams([]));
      }
    );
    return unsubTeams;
  }, []);

  useEffect(() => {
    const q = query(collection(db, "rooms"));
    const unsubRooms = onSnapshot(
      q,
      (snap) => {
        const sorted = snap.docs
          .map((doc) => ({ id: doc.id, ...doc.data() }) as Room)
          .sort((a, b) => {
            const timeA = a.createdAt?.toMillis?.() || a.createdAt || 0;
            const timeB = b.createdAt?.toMillis?.() || b.createdAt || 0;
            return timeB - timeA;
          });
        setRooms(sorted);
        try {
          localStorage.setItem("konamix_rooms_cache", JSON.stringify(sorted));
        } catch (e) {}
        setLoading(false);
      },
      (error) => {
        console.warn("Lobby rooms snapshot quota/offline:", error?.message);
        try {
          const cached = localStorage.getItem("konamix_rooms_cache");
          if (cached) setRooms(JSON.parse(cached));
        } catch (e) {}
        setLoading(false);
      }
    );

    return unsubRooms;
  }, []);

  // Strict requirement for "Mes Salles":
  // Salles ouvertes par l'utilisateur OU salles dans lesquelles il participe ou il a participé
  const myRooms = rooms.filter((room) => {
    if (!user) return false;
    const isCreator = room.creatorId === user.uid;
    const isParticipant = Object.values(room.positions || {}).some(
      (p: any) => p?.playerId === user.uid
    );
    return isCreator || isParticipant;
  });

  // Tab filtering
  const filteredMyRooms = myRooms.filter((room) => {
    const isFinished = ["finished", "partie_terminee", "results"].includes(room.status);
    const isCreator = room.creatorId === user?.uid;

    if (activeTab === "ACTIVE" && isFinished) return false;
    if (activeTab === "FINISHED" && !isFinished) return false;
    if (activeTab === "CREATED" && !isCreator) return false;

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      const matchId = room.id.toLowerCase().includes(q);
      const matchLeague = (room.league || "").toLowerCase().includes(q);
      const matchMode = (room.mode || "").toLowerCase().includes(q);
      return matchId || matchLeague || matchMode;
    }

    return true;
  });

  // Statistics counters
  const myActiveRoomsCount = myRooms.filter(
    (r) => !["finished", "partie_terminee", "results"].includes(r.status)
  ).length;

  const myFinishedRoomsCount = myRooms.filter(
    (r) => ["finished", "partie_terminee", "results"].includes(r.status)
  ).length;

  const myCreatedRoomsCount = myRooms.filter((r) => r.creatorId === user?.uid).length;

  const myWonCount = myRooms.filter((r) => r.winnerId === user?.uid).length;

  const getLogo = (t: any) => {
    if (!t) return null;
    const teamId = typeof t === "string" ? t : t.id || t.name;
    const latestTeam = teamsList.find((it) => it.id === teamId || it.name === teamId);
    return latestTeam?.logo || t.logo || FALLBACK_LOGO;
  };

  const renderRoomCard = (room: Room) => {
    const isCreator = room.creatorId === user?.uid;
    const isFinished = ["finished", "partie_terminee", "results"].includes(room.status);
    const isWinner = room.winnerId === user?.uid;
    const playersCount = Object.values(room.positions || {}).filter((p) => (p as any)?.playerId).length;
    const maxPlayers = room.maxPlayers || 7;
    const fillPercent = Math.min(100, (playersCount / maxPlayers) * 100);

    // Find player position key
    const myPosEntry = Object.entries(room.positions || {}).find(
      ([, p]: [string, any]) => p?.playerId === user?.uid
    );
    const myPosKey = myPosEntry ? myPosEntry[0] : null;

    return (
      <motion.div
        key={room.id}
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        className="relative group font-sans"
      >
        <Link
          to={`/room/${room.id}`}
          className={cn(
            "card block border transition-all p-4 sm:p-5 rounded-2xl relative shadow-lg active:scale-[0.99]",
            isWinner
              ? "bg-gradient-to-b from-brand-gold/10 to-[#121212] border-brand-gold/40 hover:border-brand-gold"
              : isFinished
              ? "bg-[#101010] border-white/5 opacity-85 hover:opacity-100 hover:border-white/20"
              : "bg-[#121212] border-white/5 hover:border-brand-red/40"
          )}
        >
          {/* Top badging */}
          <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
            <div className="flex items-center gap-1.5 flex-wrap">
              {isCreator && (
                <span className="bg-brand-gold/20 text-brand-gold border border-brand-gold/30 text-[9px] font-black px-2 py-0.5 rounded-md uppercase flex items-center gap-1">
                  <Crown size={11} /> Créateur
                </span>
              )}
              {myPosKey && (
                <span className="bg-brand-red/20 text-brand-red border border-brand-red/30 text-[9px] font-black px-2 py-0.5 rounded-md uppercase flex items-center gap-1">
                  <Gamepad2 size={11} /> Position {myPosKey}
                </span>
              )}
              {isFinished ? (
                isWinner ? (
                  <span className="bg-green-500/20 text-green-400 border border-green-500/30 text-[9px] font-black px-2 py-0.5 rounded-md uppercase flex items-center gap-1 animate-pulse">
                    <Trophy size={11} /> Victoire Remportée !
                  </span>
                ) : (
                  <span className="bg-white/5 text-gray-400 border border-white/10 text-[9px] font-bold px-2 py-0.5 rounded-md uppercase flex items-center gap-1">
                    <CheckCircle2 size={11} /> Partie Terminée
                  </span>
                )
              ) : (
                <span className="bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 text-[9px] font-black px-2 py-0.5 rounded-md uppercase flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping" />
                  En cours
                </span>
              )}
            </div>

            <span className="text-[11px] font-mono text-gray-400 font-bold">
              #{room.id.slice(-6).toUpperCase()}
            </span>
          </div>

          {/* Mode & League */}
          <div className="flex justify-between items-start mb-3.5">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <span
                  className={cn(
                    "text-[9px] font-black uppercase px-2 py-0.5 rounded",
                    room.mode === "Expert"
                      ? "bg-brand-gold text-black"
                      : room.mode === "Random"
                      ? "bg-blue-500 text-white"
                      : "bg-brand-red text-white"
                  )}
                >
                  {(room.mode || "TOP").toUpperCase()}
                </span>
                <p className="text-sm font-black truncate max-w-[200px] uppercase text-white tracking-tight">
                  {room.league || "Salle Ouverte"}
                </p>
              </div>
            </div>
            <div className="text-right">
              <p className="text-[9px] text-gray-400 font-black uppercase">Mise</p>
              <p className="text-brand-gold font-black italic tracking-tighter text-sm sm:text-base font-mono">
                {formatFCFA(room.stakePerPosition)}
              </p>
            </div>
          </div>

          {/* Positions Slots Preview */}
          <div className="grid grid-cols-7 gap-1.5 mb-3.5">
            {[1, 2, 3, 4, 5, 6, 7].map((num) => {
              const pos = room.positions?.[`P${num}`] || (room.positions as any)?.[num];
              const isOccupied = pos && (pos as any).playerId;
              const isMe = pos && (pos as any).playerId === user?.uid;
              const topLogo = getLogo((pos as any)?.teams?.top);
              const bottomLogo = getLogo((pos as any)?.teams?.bottom);

              return (
                <div key={num} className="flex flex-col items-center gap-1">
                  <span className="text-[9px] font-bold italic text-gray-400">P{num}</span>
                  <div
                    className={cn(
                      "relative w-full aspect-square rounded-lg border flex items-center justify-center p-0.5 transition-colors",
                      isMe
                        ? "bg-brand-red/20 border-brand-red ring-1 ring-brand-red/50 shadow-sm"
                        : isOccupied
                        ? "bg-white/5 border-white/10"
                        : "bg-black/40 border-white/5 opacity-40"
                    )}
                  >
                    {isOccupied ? (
                      <div className="flex flex-col gap-0.5 w-full h-full">
                        <div className="flex-1 bg-black/40 rounded flex items-center justify-center overflow-hidden">
                          {topLogo ? (
                            <img
                              src={topLogo}
                              className="w-full h-full object-contain p-0.5"
                              referrerPolicy="no-referrer"
                              alt=""
                              onError={(e) => {
                                (e.target as HTMLImageElement).src = FALLBACK_LOGO;
                              }}
                            />
                          ) : (
                            <div className="text-[7px] text-gray-500 font-black">?</div>
                          )}
                        </div>
                        <div className="flex-1 bg-black/40 rounded flex items-center justify-center overflow-hidden">
                          {bottomLogo ? (
                            <img
                              src={bottomLogo}
                              className="w-full h-full object-contain p-0.5"
                              referrerPolicy="no-referrer"
                              alt=""
                              onError={(e) => {
                                (e.target as HTMLImageElement).src = FALLBACK_LOGO;
                              }}
                            />
                          ) : (
                            <div className="text-[7px] text-gray-500 font-black">?</div>
                          )}
                        </div>
                      </div>
                    ) : (
                      <span className="text-[8px] text-gray-600 font-bold">-</span>
                    )}
                  </div>
                  <span
                    className={cn(
                      "text-[8px] font-black uppercase truncate w-full text-center",
                      isMe ? "text-brand-gold font-extrabold" : isOccupied ? "text-gray-300" : "text-gray-600"
                    )}
                  >
                    {isMe ? "Moi" : isOccupied ? pos.displayName : "-"}
                  </span>
                </div>
              );
            })}
          </div>

          {/* Cagnotte & Details */}
          <div className="grid grid-cols-2 gap-3 mb-3.5">
            <div className="bg-black/30 rounded-xl p-2.5 border border-white/5 flex flex-col justify-center">
              <p className="text-[8px] text-gray-400 font-black uppercase mb-0.5">
                {isFinished ? "Cagnotte Finale" : "Cagnotte Net (95%)"}
              </p>
              <p className="text-xs sm:text-sm font-black text-white italic font-mono">
                {formatFCFA((room.totalStake || 0) * 0.95)}
              </p>
            </div>
            <div className="bg-black/30 rounded-xl p-2.5 border border-white/5 flex flex-col justify-center">
              <div className="flex justify-between items-center mb-1">
                <p className="text-[8px] text-gray-400 font-black uppercase">
                  {isFinished ? "Vainqueur" : "Remplissage"}
                </p>
                <span className="text-[10px] font-black text-white font-mono">
                  {isFinished ? (room.winnerName || "Joueur") : `${playersCount}/${maxPlayers}`}
                </span>
              </div>
              {!isFinished ? (
                <div className="w-full h-1.5 bg-white/10 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-brand-red transition-all duration-300"
                    style={{ width: `${fillPercent}%` }}
                  />
                </div>
              ) : (
                <p className="text-[9px] text-brand-gold font-bold truncate">
                  Partie clôturée avec succès
                </p>
              )}
            </div>
          </div>

          {/* Footer action */}
          <div className="flex justify-between items-center text-[10px] font-black uppercase italic pt-2 border-t border-white/5">
            <div className="flex items-center gap-1.5 text-gray-400">
              <Users size={12} />
              <span>Créé par {room.creatorDisplayName || "Admin"}</span>
            </div>
            <div className="flex items-center gap-1 font-black text-brand-red group-hover:translate-x-0.5 transition-transform">
              <span>{isFinished ? "Consulter les Résultats" : "Accéder à la Salle"}</span>
              <ChevronRight size={13} strokeWidth={2.5} />
            </div>
          </div>
        </Link>
      </motion.div>
    );
  };

  if (loading) {
    return (
      <div className="py-24 flex flex-col items-center justify-center gap-4">
        <div className="w-10 h-10 border-4 border-brand-red border-t-transparent rounded-full animate-spin" />
        <p className="text-xs font-black uppercase text-gray-500 tracking-wider">
          Chargement de vos salles...
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-5 max-w-5xl mx-auto pb-12">
      {/* Header: Mes Salles */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-gradient-to-r from-brand-gold/10 via-transparent to-brand-red/10 p-4 rounded-2xl border border-white/5">
        <div>
          <div className="flex items-center gap-2">
            <Trophy className="text-brand-gold" size={22} />
            <h1 className="text-xl sm:text-2xl font-black italic tracking-tighter uppercase text-white">
              Mes Salles
            </h1>
            <span className="bg-brand-gold/20 text-brand-gold border border-brand-gold/30 text-[10px] font-black px-2 py-0.5 rounded-full font-mono">
              {myRooms.length}
            </span>
          </div>
          <p className="text-[10px] text-gray-400 uppercase font-bold tracking-wider mt-0.5">
            Salles que vous avez créées ou dans lesquelles vous participez
          </p>
        </div>

        <button
          onClick={() => navigate("/create-room")}
          className="btn-primary py-2.5 px-4 text-xs flex items-center justify-center gap-2 font-black uppercase tracking-wider shrink-0"
        >
          <PlusCircle size={16} />
          Nouvelle Salle
        </button>
      </div>

      {/* Stats overview */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
        <div className="bg-[#121212] border border-white/5 p-3 rounded-xl">
          <p className="text-[9px] uppercase font-bold text-gray-400">Total Salles</p>
          <p className="text-xl font-black text-white font-mono">{myRooms.length}</p>
        </div>
        <div className="bg-[#121212] border border-white/5 p-3 rounded-xl">
          <p className="text-[9px] uppercase font-bold text-emerald-400">En Cours</p>
          <p className="text-xl font-black text-emerald-400 font-mono">{myActiveRoomsCount}</p>
        </div>
        <div className="bg-[#121212] border border-white/5 p-3 rounded-xl">
          <p className="text-[9px] uppercase font-bold text-brand-gold">Mes Créations</p>
          <p className="text-xl font-black text-brand-gold font-mono">{myCreatedRoomsCount}</p>
        </div>
        <div className="bg-[#121212] border border-white/5 p-3 rounded-xl">
          <p className="text-[9px] uppercase font-bold text-yellow-400">Victoires</p>
          <p className="text-xl font-black text-yellow-400 font-mono">{myWonCount}</p>
        </div>
      </div>

      {/* Tabs and Search */}
      <div className="flex flex-col sm:flex-row gap-2.5">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
          <input
            type="text"
            placeholder="Filtrer mes salles par code, ligue, mode..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-[#121212] border border-white/10 rounded-xl py-2.5 pl-10 pr-4 text-xs font-bold text-white placeholder-gray-500 outline-none focus:border-brand-gold transition-all"
          />
        </div>

        <div className="flex gap-1 overflow-x-auto pb-1 scrollbar-none">
          {[
            { key: "ALL", label: "Toutes" },
            { key: "ACTIVE", label: `En cours (${myActiveRoomsCount})` },
            { key: "FINISHED", label: `Terminées (${myFinishedRoomsCount})` },
            { key: "CREATED", label: `Créées (${myCreatedRoomsCount})` },
          ].map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key as any)}
              className={cn(
                "px-3 py-2 rounded-xl text-[10px] font-black uppercase tracking-wider transition-all whitespace-nowrap",
                activeTab === tab.key
                  ? "bg-brand-gold text-black shadow-lg shadow-brand-gold/20 font-extrabold"
                  : "bg-white/5 text-gray-400 hover:bg-white/10 hover:text-white"
              )}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Rooms list */}
      {filteredMyRooms.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {filteredMyRooms.map((room) => renderRoomCard(room))}
        </div>
      ) : (
        <div className="card py-16 bg-white/[0.01] border-dashed border-white/10 text-center p-6 rounded-2xl flex flex-col items-center justify-center space-y-3">
          <div className="w-14 h-14 rounded-full bg-white/5 flex items-center justify-center text-gray-500 mb-1">
            <Trophy size={28} />
          </div>
          <h3 className="text-base font-black uppercase text-white tracking-wide">
            {searchQuery || activeTab !== "ALL"
              ? "Aucune salle trouvée avec ces critères"
              : "Vous n'avez pas encore de salle"}
          </h3>
          <p className="text-xs text-gray-500 max-w-sm">
            {searchQuery || activeTab !== "ALL"
              ? "Essayez de modifier votre filtre ou votre recherche."
              : "Créez votre propre salle ou rejoignez une salle ouverte depuis l'Accueil pour commencer à jouer !"}
          </p>
          <div className="flex flex-wrap gap-2 justify-center pt-2">
            <button
              onClick={() => navigate("/create-room")}
              className="btn-primary text-xs px-4 py-2 font-bold uppercase"
            >
              + Créer une Salle
            </button>
            <button
              onClick={() => navigate("/")}
              className="btn-secondary text-xs px-4 py-2 font-bold uppercase"
            >
              Voir les Salles Ouvertes (Accueil)
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
