import React, { useState } from "react";
import { User, Room, Position } from "../../types";
import { formatFCFA } from "../../lib/utils";
import { 
  X, 
  Trophy, 
  Calendar, 
  Coins, 
  Users, 
  Eye, 
  ExternalLink, 
  Search, 
  Filter, 
  Swords, 
  Clock, 
  CheckCircle2, 
  AlertCircle,
  Sparkles,
  Bot
} from "lucide-react";
import { useNavigate } from "react-router-dom";

interface UserRoomsModalProps {
  isOpen: boolean;
  onClose: () => void;
  user: User | null;
  rooms: Room[];
  onOpenRoomHistory: (room: Room) => void;
}

export default function UserRoomsModal({
  isOpen,
  onClose,
  user,
  rooms,
  onOpenRoomHistory,
}: UserRoomsModalProps) {
  const navigate = useNavigate();
  const [tab, setTab] = useState<"created" | "participated">("created");
  const [statusFilter, setStatusFilter] = useState<"all" | "waiting" | "active" | "finished">("all");
  const [search, setSearch] = useState("");

  if (!isOpen || !user) return null;

  // Filter rooms created by this user
  const createdRooms = rooms.filter(
    (r) =>
      r.creatorId === user.uid ||
      (r as any).creatorEmail === user.email ||
      (user.displayName && r.creatorDisplayName === user.displayName)
  );

  // Filter rooms where this user participated in at least one position
  const participatedRooms = rooms.filter((r) =>
    Object.values(r.positions || {}).some(
      (p: Position) => p.playerId === user.uid
    )
  );

  const activeRoomsList = tab === "created" ? createdRooms : participatedRooms;

  // Filtered by status and search
  const filteredRooms = activeRoomsList.filter((r) => {
    const isFinished = r.status === "finished" || r.status === "partie_terminee";
    const isWaiting = r.status === "waiting";
    const isActive = ["selecting", "secondary_bets", "countdown", "simulating"].includes(r.status);

    if (statusFilter === "finished" && !isFinished) return false;
    if (statusFilter === "waiting" && !isWaiting) return false;
    if (statusFilter === "active" && !isActive) return false;

    if (search.trim()) {
      const q = search.toLowerCase();
      const matchId = r.id.toLowerCase().includes(q);
      const matchMode = (r.mode || "").toLowerCase().includes(q);
      const matchWinner = (r.winnerName || "").toLowerCase().includes(q);
      return matchId || matchMode || matchWinner;
    }

    return true;
  });

  // Calculate statistics for created rooms
  const totalVolumeCreated = createdRooms.reduce((acc, r) => acc + (r.totalStake || 0), 0);
  const finishedCreatedCount = createdRooms.filter(
    (r) => r.status === "finished" || r.status === "partie_terminee"
  ).length;
  const userWinsInCreated = createdRooms.filter(
    (r) => r.winnerId === user.uid
  ).length;

  return (
    <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-md flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
      <div 
        className="bg-[#121212] border border-brand-gold/35 rounded-3xl p-5 sm:p-6 max-w-4xl w-full shadow-2xl relative flex flex-col max-h-[92vh] my-auto animate-in fade-in zoom-in-95 duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-white/10 shrink-0">
          <div className="flex items-center gap-3.5 min-w-0">
            <img 
              src={user.photoURL || `https://api.dicebear.com/7.x/pixel-art/svg?seed=${user.uid}`} 
              className="w-12 h-12 rounded-2xl border-2 border-brand-gold/40 shadow-lg shrink-0 object-cover" 
              alt={user.displayName || "Joueur"} 
            />
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <h3 className="text-base sm:text-lg font-black uppercase italic tracking-tighter text-white truncate">
                  Salles & Historique de {user.displayName || "Joueur"}
                </h3>
                <span className="text-[9px] font-mono px-2 py-0.5 rounded-full bg-brand-gold/20 text-brand-gold border border-brand-gold/30 font-bold shrink-0">
                  {createdRooms.length} salle(s) créée(s)
                </span>
              </div>
              <p className="text-[10px] text-gray-400 font-mono truncate mt-0.5">
                ID: {user.uid} • {user.email || "Aucun email"} • Solde: <span className="text-brand-gold font-bold">{formatFCFA(user.balance)}</span>
              </p>
            </div>
          </div>

          <button 
            type="button"
            onClick={onClose}
            className="text-gray-400 hover:text-white p-2 rounded-xl bg-white/5 hover:bg-white/10 cursor-pointer transition-colors shrink-0 ml-2"
            title="Fermer"
          >
            <X size={18} />
          </button>
        </div>

        {/* Statistiques Rapides */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 my-4 shrink-0">
          <div className="bg-white/[0.03] p-3 rounded-2xl border border-white/5 text-center">
            <p className="text-[8px] font-black uppercase text-gray-400 tracking-wider">Salles Ouvertes</p>
            <p className="text-lg font-black italic text-white font-mono">{createdRooms.length}</p>
            <p className="text-[8px] text-gray-500 font-medium">créées par ce joueur</p>
          </div>

          <div className="bg-white/[0.03] p-3 rounded-2xl border border-white/5 text-center">
            <p className="text-[8px] font-black uppercase text-gray-400 tracking-wider">Salles Terminées</p>
            <p className="text-lg font-black italic text-green-400 font-mono">{finishedCreatedCount}</p>
            <p className="text-[8px] text-gray-500 font-medium">matchs joués</p>
          </div>

          <div className="bg-white/[0.03] p-3 rounded-2xl border border-white/5 text-center">
            <p className="text-[8px] font-black uppercase text-brand-gold tracking-wider">Volume Cagnottes</p>
            <p className="text-lg font-black italic text-brand-gold font-mono">{formatFCFA(totalVolumeCreated)}</p>
            <p className="text-[8px] text-gray-500 font-medium">total des pools créés</p>
          </div>

          <div className="bg-white/[0.03] p-3 rounded-2xl border border-white/5 text-center">
            <p className="text-[8px] font-black uppercase text-purple-400 tracking-wider">Victoires du Joueur</p>
            <p className="text-lg font-black italic text-purple-400 font-mono">{userWinsInCreated}</p>
            <p className="text-[8px] text-gray-500 font-medium">dans ses salles créées</p>
          </div>
        </div>

        {/* Barre de Filtres & Recherche */}
        <div className="flex flex-col sm:flex-row gap-2.5 pb-3 shrink-0">
          {/* Tabs */}
          <div className="flex bg-black/60 p-1 rounded-xl border border-white/10 shrink-0">
            <button
              type="button"
              onClick={() => setTab("created")}
              className={`px-3 py-1.5 rounded-lg text-xs font-black uppercase transition-all cursor-pointer ${
                tab === "created"
                  ? "bg-brand-gold text-brand-black shadow-md"
                  : "text-gray-400 hover:text-white"
              }`}
            >
              Créées par le joueur ({createdRooms.length})
            </button>
            <button
              type="button"
              onClick={() => setTab("participated")}
              className={`px-3 py-1.5 rounded-lg text-xs font-black uppercase transition-all cursor-pointer ${
                tab === "participated"
                  ? "bg-brand-gold text-brand-black shadow-md"
                  : "text-gray-400 hover:text-white"
              }`}
            >
              Participées ({participatedRooms.length})
            </button>
          </div>

          {/* Recherche */}
          <div className="relative flex-1">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
            <input 
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Filtrer par ID, mode, gagnant..."
              className="w-full bg-black/40 border border-white/10 rounded-xl pl-8 pr-3 py-2 text-xs text-white placeholder-gray-500 outline-none focus:border-brand-gold/60"
            />
          </div>

          {/* Filtre de statut */}
          <div className="flex gap-1 overflow-x-auto shrink-0">
            {(["all", "waiting", "active", "finished"] as const).map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => setStatusFilter(s)}
                className={`px-2.5 py-1.5 rounded-xl text-[10px] font-black uppercase transition-all cursor-pointer ${
                  statusFilter === s
                    ? "bg-white/20 text-white border border-white/30"
                    : "bg-white/5 text-gray-400 hover:bg-white/10"
                }`}
              >
                {s === "all" ? "Toutes" : s === "waiting" ? "En attente" : s === "active" ? "En cours" : "Terminées"}
              </button>
            ))}
          </div>
        </div>

        {/* Liste des Salles */}
        <div className="flex-1 overflow-y-auto pr-1 space-y-3 min-h-0">
          {filteredRooms.length === 0 ? (
            <div className="py-12 text-center border border-dashed border-white/10 rounded-2xl bg-black/30 space-y-2">
              <Trophy size={32} className="mx-auto text-gray-600 opacity-50" />
              <p className="text-xs font-black uppercase tracking-wider text-gray-400">
                Aucune salle trouvée
              </p>
              <p className="text-[10px] text-gray-600">
                {tab === "created" 
                  ? "Cet utilisateur n'a pas encore ouvert de salle correspondant aux filtres." 
                  : "Aucune participation enregistrée pour cet utilisateur."}
              </p>
            </div>
          ) : (
            filteredRooms.map((r) => {
              const isFinished = r.status === "finished" || r.status === "partie_terminee";
              const isWaiting = r.status === "waiting";
              const positions = Object.values(r.positions || {}) as Position[];
              const occupiedPositions = positions.filter((p) => p.playerId).length;
              const leveragePositions = positions.filter((p) => p.isLeverage || p.isBot || p.playerId?.startsWith("BOT_")).length;
              const challengesCount = (r.challenges || []).length;
              const dateStr = r.createdAt?.seconds 
                ? new Date(r.createdAt.seconds * 1000).toLocaleString() 
                : "Date inconnue";

              return (
                <div 
                  key={r.id}
                  className="bg-white/[0.02] hover:bg-white/[0.04] border border-white/10 hover:border-brand-gold/30 rounded-2xl p-4 transition-all space-y-3"
                >
                  {/* Top Bar of Room Card */}
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                    <div className="flex items-center gap-2.5 min-w-0">
                      <span className="w-8 h-8 rounded-xl bg-brand-gold/15 text-brand-gold flex items-center justify-center font-mono font-bold text-xs shrink-0 border border-brand-gold/20">
                        #{r.id.slice(0, 4)}
                      </span>
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <h4 className="text-sm font-black uppercase text-white truncate">
                            Salle #{r.id.slice(0, 8)}
                          </h4>
                          <span className="text-[9px] font-black uppercase px-2 py-0.5 rounded-full bg-white/10 text-gray-300">
                            Mode: {r.mode}
                          </span>
                          <span className={`text-[8.5px] font-black uppercase px-2.5 py-0.5 rounded-full border ${
                            isFinished ? "bg-green-500/15 text-green-400 border-green-500/30" :
                            isWaiting ? "bg-amber-500/15 text-amber-400 border-amber-500/30" :
                            "bg-blue-500/15 text-blue-400 border-blue-500/30"
                          }`}>
                            {isFinished ? "Terminée" : isWaiting ? "En attente" : r.status}
                          </span>
                        </div>
                        <p className="text-[9px] text-gray-500 flex items-center gap-1 mt-0.5">
                          <Calendar size={10} />
                          {dateStr}
                          {r.creatorDisplayName && (
                            <span className="text-gray-400 ml-1">
                              • Créée par : <strong className="text-white">{r.creatorDisplayName}</strong>
                            </span>
                          )}
                        </p>
                      </div>
                    </div>

                    {/* Action Buttons for this room */}
                    <div className="flex items-center gap-2 shrink-0 self-end sm:self-auto">
                      <button
                        type="button"
                        onClick={() => {
                          onOpenRoomHistory(r);
                        }}
                        className="flex items-center gap-1.5 px-3 py-2 bg-brand-gold/15 hover:bg-brand-gold text-brand-gold hover:text-brand-black border border-brand-gold/30 rounded-xl text-[10px] font-black uppercase tracking-wider transition-all cursor-pointer shadow-md active:scale-95"
                        title="Ouvrir l'historique complet des scores et duels de cette salle"
                      >
                        <Eye size={13} />
                        <span>📜 Historique Complet</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => {
                          onClose();
                          navigate(`/room/${r.id}`);
                        }}
                        className="p-2 bg-white/5 hover:bg-white/15 text-gray-400 hover:text-white rounded-xl transition-colors cursor-pointer"
                        title="Ouvrir la salle dans l'application"
                      >
                        <ExternalLink size={14} />
                      </button>
                    </div>
                  </div>

                  {/* Financial & Gameplay Metrics */}
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-2 border-t border-white/5">
                    <div className="bg-black/40 p-2.5 rounded-xl border border-white/5">
                      <p className="text-[8px] font-black uppercase text-gray-400">Mise par place</p>
                      <p className="text-xs font-black font-mono text-white mt-0.5">{formatFCFA(r.stakePerPosition)}</p>
                    </div>
                    <div className="bg-black/40 p-2.5 rounded-xl border border-white/5">
                      <p className="text-[8px] font-black uppercase text-gray-400">Cagnotte Totale</p>
                      <p className="text-xs font-black font-mono text-brand-gold mt-0.5">{formatFCFA(r.totalStake)}</p>
                    </div>
                    <div className="bg-black/40 p-2.5 rounded-xl border border-white/5">
                      <p className="text-[8px] font-black uppercase text-gray-400">Remplissage</p>
                      <p className="text-xs font-black font-mono text-white mt-0.5 flex items-center gap-1">
                        <Users size={12} className="text-blue-400" />
                        {occupiedPositions}/7
                        {leveragePositions > 0 && (
                          <span className="text-[8px] text-amber-400 font-bold ml-1">
                            ({leveragePositions} bot{leveragePositions > 1 ? "s" : ""})
                          </span>
                        )}
                      </p>
                    </div>
                    <div className="bg-black/40 p-2.5 rounded-xl border border-white/5">
                      <p className="text-[8px] font-black uppercase text-gray-400">Duels P vs P</p>
                      <p className="text-xs font-black font-mono text-purple-400 mt-0.5 flex items-center gap-1">
                        <Swords size={12} />
                        {challengesCount} duel{challengesCount > 1 ? "s" : ""}
                      </p>
                    </div>
                  </div>

                  {/* Vainqueur & Détail si terminé */}
                  {isFinished && (
                    <div className="flex items-center justify-between bg-black/60 px-3 py-2 rounded-xl border border-white/5 text-xs">
                      <div className="flex items-center gap-2">
                        <Trophy size={14} className="text-brand-gold shrink-0" />
                        <span className="text-[10px] text-gray-400 uppercase font-bold">Vainqueur :</span>
                        <span className="font-black text-white uppercase text-[11px]">
                          {r.winnerName || "Position gagnante"}
                        </span>
                        {r.winnerIsBot && (
                          <span className="text-[8px] font-black uppercase px-2 py-0.5 rounded-full bg-brand-gold text-brand-black">
                            🤖 Bot Levier
                          </span>
                        )}
                      </div>
                      <span className="font-mono font-bold text-xs text-green-400">
                        Cagnotte distribuée
                      </span>
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>

        {/* Footer */}
        <div className="pt-3 mt-2 border-t border-white/10 shrink-0 flex justify-between items-center">
          <p className="text-[9px] text-gray-500 font-bold uppercase">
            {filteredRooms.length} salle(s) affichée(s)
          </p>
          <button
            type="button"
            onClick={onClose}
            className="px-6 py-2.5 rounded-xl bg-white/10 hover:bg-white/15 text-white font-black text-xs uppercase transition-all cursor-pointer"
          >
            Fermer
          </button>
        </div>
      </div>
    </div>
  );
}
