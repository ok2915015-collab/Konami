import React, { useState, useEffect } from "react";
import { collection, query, where, onSnapshot, orderBy } from "firebase/firestore";
import { db } from "../lib/firebase";
import { useAuth } from "../contexts/AuthContext";
import { Room } from "../types";
import { formatFCFA, cn } from "../lib/utils";
import { Link } from "react-router-dom";
import { History, Trophy, ChevronRight, Clock, Box } from "lucide-react";
import { motion } from "motion/react";

export default function RoomHistory() {
  const { user } = useAuth();
  const [rooms, setRooms] = useState<Room[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;

    // We can't easily query by array membership and order by date without complex indexes
    // For now, we fetch rooms where the user is potentially involved or recently finished
    const q = query(
      collection(db, "rooms"),
      where("status", "in", ["finished", "partie_terminee", "results"]),
      orderBy("updatedAt", "desc")
    );

    const unsubscribe = onSnapshot(
      q, 
      (snap) => {
        const filtered = snap.docs
          .map(doc => ({ id: doc.id, ...doc.data() } as Room))
          .filter(room => {
              // Check if user was a player in this room
              const positions = Object.values(room.positions || {});
              return positions.some((p: any) => p?.playerId === user.uid);
          });
        
        setRooms(filtered);
        setLoading(false);
      },
      (err) => {
        console.warn("RoomHistory quota/offline:", err?.message);
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, [user]);

  return (
    <div className="space-y-6 pb-20 pt-4">
      <div className="px-1 space-y-1">
        <h1 className="text-2xl font-black italic tracking-tighter uppercase leading-none flex items-center gap-2">
            <History className="text-brand-red" size={24} />
            Historique
        </h1>
        <p className="text-[10px] text-gray-500 font-bold uppercase tracking-widest italic">Tes anciennes parties & résultats</p>
      </div>

      <div className="space-y-3">
        {loading ? (
             <div className="py-20 flex justify-center">
                <div className="w-8 h-8 border-4 border-brand-red border-t-transparent rounded-full animate-spin" />
             </div>
        ) : rooms.length > 0 ? (
          rooms.map((room) => {
            const isWinner = room.winnerId === user?.uid;
            const userPos = Object.entries(room.positions || {}).find(([_, p]: [string, any]) => p?.playerId === user?.uid)?.[0];

            return (
              <motion.div
                key={room.id}
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
              >
                <Link 
                  to={`/room/${room.id}`}
                  className={cn(
                    "card block bg-white/[0.02] border-white/5 p-4 hover:border-white/20 transition-all",
                    isWinner && "border-brand-gold/30 bg-brand-gold/5"
                  )}
                >
                  <div className="flex justify-between items-start mb-3">
                    <div className="space-y-1">
                        <div className="flex items-center gap-2">
                            <span className="text-[8px] font-black uppercase bg-white/10 px-2 py-0.5 rounded text-gray-400">
                                {room.mode}
                            </span>
                            <span className="text-[10px] font-mono text-gray-600">#{room.id.slice(-6).toUpperCase()}</span>
                        </div>
                        <p className="text-xs font-black truncate">{room.league || "Championnat"}</p>
                    </div>
                    <div className="text-right">
                        {isWinner ? (
                            <div className="bg-brand-gold text-black text-[8px] font-black px-2 py-0.5 rounded uppercase italic animate-pulse">GAGNÉ</div>
                        ) : (
                            <div className="bg-white/5 text-gray-500 text-[8px] font-black px-2 py-0.5 rounded uppercase italic">TERMINÉ</div>
                        )}
                        <p className={cn(
                            "text-xs font-black italic mt-1",
                            isWinner ? "text-brand-gold" : "text-gray-500"
                        )}>
                            {isWinner ? "+" : "-"}{formatFCFA(room.stakePerPosition)}
                        </p>
                    </div>
                  </div>

                  <div className="flex justify-between items-center text-[9px] font-black uppercase text-gray-500 italic">
                    <div className="flex items-center gap-2">
                        <Clock size={12} />
                        <span>{new Date(room.updatedAt?.seconds * 1000).toLocaleDateString()}</span>
                    </div>
                    <div className="flex items-center gap-1">
                        <span>Position {userPos}</span>
                        <ChevronRight size={12} />
                    </div>
                  </div>
                </Link>
              </motion.div>
            );
          })
        ) : (
          <div className="card py-20 flex flex-col items-center justify-center text-center gap-4 opacity-30 border-dashed">
            <Box size={40} />
            <div>
                <p className="text-xs font-black uppercase">Aucun historique trouvé</p>
                <p className="text-[10px] font-bold">Tes parties terminées apparaîtront ici.</p>
            </div>
            <Link to="/lobby" className="text-brand-red text-[10px] font-black uppercase underline">Jouer maintenant</Link>
          </div>
        )}
      </div>
    </div>
  );
}
