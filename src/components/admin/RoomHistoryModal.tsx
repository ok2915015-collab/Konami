import React from "react";
import { Room, Position, Challenge } from "../../types";
import { formatFCFA } from "../../lib/utils";
import { X, Trophy, Swords, Users, Clock, ShieldCheck, ExternalLink, Bot, User as UserIcon, Coins } from "lucide-react";
import { useNavigate } from "react-router-dom";

interface RoomHistoryModalProps {
  isOpen: boolean;
  onClose: () => void;
  room: Room | null;
}

export default function RoomHistoryModal({ isOpen, onClose, room }: RoomHistoryModalProps) {
  const navigate = useNavigate();

  if (!isOpen || !room) return null;

  const positions = (room.positions || {}) as Record<string, Position>;
  const challenges = (room.challenges || []) as Challenge[];
  const comm = typeof room.commission === "number" ? room.commission : 0.05;
  const netWinnerPot = (room.totalStake || 0) * (1 - comm);
  const platformFee = (room.totalStake || 0) * comm;

  const isFinished = room.status === "finished" || room.status === "partie_terminee";

  return (
    <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-md flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
      <div 
        className="bg-[#121212] border border-brand-gold/30 rounded-3xl p-5 sm:p-6 max-w-2xl w-full shadow-2xl relative flex flex-col max-h-[90vh] my-auto animate-in fade-in zoom-in-95 duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header Fixe */}
        <div className="flex items-center justify-between pb-3 border-b border-white/10 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-2xl bg-brand-gold/15 text-brand-gold flex items-center justify-center border border-brand-gold/30 shrink-0">
              <Trophy size={22} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base font-black uppercase italic tracking-tighter text-white">
                  Historique Salle #{room.id.slice(0, 8)}
                </h3>
                <span className={`text-[9px] font-black uppercase px-2 py-0.5 rounded-full border ${
                  isFinished ? "bg-green-500/15 text-green-400 border-green-500/30" :
                  room.status === "waiting" ? "bg-amber-500/15 text-amber-400 border-amber-500/30" :
                  "bg-blue-500/15 text-blue-400 border-blue-500/30"
                }`}>
                  {isFinished ? "Terminée" : room.status === "waiting" ? "En attente" : room.status}
                </span>
                <span className="text-[9px] font-black uppercase px-2 py-0.5 rounded-full bg-white/5 text-gray-300 border border-white/10">
                  Mode: {room.mode}
                </span>
              </div>
              <p className="text-[10px] text-gray-400 font-bold uppercase mt-0.5">
                Créée par : <span className="text-brand-gold">{room.creatorDisplayName || room.creatorId}</span>
                {room.createdAt?.seconds && (
                  <span className="ml-2 text-gray-500 font-normal">
                    • {new Date(room.createdAt.seconds * 1000).toLocaleString()}
                  </span>
                )}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => {
                onClose();
                navigate(`/room/${room.id}`);
              }}
              className="p-2 rounded-xl bg-white/5 hover:bg-white/10 text-gray-400 hover:text-white transition-colors cursor-pointer"
              title="Ouvrir la salle dans l'application"
            >
              <ExternalLink size={16} />
            </button>
            <button 
              type="button"
              onClick={onClose}
              className="p-2 rounded-xl bg-white/5 hover:bg-white/10 text-gray-400 hover:text-white transition-colors cursor-pointer"
              title="Fermer"
            >
              <X size={18} />
            </button>
          </div>
        </div>

        {/* Corps Déroulant */}
        <div className="flex-1 overflow-y-auto py-3 pr-1 space-y-4 min-h-0">
          {/* Métriques Financières de la Salle */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            <div className="bg-white/5 p-3 rounded-2xl border border-white/5 text-center">
              <p className="text-[8px] font-black uppercase text-gray-400">Mise par Place</p>
              <p className="text-base font-black italic text-white font-mono">{formatFCFA(room.stakePerPosition)}</p>
            </div>
            <div className="bg-white/5 p-3 rounded-2xl border border-white/5 text-center">
              <p className="text-[8px] font-black uppercase text-gray-400">Cagnotte Brute</p>
              <p className="text-base font-black italic text-brand-gold font-mono">{formatFCFA(room.totalStake)}</p>
            </div>
            <div className="bg-white/5 p-3 rounded-2xl border border-white/5 text-center">
              <p className="text-[8px] font-black uppercase text-gray-400">Commission (5%)</p>
              <p className="text-base font-black italic text-cyan-400 font-mono">{formatFCFA(platformFee)}</p>
            </div>
            <div className="bg-green-500/10 p-3 rounded-2xl border border-green-500/20 text-center">
              <p className="text-[8px] font-black uppercase text-green-400">Gain Net Gagnant</p>
              <p className="text-base font-black italic text-green-400 font-mono">{formatFCFA(netWinnerPot)}</p>
            </div>
          </div>

          {/* Vainqueur de la Salle */}
          {isFinished && (
            <div className={`p-4 rounded-2xl border flex items-center justify-between ${
              room.winnerIsBot 
                ? "bg-brand-gold/10 border-brand-gold/30 shadow-lg" 
                : "bg-white/[0.03] border-white/10"
            }`}>
              <div className="flex items-center gap-3">
                <div className={`w-12 h-12 rounded-2xl flex items-center justify-center shrink-0 ${
                  room.winnerIsBot ? "bg-brand-gold text-brand-black" : "bg-green-500/20 text-green-400 border border-green-500/30"
                }`}>
                  <Trophy size={24} />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h4 className="text-sm font-black uppercase italic text-white">
                      Vainqueur : {room.winnerName || "Position gagnante"}
                    </h4>
                    {room.winnerIsBot && (
                      <span className="text-[8.5px] font-black uppercase px-2 py-0.5 rounded-full bg-brand-gold text-brand-black">
                        🤖 Bot Levier Admin
                      </span>
                    )}
                  </div>
                  <p className="text-[10px] text-gray-400 font-medium mt-0.5">
                    {room.winnerIsBot 
                      ? "⚡ La cagnotte nette (+"+formatFCFA(netWinnerPot)+") a été reversée sur le compte Administrateur !" 
                      : `Gain de ${formatFCFA(netWinnerPot)} crédité sur le compte du joueur.`}
                  </p>
                </div>
              </div>

              <div className="text-right shrink-0">
                <p className="text-[9px] font-black uppercase text-gray-400">Gain Remporté</p>
                <p className="text-lg font-black text-brand-gold font-mono">+{formatFCFA(netWinnerPot)}</p>
              </div>
            </div>
          )}

          {/* Composition des 7 Positions de la Salle */}
          <div className="space-y-2">
            <h4 className="text-xs font-black uppercase italic tracking-wider text-white flex items-center gap-2">
              <Users size={15} className="text-brand-gold" />
              Participants & Équipes (7 Positions)
            </h4>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {Object.entries(positions).map(([pKey, pos]) => {
                const isOccupied = Boolean(pos.playerId);
                const isBot = Boolean(pos.isBot || pos.isLeverage || pos.playerId?.startsWith("BOT_") || pos.playerId?.startsWith("LEV_"));
                const isWinnerPos = room.winnerId === pos.playerId || (room.oracleResults?.winnerPos === pKey);

                return (
                  <div 
                    key={pKey}
                    className={`p-3 rounded-2xl border transition-all ${
                      isWinnerPos 
                        ? "bg-brand-gold/15 border-brand-gold/40 shadow-md" 
                        : isOccupied 
                        ? "bg-white/[0.03] border-white/10" 
                        : "bg-white/[0.01] border-white/5 opacity-40"
                    }`}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <span className={`w-6 h-6 rounded-lg text-[10px] font-black flex items-center justify-center font-mono ${
                          isWinnerPos ? "bg-brand-gold text-black" : "bg-white/10 text-white"
                        }`}>
                          {pKey}
                        </span>
                        <div className="min-w-0">
                          <p className="text-xs font-black uppercase truncate text-white">
                            {isOccupied ? pos.displayName || "Joueur" : "Position Libre"}
                          </p>
                          {isOccupied && (
                            <p className="text-[8px] font-mono text-gray-400 truncate">
                              {isBot ? "🤖 Bot Levier Admin" : `ID: ${pos.playerId?.slice(0, 10)}...`}
                            </p>
                          )}
                        </div>
                      </div>

                      {isWinnerPos && (
                        <span className="text-[8px] font-black uppercase px-2 py-0.5 rounded-full bg-brand-gold text-brand-black">
                          🏆 Gagnant
                        </span>
                      )}
                    </div>

                    {isOccupied && (pos.teams?.top || pos.teams?.bottom) && (
                      <div className="bg-black/40 rounded-xl p-2 border border-white/5 text-[10px] space-y-1">
                        <div className="flex justify-between items-center text-gray-300">
                          <span className="font-bold truncate max-w-[130px]">⬆️ {pos.teams?.top?.name || "-"}</span>
                          <span className="font-mono font-bold text-white">{pos.score?.top ?? "-"} buts</span>
                        </div>
                        <div className="flex justify-between items-center text-gray-300">
                          <span className="font-bold truncate max-w-[130px]">⬇️ {pos.teams?.bottom?.name || "-"}</span>
                          <span className="font-mono font-bold text-white">{pos.score?.bottom ?? "-"} buts</span>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Duels P vs P disputés dans la salle */}
          <div className="space-y-2 pt-2 border-t border-white/10">
            <h4 className="text-xs font-black uppercase italic tracking-wider text-white flex items-center gap-2">
              <Swords size={15} className="text-brand-red" />
              Duels P vs P de cette salle ({challenges.length})
            </h4>

            {challenges.length === 0 ? (
              <p className="text-[10px] text-gray-500 font-bold uppercase italic py-2">
                Aucun duel P vs P disputé dans cette salle.
              </p>
            ) : (
              <div className="space-y-2">
                {challenges.map((c) => {
                  const isAccepted = c.status === "accepted" || c.status === "resolved";
                  const isResolved = c.status === "resolved";

                  return (
                    <div 
                      key={c.id}
                      className="p-3 rounded-2xl bg-white/[0.02] border border-white/10 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                    >
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="text-[11px] font-black text-white">
                            {c.creatorDisplayName} ({c.creatorPKey})
                          </span>
                          <span className="text-[9px] text-brand-red font-black">VS</span>
                          <span className="text-[11px] font-black text-white">
                            {c.accepterDisplayName || c.targetPKey} ({c.targetPKey})
                          </span>
                        </div>
                        <p className="text-[9px] text-gray-400 font-bold mt-0.5">
                          Mise : <span className="text-brand-gold font-mono">{formatFCFA(c.stake)}</span> • Cagnotte duel : <span className="text-brand-gold font-mono">{formatFCFA(c.stake * 2)}</span>
                          {c.autoAcceptedByAdmin && (
                            <span className="ml-2 text-brand-gold font-bold">• ⚡ Auto-accepté par l'Admin</span>
                          )}
                        </p>
                      </div>

                      <div className="text-right shrink-0">
                        {isResolved ? (
                          <div>
                            <span className="text-[9px] font-black uppercase px-2 py-0.5 rounded-full bg-green-500/20 text-green-400 border border-green-500/30">
                              🏆 Gagnant : {c.winnerPKey === "TIE" ? "Égalité" : c.winnerPKey}
                            </span>
                            <p className="text-[9px] font-mono font-bold text-brand-gold mt-1">
                              +{formatFCFA(c.wonAmount || c.stake * 2)}
                            </p>
                          </div>
                        ) : (
                          <span className="text-[9px] font-black uppercase px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-400 border border-amber-500/30">
                            {c.status === "pending" ? "En attente" : c.status}
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* Footer Fixe */}
        <div className="pt-3 border-t border-white/10 shrink-0 flex justify-end">
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
