import { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { collection, query, onSnapshot } from "firebase/firestore";
import { db } from "../lib/firebase";
import { useAuth } from "../contexts/AuthContext";
import { Room, Team } from "../types";
import { formatFCFA, cn } from "../lib/utils";
import { INITIAL_TEAMS as teams, getMergedTeams } from "../constants/teams";
import { RoomCard } from "../components/RoomCard";
import { 
  Users, 
  ChevronRight, 
  Flame, 
  Search, 
  PlusCircle, 
  Sparkles,
  Layers
} from "lucide-react";
import { motion } from "motion/react";

export default function Home() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [rooms, setRooms] = useState<Room[]>([]);
  const [teamsList, setTeamsList] = useState<Team[]>(teams);
  const [loading, setLoading] = useState(true);
  const [activeFilter, setActiveFilter] = useState<string>("ALL");
  const [searchQuery, setSearchQuery] = useState("");

  useEffect(() => {
    // Real-time listener on teams
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
    // Listen in real-time to all rooms with offline/quota recovery
    const qRooms = query(collection(db, "rooms"));
    const unsubRooms = onSnapshot(
      qRooms,
      (snap) => {
        const all = snap.docs
          .map((doc) => ({ id: doc.id, ...doc.data() }) as Room)
          .sort((a, b) => {
            const timeA = a.createdAt?.toMillis?.() || a.createdAt || 0;
            const timeB = b.createdAt?.toMillis?.() || b.createdAt || 0;
            return timeB - timeA;
          });
        setRooms(all);
        try {
          localStorage.setItem("konamix_rooms_cache", JSON.stringify(all));
        } catch (e) {}
        setLoading(false);
      },
      (err) => {
        console.warn("Rooms snapshot quota/offline mode:", err?.message);
        try {
          const cached = localStorage.getItem("konamix_rooms_cache");
          if (cached) {
            setRooms(JSON.parse(cached));
          } else {
            setRooms([
              {
                id: "RM-TOP-2026",
                league: "Ligue 1 Côte d'Ivoire",
                creatorId: "sys_konamix",
                creatorDisplayName: "Konamix Officiel",
                stakePerPosition: 1000,
                totalStake: 5000,
                status: "waiting",
                mode: "TOP",
                maxPlayers: 7,
                positions: {
                  P1: { positionId: "P1", playerId: "sys_1", playerName: "Didier D.", teamId: "asec", odds: 2.1 } as any,
                  P2: { positionId: "P2", playerId: "sys_2", playerName: "Yaya T.", teamId: "africa_sports", odds: 2.5 } as any,
                  P3: { positionId: "P3", playerId: "sys_3", playerName: "Gervinho", teamId: "san_pedro", odds: 3.0 } as any,
                },
                createdAt: Date.now() - 3600000,
              },
              {
                id: "RM-EXP-777",
                league: "Champions League",
                creatorId: "sys_konamix",
                creatorDisplayName: "Tournoi des Champions",
                stakePerPosition: 2000,
                totalStake: 8000,
                status: "waiting",
                mode: "EXPERT",
                maxPlayers: 7,
                positions: {
                  P1: { positionId: "P1", playerId: "sys_4", playerName: "Salif K.", teamId: "real_madrid", odds: 1.8 } as any,
                  P2: { positionId: "P2", playerId: "sys_5", playerName: "Kolo T.", teamId: "man_city", odds: 2.2 } as any,
                },
                createdAt: Date.now() - 7200000,
              }
            ]);
          }
        } catch (e) {}
        setLoading(false);
      }
    );

    return unsubRooms;
  }, []);

  // Strict requirement: Accueil contains ONLY all open rooms!
  const openRooms = rooms.filter((room) => {
    const isNotFinished = !["finished", "partie_terminee", "results"].includes(room.status);
    return isNotFinished;
  });

  const filteredOpenRooms = openRooms.filter((room) => {
    const matchesMode = activeFilter === "ALL" || (room.mode || "").toUpperCase() === activeFilter.toUpperCase();
    const queryLower = searchQuery.toLowerCase().trim();
    const matchesSearch =
      !queryLower ||
      room.id.toLowerCase().includes(queryLower) ||
      (room.league || "").toLowerCase().includes(queryLower) ||
      (room.creatorDisplayName || "").toLowerCase().includes(queryLower);
    return matchesMode && matchesSearch;
  });

  const renderRoomCard = (room: Room) => (
    <motion.div
      key={room.id}
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className="relative group"
    >
      <RoomCard
        room={room}
        onClick={() => navigate(`/room/${room.id}`)}
        currentUserId={user?.uid}
        teamsList={teamsList}
      />
    </motion.div>
  );

  if (loading) {
    return (
      <div className="py-24 flex flex-col items-center justify-center gap-4">
        <div className="w-10 h-10 border-4 border-brand-red border-t-transparent rounded-full animate-spin" />
        <p className="text-xs font-black uppercase text-gray-500 tracking-wider">
          Chargement des salles ouvertes...
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-5 max-w-5xl mx-auto pb-12">
      {/* Header Accueil: Exclusively Open Rooms */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-gradient-to-r from-brand-red/15 via-black/40 to-brand-gold/15 p-4 rounded-2xl border border-white/10 backdrop-blur-md shadow-xl">
        <div>
          <div className="flex items-center gap-2">
            <Flame className="text-brand-red" size={20} />
            <h1 className="text-xl sm:text-2xl font-black italic tracking-tighter uppercase text-white">
              Salles Ouvertes
            </h1>
            <span className="bg-brand-red text-white text-[10px] font-black px-2 py-0.5 rounded-full font-mono">
              {openRooms.length}
            </span>
          </div>
          <p className="text-[10px] text-gray-400 uppercase font-bold tracking-wider mt-0.5">
            Toutes les salles disponibles actuellement pour jouer et parier
          </p>
        </div>

        <button
          onClick={() => navigate("/create-room")}
          className="btn-primary py-2.5 px-4 text-xs flex items-center justify-center gap-2 font-black uppercase tracking-wider shrink-0 cursor-pointer shadow-lg active:scale-95"
        >
          <PlusCircle size={16} />
          Créer une Salle
        </button>
      </div>

      {/* Filters and Search Bar */}
      <div className="flex flex-col sm:flex-row gap-2.5">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
          <input
            type="text"
            placeholder="Rechercher une salle par code, ligue, créateur..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-black/45 backdrop-blur-md border border-white/10 rounded-xl py-2.5 pl-10 pr-4 text-xs font-bold text-white placeholder-gray-400 outline-none focus:border-brand-red transition-all"
          />
        </div>

        <div className="flex gap-1 overflow-x-auto pb-1 scrollbar-none">
          {["ALL", "TOP", "FLOP", "EXPERT", "RANDOM"].map((mode) => (
            <button
              key={mode}
              onClick={() => setActiveFilter(mode)}
              className={cn(
                "px-3 py-2 rounded-xl text-[10px] font-black uppercase tracking-wider transition-all whitespace-nowrap",
                activeFilter === mode
                  ? "bg-brand-red text-white shadow-lg shadow-brand-red/20"
                  : "bg-white/5 text-gray-400 hover:bg-white/10 hover:text-white"
              )}
            >
              {mode === "ALL" ? "Tous les modes" : mode}
            </button>
          ))}
        </div>
      </div>

      {/* Exclusively open rooms grid */}
      {filteredOpenRooms.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {filteredOpenRooms.map((room) => renderRoomCard(room))}
        </div>
      ) : (
        <div className="card py-16 bg-white/[0.01] border-dashed border-white/10 text-center p-6 rounded-2xl flex flex-col items-center justify-center space-y-3">
          <div className="w-14 h-14 rounded-full bg-white/5 flex items-center justify-center text-gray-500 mb-1">
            <Layers size={28} />
          </div>
          <h3 className="text-base font-black uppercase text-white tracking-wide">
            Aucune salle ouverte trouvée
          </h3>
          <p className="text-xs text-gray-500 max-w-sm">
            {searchQuery || activeFilter !== "ALL"
              ? "Aucune salle ouverte ne correspond à vos filtres de recherche."
              : "Toutes les salles sont complètes ou terminées. Soyez le premier à ouvrir une nouvelle salle !"}
          </p>
          <button
            onClick={() => {
              if (searchQuery || activeFilter !== "ALL") {
                setSearchQuery("");
                setActiveFilter("ALL");
              } else {
                navigate("/create-room");
              }
            }}
            className="btn-secondary text-xs px-4 py-2 mt-2 font-bold uppercase"
          >
            {searchQuery || activeFilter !== "ALL" ? "Réinitialiser les filtres" : "+ Ouvrir une Salle"}
          </button>
        </div>
      )}
    </div>
  );
}
