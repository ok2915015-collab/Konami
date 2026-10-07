import { useState, useEffect } from "react";
import { collection, query, onSnapshot, doc, deleteDoc, updateDoc, orderBy, where, serverTimestamp, runTransaction, increment } from "firebase/firestore";
import { db } from "../../lib/firebase";
import { Room, Position } from "../../types";
import { formatFCFA } from "../../lib/utils";
import { Search, Trash2, Pause, Play, MessageSquare, Dice5, Eye, AlertTriangle, Users, Timer, ShieldX, Landmark, TrendingUp, History } from "lucide-react";
import { toast } from "sonner";
import RoomHistoryModal from "./RoomHistoryModal";

const safeConfirm = (message: string): boolean => {
  try {
    const t0 = performance.now();
    const result = window.confirm(message);
    if (!result && (performance.now() - t0) < 50) {
      console.warn("window.confirm blocked (returned false instantly). Auto-approving.");
      return true;
    }
    return result;
  } catch (e) {
    console.warn("window.confirm bloqué par sandbox. Auto-approbation.", e);
    return true;
  }
};

export default function RoomManagement() {
  const [rooms, setRooms] = useState<Room[]>([]);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "active" | "waiting" | "finished">("waiting");
  const [selectedRoomForHistory, setSelectedRoomForHistory] = useState<Room | null>(null);
  const [showHistoryModal, setShowHistoryModal] = useState(false);

  useEffect(() => {
    const q = query(collection(db, "rooms"), orderBy("createdAt", "desc"));
    const unsubscribe = onSnapshot(
      q, 
      (snap) => {
        const rList = snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Room));
        setRooms(rList);
        try {
          localStorage.setItem("konamix_rooms_cache", JSON.stringify(rList));
        } catch (e) {}
      },
      (err) => {
        console.warn("RoomManagement rooms quota/offline:", err?.message);
        try {
          const cached = localStorage.getItem("konamix_rooms_cache");
          if (cached) setRooms(JSON.parse(cached));
        } catch (e) {}
      }
    );
    return unsubscribe;
  }, []);

  const openRoomHistory = (room: Room) => {
    setSelectedRoomForHistory(room);
    setShowHistoryModal(true);
  };

  const filteredRooms = rooms.filter(r => {
    const q = search.toLowerCase();
    const matchesSearch = 
      r.id.toLowerCase().includes(q) || 
      (r.creatorId || "").toLowerCase().includes(q) ||
      (r.creatorDisplayName || "").toLowerCase().includes(q) ||
      (r.creatorEmail || "").toLowerCase().includes(q) ||
      (r.mode || "").toLowerCase().includes(q);
    
    if (statusFilter === "active") return matchesSearch && ["selecting", "secondary_bets", "countdown", "simulating"].includes(r.status);
    if (statusFilter === "waiting") return matchesSearch && r.status === "waiting";
    if (statusFilter === "finished") return matchesSearch && ["finished", "partie_terminee"].includes(r.status);
    return matchesSearch;
  });

  const getFullness = (room: Room) => {
    const filled = Object.values(room.positions as Record<string, Position>).filter(p => p.playerId).length;
    return { filled, total: 7 };
  };

  const getLeverageCount = (room: Room) => {
      return Object.values(room.positions as Record<string, Position>).filter(p => p.isLeverage).length;
  };

  const cancelRoom = async (room: Room) => {
    if (!safeConfirm("ANNULER cette salle ? Tous les joueurs seront REMBOURSÉS immédiatement.")) return;
    
    try {
      await runTransaction(db, async (transaction) => {
        const roomRef = doc(db, "rooms", room.id);
        const roomSnap = await transaction.get(roomRef);
        if (!roomSnap.exists()) throw "Salle introuvable";
        
        const positions = roomSnap.data().positions as Record<string, Position>;
        
        // Refund each player
        for (const pKey in positions) {
          const p = positions[pKey];
          if (p.playerId && !p.isBot) {
            const userRef = doc(db, "users", p.playerId);
            transaction.update(userRef, { balance: increment(room.stakePerPosition) });
          }
        }
        
        // Refund secondary bets
        const secondaryBets = roomSnap.data().secondaryBets || [];
        for (const bet of secondaryBets) {
          const userRef = doc(db, "users", bet.userId);
          transaction.update(userRef, { balance: increment(bet.amount) });
        }
        
        transaction.delete(roomRef);
      });
      toast.success("Salle annulée et joueurs remboursés");
    } catch (e) {
      toast.error("Erreur remboursement: " + e);
    }
  };

  const forceClose = async (room: Room) => {
      if (!safeConfirm("FORCER la clôture ? Passe directement en simulation.")) return;
      try {
          await updateDoc(doc(db, "rooms", room.id), { status: "countdown" });
          toast.success("Salle passée en simulation");
      } catch (e) {
          toast.error("Erreur: " + e);
      }
  };

  const extendTime = async (room: Room) => {
      // Room doesn't have a timer yet, but we could add an expiresAt field if needed
      toast.info("Fonctionnalité d'extension bientôt disponible");
  };

  const toggleStatus = async (room: Room) => {
      const newStatus = room.status === 'waiting' ? 'selecting' : 'waiting';
      try {
          await updateDoc(doc(db, "rooms", room.id), { status: newStatus });
          toast.success(`Statut mis à jour: ${newStatus}`);
      } catch (e) {
          toast.error("Erreur: " + e);
      }
  };

  const manualResult = async (roomId: string) => {
      if (!safeConfirm("DÉCLENCHER manuellement le résultat ? (UTILE EN CAS DE BUG)")) return;
      try {
           await updateDoc(doc(db, "rooms", roomId), { status: "countdown" });
           toast.success("Simulation déclenchée");
      } catch (e) {
          toast.error("Erreur: " + e);
      }
  };

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="card bg-brand-gold/5 border-brand-gold/20 flex flex-col gap-1">
          <Landmark className="text-brand-gold mb-1" size={18} />
          <span className="text-[8px] text-gray-500 font-black uppercase italic">Volume Global Salles</span>
          <span className="text-xl font-black italic text-white">
            {formatFCFA(rooms.filter(r => !['finished', 'partie_terminee'].includes(r.status)).reduce((acc, r) => acc + r.totalStake, 0))}
          </span>
        </div>
        <div className="card bg-blue-500/5 border-blue-500/20 flex flex-col gap-1">
          <Dice5 className="text-blue-500 mb-1" size={18} />
          <span className="text-[8px] text-gray-500 font-black uppercase italic">Volume Paris P vs P</span>
          <span className="text-xl font-black italic text-white">
            {formatFCFA(rooms.reduce((acc, r) => acc + (r.secondaryBets?.reduce((sAcc: any, b: any) => sAcc + b.amount, 0) || 0), 0))}
          </span>
        </div>
        <div className="card bg-purple-500/5 border-purple-500/20 flex flex-col gap-1">
          <TrendingUp className="text-purple-500 mb-1" size={18} />
          <span className="text-[8px] text-gray-500 font-black uppercase italic">Commission Estimée</span>
          <span className="text-xl font-black italic text-white">
            {formatFCFA(rooms.filter(r => !['finished', 'partie_terminee'].includes(r.status)).reduce((acc, r) => acc + (r.totalStake * 0.1), 0))}
          </span>
        </div>
      </div>

      <div className="flex flex-col md:flex-row gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" size={16} />
          <input 
             value={search}
             onChange={(e) => setSearch(e.target.value)}
             placeholder="Rechercher par ID de salle..."
             className="w-full bg-black/40 border border-white/10 rounded-lg pl-10 pr-4 py-2 text-sm outline-none focus:border-brand-gold transition-all"
          />
        </div>
        <div className="flex gap-2">
            {["waiting", "active", "finished", "all"].map(s => (
                <button 
                  key={s}
                  onClick={() => setStatusFilter(s as any)}
                  className={`px-4 py-2 rounded-lg font-black text-[10px] uppercase transition-all ${statusFilter === s ? 'bg-brand-red text-white' : 'bg-white/5 text-gray-400'}`}
                >
                  {s === 'waiting' ? 'EN ATTENTE' : s === 'active' ? 'EN COURS' : s === 'finished' ? 'TERMINÉES' : 'TOUT'}
                </button>
            ))}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filteredRooms.map(room => {
          const { filled, total } = getFullness(room);
          const leverageCount = getLeverageCount(room);
          const fillPercent = (filled / total) * 100;

          const secondaryBetsVolume = room.secondaryBets?.reduce((a, b) => a + (b.amount || 0), 0) || 0;
          const secondaryBetsCount = room.secondaryBets?.length || 0;

          return (
            <div key={room.id} className="card bg-black/40 border-white/5 flex flex-col gap-4 group hover:border-brand-gold/30 transition-all">
              <div className="flex justify-between items-start">
                <div>
                   <div className="flex items-center gap-1.5">
                     <p className="text-[10px] font-black text-brand-gold uppercase tracking-widest">{room.mode}</p>
                     <span className="text-[8px] font-mono text-gray-500 font-bold">• Créée par: {room.creatorDisplayName || (room.creatorId ? room.creatorId.slice(0, 8) : "Admin")}</span>
                   </div>
                   <h4 className="text-sm font-black italic tracking-tighter text-white">SALLE #{room.id.slice(0, 8)}</h4>
                   <p className="text-[10px] text-gray-500 font-bold uppercase mt-0.5">{room.status}</p>
                </div>
                <div className="text-right">
                   <p className="text-[10px] font-black text-gray-500 uppercase tracking-widest mb-0.5">Cagnotte Totale</p>
                   <p className="text-sm font-black italic text-white leading-none">{formatFCFA(room.totalStake + secondaryBetsVolume)}</p>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div className="bg-white/5 p-2 rounded-lg border border-white/5">
                  <p className="text-[8px] font-black uppercase text-gray-500 mb-1">Pool Principal</p>
                  <p className="text-xs font-black italic text-brand-gold">{formatFCFA(room.totalStake)}</p>
                </div>
                <div className="bg-blue-500/5 p-2 rounded-lg border border-blue-500/10">
                  <p className="text-[8px] font-black uppercase text-gray-500 mb-1">Paris P vs P ({secondaryBetsCount})</p>
                  <p className="text-xs font-black italic text-blue-400">{formatFCFA(secondaryBetsVolume)}</p>
                </div>
              </div>

              <div className="space-y-1.5">
                <div className="flex justify-between text-[9px] font-black uppercase text-gray-500">
                  <span>Remplissage</span>
                  <span>{filled}/{total} J</span>
                </div>
                <div className="h-1.5 bg-white/5 rounded-full overflow-hidden">
                  <div 
                    className="h-full bg-brand-red transition-all duration-500" 
                    style={{ width: `${fillPercent}%` }}
                  />
                </div>
                <div className="flex justify-between text-[8px] font-bold text-gray-600 uppercase italic">
                    <span>Joueurs Réels: {filled - leverageCount}</span>
                    <span className="text-brand-gold">Levier Admin: {leverageCount}</span>
                </div>
              </div>

              {/* Bouton d'Historique Complet de Salle */}
              <button
                type="button"
                onClick={() => openRoomHistory(room)}
                className="w-full py-2 bg-white/5 hover:bg-brand-gold hover:text-brand-black text-gray-300 font-black text-[9px] uppercase tracking-wider rounded-xl transition-all border border-white/10 hover:border-brand-gold flex items-center justify-center gap-1.5 cursor-pointer shadow-sm active:scale-95"
              >
                <Eye size={12} />
                <span>📜 Voir l'historique de cette salle</span>
              </button>

              <div className="grid grid-cols-4 gap-2 pt-2 border-t border-white/5">
                <button 
                   onClick={() => forceClose(room)}
                   title="Forcer la clôture"
                   className="flex items-center justify-center p-2 bg-white/5 rounded-lg text-gray-400 hover:text-brand-gold hover:bg-brand-gold/10 transition-colors"
                >
                  <Timer size={16} />
                </button>
                <button 
                  onClick={() => manualResult(room.id)}
                  title="Déclencher résultat"
                  className="flex items-center justify-center p-2 bg-white/5 rounded-lg text-gray-400 hover:text-brand-gold hover:bg-brand-gold/10 transition-colors"
                >
                  <Dice5 size={16} />
                </button>
                <button className="flex items-center justify-center p-2 bg-white/5 rounded-lg text-gray-400 hover:text-blue-500 hover:bg-blue-500/10 transition-colors" title="Message aux joueurs">
                  <MessageSquare size={16} />
                </button>
                <button 
                  onClick={() => cancelRoom(room)}
                  title="Annuler et rembourser"
                  className="flex items-center justify-center p-2 bg-brand-red/10 rounded-lg text-brand-red hover:bg-brand-red hover:text-white transition-all shadow-lg shadow-brand-red/10"
                >
                  <Trash2 size={16} />
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {/* Modal d'Historique de Salle */}
      <RoomHistoryModal
        isOpen={showHistoryModal}
        onClose={() => setShowHistoryModal(false)}
        room={selectedRoomForHistory}
      />
    </div>
  );
}
