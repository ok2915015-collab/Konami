import React, { useState, useEffect } from "react";
import { useSearchParams, Navigate, useNavigate } from "react-router-dom";
import { collection, query, orderBy, limit, onSnapshot } from "firebase/firestore";
import { db } from "../lib/firebase";
import { useAuth } from "../contexts/AuthContext";
import { Room, Team } from "../types";
import { formatFCFA, cn } from "../lib/utils";
import { RoomCard } from "../components/RoomCard";
import { INITIAL_TEAMS as teams, getMergedTeams } from "../constants/teams";
import LoginPage from "../components/auth/LoginPage";
import SignupPage from "../components/auth/SignupPage";
import OTPVerification from "../components/auth/OTPVerification";
import ForgotPassword from "../components/auth/ForgotPassword";
import { AnimatePresence, motion } from "motion/react";
import { 
  Trophy, 
  Flame, 
  LogIn, 
  UserPlus, 
  Zap, 
  Search, 
  Filter, 
  ChevronRight, 
  ShieldCheck, 
  Smartphone,
  X,
  Sparkles,
  ArrowRight
} from "lucide-react";
import { toast } from "sonner";

type AuthScreen = "login" | "signup" | "otp" | "forgot-password";

interface ActivityNews {
  id: string;
  message: string;
  time: Date;
  type: "win" | "create" | "join";
}

export default function Auth() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();

  // Auth Screen State
  const [screen, setScreen] = useState<AuthScreen>("login");
  const [phoneForOTP, setPhoneForOTP] = useState("");
  const [otpType, setOtpType] = useState<"signup" | "reset">("signup");

  // Mobile View Tab Controller: "rooms" (live sportsbook lobby) vs "auth" (form)
  const [mobileTab, setMobileTab] = useState<"rooms" | "auth">("rooms");
  const [showMobileAuthDrawer, setShowMobileAuthDrawer] = useState(false);

  // Selected room when visitor clicks "Rejoindre la salle"
  const [selectedRoom, setSelectedRoom] = useState<Room | null>(null);

  // Rooms and Feed Data
  const [allRooms, setAllRooms] = useState<Room[]>([]);
  const [teamsList, setTeamsList] = useState<Team[]>(teams);
  const [newsFeed, setNewsFeed] = useState<ActivityNews[]>([]);
  const [loading, setLoading] = useState(true);

  // Real-time Firestore teams listener
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

  // Filters (Betclic / 1xBet style)
  const [stakeFilter, setStakeFilter] = useState<"all" | "500" | "1000" | "2000" | "5000+">("all");
  const [searchQuery, setSearchQuery] = useState("");

  const refCode = searchParams.get("ref");

  useEffect(() => {
    const modeParam = searchParams.get("mode");
    if (modeParam === "signup") {
      setScreen("signup");
      setMobileTab("auth");
    } else if (modeParam === "login") {
      setScreen("login");
      setMobileTab("auth");
    }
  }, [searchParams]);

  // Real-time Firestore rooms listener (matches Home.tsx)
  useEffect(() => {
    const qRooms = query(collection(db, "rooms"));

    const unsubscribe = onSnapshot(
      qRooms,
      (snap) => {
        const parsedRooms = snap.docs
          .map((doc) => ({ id: doc.id, ...doc.data() } as Room))
          .sort((a, b) => {
            const timeA = a.createdAt?.toMillis?.() || a.createdAt || a.updatedAt?.toMillis?.() || 0;
            const timeB = b.createdAt?.toMillis?.() || b.createdAt || b.updatedAt?.toMillis?.() || 0;
            return timeB - timeA;
          });
        setAllRooms(parsedRooms);

        const realNews: ActivityNews[] = [];
        parsedRooms.forEach((room) => {
          const roomCode = room.id.slice(-4).toUpperCase();
          const updatedAtDate = room.updatedAt?.toDate?.() || room.createdAt?.toDate?.() || new Date();

          if (room.status === "finished" || room.status === "partie_terminee" || room.status === "results") {
            let winnerName = room.winnerName;
            if (!winnerName && room.winnerId) {
              const winnerPos = Object.values(room.positions || {}).find((p) => p.playerId === room.winnerId);
              winnerName = winnerPos?.displayName;
            }
            const cleanWinner = winnerName || "Joueur d'Élite";
            const totalWinAmount = (room.totalStake || 0) * 0.95;

            realNews.push({
              id: `win-${room.id}`,
              message: `🏆 ${cleanWinner} a remporté ${formatFCFA(totalWinAmount)} sur la Salle #${roomCode} !`,
              time: updatedAtDate,
              type: "win",
            });
          } else if (room.createdAt) {
            const creator = room.creatorDisplayName || "Un parieur";
            realNews.push({
              id: `create-${room.id}`,
              message: `🔥 ${creator} a ouvert la Salle #${roomCode} (Mise ${formatFCFA(room.stakePerPosition)}) !`,
              time: room.createdAt?.toDate?.() || new Date(),
              type: "create",
            });
          }
        });

        const fallbackNews: ActivityNews[] = [
          {
            id: "sim-1",
            message: "🏆 KoffiBet a remporté 8 500 FCFA sur la Salle #E8Z1 en direct !",
            time: new Date(Date.now() - 2 * 60 * 1000),
            type: "win",
          },
          {
            id: "sim-2",
            message: "🔥 SoroGagnant a ouvert la Salle #A19B (Mise 2 000 FCFA) !",
            time: new Date(Date.now() - 6 * 60 * 1000),
            type: "create",
          },
          {
            id: "sim-3",
            message: "⚽ DrogbaFan a rejoint la position P4 sur la Salle #C55X !",
            time: new Date(Date.now() - 12 * 60 * 1000),
            type: "join",
          },
        ];

        const combined = [...realNews, ...fallbackNews]
          .sort((a, b) => b.time.getTime() - a.time.getTime())
          .slice(0, 8);

        try {
          localStorage.setItem("konamix_rooms_cache", JSON.stringify(parsedRooms));
        } catch (e) {}
        setNewsFeed(combined);
        setLoading(false);
      },
      (error) => {
        console.warn("Auth listener quota/offline fallback:", error?.message);
        try {
          const cached = localStorage.getItem("konamix_rooms_cache");
          if (cached) setAllRooms(JSON.parse(cached));
        } catch (e) {}
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, []);

  if (user) return <Navigate to="/" />;

  // Robust fallbacks if Firestore has no active rooms yet
  const fallbackRooms: Room[] = [
    {
      id: "MOCK_R1",
      creatorId: "admin",
      creatorDisplayName: "Kouassi_Pro",
      createdAt: null,
      updatedAt: null,
      status: "waiting",
      stakePerPosition: 1000,
      totalStake: 5000,
      mode: "expert",
      maxPlayers: 7,
      league: "Ligue des Champions",
      positions: {
        P1: { playerId: "1", displayName: "Koffi", teams: { top: "nat-ger", bottom: "nat-esp" } },
        P2: { playerId: "2", displayName: "Amani", teams: { top: "nat-cmr", bottom: "nat-egy" } },
        P3: { playerId: "3", displayName: "DrogbaFan", teams: { top: "nat-por", bottom: "nat-fra" } },
      },
    } as any,
    {
      id: "MOCK_R2",
      creatorId: "admin",
      creatorDisplayName: "SoloGagnant",
      createdAt: null,
      updatedAt: null,
      status: "selecting",
      stakePerPosition: 2000,
      totalStake: 8000,
      mode: "top",
      maxPlayers: 7,
      league: "Choc Européen",
      positions: {
        P1: { playerId: "1", displayName: "Solo", teams: { top: "fra-psg", bottom: "fra-om" } },
        P2: { playerId: "2", displayName: "Kouassi", teams: { top: "fra-monaco", bottom: "fra-ol" } },
      },
    } as any,
    {
      id: "MOCK_R3",
      creatorId: "admin",
      creatorDisplayName: "Konan_Bet",
      createdAt: null,
      updatedAt: null,
      status: "waiting",
      stakePerPosition: 5000,
      totalStake: 15000,
      mode: "random",
      maxPlayers: 7,
      league: "Superstars d'Afrique",
      positions: {
        P1: { playerId: "1", displayName: "Konan", teams: { top: "ger-bayern", bottom: "ger-dortmund" } },
      },
    } as any,
  ];

  // Open rooms list (filter out finished rooms)
  const realOpenRooms = allRooms.filter(
    (r) => !["finished", "partie_terminee", "results"].includes(r.status)
  );
  const rawOpenRooms = realOpenRooms.length > 0 ? realOpenRooms : fallbackRooms;

  // Filtered rooms
  const filteredRooms = rawOpenRooms.filter((room) => {
    // Stake filter
    if (stakeFilter === "500" && room.stakePerPosition !== 500) return false;
    if (stakeFilter === "1000" && room.stakePerPosition !== 1000) return false;
    if (stakeFilter === "2000" && room.stakePerPosition !== 2000) return false;
    if (stakeFilter === "5000+" && (room.stakePerPosition || 0) < 5000) return false;

    // Search query
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const matchLeague = (room.league || "").toLowerCase().includes(q);
      const matchCreator = (room.creatorDisplayName || "").toLowerCase().includes(q);
      const matchId = room.id.toLowerCase().includes(q);
      if (!matchLeague && !matchCreator && !matchId) return false;
    }
    return true;
  });

  const handleRoomClick = (room: Room) => {
    setSelectedRoom(room);
    setScreen("login");
    setShowMobileAuthDrawer(true);
    setMobileTab("auth");
    toast.info(`Connectez-vous pour rejoindre la Salle #${room.id.slice(-4).toUpperCase()} !`);
  };

  const handleShowOTP = (phone: string, type: "signup" | "reset") => {
    setPhoneForOTP(phone);
    setOtpType(type);
    setScreen("otp");
  };

  return (
    <div className="min-h-screen bg-transparent text-white flex flex-col font-sans select-none">
      {/* 🚀 SPORTSBOOK HEADER (Betclic / 1xBet Style) */}
      <header className="sticky top-0 z-40 bg-black/50 backdrop-blur-md border-b border-white/10 px-4 sm:px-8 py-3.5 flex items-center justify-between shadow-xl">
        <div className="flex items-center gap-3">
          <div className="flex items-baseline gap-1.5 cursor-pointer" onClick={() => setMobileTab("rooms")}>
            <h1 className="text-2xl sm:text-3xl font-black italic tracking-tighter text-brand-red">
              KONAMIX
            </h1>
            <span className="text-[9px] font-black uppercase tracking-wider text-brand-gold bg-brand-gold/10 px-1.5 py-0.5 rounded border border-brand-gold/20">
              PARIS P1-P7
            </span>
          </div>

          <div className="hidden md:flex items-center gap-2 pl-4 border-l border-white/10 text-xs text-gray-400">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
            </span>
            <span className="font-bold text-white uppercase text-[10px] tracking-wide">
              {rawOpenRooms.length} Salles Ouvertes en Direct
            </span>
          </div>
        </div>

        {/* Quick Auth Actions */}
        <div className="flex items-center gap-2">
          <button
            onClick={() => {
              setScreen("login");
              setMobileTab("auth");
              setShowMobileAuthDrawer(true);
            }}
            className={cn(
              "px-3.5 py-2 rounded-xl text-xs font-black uppercase tracking-wider transition-all cursor-pointer flex items-center gap-1.5",
              screen === "login" && mobileTab === "auth"
                ? "bg-white/15 text-white border border-white/20"
                : "bg-white/5 hover:bg-white/10 text-gray-300"
            )}
          >
            <LogIn size={14} /> Se Connecter
          </button>

          <button
            onClick={() => {
              setScreen("signup");
              setMobileTab("auth");
              setShowMobileAuthDrawer(true);
            }}
            className={cn(
              "px-3.5 py-2 rounded-xl text-xs font-black uppercase tracking-wider transition-all cursor-pointer flex items-center gap-1.5 shadow-lg active:scale-95",
              screen === "signup" && mobileTab === "auth"
                ? "bg-brand-red text-white shadow-brand-red/30"
                : "bg-brand-red hover:bg-brand-red/90 text-white"
            )}
          >
            <UserPlus size={14} /> S&apos;inscrire
          </button>
        </div>
      </header>

      {/* 🔴 LIVE NEWS & TICKER BAR */}
      <div className="bg-black/60 border-b border-white/5 px-4 sm:px-8 py-2 overflow-x-auto whitespace-nowrap scrollbar-none flex items-center gap-4">
        <div className="flex items-center gap-1.5 text-brand-gold text-[10px] font-black uppercase tracking-widest shrink-0">
          <Flame size={13} className="text-amber-400 animate-pulse" />
          <span>DIRECT :</span>
        </div>
        <div className="flex items-center gap-6 text-[11px] font-medium text-gray-300">
          {newsFeed.map((news) => (
            <span key={news.id} className="inline-flex items-center gap-2 shrink-0">
              <span className="text-xs">{news.type === "win" ? "🏆" : "🔥"}</span>
              <span className="font-bold text-gray-200">{news.message}</span>
              <span className="text-gray-600">•</span>
            </span>
          ))}
        </div>
      </div>

      {/* 📱 MOBILE VIEW TABS (Salles Ouvertes vs Connexion) */}
      <div className="lg:hidden flex bg-black/50 backdrop-blur-md border-b border-white/10 p-1.5 sticky top-[57px] z-30">
        <button
          onClick={() => {
            setMobileTab("rooms");
            setShowMobileAuthDrawer(false);
          }}
          className={cn(
            "flex-1 py-2.5 rounded-xl font-black text-xs uppercase tracking-wider transition-all flex items-center justify-center gap-2",
            mobileTab === "rooms"
              ? "bg-brand-red text-white shadow-md font-extrabold"
              : "text-gray-400 hover:text-white"
          )}
        >
          <Trophy size={15} /> Salles Ouvertes ({rawOpenRooms.length})
        </button>

        <button
          onClick={() => {
            setMobileTab("auth");
            if (screen !== "login" && screen !== "signup") setScreen("login");
          }}
          className={cn(
            "flex-1 py-2.5 rounded-xl font-black text-xs uppercase tracking-wider transition-all flex items-center justify-center gap-2",
            mobileTab === "auth"
              ? "bg-brand-red text-white shadow-md font-extrabold"
              : "text-gray-400 hover:text-white"
          )}
        >
          {screen === "signup" ? <UserPlus size={15} /> : <LogIn size={15} />}
          {screen === "signup" ? "Inscription" : "Connexion"}
        </button>
      </div>

      {/* 🏟️ MAIN SPORTSBOOK DUAL-VIEW CONTAINER (Betclic / 1xBet Style) */}
      <main className="flex-1 w-full max-w-7xl mx-auto px-3 sm:px-6 lg:px-8 py-6">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 xl:gap-8 items-start">
          
          {/* ============================================================ */}
          {/*    COLONNE PRINCIPALE : LOBBY DES SALLES OUVERTES (Betclic)   */}
          {/* ============================================================ */}
          <div
            className={cn(
              "lg:col-span-7 xl:col-span-8 space-y-6",
              mobileTab === "auth" ? "hidden lg:block" : "block"
            )}
          >
            {/* Header / Hero Banner */}
            <div className="card bg-gradient-to-r from-black/55 via-brand-red/10 to-black/55 border-white/10 p-5 rounded-2xl relative overflow-hidden shadow-2xl backdrop-blur-md">
              <div className="relative z-10 space-y-2">
                <div className="inline-flex items-center gap-1.5 bg-brand-gold/10 border border-brand-gold/20 px-2.5 py-0.5 rounded-full text-[9px] font-black text-brand-gold uppercase tracking-wider">
                  <Zap size={11} className="text-brand-gold" />
                  Pari Direct & Retraits Wave 100% Instantanés
                </div>
                <h2 className="text-2xl sm:text-4xl font-black italic uppercase tracking-tighter text-white">
                  SALLES DE JEU OUVERTES
                </h2>
                <p className="text-xs text-gray-300 max-w-lg leading-relaxed">
                  Choisissez votre salle, sélectionnez votre position tactique (P1 à P7) et empochez la cagnotte en direct !
                </p>
              </div>
            </div>

            {/* Filter & Search Bar (Betclic / 1xBet Sportsbook Bar) */}
            <div className="card bg-black/45 backdrop-blur-md border-white/10 p-3.5 rounded-2xl space-y-3 shadow-lg">
              <div className="flex flex-col sm:flex-row gap-3 items-center justify-between">
                {/* Stake quick filters */}
                <div className="flex flex-wrap items-center gap-1.5 w-full sm:w-auto">
                  {[
                    { id: "all", label: "Toutes les Salles" },
                    { id: "500", label: "500 F" },
                    { id: "1000", label: "1 000 F" },
                    { id: "2000", label: "2 000 F" },
                    { id: "5000+", label: "5 000 F+ (VIP)" },
                  ].map((filterItem) => (
                    <button
                      key={filterItem.id}
                      onClick={() => setStakeFilter(filterItem.id as any)}
                      className={cn(
                        "text-[10px] font-black uppercase px-3 py-1.5 rounded-xl transition-all",
                        stakeFilter === filterItem.id
                          ? "bg-brand-red text-white shadow-md shadow-brand-red/20 font-bold"
                          : "bg-white/5 hover:bg-white/10 text-gray-400 hover:text-white"
                      )}
                    >
                      {filterItem.label}
                    </button>
                  ))}
                </div>

                {/* Search input */}
                <div className="relative w-full sm:w-56">
                  <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Rechercher une salle..."
                    className="w-full bg-black/40 border border-white/10 pl-9 pr-3 py-1.5 rounded-xl text-xs text-white placeholder-gray-500 focus:outline-none focus:border-brand-red font-medium"
                  />
                  {searchQuery && (
                    <button
                      onClick={() => setSearchQuery("")}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-500 hover:text-white"
                    >
                      <X size={12} />
                    </button>
                  )}
                </div>
              </div>
            </div>

            {/* Grid of Open Rooms */}
            <div className="space-y-3">
              <div className="flex items-center justify-between px-1">
                <h3 className="text-xs font-black uppercase tracking-wider text-gray-400 flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                  Parties Disponibles ({filteredRooms.length})
                </h3>
                <span className="text-[10px] text-gray-500 font-bold uppercase">
                  Cliquez sur une salle pour la rejoindre
                </span>
              </div>

              {filteredRooms.length > 0 ? (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {filteredRooms.map((room) => (
                    <RoomCard
                      key={room.id}
                      room={room}
                      onClick={() => handleRoomClick(room)}
                      teamsList={teamsList}
                    />
                  ))}
                </div>
              ) : (
                <div className="card py-16 bg-white/[0.02] border-dashed border-white/10 rounded-2xl flex flex-col items-center justify-center text-center p-6 space-y-3">
                  <Trophy size={36} className="text-gray-600 opacity-50" />
                  <p className="text-sm font-black uppercase text-gray-400">
                    Aucune salle ouverte avec ces filtres
                  </p>
                  <button
                    onClick={() => {
                      setStakeFilter("all");
                      setSearchQuery("");
                    }}
                    className="text-xs font-bold text-brand-gold uppercase hover:underline"
                  >
                    Réinitialiser les filtres
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* ============================================================ */}
          {/*   COLONNE DROITE : MODULE D'INSCRIPTION & CONNEXION RAPIDE   */}
          {/* ============================================================ */}
          <div
            className={cn(
              "lg:col-span-5 xl:col-span-4",
              mobileTab === "rooms" ? "hidden lg:block" : "block"
            )}
          >
            <div className="sticky top-20 space-y-4">
              {/* Selected Room Notification Banner if user clicked a room */}
              {selectedRoom && (
                <div className="p-4 bg-gradient-to-r from-brand-gold/15 to-black border border-brand-gold/30 rounded-2xl space-y-2 shadow-lg animate-fadeIn">
                  <div className="flex items-center justify-between">
                    <span className="text-[9px] font-black uppercase text-brand-gold bg-brand-gold/10 px-2 py-0.5 rounded border border-brand-gold/25">
                      Salle #{selectedRoom.id.slice(-4).toUpperCase()}
                    </span>
                    <button
                      onClick={() => setSelectedRoom(null)}
                      className="text-gray-400 hover:text-white"
                    >
                      <X size={14} />
                    </button>
                  </div>
                  <p className="text-xs font-bold text-white leading-snug">
                    Pour miser sur la salle <strong>{selectedRoom.league || "Sélectionnée"}</strong> (Mise :{" "}
                    <span className="text-brand-gold font-black">{formatFCFA(selectedRoom.stakePerPosition)}</span>),
                    connectez-vous ou créez votre compte en quelques secondes !
                  </p>
                </div>
              )}

              {/* Integrated Auth Card */}
              <div className="card bg-black/50 backdrop-blur-md border-white/10 p-6 rounded-2xl shadow-2xl space-y-5">
                {/* Tabs Switcher: Connexion vs Inscription */}
                {(screen === "login" || screen === "signup") && (
                  <div className="flex p-1 bg-black/50 rounded-xl border border-white/10">
                    <button
                      type="button"
                      onClick={() => setScreen("login")}
                      className={cn(
                        "flex-1 py-2.5 rounded-lg text-xs font-black uppercase tracking-wider transition-all flex items-center justify-center gap-1.5",
                        screen === "login"
                          ? "bg-brand-red text-white shadow-md font-bold"
                          : "text-gray-400 hover:text-white"
                      )}
                    >
                      <LogIn size={14} /> Se Connecter
                    </button>
                    <button
                      type="button"
                      onClick={() => setScreen("signup")}
                      className={cn(
                        "flex-1 py-2.5 rounded-lg text-xs font-black uppercase tracking-wider transition-all flex items-center justify-center gap-1.5",
                        screen === "signup"
                          ? "bg-brand-red text-white shadow-md font-bold"
                          : "text-gray-400 hover:text-white"
                      )}
                    >
                      <UserPlus size={14} /> S&apos;inscrire
                    </button>
                  </div>
                )}

                {/* Sub-screens Form */}
                <div className="pt-1">
                  {screen === "login" && (
                    <LoginPage
                      isEmbed={true}
                      onSwitchToSignup={() => setScreen("signup")}
                      onForgotPassword={() => setScreen("forgot-password")}
                      onSuccess={() => {
                        toast.success("Connexion réussie ! Bienvenue sur Konamix.");
                        navigate(selectedRoom ? `/room/${selectedRoom.id}` : "/");
                      }}
                    />
                  )}

                  {screen === "signup" && (
                    <SignupPage
                      isEmbed={true}
                      defaultRefCode={refCode || undefined}
                      onSwitchToLogin={() => setScreen("login")}
                      onSignupSuccess={() => {
                        toast.success("🏆 Compte créé avec succès ! Bienvenue sur Konamix.");
                        navigate(selectedRoom ? `/room/${selectedRoom.id}` : "/");
                      }}
                    />
                  )}

                  {screen === "otp" && (
                    <OTPVerification
                      isEmbed={true}
                      phone={phoneForOTP}
                      type={otpType}
                      onBack={() => setScreen(otpType === "signup" ? "signup" : "forgot-password")}
                      onSuccess={() => {
                        toast.success("Validation réussie !");
                        navigate(selectedRoom ? `/room/${selectedRoom.id}` : "/");
                      }}
                    />
                  )}

                  {screen === "forgot-password" && (
                    <ForgotPassword
                      isEmbed={true}
                      onBack={() => setScreen("login")}
                      onCodeSent={(phone) => handleShowOTP(phone, "reset")}
                    />
                  )}
                </div>

                {/* Reassurance Badges */}
                <div className="pt-4 border-t border-white/5 grid grid-cols-2 gap-2 text-center text-[9px] text-gray-400 font-bold uppercase tracking-wider">
                  <div className="flex items-center justify-center gap-1.5 bg-white/[0.02] p-2 rounded-xl border border-white/5">
                    <Smartphone size={12} className="text-brand-gold" />
                    <span>Dépôts & Retraits Wave</span>
                  </div>
                  <div className="flex items-center justify-center gap-1.5 bg-white/[0.02] p-2 rounded-xl border border-white/5">
                    <ShieldCheck size={12} className="text-emerald-400" />
                    <span>Sécurité Maximale</span>
                  </div>
                </div>
              </div>

              {/* Live Rooms Quick Carousel preview on mobile when on auth tab */}
              <div className="lg:hidden card bg-black/50 backdrop-blur-md border-white/10 p-4 rounded-2xl space-y-3">
                <div className="flex items-center justify-between">
                  <h4 className="text-[10px] font-black uppercase text-brand-gold flex items-center gap-1.5">
                    <Trophy size={12} /> Voir les Salles Ouvertes
                  </h4>
                  <button
                    onClick={() => setMobileTab("rooms")}
                    className="text-[10px] font-bold text-white hover:underline flex items-center gap-1"
                  >
                    Explorer <ArrowRight size={11} />
                  </button>
                </div>
                <p className="text-[10px] text-gray-400">
                  {rawOpenRooms.length} parties sont actuellement ouvertes aux mises. Vous pourrez les rejoindre dès votre connexion !
                </p>
              </div>
            </div>
          </div>
        </div>
      </main>

      {/* FOOTER */}
      <footer className="bg-black/90 py-6 px-4 text-center border-t border-white/5 space-y-2 select-none mt-auto">
        <p className="text-[9px] font-black uppercase tracking-widest text-gray-500">
          KONAMIX • Côte d&apos;Ivoire • © 2026 Tous droits réservés
        </p>
        <div className="flex justify-center gap-4 text-[9px] font-bold uppercase text-gray-600">
          <span>Pari Responsable (+18)</span>
          <span>•</span>
          <span>Paiements Wave & Mobile Money</span>
          <span>•</span>
          <span>Support 24/7</span>
        </div>
      </footer>
    </div>
  );
}
