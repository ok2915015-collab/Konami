import { useState, useEffect, useRef } from "react";
import { 
  collection, 
  query, 
  onSnapshot, 
  doc, 
  updateDoc, 
  deleteDoc, 
  writeBatch, 
  increment, 
  runTransaction, 
  serverTimestamp, 
  orderBy, 
  getDoc, 
  addDoc 
} from "firebase/firestore";
import { db } from "../../lib/firebase";
import { Transaction, AppConfig, User, PaymentMethod, Room } from "../../types";
import { formatFCFA, cn } from "../../lib/utils";
import { 
  Check, 
  X, 
  Wallet, 
  ArrowDownLeft, 
  ArrowUpRight, 
  Clock, 
  AlertCircle, 
  FileText, 
  ShieldCheck, 
  ShieldAlert, 
  Smartphone, 
  Trash2, 
  RotateCcw, 
  Ban, 
  Sparkles, 
  CheckCircle2, 
  AlertTriangle 
} from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "../../contexts/AuthContext";

import { FinancialDashboard } from "./FinancialDashboard";

export default function FinanceManagement() {
  const { user: adminUser } = useAuth();
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [methods, setMethods] = useState<PaymentMethod[]>([]);
  const [rooms, setRooms] = useState<Room[]>([]);
  const [config, setConfig] = useState<AppConfig | null>(null);
  const [userMap, setUserMap] = useState<Record<string, User>>({});
  const [filter, setFilter] = useState<"all" | "pending" | "deposit" | "withdrawal" | "cancelled">("pending");
  const [isLedgerInited, setIsLedgerInited] = useState(false);

  // Modal d'action (Annulation / Suppression / Nettoyage)
  const [modalState, setModalState] = useState<{
    isOpen: boolean;
    type: "cancel" | "delete" | "cleanup";
    tx?: Transaction;
    reason: string;
    loading: boolean;
  }>({
    isOpen: false,
    type: "cancel",
    reason: "",
    loading: false,
  });

  const fetchedUidsRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    // Check if ledger is inited by checking one account
    const checkLedger = async () => {
      try {
        const snap = await getDoc(doc(db, "ledger_accounts", "REAL_TREASURY"));
        setIsLedgerInited(snap.exists());
      } catch (e) {
        console.warn("Ledger check fallback:", e);
      }
    };
    checkLedger();

    const unsubMethods = onSnapshot(
      collection(db, "payment_methods"), 
      (snap) => {
        setMethods(snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as PaymentMethod)));
      },
      (err) => console.warn("Payment methods snapshot quota/offline:", err?.message)
    );

    const unsubConfig = onSnapshot(
      doc(db, "config", "global"), 
      (snap) => {
        if (snap.exists()) {
          const data = snap.data();
          const mergedConfig = {
            leverageUsedToday: 0,
            ...data,
            treasury: {
              wave: 0,
              om: 0,
              mtn: 0,
              ...(data.treasury || {})
            }
          } as AppConfig;
          setConfig(mergedConfig);
        }
      },
      (err) => console.warn("Config snapshot quota/offline:", err?.message)
    );

    const q = query(collection(db, "transactions"), orderBy("createdAt", "desc"));
    const unsubTxs = onSnapshot(
      q, 
      async (snap) => {
        const txs = snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Transaction));
        setTransactions(txs);
        try {
          localStorage.setItem("konamix_txs_cache", JSON.stringify(txs));
        } catch (e) {}

        // Fetch user data for KYC check only once per user, avoiding infinite loops
        const uids = Array.from(new Set(txs.map(t => t.userId))).slice(0, 20);
        for (const uid of uids) {
          if (!fetchedUidsRef.current.has(uid)) {
            fetchedUidsRef.current.add(uid);
            try {
              const uSnap = await getDoc(doc(db, "users", uid));
              if (uSnap.exists()) {
                setUserMap(prev => ({ ...prev, [uid]: uSnap.data() as User }));
              }
            } catch (err) {
              console.warn("User fetch quota/offline:", uid);
            }
          }
        }
      },
      (err) => {
        console.warn("Transactions snapshot quota/offline:", err?.message);
        try {
          const cached = localStorage.getItem("konamix_txs_cache");
          if (cached) setTransactions(JSON.parse(cached));
        } catch (e) {}
      }
    );

    const qRooms = query(collection(db, "rooms"), orderBy("createdAt", "desc"));
    const unsubRooms = onSnapshot(
      qRooms, 
      (snap) => {
        const rList = snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Room));
        setRooms(rList);
        try {
          localStorage.setItem("konamix_rooms_cache", JSON.stringify(rList));
        } catch (e) {}
      },
      (err) => {
        console.warn("Rooms snapshot quota/offline:", err?.message);
        try {
          const cached = localStorage.getItem("konamix_rooms_cache");
          if (cached) setRooms(JSON.parse(cached));
        } catch (e) {}
      }
    );

    return () => {
      unsubConfig();
      unsubTxs();
      unsubRooms();
      unsubMethods();
    };
  }, []);

  const filteredTxs = transactions.filter(tx => {
    if (filter === "pending") return tx.status === "pending";
    if (filter === "deposit") return tx.type === "deposit";
    if (filter === "withdrawal") return tx.type === "withdrawal";
    if (filter === "cancelled") return tx.status === "cancelled" || tx.status === "rejected";
    return true;
  });

  // 1. Valider / Payer une transaction en attente
  const handleApproveTransaction = async (tx: Transaction) => {
    let referenceId = tx.reference || tx.transactionId || "";

    if (tx.type === 'deposit' && !referenceId) {
      referenceId = window.prompt("Référence de transaction (Ex: ID Wave/OM):") || "";
      if (!referenceId) {
        toast.error("La référence est obligatoire pour valider un dépôt");
        return;
      }
    }

    try {
      await runTransaction(db, async (transaction) => {
        const txRef = doc(db, "transactions", tx.id);
        const userRef = doc(db, "users", tx.userId);
        const configRef = doc(db, "config", "global");
        
        const txSnap = await transaction.get(txRef);
        if (!txSnap.exists() || txSnap.data().status !== "pending") {
          throw "Cette transaction n'est plus en attente";
        }

        const userSnap = await transaction.get(userRef);
        if (!userSnap.exists()) throw "Utilisateur introuvable";
        const userData = userSnap.data() as User;

        if (tx.type === "withdrawal") {
          if (!(tx as any).debitedAtRequest) {
            if (userData.balance < tx.amount) {
              throw "Solde utilisateur insuffisant pour ce retrait";
            }
            transaction.update(userRef, { balance: increment(-tx.amount) });
          }
        } else if (tx.type === "deposit") {
          transaction.update(userRef, { balance: increment(tx.amount) });
        }

        // Update Treasury
        if (config) {
          const methodName = tx.method.toLowerCase();
          const treasuryChange = tx.type === "deposit" ? tx.amount : -tx.amount;
          transaction.update(configRef, { 
            [`treasury.${methodName}`]: increment(treasuryChange) 
          });
        }

        transaction.update(txRef, { 
          status: "approved", 
          updatedAt: serverTimestamp(),
          validatedBy: adminUser?.uid,
          reference: referenceId
        });

        // Audit Log
        const auditRef = doc(collection(db, "audit_logs"));
        transaction.set(auditRef, {
          action: "TX_APPROVED",
          userId: tx.userId,
          targetId: tx.id,
          amount: tx.amount,
          adminId: adminUser?.uid,
          createdAt: serverTimestamp()
        });
      });

      // Synchronize with Ledger System
      const endpoint = tx.type === "deposit" ? "/api/ledger/deposit" : "/api/ledger/withdraw";
      const payload = {
        userId: tx.userId,
        amount: tx.amount,
        transactionId: tx.id,
        withdrawalId: tx.id
      };
      
      await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });

      toast.success(`Transaction ${tx.type === 'deposit' ? 'validée' : 'payée'} avec succès !`);
    } catch (e: any) {
      toast.error("Erreur: " + e);
    }
  };

  // 2. Confirmer l'annulation d'une transaction (pending ou approved)
  const confirmCancelTransaction = async () => {
    const tx = modalState.tx;
    if (!tx) return;

    setModalState(prev => ({ ...prev, loading: true }));
    const reason = modalState.reason.trim() || "Annulé par l'administration";

    try {
      await runTransaction(db, async (transaction) => {
        const txRef = doc(db, "transactions", tx.id);
        const userRef = doc(db, "users", tx.userId);
        const configRef = doc(db, "config", "global");

        const txSnap = await transaction.get(txRef);
        if (!txSnap.exists()) throw "Transaction introuvable";
        const currentStatus = txSnap.data().status;

        // Cas 1: Annulation d'une transaction en attente (pending)
        if (currentStatus === "pending") {
          // Si retrait débité au moment de la demande => rembourser le joueur !
          if (tx.type === "withdrawal" && (tx as any).debitedAtRequest) {
            transaction.update(userRef, { balance: increment(tx.amount) });
          }
        } 
        // Cas 2: Annulation d'une transaction DÉJÀ VALIDÉE (approved)
        else if (currentStatus === "approved") {
          if (tx.type === "deposit") {
            // Dépôt validé qu'on annule => déduire le montant du solde du joueur
            transaction.update(userRef, { balance: increment(-tx.amount) });
            if (config) {
              const methodName = tx.method.toLowerCase();
              transaction.update(configRef, { [`treasury.${methodName}`]: increment(-tx.amount) });
            }
          } else if (tx.type === "withdrawal") {
            // Retrait payé qu'on annule => restituer les fonds au joueur
            transaction.update(userRef, { balance: increment(tx.amount) });
            if (config) {
              const methodName = tx.method.toLowerCase();
              transaction.update(configRef, { [`treasury.${methodName}`]: increment(tx.amount) });
            }
          }
        }

        // Marquer comme annulé
        transaction.update(txRef, {
          status: "cancelled",
          updatedAt: serverTimestamp(),
          cancelledBy: adminUser?.uid,
          rejectionReason: reason,
        });

        // Audit Log
        const auditRef = doc(collection(db, "audit_logs"));
        transaction.set(auditRef, {
          action: currentStatus === "approved" ? "TX_CANCELLED_APPROVED" : "TX_CANCELLED",
          userId: tx.userId,
          targetId: tx.id,
          amount: tx.amount,
          adminId: adminUser?.uid,
          reason,
          createdAt: serverTimestamp()
        });
      });

      // Notifier le joueur
      await addDoc(collection(db, "notifications"), {
        title: `Transaction ${tx.type === 'deposit' ? 'dépôt' : 'retrait'} annulée`,
        body: `Votre ${tx.type === 'deposit' ? 'dépôt' : 'demande de retrait'} de ${formatFCFA(tx.amount)} a été annulé par l'administration. Motif : ${reason}`,
        type: "warning",
        target: tx.userId,
        createdAt: serverTimestamp(),
        readBy: []
      });

      toast.success(`Transaction annulée avec succès !`);
      setModalState({ isOpen: false, type: "cancel", reason: "", loading: false });
    } catch (e: any) {
      console.error("Erreur annulation:", e);
      toast.error("Erreur lors de l'annulation: " + (e?.message || e));
      setModalState(prev => ({ ...prev, loading: false }));
    }
  };

  // 3. Supprimer définitivement une transaction pour nettoyer le dashboard
  const confirmDeleteTransaction = async () => {
    const tx = modalState.tx;
    if (!tx) return;

    setModalState(prev => ({ ...prev, loading: true }));
    try {
      await deleteDoc(doc(db, "transactions", tx.id));

      // Audit Log
      await addDoc(collection(db, "audit_logs"), {
        action: "TX_DELETED",
        userId: tx.userId,
        targetId: tx.id,
        amount: tx.amount,
        type: tx.type,
        adminId: adminUser?.uid,
        createdAt: serverTimestamp()
      });

      toast.success("Transaction supprimée du dashboard !");
      setModalState({ isOpen: false, type: "delete", reason: "", loading: false });
    } catch (e: any) {
      console.error("Erreur suppression:", e);
      toast.error("Erreur lors de la suppression: " + (e?.message || e));
      setModalState(prev => ({ ...prev, loading: false }));
    }
  };

  // 4. Nettoyer en bloc toutes les transactions annulées / rejetées
  const confirmCleanupTransactions = async () => {
    setModalState(prev => ({ ...prev, loading: true }));
    try {
      const toDelete = transactions.filter(t => t.status === "cancelled" || t.status === "rejected");
      if (toDelete.length === 0) {
        toast.info("Aucune transaction annulée ou rejetée à nettoyer.");
        setModalState({ isOpen: false, type: "cleanup", reason: "", loading: false });
        return;
      }

      const batch = writeBatch(db);
      toDelete.forEach(t => {
        batch.delete(doc(db, "transactions", t.id));
      });
      await batch.commit();

      // Audit log
      await addDoc(collection(db, "audit_logs"), {
        action: "TX_CLEANUP_BULK",
        count: toDelete.length,
        adminId: adminUser?.uid,
        createdAt: serverTimestamp()
      });

      toast.success(`${toDelete.length} transaction(s) nettoyée(s) avec succès ! Dashboard propre.`);
      setModalState({ isOpen: false, type: "cleanup", reason: "", loading: false });
    } catch (e: any) {
      console.error("Erreur nettoyage:", e);
      toast.error("Erreur lors du nettoyage: " + (e?.message || e));
      setModalState(prev => ({ ...prev, loading: false }));
    }
  };

  const cancelledCount = transactions.filter(t => t.status === "cancelled" || t.status === "rejected").length;

  const stats = {
    pendingDeposits: transactions.filter(t => t.type === 'deposit' && t.status === 'pending').reduce((a, b) => a + b.amount, 0),
    pendingWithdrawals: transactions.filter(t => t.type === 'withdrawal' && t.status === 'pending').reduce((a, b) => a + b.amount, 0),
    totalCommission: config?.leverageUsedToday || 0,
  };

  // Calculs en temps réel des gains des leviers
  let leverageRoomWins = 0;
  let leverageWinnings = 0;
  let leverageStakes = 0;
  let leveragePvPWins = 0;

  rooms.forEach((r) => {
    const comm = typeof r.commission === "number" ? r.commission : 0.05;
    const netPot = (r.totalStake || 0) * (1 - comm);
    const isBotWinner = Boolean(
      r.winnerIsBot || 
      r.winnerId?.startsWith("BOT_") || 
      r.winnerId?.startsWith("LEV_") ||
      (r.winnerId && r.positions?.[r.winnerId]?.isBot) ||
      (r.winnerId && r.positions?.[r.winnerId]?.isLeverage)
    );
    if ((r.status === "finished" || r.status === "partie_terminee") && isBotWinner) {
      leverageRoomWins++;
      leverageWinnings += netPot;
    }
    Object.values(r.positions || {}).forEach((p: any) => {
      if (p.isBot || p.isLeverage || p.playerId?.startsWith("BOT_") || p.playerId?.startsWith("LEV_")) {
        leverageStakes += (r.stakePerPosition || 0);
      }
    });
    (r.challenges || []).forEach((c: any) => {
      if (c.status === "resolved") {
        const cPos = (r.positions || {})[c.creatorPKey];
        const aPos = (r.positions || {})[c.accepterPKey];
        const isBotC = Boolean(cPos?.isBot || cPos?.isLeverage || c.creatorUid?.startsWith("BOT_") || c.creatorUid?.startsWith("LEV_"));
        const isBotA = Boolean(aPos?.isBot || aPos?.isLeverage || c.accepterUid?.startsWith("BOT_") || c.accepterUid?.startsWith("LEV_"));
        if ((c.winnerPKey === c.creatorPKey && isBotC) || (c.winnerPKey === c.accepterPKey && isBotA)) {
          leveragePvPWins++;
          leverageWinnings += (c.wonAmount || c.stake * 2);
        }
      }
    });
  });
  const leverageNetProfit = leverageWinnings - leverageStakes;

  const handleInitLedger = async () => {
    try {
      const res = await fetch("/api/ledger/init", { method: "POST" });
      if (res.ok) {
        toast.success("Système de Ledger initialisé !");
        setIsLedgerInited(true);
      } else {
        throw new Error(await res.text());
      }
    } catch (e: any) {
      toast.error("Erreur init: " + e.message);
    }
  };

  return (
    <div className="space-y-6 text-white pb-10">
      {!isLedgerInited && (
          <div className="p-4 bg-brand-gold/10 border border-brand-gold/30 rounded-2xl flex items-center justify-between">
              <div className="flex items-center gap-3">
                  <AlertCircle className="text-brand-gold" />
                  <p className="text-[10px] font-black uppercase tracking-widest text-brand-gold">Le système de comptabilité double-entrée n'est pas initialisé.</p>
              </div>
              <button 
                onClick={handleInitLedger}
                className="px-4 py-2 bg-brand-gold text-black text-[10px] font-black uppercase rounded-lg hover:scale-105 active:scale-95 transition-all cursor-pointer"
              >
                  Initialiser les Comptes Ledger
              </button>
          </div>
      )}

      {isLedgerInited && <FinancialDashboard />}

      <hr className="border-white/5" />
      
      <div className="px-4">
        <h3 className="text-[10px] font-black uppercase tracking-widest text-gray-500 mb-4">Gestion des Flux (Dépôts / Retraits)</h3>
      </div>

      {/* Detailed Treasury */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        {methods.map(m => (
          <div key={m.id} className="card bg-black/40 border-white/5 relative overflow-hidden group">
            <div className={cn("absolute top-0 right-0 w-24 h-24 opacity-5 blur-3xl -mr-8 -mt-8 rounded-full", m.color || "bg-brand-gold")} />
            <div className="flex items-center gap-3 mb-2">
              <div className={cn("w-2 h-2 rounded-full animate-pulse", m.color || "bg-brand-gold")} />
              <p className="text-[10px] font-black uppercase text-gray-500 tracking-widest">{m.name}</p>
            </div>
            <h3 className="text-2xl font-black italic tracking-tighter line-clamp-1">
               {formatFCFA((config?.treasury as any)?.[m.name.toLowerCase()] || 0)}
            </h3>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
        <div className="card border-l-4 border-l-green-500 bg-green-500/5">
          <p className="text-[10px] font-black uppercase text-green-500 italic mb-1">Dépôts en Attente</p>
          <h3 className="text-xl font-black italic tracking-tighter">{formatFCFA(stats.pendingDeposits)}</h3>
        </div>
        <div className="card border-l-4 border-l-brand-red bg-brand-red/5">
          <p className="text-[10px] font-black uppercase text-brand-red italic mb-1">Retraits en Attente</p>
          <h3 className="text-xl font-black italic tracking-tighter">{formatFCFA(stats.pendingWithdrawals)}</h3>
        </div>
        <div className="card border-l-4 border-l-brand-gold bg-brand-gold/5">
          <p className="text-[10px] font-black uppercase text-brand-gold italic mb-1">Commissions Salons</p>
          <h3 className="text-xl font-black italic tracking-tighter">{formatFCFA(stats.totalCommission)}</h3>
        </div>
        <div className="card border-l-4 border-l-amber-500 bg-amber-500/10">
          <div className="flex items-center justify-between">
            <p className="text-[10px] font-black uppercase text-amber-400 italic mb-1 flex items-center gap-1">
              <Sparkles size={12} /> Gains Leviers
            </p>
            <span className="text-[7.5px] font-bold text-gray-400 uppercase">Salles & P vs P</span>
          </div>
          <h3 className="text-xl font-black italic tracking-tighter text-brand-gold font-mono">+{formatFCFA(leverageWinnings)}</h3>
          <p className="text-[8.5px] text-gray-400 mt-1 flex items-center gap-1">
            <span>Net:</span>
            <strong className={leverageNetProfit >= 0 ? "text-green-400 font-mono" : "text-brand-red font-mono"}>
              {leverageNetProfit >= 0 ? "+" : ""}{formatFCFA(leverageNetProfit)}
            </strong>
          </p>
        </div>
        <div className="card border-l-4 border-l-cyan-500 bg-cyan-500/5">
          <p className="text-[10px] font-black uppercase text-cyan-500 italic mb-1">Total Opérations</p>
          <h3 className="text-xl font-black italic tracking-tighter">{transactions.length}</h3>
        </div>
      </div>

      {/* Barre de Filtres & Outils de Nettoyage */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex flex-wrap gap-2">
            {[
              { id: "pending", label: "EN ATTENTE" },
              { id: "deposit", label: "DÉPÔTS" },
              { id: "withdrawal", label: "RETRAITS" },
              { id: "cancelled", label: `ANNULÉS / REJETÉS (${cancelledCount})` },
              { id: "all", label: "TOUT" }
            ].map(f => (
                <button 
                  key={f.id}
                  onClick={() => setFilter(f.id as any)}
                  className={`px-3.5 py-2 rounded-xl font-black text-[10px] uppercase transition-all cursor-pointer ${
                    filter === f.id ? 'bg-brand-red text-white shadow-md shadow-brand-red/20' : 'bg-white/5 text-gray-400 hover:text-white'
                  }`}
                >
                  {f.label}
                </button>
            ))}
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => {
              if (cancelledCount === 0) {
                toast.info("Aucune transaction annulée ou rejetée à nettoyer pour le moment.");
                return;
              }
              setModalState({ isOpen: true, type: "cleanup", reason: "", loading: false });
            }}
            disabled={cancelledCount === 0}
            className={cn(
              "flex items-center gap-2 px-3.5 py-2 rounded-xl font-black text-[10px] uppercase transition-all shadow-md active:scale-95 border",
              cancelledCount > 0 
                ? "bg-brand-red/15 hover:bg-brand-red text-brand-red hover:text-white border-brand-red/30 cursor-pointer" 
                : "bg-white/5 text-gray-500 border-white/5 cursor-not-allowed opacity-60"
            )}
            title="Purger toutes les transactions annulées ou rejetées pour un dashboard propre"
          >
            <Sparkles size={14} />
            <span>Nettoyer Dashboard ({cancelledCount})</span>
          </button>

          <button className="flex items-center gap-2 bg-white/5 px-4 py-2 rounded-xl font-black text-[10px] uppercase text-gray-400 hover:bg-white/10 transition-colors cursor-pointer">
              <FileText size={14} /> EXPORTER (CSV)
          </button>
        </div>
      </div>

      {/* Liste des Transactions */}
      <div className="grid grid-cols-1 gap-3">
        {filteredTxs.length > 0 ? filteredTxs.map(tx => {
          const isPending = tx.status === "pending";
          const isApproved = tx.status === "approved";
          const isCancelled = tx.status === "cancelled";
          const isRejected = tx.status === "rejected";

          return (
            <div 
              key={tx.id} 
              className={`card bg-black/40 border flex flex-col md:flex-row md:items-center justify-between p-4 gap-4 group transition-all rounded-2xl ${
                isPending ? 'border-amber-500/20 hover:border-amber-500/40' :
                isApproved ? 'border-green-500/20 hover:border-green-500/40' :
                'border-white/5 hover:border-white/15 opacity-80'
              }`}
            >
              <div className="flex items-center gap-4 min-w-0">
                <div className={`w-13 h-13 rounded-2xl flex items-center justify-center shadow-2xl shrink-0 ${
                  tx.type === 'deposit' ? 'bg-green-500/10 text-green-500 border border-green-500/20' : 'bg-brand-red/10 text-brand-red border border-brand-red/20'
                }`}>
                  {tx.type === 'deposit' ? <ArrowDownLeft size={24} /> : <ArrowUpRight size={24} />}
                </div>

                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="font-black italic text-sm uppercase tracking-tight">{tx.type} {tx.method}</p>

                    {/* Statut Badge */}
                    <span className={`text-[8.5px] font-black uppercase px-2 py-0.5 rounded-full border ${
                      isPending ? 'bg-amber-500/15 text-amber-400 border-amber-500/30' :
                      isApproved ? 'bg-green-500/15 text-green-400 border-green-500/30' :
                      isCancelled ? 'bg-gray-500/20 text-gray-400 border-gray-500/30' :
                      'bg-red-500/15 text-brand-red border-red-500/30'
                    }`}>
                      {isPending ? '⏳ En attente' : isApproved ? '✓ Validé' : isCancelled ? '⊘ Annulé' : '✕ Rejeté'}
                    </span>

                    {userMap[tx.userId]?.kycStatus === 'verified' ? (
                      <span className="flex items-center gap-1 bg-green-500/10 text-green-500 text-[8px] font-black px-1.5 py-0.5 rounded border border-green-500/20">
                        <ShieldCheck size={10} /> KYC OK
                      </span>
                    ) : (
                      <span className="flex items-center gap-1 bg-brand-gold/10 text-brand-gold text-[8px] font-black px-1.5 py-0.5 rounded border border-brand-gold/20">
                        <ShieldAlert size={10} /> KYC REQUIS
                      </span>
                    )}
                  </div>

                  <div className="flex flex-wrap items-center gap-2 mt-1">
                    <p className="text-lg font-black tracking-tighter text-brand-gold">{formatFCFA(tx.amount)}</p>
                    {tx.phoneNumber && (
                      <div className="flex items-center gap-1 bg-white/5 px-2 py-0.5 rounded text-[10px] font-mono font-bold text-gray-400">
                        <Smartphone size={12} />
                        {tx.phoneNumber}
                      </div>
                    )}
                    {(tx.reference || tx.transactionId) && (
                      <div className="flex items-center gap-1 bg-brand-gold/10 border border-brand-gold/20 px-2 py-0.5 rounded text-[10px] font-mono font-bold text-brand-gold">
                        ID: {tx.reference || tx.transactionId}
                      </div>
                    )}
                  </div>

                  <div className="flex flex-wrap items-center gap-2 mt-1 text-[9px] text-gray-500 font-bold italic">
                    <span className="flex items-center gap-1">
                      <Clock size={10} />
                      {tx.createdAt?.seconds ? new Date(tx.createdAt.seconds * 1000).toLocaleString() : "Récent"}
                    </span>
                    <span className="text-gray-300 font-bold not-italic">
                      • Joueur: {tx.userName || userMap[tx.userId]?.displayName || userMap[tx.userId]?.email || tx.userId.slice(0, 8)}
                    </span>
                    {tx.rejectionReason && (
                      <span className="text-brand-red font-semibold not-italic">
                        • Motif : {tx.rejectionReason}
                      </span>
                    )}
                  </div>
                </div>
              </div>

              {/* Boutons d'Action selon le Statut */}
              <div className="flex items-center gap-2 self-end md:self-center shrink-0">
                {isPending && (
                  <>
                    <button 
                       onClick={() => handleApproveTransaction(tx)}
                       className="px-3.5 py-2.5 bg-green-500 hover:bg-green-400 text-brand-black rounded-xl flex items-center justify-center gap-1.5 font-black text-xs uppercase hover:scale-105 active:scale-95 transition-all shadow-lg shadow-green-500/20 cursor-pointer"
                       title="Valider et créditer"
                    >
                      <Check size={16} />
                      <span>{tx.type === 'deposit' ? 'VALIDER' : 'PAYER'}</span>
                    </button>
                    <button 
                       onClick={() => setModalState({ isOpen: true, type: "cancel", tx, reason: "", loading: false })}
                       className="px-3 py-2.5 bg-amber-500/10 hover:bg-amber-500 text-amber-400 hover:text-black border border-amber-500/20 rounded-xl flex items-center justify-center gap-1 font-black text-xs uppercase transition-all cursor-pointer"
                       title="Annuler cette demande"
                    >
                      <Ban size={15} />
                      <span>ANNULER</span>
                    </button>
                  </>
                )}

                {isApproved && (
                  <button 
                     onClick={() => setModalState({ isOpen: true, type: "cancel", tx, reason: "", loading: false })}
                     className="px-3 py-2 bg-amber-500/10 hover:bg-amber-500 text-amber-400 hover:text-black border border-amber-500/20 rounded-xl flex items-center justify-center gap-1.5 font-bold text-[10px] uppercase transition-all cursor-pointer"
                     title="Annuler cette transaction déjà validée (réajuste les soldes)"
                  >
                    <RotateCcw size={13} />
                    <span>ANNULER TRANSACTION</span>
                  </button>
                )}

                {/* Bouton de Suppression pour rendre le dashboard CLEAN */}
                <button 
                   onClick={() => setModalState({ isOpen: true, type: "delete", tx, reason: "", loading: false })}
                   className="p-2.5 bg-white/5 hover:bg-brand-red text-gray-400 hover:text-white border border-white/10 hover:border-brand-red rounded-xl flex items-center justify-center transition-all cursor-pointer"
                   title="Supprimer définitivement du dashboard"
                >
                  <Trash2 size={16} />
                </button>
              </div>
            </div>
          );
        }) : (
            <div className="card py-12 flex flex-col items-center justify-center text-gray-600 border-dashed border-white/5">
                <AlertCircle size={48} className="mb-4 opacity-20" />
                <p className="text-xs font-black uppercase tracking-widest italic opacity-50">Aucune transaction trouvée</p>
            </div>
        )}
      </div>

      {/* Modal de Confirmation d'Action (Annulation / Suppression / Nettoyage) */}
      {modalState.isOpen && (
        <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-md flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
          <div 
            className="bg-[#121212] border border-white/15 rounded-3xl p-5 sm:p-6 max-w-md w-full shadow-2xl relative flex flex-col my-auto animate-in fade-in zoom-in-95 duration-200 space-y-4"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header Modal */}
            <div className="flex items-center justify-between pb-3 border-b border-white/10">
              <div className="flex items-center gap-3">
                <div className={`w-10 h-10 rounded-2xl flex items-center justify-center shrink-0 border ${
                  modalState.type === "cancel" 
                    ? "bg-amber-500/15 text-amber-400 border-amber-500/30" 
                    : modalState.type === "delete"
                    ? "bg-brand-red/15 text-brand-red border-brand-red/30"
                    : "bg-cyan-500/15 text-cyan-400 border-cyan-500/30"
                }`}>
                  {modalState.type === "cancel" ? <Ban size={20} /> :
                   modalState.type === "delete" ? <Trash2 size={20} /> :
                   <Sparkles size={20} />}
                </div>
                <div>
                  <h3 className="text-base font-black uppercase italic tracking-tighter text-white">
                    {modalState.type === "cancel" ? "Annuler la transaction" :
                     modalState.type === "delete" ? "Supprimer la transaction" :
                     "Nettoyer le dashboard"}
                  </h3>
                  <p className="text-[10px] text-gray-400 font-bold uppercase">
                    {modalState.type === "cancel" ? "Mise à jour du statut & réajustement" :
                     modalState.type === "delete" ? "Action définitive & irréversible" :
                     "Suppression en masse des flux annulés/rejetés"}
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setModalState({ isOpen: false, type: "cancel", reason: "", loading: false })}
                className="text-gray-400 hover:text-white p-2 rounded-xl bg-white/5 hover:bg-white/10 cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>

            {/* Corps selon le Type */}
            {modalState.type === "cancel" && modalState.tx && (
              <div className="space-y-3.5">
                <div className="bg-white/5 border border-white/10 rounded-2xl p-3.5 space-y-1">
                  <div className="flex items-center justify-between text-xs font-bold">
                    <span className="uppercase text-gray-400">{modalState.tx.type} {modalState.tx.method}</span>
                    <span className="text-brand-gold font-mono font-black">{formatFCFA(modalState.tx.amount)}</span>
                  </div>
                  <p className="text-[10px] text-gray-400">
                    Joueur : <span className="text-white font-semibold">{modalState.tx.userName || userMap[modalState.tx.userId]?.displayName || modalState.tx.userId}</span>
                  </p>
                </div>

                {modalState.tx.status === "approved" ? (
                  <div className="bg-amber-500/10 border border-amber-500/30 rounded-2xl p-3 space-y-1">
                    <p className="text-[10px] font-black uppercase text-amber-400 flex items-center gap-1.5">
                      <AlertTriangle size={13} /> Attention : Transaction Déjà Validée
                    </p>
                    <p className="text-[10px] text-gray-300 leading-relaxed font-medium">
                      En annulant cette transaction validée, le solde du joueur sera automatiquement {modalState.tx.type === "deposit" ? `débité de -${formatFCFA(modalState.tx.amount)}` : `recrédité de +${formatFCFA(modalState.tx.amount)}`} et la trésorerie sera synchronisée.
                    </p>
                  </div>
                ) : (
                  <p className="text-[11px] text-gray-300">
                    Cette demande sera marquée comme annulée. {modalState.tx.type === "withdrawal" && "Si les fonds avaient été débités, ils seront immédiatement recrédités sur le compte du joueur."}
                  </p>
                )}

                <div className="space-y-1.5">
                  <label className="text-[9px] font-black uppercase text-gray-400">Motif de l'annulation :</label>
                  <div className="flex flex-wrap gap-1.5 mb-1.5">
                    {["Erreur de saisie", "Numéro mobile erroné", "Fonds non reçus", "Demande du joueur", "Doublon"].map(r => (
                      <button
                        key={r}
                        type="button"
                        onClick={() => setModalState(prev => ({ ...prev, reason: r }))}
                        className={`text-[8.5px] font-bold px-2.5 py-1 rounded-lg border transition-all cursor-pointer ${
                          modalState.reason === r
                            ? "bg-brand-red text-white border-brand-red"
                            : "bg-white/5 border-white/10 text-gray-400 hover:text-white"
                        }`}
                      >
                        {r}
                      </button>
                    ))}
                  </div>
                  <input
                    type="text"
                    value={modalState.reason}
                    onChange={(e) => setModalState(prev => ({ ...prev, reason: e.target.value }))}
                    placeholder="Précisez la raison de l'annulation..."
                    className="w-full bg-black/60 border border-white/15 focus:border-amber-400 rounded-xl px-3 py-2.5 text-xs text-white outline-none"
                  />
                </div>
              </div>
            )}

            {modalState.type === "delete" && modalState.tx && (
              <div className="space-y-3">
                <div className="bg-brand-red/10 border border-brand-red/30 rounded-2xl p-4 space-y-2">
                  <p className="text-xs font-black uppercase text-brand-red flex items-center gap-1.5">
                    <AlertTriangle size={15} /> Confirmation de suppression définitive
                  </p>
                  <p className="text-[11px] text-gray-300 leading-relaxed font-medium">
                    Êtes-vous sûr de vouloir supprimer cette transaction ({modalState.tx.type} de <span className="font-mono text-brand-gold font-bold">{formatFCFA(modalState.tx.amount)}</span>) ?
                  </p>
                  <p className="text-[10px] text-gray-400 leading-relaxed">
                    Elle sera définitivement effacée de la base de données afin de rendre le dashboard propre et net.
                  </p>
                </div>
              </div>
            )}

            {modalState.type === "cleanup" && (
              <div className="space-y-3">
                <div className="bg-cyan-500/10 border border-cyan-500/30 rounded-2xl p-4 space-y-2">
                  <p className="text-xs font-black uppercase text-cyan-400 flex items-center gap-1.5">
                    <Sparkles size={15} /> Nettoyage complet du Dashboard
                  </p>
                  <p className="text-[11px] text-gray-300 leading-relaxed font-medium">
                    Vous êtes sur le point de supprimer définitivement les <span className="text-white font-black">{cancelledCount}</span> transactions actuellement annulées ou rejetées.
                  </p>
                  <p className="text-[10px] text-gray-400 leading-relaxed">
                    Cela purgera les opérations terminées ou non abouties pour n'afficher que les flux actifs et réels.
                  </p>
                </div>
              </div>
            )}

            {/* Boutons Footer Modal */}
            <div className="pt-3 border-t border-white/10 flex gap-3">
              <button
                type="button"
                onClick={() => setModalState({ isOpen: false, type: "cancel", reason: "", loading: false })}
                className="flex-1 py-3 rounded-xl bg-white/5 hover:bg-white/10 font-black text-xs uppercase text-gray-400 transition-all cursor-pointer"
                disabled={modalState.loading}
              >
                Fermer
              </button>

              {modalState.type === "cancel" && (
                <button
                  type="button"
                  onClick={confirmCancelTransaction}
                  disabled={modalState.loading}
                  className="flex-1 py-3 rounded-xl bg-amber-500 hover:bg-amber-400 text-black font-black text-xs uppercase transition-all shadow-lg shadow-amber-500/20 active:scale-95 disabled:opacity-50 cursor-pointer flex items-center justify-center gap-1.5"
                >
                  <Ban size={14} />
                  <span>{modalState.loading ? "Annulation..." : "Confirmer l'Annulation"}</span>
                </button>
              )}

              {modalState.type === "delete" && (
                <button
                  type="button"
                  onClick={confirmDeleteTransaction}
                  disabled={modalState.loading}
                  className="flex-1 py-3 rounded-xl bg-brand-red hover:bg-brand-red/90 text-white font-black text-xs uppercase transition-all shadow-lg shadow-brand-red/20 active:scale-95 disabled:opacity-50 cursor-pointer flex items-center justify-center gap-1.5"
                >
                  <Trash2 size={14} />
                  <span>{modalState.loading ? "Suppression..." : "Supprimer Définitivement"}</span>
                </button>
              )}

              {modalState.type === "cleanup" && (
                <button
                  type="button"
                  onClick={confirmCleanupTransactions}
                  disabled={modalState.loading}
                  className="flex-1 py-3 rounded-xl bg-brand-red hover:bg-brand-red/90 text-white font-black text-xs uppercase transition-all shadow-lg shadow-brand-red/20 active:scale-95 disabled:opacity-50 cursor-pointer flex items-center justify-center gap-1.5"
                >
                  <Sparkles size={14} />
                  <span>{modalState.loading ? "Nettoyage..." : `Nettoyer (${cancelledCount})`}</span>
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
