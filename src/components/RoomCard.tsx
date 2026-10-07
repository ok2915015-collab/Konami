import React from "react";
import { Room, Team } from "../types";
import { formatFCFA, cn } from "../lib/utils";
import { INITIAL_TEAMS as teams, FALLBACK_LOGO, getTeamLogo } from "../constants/teams";
import { Users, ChevronRight } from "lucide-react";

interface RoomCardProps {
  room: Room;
  onClick?: () => void;
  currentUserId?: string;
  teamsList?: Team[];
  key?: React.Key;
}

export const RoomCard = ({ room, onClick, currentUserId, teamsList }: RoomCardProps) => {
  const playersCount = Object.values(room.positions || {}).filter((p) => (p as any)?.playerId).length;
  const maxPlayers = room.maxPlayers || 7;
  const fillPercent = Math.min(100, (playersCount / maxPlayers) * 100);
  const isUserInRoom = Object.values(room.positions || {}).some((p: any) => p?.playerId === currentUserId);
  const isFull = playersCount >= maxPlayers;

  const resolvedTeams = teamsList && teamsList.length > 0 ? teamsList : teams;

  const getLogo = (t: any) => {
    if (!t) return null;
    const teamId = typeof t === "string" ? t : t.id || t.name;
    const latestTeam = resolvedTeams.find(
      (it) => it.id === teamId || (it.name && teamId && it.name.toLowerCase() === teamId.toLowerCase())
    );
    if (latestTeam) return getTeamLogo(latestTeam);
    return typeof t === "object" ? getTeamLogo(t) : FALLBACK_LOGO;
  };

  return (
    <div
      onClick={onClick}
      className="card block bg-black/45 backdrop-blur-md border border-white/10 hover:border-brand-red/50 hover:bg-black/55 transition-all p-4 sm:p-5 rounded-2xl shadow-xl relative overflow-hidden active:scale-[0.99] cursor-pointer group"
    >
      {room.isPrivate && (
        <div className="absolute top-0 right-0 bg-brand-gold text-black text-[8px] font-black px-2.5 py-0.5 rounded-bl-lg uppercase tracking-wider z-10">
          PRIVÉ
        </div>
      )}

      {isUserInRoom && (
        <div className="absolute top-0 left-0 bg-brand-red text-white text-[8px] font-black px-2.5 py-0.5 rounded-br-lg uppercase tracking-wider z-10 flex items-center gap-1">
          <span className="w-1.5 h-1.5 rounded-full bg-white animate-pulse" />
          MA PARTICIPATION
        </div>
      )}

      {/* Header info */}
      <div className="flex justify-between items-start mb-3.5 pt-1">
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
            <span className="text-[11px] font-mono text-gray-400 font-bold">
              #{room.id.slice(-6).toUpperCase()}
            </span>
          </div>
          <p className="text-sm font-black truncate max-w-[200px] uppercase text-white tracking-tight">
            {room.league || "Salle Ouverte"}
          </p>
        </div>
        <div className="text-right">
          <p className="text-[9px] text-gray-400 font-black uppercase">Mise / Ticket</p>
          <p className="text-brand-gold font-black italic tracking-tighter text-sm sm:text-base font-mono">
            {formatFCFA(room.stakePerPosition)}
          </p>
        </div>
      </div>

      {/* Positions Slots (P1 to P7) */}
      <div className="grid grid-cols-7 gap-1.5 mb-3.5">
        {[1, 2, 3, 4, 5, 6, 7].map((num) => {
          const pos = room.positions?.[`P${num}`] || (room.positions as any)?.[num];
          const isOccupied = pos && (pos as any).playerId;
          const isMe = currentUserId && pos && (pos as any).playerId === currentUserId;
          const topLogo = getLogo((pos as any)?.teams?.top);
          const bottomLogo = getLogo((pos as any)?.teams?.bottom);

          return (
            <div key={num} className="flex flex-col items-center gap-1">
              <span className="text-[9px] font-bold italic text-gray-400">P{num}</span>
              <div
                className={cn(
                  "relative w-full aspect-square rounded-lg border flex items-center justify-center p-0.5 transition-colors",
                  isMe
                    ? "bg-brand-red/20 border-brand-red ring-1 ring-brand-red/50"
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
                  <span className="text-[8px] text-gray-600 font-bold">+</span>
                )}
              </div>
              <span
                className={cn(
                  "text-[8px] font-black uppercase truncate w-full text-center",
                  isMe ? "text-brand-gold" : isOccupied ? "text-gray-300" : "text-gray-600"
                )}
              >
                {isMe ? "Moi" : isOccupied ? pos.displayName : "-"}
              </span>
            </div>
          );
        })}
      </div>

      {/* Prize Pool and Progress Bar */}
      <div className="grid grid-cols-2 gap-3 mb-3.5">
        <div className="bg-black/30 rounded-xl p-2.5 border border-white/5 flex flex-col justify-center">
          <p className="text-[8px] text-gray-400 font-black uppercase mb-0.5">Cagnotte Net (95%)</p>
          <p className="text-xs sm:text-sm font-black text-white italic font-mono">
            {formatFCFA((room.totalStake || 0) * 0.95)}
          </p>
        </div>
        <div className="bg-black/30 rounded-xl p-2.5 border border-white/5 flex flex-col justify-center">
          <div className="flex justify-between items-center mb-1">
            <p className="text-[8px] text-gray-400 font-black uppercase">Joueurs</p>
            <span className="text-[10px] font-black text-white font-mono">
              {playersCount}/{maxPlayers}
            </span>
          </div>
          <div className="w-full h-1.5 bg-white/10 rounded-full overflow-hidden">
            <div
              className={cn(
                "h-full transition-all duration-300",
                isFull ? "bg-amber-400" : "bg-brand-red"
              )}
              style={{ width: `${fillPercent}%` }}
            />
          </div>
        </div>
      </div>

      {/* Footer Card */}
      <div className="flex justify-between items-center text-[10px] font-black uppercase italic pt-2 border-t border-white/5">
        <div className="flex items-center gap-1.5 text-gray-400">
          <Users size={12} />
          <span className="truncate max-w-[140px]">
            Créé par {room.creatorDisplayName || "Admin"}
          </span>
        </div>
        <div
          className={cn(
            "flex items-center gap-1 font-black",
            isUserInRoom
              ? "text-brand-gold"
              : isFull
              ? "text-gray-400"
              : "text-brand-red group-hover:translate-x-0.5 transition-transform"
          )}
        >
          <span>{isFull && !isUserInRoom ? "Voir la salle" : "Rejoindre la salle"}</span>
          <ChevronRight size={13} strokeWidth={2.5} />
        </div>
      </div>
    </div>
  );
};
