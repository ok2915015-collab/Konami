import React, { useEffect, useState } from "react";
import { 
  collection, 
  onSnapshot, 
  query, 
  orderBy, 
  limit 
} from "firebase/firestore";
import { db } from "../../lib/firebase.ts";
import { 
  Wallet, 
  TrendingUp, 
  ShieldAlert, 
  ArrowUpRight, 
  ArrowDownRight, 
  Activity,
  DollarSign,
  AlertTriangle
} from "lucide-react";
import { motion } from "motion/react";

interface LedgerAccount {
  id: string;
  name: string;
  type: string;
  balance: number;
}

interface LedgerTransaction {
  id: string;
  transactionRef: string;
  accountId: string;
  type: "DEBIT" | "CREDIT";
  amount: number;
  description: string;
  createdAt: any;
}

const formatFCFA = (amount: number) => {
  return new Intl.NumberFormat("fr-FR", {
    style: "currency",
    currency: "XOF",
    minimumFractionDigits: 0,
  }).format(amount);
};

export const FinancialDashboard: React.FC = () => {
  const [accounts, setAccounts] = useState<LedgerAccount[]>([]);
  const [recentTransactions, setRecentTransactions] = useState<LedgerTransaction[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Real-time accounts
    const unsubAccounts = onSnapshot(
      collection(db, "ledger_accounts"), 
      (snap) => {
        const accList = snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as LedgerAccount));
        setAccounts(accList);
        setLoading(false);
      },
      (err) => {
        console.warn("Ledger accounts quota/offline:", err?.message);
        setLoading(false);
      }
    );

    // Recent transactions
    const q = query(
      collection(db, "ledger_transactions"), 
      orderBy("createdAt", "desc"), 
      limit(20)
    );
    const unsubTx = onSnapshot(
      q, 
      (snap) => {
        setRecentTransactions(snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as LedgerTransaction)));
      },
      (err) => console.warn("Ledger txs quota/offline:", err?.message)
    );

    return () => {
      unsubAccounts();
      unsubTx();
    };
  }, []);

  const getBalance = (id: string) => accounts.find(a => a.id === id)?.balance || 0;

  const userWallet = getBalance("USER_WALLET");
  const roomEscrow = getBalance("ROOM_ESCROW");
  const totalLiabilities = userWallet + roomEscrow;

  const adminRevenue = getBalance("ADMIN_REVENUE");
  const withdrawalFees = getBalance("WITHDRAWAL_FEE_POOL");
  const totalRevenue = adminRevenue + withdrawalFees;

  const realTreasury = getBalance("REAL_TREASURY");
  const marketingPool = getBalance("MARKETING_POOL");
  const aggregatorFees = getBalance("AGGREGATOR_FEE_POOL");

  const healthRatio = totalLiabilities > 0 ? (realTreasury / totalLiabilities) * 100 : 100;
  const isUnsafe = realTreasury < totalLiabilities;

  const handleInternalTransfer = async (targetId?: string) => {
    const toId = targetId || window.prompt("ID du compte de destination (Ex: MARKETING_POOL, REFERRAL_BONUS_POOL, REAL_TREASURY):");
    if (!toId) return;

    const amountStr = window.prompt(`Montant à transférer depuis ADMIN_REVENUE vers ${toId} (FCFA):`);
    if (!amountStr) return;
    const amount = parseFloat(amountStr);
    if (isNaN(amount) || amount <= 0) return;

    if (amount > adminRevenue) {
      alert("Fonds insuffisants dans ADMIN_REVENUE");
      return;
    }

    try {
      const res = await fetch("/api/ledger/transfer", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fromId: "ADMIN_REVENUE",
          toId,
          amount,
          adminId: "admin"
        })
      });
      if (!res.ok) throw new Error(await res.text());
      alert(`Transfert de ${formatFCFA(amount)} vers ${toId} réussi !`);
    } catch (e: any) {
      alert("Erreur: " + e.message);
    }
  };

  if (loading) return <div className="p-8 text-center text-gray-500 font-bold uppercase tracking-widest animate-pulse">Chargement des données financières...</div>;

  return (
    <div className="space-y-6 pt-2">
      <div className="flex justify-between items-center px-4">
        <h2 className="text-xl font-black italic uppercase tracking-tighter text-white">Comptabilité Bancaire</h2>
        <div className="flex items-center gap-2 px-3 py-1 bg-black/40 rounded-full border border-white/5">
            <div className={`w-2 h-2 rounded-full ${isUnsafe ? 'bg-red-500 animate-ping' : 'bg-green-500'}`} />
            <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest">{isUnsafe ? 'Alerte Trésorerie' : 'Système Stable'}</span>
        </div>
      </div>

      {/* Main Cards Row */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 px-4">
        
        {/* CARTE BLEUE: PASSIF (L'argent des Users) */}
        <motion.div 
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="card bg-blue-600/10 border-blue-500/20 p-5 space-y-4 relative overflow-hidden"
        >
          <div className="absolute -right-4 -top-4 opacity-5">
            <Wallet size={120} />
          </div>
          <div className="flex justify-between items-start">
            <div className="bg-blue-500 text-white p-2 rounded-xl shadow-lg shadow-blue-500/20">
              <Wallet size={20} />
            </div>
            <span className="text-[10px] font-black text-blue-400 uppercase tracking-widest">Passif / Dette</span>
          </div>
          <div>
            <p className="text-[10px] font-black text-blue-400/50 uppercase">Total Dû aux Utilisateurs</p>
            <h3 className="text-2xl font-black italic text-white tracking-tighter">{formatFCFA(totalLiabilities)}</h3>
          </div>
          <div className="pt-2 space-y-2 border-t border-blue-500/10">
            <div className="flex justify-between items-center text-[11px]">
              <span className="text-gray-400 font-bold">Wallets Utilisateurs</span>
              <span className="text-white font-black">{formatFCFA(userWallet)}</span>
            </div>
            <div className="flex justify-between items-center text-[11px]">
              <span className="text-gray-400 font-bold">Séquestre Salles</span>
              <span className="text-white font-black">{formatFCFA(roomEscrow)}</span>
            </div>
          </div>
        </motion.div>

        {/* CARTE VERTE: REVENUS (L'argent de Konamix) */}
        <motion.div 
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="card bg-green-600/10 border-green-500/20 p-5 space-y-4 relative overflow-hidden"
        >
          <div className="absolute -right-4 -top-4 opacity-5">
            <TrendingUp size={120} />
          </div>
          <div className="flex justify-between items-start">
            <div className="bg-green-500 text-white p-2 rounded-xl shadow-lg shadow-green-500/20">
              <TrendingUp size={20} />
            </div>
            <span className="text-[10px] font-black text-green-400 uppercase tracking-widest">Produits / Profits</span>
          </div>
          <div>
            <p className="text-[10px] font-black text-green-400/50 uppercase">Revenus Nets Accumulés</p>
            <h3 className="text-2xl font-black italic text-white tracking-tighter">{formatFCFA(totalRevenue)}</h3>
          </div>
          <div className="pt-2 space-y-2 border-t border-green-500/10">
            <div className="flex justify-between items-center text-[11px]">
              <span className="text-gray-400 font-bold">Commission Salles</span>
              <span className="text-white font-black">{formatFCFA(adminRevenue)}</span>
            </div>
            <div className="flex justify-between items-center text-[11px]">
              <span className="text-gray-400 font-bold">Frais de Retrait</span>
              <span className="text-white font-black">{formatFCFA(withdrawalFees)}</span>
            </div>
          </div>
          <button 
            onClick={() => handleInternalTransfer()}
            className="w-full py-2 bg-green-500 text-black text-[10px] font-black uppercase italic rounded-lg shadow-lg shadow-green-500/10 hover:scale-105 active:scale-95 transition-transform flex items-center justify-center gap-2"
          >
            <ArrowUpRight size={14} /> Envoyer de la Commission
          </button>
        </motion.div>

        {/* CARTE ROUGE: SANTÉ & TRÉSORERIE */}
        <motion.div 
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className={`card p-5 space-y-4 relative overflow-hidden transition-all duration-500 ${
            isUnsafe 
            ? "bg-red-600/20 border-red-500 shadow-[0_0_20px_rgba(239,68,68,0.2)] animate-pulse" 
            : "bg-neutral-900 border-white/5"
          }`}
        >
          <div className="absolute -right-4 -top-4 opacity-5">
             <Activity size={120} />
          </div>
          <div className="flex justify-between items-start">
            <div className={`${isUnsafe ? 'bg-red-500' : 'bg-white/10'} text-white p-2 rounded-xl`}>
              <Activity size={20} />
            </div>
            <span className={`text-[10px] font-black uppercase tracking-widest ${isUnsafe ? 'text-red-500' : 'text-gray-500'}`}>Actif / Trésorerie</span>
          </div>
          <div>
            <p className="text-[10px] font-black text-gray-500 uppercase">Trésorerie Réelle (Kkiapay)</p>
            <h3 className="text-2xl font-black italic text-white tracking-tighter">{formatFCFA(realTreasury)}</h3>
          </div>
          
          <div className="pt-2 space-y-3">
             <div className="flex justify-between items-end">
                <span className="text-[10px] font-black text-gray-400 uppercase">Capacité de Remboursement</span>
                <span className={`text-xs font-black ${isUnsafe ? 'text-red-500' : 'text-green-500'}`}>{healthRatio.toFixed(1)}%</span>
             </div>
             <div className="h-2 bg-white/5 rounded-full overflow-hidden">
                <motion.div 
                    initial={{ width: 0 }}
                    animate={{ width: `${Math.min(100, healthRatio)}%` }}
                    className={`h-full ${isUnsafe ? 'bg-red-500 shadow-[0_0_8px_rgba(239,68,68,0.5)]' : 'bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.5)]'}`}
                />
             </div>
             
             {isUnsafe && (
                <div className="p-2 bg-red-500/20 border border-red-500/30 rounded-lg flex items-center gap-2">
                    <AlertTriangle size={14} className="text-red-500 shrink-0" />
                    <p className="text-[8px] font-black text-red-500 uppercase leading-none">Déficit de Trésorerie Détecté ! L'argent réel est insuffisant.</p>
                </div>
             )}
          </div>
        </motion.div>
      </div>

      {/* Secondary Accounts & Logs */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 px-4">
        {/* Internal Budgets */}
        <div className="space-y-3 lg:col-span-1">
            <h3 className="text-[10px] font-black uppercase tracking-widest text-gray-500">Budgets Internes</h3>
            <div className="card bg-black/40 border-white/5 p-4 divide-y divide-white/5">
                <div className="pb-3 flex justify-between items-center">
                    <div>
                        <p className="text-[9px] font-bold text-gray-500 uppercase">Budget Marketing</p>
                        <p className="text-sm font-black italic text-brand-gold">{formatFCFA(marketingPool)}</p>
                    </div>
                    <button 
                        onClick={() => handleInternalTransfer("MARKETING_POOL")}
                        className="p-2 bg-white/5 hover:bg-white/10 rounded-lg text-brand-gold transition-colors"
                        title="Alimenter depuis les revenus"
                    >
                        <ArrowUpRight size={14} />
                    </button>
                </div>
                <div className="py-3 flex justify-between items-center">
                    <div>
                        <p className="text-[9px] font-bold text-gray-500 uppercase">Frais Agrégateurs (Charge)</p>
                        <p className="text-sm font-black italic text-red-400">{formatFCFA(aggregatorFees)}</p>
                    </div>
                </div>
            </div>
        </div>

        {/* Transaction History (Grand Livre) */}
        <div className="space-y-3 lg:col-span-2">
            <h3 className="text-[10px] font-black uppercase tracking-widest text-gray-500">Le Grand Livre (Dernières écritures)</h3>
            <div className="card bg-black/40 border-white/5 overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full text-left text-[10px]">
                        <thead className="bg-white/5 text-gray-500 font-black uppercase tracking-widest">
                            <tr>
                                <th className="px-4 py-3">Compte</th>
                                <th className="px-4 py-3">Réf/Action</th>
                                <th className="px-4 py-3 text-right">Débit</th>
                                <th className="px-4 py-3 text-right">Crédit</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-white/5">
                            {recentTransactions.map(tx => (
                                <tr key={tx.id} className="hover:bg-white/[0.02] transition-colors">
                                    <td className="px-4 py-3 font-black text-white">{tx.accountId}</td>
                                    <td className="px-4 py-3">
                                        <p className="font-bold text-gray-400 line-clamp-1">{tx.description}</p>
                                        <p className="text-[8px] text-gray-600 font-mono">#{tx.transactionRef.slice(0, 8)}</p>
                                    </td>
                                    <td className="px-4 py-3 text-right font-black">
                                        {tx.type === "DEBIT" ? (
                                            <span className="text-red-400">{formatFCFA(tx.amount)}</span>
                                        ) : "-"}
                                    </td>
                                    <td className="px-4 py-3 text-right font-black">
                                        {tx.type === "CREDIT" ? (
                                            <span className="text-green-400">{formatFCFA(tx.amount)}</span>
                                        ) : "-"}
                                    </td>
                                </tr>
                            ))}
                            {recentTransactions.length === 0 && (
                                <tr>
                                    <td colSpan={4} className="p-8 text-center text-gray-600 font-bold uppercase italic tracking-widest">
                                        Aucun mouvement enregistré
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
      </div>
    </div>
  );
};
