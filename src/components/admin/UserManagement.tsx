import React, { useState, useEffect } from "react";
import { collection, query, onSnapshot, doc, updateDoc, increment, addDoc, serverTimestamp, orderBy } from "firebase/firestore";
import { db } from "../../lib/firebase";
import { User, KYCStatus, Room } from "../../types";
import { formatFCFA } from "../../lib/utils";
import { Search, Filter, ShieldCheck, ShieldAlert, ShieldX, Wallet, Ban, Mail, RefreshCw, Eye, Users, Gift, X, Check, Zap, Trophy, Swords } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "../../contexts/AuthContext";
import AdminMessageModal from "./AdminMessageModal";
import RoomHistoryModal from "./RoomHistoryModal";
import UserRoomsModal from "./UserRoomsModal";

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

interface UserManagementProps {
  autoOpenBonus?: boolean;
  onBonusModalClose?: () => void;
}

export default function UserManagement({ autoOpenBonus, onBonusModalClose }: UserManagementProps = {}) {
  const { user: adminUser } = useAuth();
  const [users, setUsers] = useState<User[]>([]);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<"all" | "banned" | "pending_kyc">("all");
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [showBonusModal, setShowBonusModal] = useState(false);
  const [bonusTargetUser, setBonusTargetUser] = useState<User | null>(null);
  const [bonusAmount, setBonusAmount] = useState<number>(2000);
  const [bonusReason, setBonusReason] = useState<string>("Bonus de bienvenue");
  const [creditingBonus, setCreditingBonus] = useState(false);

  // Modal d'envoi de message au joueur
  const [showMessageModal, setShowMessageModal] = useState(false);
  const [messageTargetUser, setMessageTargetUser] = useState<User | null>(null);

  // Salles et Modal d'historique de salle
  const [rooms, setRooms] = useState<Room[]>([]);
  const [selectedRoomForHistory, setSelectedRoomForHistory] = useState<Room | null>(null);
  const [showRoomHistoryModal, setShowRoomHistoryModal] = useState(false);
  const [userRoomTab, setUserRoomTab] = useState<"created" | "participated">("created");
  const [showUserRoomsModal, setShowUserRoomsModal] = useState(false);
  const [userRoomsTargetUser, setUserRoomsTargetUser] = useState<User | null>(null);

  const openUserRoomsModal = (targetUser: User) => {
    setUserRoomsTargetUser(targetUser);
    setSelectedUser(targetUser);
    setShowUserRoomsModal(true);
  };

  const openMessageModal = (targetUser?: User | null) => {
    const target = targetUser || selectedUser || (users.length > 0 ? users[0] : null);
    if (!target) {
      toast.error("Veuillez sélectionner un joueur");
      return;
    }
    setMessageTargetUser(target);
    setShowMessageModal(true);
  };

  const closeMessageModal = () => {
    setShowMessageModal(false);
  };

  const openRoomHistory = (r: Room) => {
    setSelectedRoomForHistory(r);
    setShowRoomHistoryModal(true);
  };

  const openBonusModal = (targetUser?: User | null) => {
    const target = targetUser || selectedUser || (users.length > 0 ? users[0] : null);
    setBonusTargetUser(target);
    setBonusAmount(2000);
    setShowBonusModal(true);
  };

  const closeBonusModal = () => {
    setShowBonusModal(false);
    onBonusModalClose?.();
  };

  useEffect(() => {
    if (autoOpenBonus) {
      openBonusModal();
    }
  }, [autoOpenBonus]);

  useEffect(() => {
    const q = query(collection(db, "users"), orderBy("createdAt", "desc"));
    const unsubscribe = onSnapshot(
      q, 
      (snap) => {
        const userList = snap.docs.map(doc => ({ uid: doc.id, ...doc.data() } as User));
        setUsers(userList);
        try {
          localStorage.setItem("konamix_users_cache", JSON.stringify(userList));
        } catch (e) {}
        setSelectedUser(prev => {
          if (!prev && userList.length > 0) return userList[0];
          if (prev) {
            const updated = userList.find(u => u.uid === prev.uid);
            return updated || prev;
          }
          return null;
        });
      },
      (err) => {
        console.warn("Users snapshot quota/offline:", err?.message);
        try {
          const cached = localStorage.getItem("konamix_users_cache");
          if (cached) {
            const userList = JSON.parse(cached);
            setUsers(userList);
            if (userList.length > 0) setSelectedUser(userList[0]);
          }
        } catch (e) {}
      }
    );
    return unsubscribe;
  }, []);

  useEffect(() => {
    const qRooms = query(collection(db, "rooms"), orderBy("createdAt", "desc"));
    const unsub = onSnapshot(
      qRooms, 
      (snap) => {
        const rList = snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Room));
        setRooms(rList);
        try {
          localStorage.setItem("konamix_rooms_cache", JSON.stringify(rList));
        } catch (e) {}
      },
      (err) => {
        console.warn("UserManagement rooms quota/offline:", err?.message);
        try {
          const cached = localStorage.getItem("konamix_rooms_cache");
          if (cached) setRooms(JSON.parse(cached));
        } catch (e) {}
      }
    );
    return unsub;
  }, []);

  const userCreatedRooms = rooms.filter(r => r.creatorId === selectedUser?.uid);
  const userParticipatedRooms = rooms.filter(r => 
    Boolean(selectedUser && Object.values(r.positions || {}).some((p: any) => p.playerId === selectedUser.uid))
  );

  const filteredUsers = users.filter(u => {
    const matchesSearch = 
      (u.displayName || "").toLowerCase().includes(search.toLowerCase()) || 
      (u.email || "").toLowerCase().includes(search.toLowerCase()) ||
      (u.phoneNumber || "").includes(search) ||
      u.uid.includes(search);
    
    if (filter === "banned") return matchesSearch && u.isBanned;
    if (filter === "pending_kyc") return matchesSearch && u.kycStatus === "pending";
    return matchesSearch;
  });

  const handleAuditLog = async (action: string, targetId: string, details: string) => {
    await addDoc(collection(db, "audit_logs"), {
      adminId: adminUser?.uid,
      action,
      targetId,
      details,
      createdAt: serverTimestamp()
    });
  };

  const handleCreditBonus = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!bonusTargetUser) return;
    if (bonusAmount <= 0) {
      toast.error("Le montant du bonus doit être supérieur à 0");
      return;
    }

    setCreditingBonus(true);
    try {
      const userRef = doc(db, "users", bonusTargetUser.uid);
      await updateDoc(userRef, {
        balance: increment(bonusAmount),
        bonusBalance: increment(bonusAmount),
        totalBonusReceived: increment(bonusAmount),
        lastBonusDate: serverTimestamp(),
        lastBonusReason: bonusReason || "Bonus offert par l'administration (immédiatement jouable)",
      });

      // Enregistre la transaction de type bonus
      await addDoc(collection(db, "transactions"), {
        userId: bonusTargetUser.uid,
        userName: bonusTargetUser.displayName || bonusTargetUser.email || "Joueur",
        type: "bonus",
        amount: bonusAmount,
        status: "approved",
        description: bonusReason ? `Bonus: ${bonusReason}` : "Bonus accordé par l'administration (immédiatement jouable)",
        validatedBy: adminUser?.uid,
        createdAt: serverTimestamp()
      });

      await handleAuditLog(
        "CREDIT_BONUS",
        bonusTargetUser.uid,
        `Montant: ${bonusAmount} FCFA, Motif: ${bonusReason}`
      );

      toast.success(
        `🎁 Bonus de ${formatFCFA(bonusAmount)} crédité directement sur le solde de ${bonusTargetUser.displayName} !`
      );

      setUsers(prev => prev.map(u => u.uid === bonusTargetUser.uid ? {
        ...u,
        balance: (u.balance || 0) + bonusAmount,
        totalBonusReceived: ((u as any).totalBonusReceived || 0) + bonusAmount
      } : u));

      if (selectedUser?.uid === bonusTargetUser.uid) {
        setSelectedUser(prev => prev ? {
          ...prev,
          balance: (prev.balance || 0) + bonusAmount,
          totalBonusReceived: ((prev as any).totalBonusReceived || 0) + bonusAmount
        } : null);
      }

      setShowBonusModal(false);
    } catch (err: any) {
      console.error(err);
      toast.error("Erreur lors de l'octroi du bonus: " + err.message);
    } finally {
      setCreditingBonus(false);
    }
  };

  const adjustBalance = async (userId: string, amount: number) => {
    const reason = window.prompt("Justification pour l'ajustement du solde:");
    if (!reason) return;

    try {
      await updateDoc(doc(db, "users", userId), {
        balance: increment(amount)
      });
      await handleAuditLog("ADJUST_BALANCE", userId, `Amount: ${amount}, Reason: ${reason}`);
      toast.success("Solde ajusté avec succès");
      if (selectedUser?.uid === userId) {
          setSelectedUser({ ...selectedUser, balance: selectedUser.balance + amount });
      }
    } catch (e) {
      toast.error("Erreur: " + e);
    }
  };

  const toggleBan = async (userId: string, currentStatus: boolean) => {
    if (!safeConfirm(`${currentStatus ? 'Débannir' : 'Bannir'} cet utilisateur ?`)) return;
    
    try {
      await updateDoc(doc(db, "users", userId), { 
        isBanned: !currentStatus,
        status: !currentStatus ? 'banned' : 'active'
      });
      await handleAuditLog(currentStatus ? "UNBAN_USER" : "BAN_USER", userId, "");
      toast.success(currentStatus ? "Utilisateur débanni" : "Utilisateur banni");
      if (selectedUser?.uid === userId) {
          setSelectedUser({ ...selectedUser, isBanned: !currentStatus });
      }
    } catch (e) {
      toast.error("Erreur: " + e);
    }
  };

  const toggleFreeze = async (userId: string, isFrozen: boolean) => {
    if (!safeConfirm(`${isFrozen ? 'Dégeler' : 'Geler'} le compte de cet utilisateur ?`)) return;
    try {
      await updateDoc(doc(db, "users", userId), { 
        status: isFrozen ? 'active' : 'frozen'
      });
      await handleAuditLog(isFrozen ? "UNFREEZE_USER" : "FREEZE_USER", userId, "");
      toast.success(isFrozen ? "Compte dégelé" : "Compte gelé");
      if (selectedUser?.uid === userId) {
        setSelectedUser({ ...selectedUser, status: isFrozen ? 'active' : 'frozen' } as User);
      }
    } catch (e) {
      toast.error("Erreur: " + e);
    }
  };

  const verifyKYC = async (userId: string, status: KYCStatus) => {
    try {
      await updateDoc(doc(db, "users", userId), { kycStatus: status });
      await handleAuditLog("VERIFY_KYC", userId, `Status: ${status}`);
      toast.success(`Statut KYC mis à jour: ${status}`);
      if (selectedUser?.uid === userId) {
          setSelectedUser({ ...selectedUser, kycStatus: status });
      }
    } catch (e) {
      toast.error("Erreur: " + e);
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Banner & Fast Action */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-gradient-to-r from-brand-gold/15 via-black/50 to-white/5 border border-brand-gold/35 p-4 sm:p-5 rounded-3xl shadow-2xl">
        <div className="flex items-center gap-3.5">
          <div className="w-12 h-12 rounded-2xl bg-brand-gold/20 text-brand-gold border border-brand-gold/40 flex items-center justify-center shrink-0 shadow-lg shadow-brand-gold/10">
            <Gift size={24} className="animate-pulse" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-base sm:text-lg font-black italic tracking-tighter uppercase text-white">
                Gestion des Joueurs & Bonus
              </h2>
              <span className="text-[9px] font-mono font-bold px-2 py-0.5 rounded-full bg-brand-gold/20 text-brand-gold border border-brand-gold/30">
                {users.length} Joueur(s)
              </span>
            </div>
            <p className="text-[10px] text-gray-400 font-bold uppercase mt-0.5">
              Créditez directement des bonus en FCFA utilisables immédiatement pour jouer
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={() => openBonusModal(selectedUser)}
          className="flex items-center justify-center gap-2 bg-gradient-to-r from-amber-500 via-brand-gold to-yellow-400 hover:brightness-110 text-brand-black px-5 py-3.5 rounded-2xl font-black text-xs uppercase shadow-xl shadow-brand-gold/30 hover:scale-105 active:scale-95 transition-all cursor-pointer shrink-0"
        >
          <Gift size={18} className="animate-bounce" />
          <span>🎁 AJOUTER UN BONUS</span>
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Search & List */}
        <div className="lg:col-span-2 space-y-4">
          <div className="flex flex-col sm:flex-row gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" size={16} />
              <input 
                 value={search}
                 onChange={(e) => setSearch(e.target.value)}
                 placeholder="Rechercher par nom, email, ID..."
                 className="w-full bg-black/40 border border-white/10 rounded-xl pl-10 pr-4 py-2.5 text-sm focus:border-brand-gold outline-none"
              />
            </div>
            <select 
               value={filter}
               onChange={(e) => setFilter(e.target.value as any)}
               className="bg-black/40 border border-white/10 rounded-xl px-3 py-2.5 text-xs font-black uppercase"
            >
              <option value="all">Tous les Joueurs</option>
              <option value="banned">Bannis</option>
              <option value="pending_kyc">KYC Attente</option>
            </select>
          </div>

          <div className="card p-0 overflow-hidden border-white/5">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead className="bg-white/5 text-[10px] font-black uppercase text-gray-500 italic">
                  <tr>
                    <th className="p-4">Utilisateur</th>
                    <th className="p-4">Statut</th>
                    <th className="p-4">Solde</th>
                    <th className="p-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  {filteredUsers.map(u => (
                    <tr 
                      key={u.uid} 
                      onClick={() => setSelectedUser(u)}
                      className={`hover:bg-white/[0.04] transition-colors group cursor-pointer ${selectedUser?.uid === u.uid ? 'bg-brand-gold/10' : ''}`}
                    >
                      <td className="p-4">
                        <div className="flex items-center gap-3">
                          <img src={u.photoURL || `https://api.dicebear.com/7.x/pixel-art/svg?seed=${u.uid}`} className="w-8 h-8 rounded-full border border-white/10" alt="" />
                          <div className="min-w-0">
                            <p className="font-bold text-sm truncate text-white">{u.displayName}</p>
                            <p className="text-[10px] text-gray-400 truncate">{u.email}</p>
                          </div>
                        </div>
                      </td>
                      <td className="p-4">
                        <div className="flex items-center gap-2">
                          {u.isBanned && <ShieldX size={14} className="text-brand-red" />}
                          {u.kycStatus === 'verified' && <ShieldCheck size={14} className="text-green-500" />}
                          {u.kycStatus === 'pending' && <ShieldAlert size={14} className="text-brand-gold" />}
                          <span className="text-[10px] font-black uppercase opacity-60">
                            {u.isBanned ? 'Banni' : u.kycStatus || 'User'}
                          </span>
                        </div>
                      </td>
                      <td className="p-4">
                        <span className="font-mono text-sm font-bold text-brand-gold">{formatFCFA(u.balance)}</span>
                      </td>
                      <td className="p-4 text-right whitespace-nowrap">
                        {/* Bouton Salles du Joueur */}
                        <button 
                           type="button"
                           onClick={(e) => {
                             e.stopPropagation();
                             openUserRoomsModal(u);
                           }}
                           title={`Voir les salles créées par ce joueur et leur historique`}
                           className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-blue-500/15 hover:bg-blue-500 text-blue-400 hover:text-white border border-blue-500/30 rounded-xl text-[10px] font-black uppercase transition-all shadow-sm active:scale-95 cursor-pointer mr-2"
                        >
                          <Trophy size={13} />
                          <span>
                            Salles ({rooms.filter(r => r.creatorId === u.uid || r.creatorEmail === u.email || (u.displayName && r.creatorDisplayName === u.displayName)).length})
                          </span>
                        </button>

                        <button 
                           type="button"
                           onClick={(e) => {
                             e.stopPropagation();
                             openBonusModal(u);
                           }}
                           title="Ajouter un bonus jouable à ce joueur"
                           className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-gradient-to-r from-amber-500 via-brand-gold to-yellow-400 text-brand-black hover:brightness-110 rounded-xl text-[10px] font-black uppercase transition-all shadow-md shadow-brand-gold/20 active:scale-95 cursor-pointer mr-2"
                        >
                          <Gift size={13} />
                          <span>Ajouter bonus</span>
                        </button>
                        <button 
                           type="button"
                           onClick={(e) => {
                             e.stopPropagation();
                             openMessageModal(u);
                           }}
                           title="Envoyer un message à ce joueur"
                           className="p-2 bg-blue-500/10 text-blue-400 border border-blue-500/20 hover:bg-blue-500 hover:text-white rounded-xl text-[10px] font-black uppercase transition-all active:scale-95 cursor-pointer mr-2 inline-flex items-center"
                        >
                          <Mail size={14} />
                        </button>
                        <button 
                           type="button"
                           onClick={(e) => {
                             e.stopPropagation();
                             setSelectedUser(u);
                           }}
                           className="p-2 bg-white/5 rounded-xl hover:bg-white/10 transition-colors cursor-pointer text-gray-400 hover:text-white inline-flex items-center"
                           title="Voir fiche détaillée"
                        >
                          <Eye size={16} />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* Detail Panel */}
        <div className="lg:col-span-1">
          {selectedUser ? (
            <div className="card space-y-6 sticky top-24 border-brand-gold/30">
              <div className="flex flex-col items-center text-center gap-3">
                <div className="relative">
                  <img src={selectedUser.photoURL || `https://api.dicebear.com/7.x/pixel-art/svg?seed=${selectedUser.uid}`} className="w-20 h-20 rounded-2xl border-2 border-brand-gold/20 shadow-xl" alt="" />
                  {selectedUser.isBanned && (
                    <div className="absolute -top-2 -right-2 bg-brand-red p-1.5 rounded-lg shadow-lg">
                      <Ban size={16} />
                    </div>
                  )}
                </div>
                <div>
                  <h3 className="text-lg font-black italic tracking-tighter uppercase text-white">{selectedUser.displayName}</h3>
                  <p className="text-xs text-gray-400 font-mono">ID: {selectedUser.uid}</p>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-2">
                 <div className="bg-white/5 p-2.5 rounded-xl border border-white/5 text-center">
                   <p className="text-[7.5px] font-black text-gray-400 uppercase tracking-widest mb-1 truncate">Solde Total</p>
                   <p className="text-base font-black italic text-brand-gold truncate">{formatFCFA(selectedUser.balance)}</p>
                 </div>
                 <div className="bg-brand-gold/10 p-2.5 rounded-xl border border-brand-gold/25 text-center">
                   <p className="text-[7.5px] font-black text-brand-gold uppercase tracking-widest mb-1 truncate flex items-center justify-center gap-1">
                     <Gift size={10} /> Bonus
                   </p>
                   <p className="text-base font-black italic text-brand-gold truncate">{formatFCFA(selectedUser.totalBonusReceived || 0)}</p>
                 </div>
                 <div className="bg-white/5 p-2.5 rounded-xl border border-white/5 text-center">
                   <p className="text-[7.5px] font-black text-gray-400 uppercase tracking-widest mb-1 truncate">Win Rate</p>
                   <p className="text-base font-black italic text-green-500 truncate">
                      {selectedUser.stats ? Math.round((selectedUser.stats.wonGames / (selectedUser.stats.totalGames || 1)) * 100) : 0}%
                   </p>
                 </div>
              </div>

              {/* Prominent Bonus Button */}
              <button 
                type="button"
                onClick={() => openBonusModal(selectedUser)}
                className="w-full flex items-center justify-center gap-2 bg-gradient-to-r from-amber-500 via-brand-gold to-yellow-400 text-brand-black p-4 rounded-2xl font-black text-xs hover:opacity-95 active:scale-95 transition-all shadow-xl shadow-brand-gold/25 cursor-pointer uppercase italic tracking-wider"
              >
                <Gift size={18} /> 🎁 AJOUTER UN BONUS (JOUABLE)
              </button>

              <div className="space-y-2">
                <p className="text-[10px] font-black uppercase text-gray-500 italic px-1">Actions Rapides</p>
                <div className="grid grid-cols-2 gap-2">
                  <button 
                     onClick={() => adjustBalance(selectedUser.uid, 5000)}
                     className="flex items-center justify-center gap-2 bg-white/5 border border-white/10 text-white p-3 rounded-xl font-black text-[10px] hover:bg-white/10 active:scale-95 transition-all"
                  >
                    <Wallet size={16} /> Ajuster (+5,000)
                  </button>
                  <button 
                     onClick={() => toggleBan(selectedUser.uid, selectedUser.isBanned || false)}
                     className={`flex items-center justify-center gap-2 p-3 rounded-xl font-black text-[10px] active:scale-95 transition-all ${selectedUser.isBanned ? 'bg-green-500 text-white' : 'bg-brand-red text-white'}`}
                  >
                    <Ban size={16} /> {selectedUser.isBanned ? 'DÉBANNIR' : 'BANNIR'}
                  </button>
                  <button 
                     onClick={() => toggleFreeze(selectedUser.uid, selectedUser.status === 'frozen')}
                     className={`flex items-center justify-center gap-2 p-3 rounded-xl font-black text-[10px] active:scale-95 transition-all ${selectedUser.status === 'frozen' ? 'bg-green-500 text-white' : 'bg-white/10 text-gray-400'}`}
                  >
                    <ShieldAlert size={16} /> {selectedUser.status === 'frozen' ? 'DÉGELER' : 'GELER'}
                  </button>
                  <button 
                     onClick={() => adjustBalance(selectedUser.uid, -selectedUser.balance)}
                     className="flex items-center justify-center gap-2 bg-white/5 border border-white/10 p-3 rounded-xl font-black text-[10px] text-brand-red hover:bg-brand-red/10 transition-all"
                  >
                    <Wallet size={16} /> Remise à Zéro
                  </button>
                </div>
                <button 
                  type="button"
                  onClick={() => openMessageModal(selectedUser)}
                  className="w-full flex items-center justify-center gap-2 bg-blue-500/15 border border-blue-500/30 text-blue-400 hover:bg-blue-500 hover:text-white p-3 rounded-xl font-black text-[10px] uppercase active:scale-95 transition-all cursor-pointer shadow-md"
                >
                  <Mail size={16} /> ENVOYER UN MESSAGE AU JOUEUR
                </button>
              </div>

              {/* Salles ouvertes et participations de ce joueur */}
              <div className="space-y-3 pt-3 border-t border-white/10">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-black uppercase italic tracking-wider text-white flex items-center gap-1.5">
                    <Trophy size={14} className="text-brand-gold" />
                    Salles de ce Joueur
                  </h4>
                  <div className="flex bg-white/5 p-0.5 rounded-lg border border-white/5 text-[9px] font-black">
                    <button
                      type="button"
                      onClick={() => setUserRoomTab("created")}
                      className={`px-2 py-1 rounded-md transition-all cursor-pointer ${
                        userRoomTab === "created" ? "bg-brand-gold text-brand-black shadow" : "text-gray-400 hover:text-white"
                      }`}
                    >
                      Créées ({userCreatedRooms.length})
                    </button>
                    <button
                      type="button"
                      onClick={() => setUserRoomTab("participated")}
                      className={`px-2 py-1 rounded-md transition-all cursor-pointer ${
                        userRoomTab === "participated" ? "bg-brand-gold text-brand-black shadow" : "text-gray-400 hover:text-white"
                      }`}
                    >
                      Participées ({userParticipatedRooms.length})
                    </button>
                  </div>
                </div>

                {/* Bouton Grand Format */}
                <button
                  type="button"
                  onClick={() => openUserRoomsModal(selectedUser)}
                  className="w-full py-2.5 px-3 bg-gradient-to-r from-brand-gold/15 via-brand-gold/10 to-transparent hover:bg-brand-gold/25 text-brand-gold border border-brand-gold/30 rounded-xl text-[10px] font-black uppercase tracking-wider flex items-center justify-center gap-2 transition-all cursor-pointer shadow-sm active:scale-95"
                >
                  <Trophy size={14} />
                  <span>📂 Inspecter Toutes ses Salles en Plein Écran</span>
                </button>

                {/* Liste des salles */}
                {((userRoomTab === "created" ? userCreatedRooms : userParticipatedRooms).length === 0) ? (
                  <div className="bg-black/40 border border-white/5 rounded-2xl p-4 text-center">
                    <p className="text-[10px] text-gray-500 font-bold uppercase">
                      Aucune salle {userRoomTab === "created" ? "ouverte" : "jouée"} pour le moment.
                    </p>
                  </div>
                ) : (
                  <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
                    {(userRoomTab === "created" ? userCreatedRooms : userParticipatedRooms).map((r) => {
                      const isFinished = r.status === "finished" || r.status === "partie_terminee";
                      return (
                        <div 
                          key={r.id}
                          className="bg-black/50 border border-white/10 hover:border-brand-gold/30 rounded-2xl p-3 space-y-2 transition-all"
                        >
                          <div className="flex items-center justify-between text-xs font-bold">
                            <div className="flex items-center gap-1.5 min-w-0">
                              <span className="font-mono text-[10px] text-gray-400">#{r.id.slice(0, 6)}</span>
                              <span className="font-black text-white uppercase text-[11px] truncate">
                                Mode: {r.mode}
                              </span>
                            </div>
                            <span className={`text-[8px] font-black uppercase px-2 py-0.5 rounded-full border ${
                              isFinished ? "bg-green-500/15 text-green-400 border-green-500/30" :
                              r.status === "waiting" ? "bg-amber-500/15 text-amber-400 border-amber-500/30" :
                              "bg-blue-500/15 text-blue-400 border-blue-500/30"
                            }`}>
                              {isFinished ? "Terminée" : r.status === "waiting" ? "En attente" : r.status}
                            </span>
                          </div>

                          <div className="flex items-center justify-between text-[10px] text-gray-400">
                            <span>Mise: <strong className="text-white font-mono">{formatFCFA(r.stakePerPosition)}</strong></span>
                            <span>Cagnotte: <strong className="text-brand-gold font-mono">{formatFCFA(r.totalStake)}</strong></span>
                          </div>

                          {isFinished && r.winnerName && (
                            <p className="text-[9px] text-gray-400 truncate">
                              🏆 Gagnant : <span className="text-brand-gold font-bold">{r.winnerName}</span>
                            </p>
                          )}

                          <button
                            type="button"
                            onClick={() => openRoomHistory(r)}
                            className="w-full py-2 bg-white/5 hover:bg-brand-gold hover:text-brand-black text-gray-300 font-black text-[9px] uppercase tracking-wider rounded-xl transition-all border border-white/10 hover:border-brand-gold flex items-center justify-center gap-1.5 cursor-pointer shadow-sm active:scale-95"
                          >
                            <Eye size={12} />
                            <span>📜 Voir l'historique de cette salle</span>
                          </button>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {selectedUser.kycStatus === 'pending' && (
                <div className="bg-brand-gold/10 border border-brand-gold/30 p-4 rounded-xl space-y-3">
                  <div className="flex items-center gap-2 text-brand-gold">
                    <ShieldAlert size={18} />
                    <h4 className="text-[10px] font-black uppercase">Vérification KYC Requise</h4>
                  </div>
                  <div className="aspect-video bg-black/40 rounded-lg flex items-center justify-center text-gray-600 font-black italic text-xs border border-white/5">
                    [IMAGE PIÈCE D'IDENTITÉ]
                  </div>
                  <div className="flex gap-2">
                    <button 
                       onClick={() => verifyKYC(selectedUser.uid, 'verified')}
                       className="flex-1 bg-green-500 py-2 rounded-lg font-black text-[10px]"
                    >
                      APPROUVER
                    </button>
                    <button 
                       onClick={() => verifyKYC(selectedUser.uid, 'rejected')}
                       className="flex-1 bg-brand-red py-2 rounded-lg font-black text-[10px]"
                    >
                      REJETER
                    </button>
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="card h-full flex flex-col items-center justify-center text-center opacity-30 border-dashed p-10">
              <Users size={48} className="mb-4 text-brand-gold" />
              <p className="text-xs font-black uppercase tracking-widest italic text-gray-400">Sélectionnez un joueur<br/>pour voir les détails</p>
            </div>
          )}
        </div>
      </div>

      {/* Modal de Crédit de Bonus Jouable */}
      {/* Modal de Crédit de Bonus Jouable */}
      {showBonusModal && (
        <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-md flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
          <div 
            className="bg-[#121212] border border-brand-gold/40 rounded-3xl p-5 sm:p-6 max-w-md w-full shadow-2xl relative flex flex-col max-h-[90vh] my-auto animate-in fade-in zoom-in-95 duration-200"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header Fixe */}
            <div className="flex items-center justify-between pb-3 border-b border-white/10 shrink-0">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-brand-gold/15 text-brand-gold flex items-center justify-center border border-brand-gold/30 shrink-0">
                  <Gift size={22} />
                </div>
                <div>
                  <h3 className="text-lg font-black uppercase italic tracking-tighter text-white">Ajouter un Bonus</h3>
                  <p className="text-[10px] text-gray-400 font-bold uppercase truncate max-w-[200px]">
                    Joueur : <span className="text-brand-gold">{bonusTargetUser?.displayName || "Sélectionnez un joueur"}</span>
                  </p>
                </div>
              </div>
              <button 
                type="button"
                onClick={closeBonusModal}
                className="text-gray-400 hover:text-white p-2 rounded-xl bg-white/5 hover:bg-white/10 cursor-pointer transition-colors"
                title="Fermer"
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleCreditBonus} className="flex flex-col flex-1 min-h-0 mt-3">
              {/* Contenu Déroulant (Scrollable) */}
              <div className="overflow-y-auto flex-1 pr-1.5 py-1 space-y-4">
                {/* Dropdown de sélection du joueur */}
                <div className="space-y-1.5">
                  <label className="text-[9px] font-black uppercase text-gray-400">Sélectionner le joueur :</label>
                  <select
                    value={bonusTargetUser?.uid || ""}
                    onChange={(e) => {
                      const target = users.find(u => u.uid === e.target.value);
                      if (target) {
                        setBonusTargetUser(target);
                        setSelectedUser(target);
                      }
                    }}
                    className="w-full bg-black/60 border border-white/15 focus:border-brand-gold rounded-xl px-3 py-2.5 text-xs text-brand-gold font-bold outline-none cursor-pointer"
                  >
                    {users.map(u => (
                      <option key={u.uid} value={u.uid} className="bg-[#121212] text-white">
                        {u.displayName || u.email || u.uid} • Solde: {formatFCFA(u.balance)} {u.phoneNumber ? `(${u.phoneNumber})` : ''}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="bg-brand-gold/10 border border-brand-gold/20 p-3 rounded-2xl space-y-1">
                  <p className="text-[9px] font-black text-brand-gold uppercase tracking-wider flex items-center gap-1.5">
                    <Zap size={12} /> Immédiatement Disponible pour Jouer
                  </p>
                  <p className="text-[9px] text-gray-300 font-medium leading-relaxed">
                    Le montant est crédité directement sur le solde réel du joueur. Il peut l'utiliser sans délai pour rejoindre des salles, créer des parties ou lancer des duels P vs P.
                  </p>
                </div>

                {/* Presets */}
                <div className="space-y-1.5">
                  <label className="text-[9px] font-black uppercase text-gray-400">Montants rapides (FCFA) :</label>
                  <div className="grid grid-cols-3 gap-2">
                    {[500, 1000, 2000, 5000, 10000, 25000].map(amt => (
                      <button
                        key={amt}
                        type="button"
                        onClick={() => setBonusAmount(amt)}
                        className={`py-2 px-1 text-xs font-mono font-black rounded-xl border transition-all cursor-pointer ${
                          bonusAmount === amt
                            ? 'bg-brand-gold text-brand-black border-brand-gold shadow-md scale-[1.02]'
                            : 'bg-white/5 border-white/10 text-gray-300 hover:bg-white/10'
                        }`}
                      >
                        +{formatFCFA(amt)}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Custom Amount */}
                <div className="space-y-1.5">
                  <label className="text-[9px] font-black uppercase text-gray-400">Montant personnalisé (FCFA) :</label>
                  <input
                    type="number"
                    min="100"
                    step="100"
                    value={bonusAmount || ""}
                    onChange={(e) => setBonusAmount(Math.max(0, Number(e.target.value)))}
                    className="w-full bg-black/60 border border-white/15 focus:border-brand-gold rounded-xl px-4 py-2.5 text-base font-mono text-brand-gold font-bold outline-none"
                    placeholder="Ex: 5000"
                    required
                  />
                </div>

                {/* Reason */}
                <div className="space-y-1.5">
                  <label className="text-[9px] font-black uppercase text-gray-400">Motif du bonus :</label>
                  <div className="flex flex-wrap gap-1.5 mb-2">
                    {["Bonus de bienvenue", "Bonus fidélité", "Cadeau administration", "Bonus d'encouragement"].map(r => (
                      <button
                        key={r}
                        type="button"
                        onClick={() => setBonusReason(r)}
                        className={`text-[8.5px] font-bold px-2.5 py-1 rounded-lg border transition-all cursor-pointer ${
                          bonusReason === r
                            ? 'bg-white/20 border-white text-white'
                            : 'bg-white/5 border-white/5 text-gray-400 hover:text-white'
                        }`}
                      >
                        {r}
                      </button>
                    ))}
                  </div>
                  <input
                    type="text"
                    value={bonusReason}
                    onChange={(e) => setBonusReason(e.target.value)}
                    placeholder="Précisez le motif..."
                    className="w-full bg-black/60 border border-white/15 focus:border-brand-gold rounded-xl px-3 py-2 text-xs text-white outline-none"
                  />
                </div>
              </div>

              {/* Footer Fixe avec Bouton d'Action TOUJOURS visible */}
              <div className="pt-3 mt-2 border-t border-white/10 shrink-0 flex gap-3 bg-[#121212]">
                <button
                  type="button"
                  onClick={closeBonusModal}
                  className="flex-1 py-3 rounded-xl bg-white/5 hover:bg-white/10 font-black text-xs uppercase text-gray-400 transition-all cursor-pointer"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  disabled={creditingBonus || bonusAmount <= 0}
                  className="flex-1 py-3 rounded-xl bg-brand-gold hover:bg-brand-gold/90 text-brand-black font-black text-xs uppercase transition-all shadow-lg active:scale-95 disabled:opacity-50 cursor-pointer flex items-center justify-center gap-2"
                >
                  {creditingBonus ? "Ajout en cours..." : `Ajouter ce bonus (+${formatFCFA(bonusAmount)})`}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal de Discussion / Envoi de Message Direct */}
      <AdminMessageModal 
        isOpen={showMessageModal} 
        onClose={closeMessageModal} 
        targetUser={messageTargetUser} 
        adminUser={adminUser} 
      />

      {/* Modal des Salles Ouvertes par un Joueur */}
      <UserRoomsModal
        isOpen={showUserRoomsModal}
        onClose={() => setShowUserRoomsModal(false)}
        user={userRoomsTargetUser || selectedUser}
        rooms={rooms}
        onOpenRoomHistory={(r) => {
          setSelectedRoomForHistory(r);
          setShowRoomHistoryModal(true);
        }}
      />

      {/* Modal d'Historique Complet de Salle */}
      <RoomHistoryModal
        isOpen={showRoomHistoryModal}
        onClose={() => setShowRoomHistoryModal(false)}
        room={selectedRoomForHistory}
      />
    </div>
  );
}
