import { useState, useEffect } from "react";
import { collection, query, onSnapshot, orderBy, limit, where, doc, updateDoc } from "firebase/firestore";
import { db } from "../../lib/firebase";
import { User, AppConfig } from "../../types";
import { Share2, Users, Trophy, Gift, Search, Settings, Save } from "lucide-react";
import { formatFCFA } from "../../lib/utils";
import { toast } from "sonner";

export default function ReferralManagement() {
  const [referrals, setReferrals] = useState<User[]>([]);
  const [topReferrers, setTopReferrers] = useState<User[]>([]);
  const [activeTab, setActiveTab] = useState<"ranking" | "tracking">("ranking");
  const [config, setConfig] = useState<AppConfig | null>(null);

  useEffect(() => {
    // Show users who have referred others
    const qTop = query(collection(db, "users"), where("referralsCount", ">", 0), orderBy("referralsCount", "desc"), limit(20));
    const unsubTop = onSnapshot(
      qTop, 
      (snap) => {
        setTopReferrers(snap.docs.map(doc => ({ uid: doc.id, ...doc.data() } as User)));
      },
      (err) => console.warn("Referral top quota/offline:", err?.message)
    );

    const qAll = query(collection(db, "users"), where("referredBy", "!=", null), limit(100));
    const unsubAll = onSnapshot(
      qAll, 
      (snap) => {
         setReferrals(snap.docs.map(doc => ({ uid: doc.id, ...doc.data() } as User)));
      },
      (err) => console.warn("Referral all quota/offline:", err?.message)
    );

    const unsubConfig = onSnapshot(
      doc(db, "config", "global"), 
      (snap) => {
        if (snap.exists()) setConfig(snap.data() as AppConfig);
      },
      (err) => console.warn("Referral config quota/offline:", err?.message)
    );

    return () => { unsubTop(); unsubAll(); unsubConfig(); };
  }, []);

  const updateRate = async (val: number) => {
    try {
      await updateDoc(doc(db, "config", "global"), { referralRate: val });
      toast.success("Taux de parrainage mis à jour");
    } catch (e) {
      toast.error("Erreur: " + e);
    }
  };

  return (
    <div className="space-y-6 text-white text-xs">
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 uppercase font-black italic">
        <div className="card bg-brand-gold/5 border-brand-gold/20 flex flex-col gap-1">
          <Share2 className="text-brand-gold mb-1" size={18} />
          <span className="text-[8px] text-gray-500">Taux Conversion</span>
          <span className="text-xl">12.4%</span>
        </div>
        <div className="card bg-purple-500/5 border-purple-500/20 flex flex-col gap-1">
          <Gift className="text-purple-500 mb-1" size={18} />
          <span className="text-[8px] text-gray-500">Bonus Payés</span>
          <span className="text-xl">{formatFCFA(450000)}</span>
        </div>
        <div className="card bg-blue-500/5 border-blue-500/20 flex flex-col gap-1">
          <Users className="text-blue-500 mb-1" size={18} />
          <span className="text-[8px] text-gray-500">Filleuls Totaux</span>
          <span className="text-xl">1,240</span>
        </div>
        <div className="card bg-brand-red/5 border-brand-red/20 flex flex-col gap-1">
          <Trophy className="text-brand-red mb-1" size={18} />
          <span className="text-[8px] text-gray-500">ROI Referral</span>
          <span className="text-xl">+18%</span>
        </div>
      </div>

      <div className="flex gap-2">
        <button 
           onClick={() => setActiveTab("ranking")}
           className={`px-4 py-2 rounded-lg font-black tracking-tighter ${activeTab === 'ranking' ? 'bg-brand-red text-white' : 'bg-white/5 text-gray-500'}`}
        >
          CLASSEMENT PARRAINS
        </button>
        <button 
           onClick={() => setActiveTab("tracking")}
           className={`px-4 py-2 rounded-lg font-black tracking-tighter ${activeTab === 'tracking' ? 'bg-brand-red text-white' : 'bg-white/5 text-gray-500'}`}
        >
          SUIVI DES FILLEULS
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 card p-0 border-white/5 overflow-hidden">
          {activeTab === "ranking" ? (
            <div className="divide-y divide-white/5">
              {topReferrers.map((u, i) => (
                <div key={u.uid} className="p-4 flex items-center justify-between hover:bg-white/[0.02] transition-colors">
                  <div className="flex items-center gap-4">
                    <span className="text-sm font-black italic text-gray-700 w-4">{i + 1}</span>
                    <img src={u.photoURL || `https://api.dicebear.com/7.x/pixel-art/svg?seed=${u.uid}`} className="w-8 h-8 rounded-lg" alt="" />
                    <div>
                      <p className="text-sm font-bold">{u.displayName}</p>
                      <p className="text-[10px] text-gray-500 uppercase font-black">{u.referredCount || 0} FILLEULS</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-[9px] font-black uppercase text-gray-600">Gains Estimés</p>
                    <p className="text-sm font-black italic text-brand-gold">{formatFCFA((u.referredCount || 0) * 500)}</p>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="divide-y divide-white/5">
              {referrals.map((u) => (
                <div key={u.uid} className="p-4 flex items-center justify-between hover:bg-white/[0.02] transition-colors">
                  <div className="flex items-center gap-4">
                    <div className="w-8 h-8 rounded bg-white/5 flex items-center justify-center font-black">?</div>
                    <div>
                      <p className="text-sm font-bold">{u.displayName}</p>
                      <p className="text-[10px] text-gray-400 font-bold uppercase">Parrainé par: <span className="text-brand-gold">{u.referredBy}</span></p>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <button className="bg-green-500 text-brand-black px-3 py-1 rounded text-[9px] font-black uppercase">Valider Bonus</button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="space-y-4">
          <div className="card border-brand-gold/20 bg-brand-gold/5">
            <h4 className="text-[10px] font-black uppercase italic mb-3 flex items-center gap-2">
              <Settings size={14} />
              Paramètres Parrainage
            </h4>
            <div className="space-y-4">
              <div className="space-y-2">
                <div className="flex justify-between">
                  <label className="text-[8px] font-black uppercase text-brand-gold/60">Taux actuel (%)</label>
                  <span className="text-[10px] font-black italic text-brand-gold">{(config?.referralRate || 0) * 100}%</span>
                </div>
                <input 
                  type="range" 
                  min="0" 
                  max="0.2" 
                  step="0.005"
                  value={config?.referralRate || 0}
                  onChange={(e) => updateRate(parseFloat(e.target.value))}
                  className="w-full h-1.5 bg-white/10 rounded-lg appearance-none cursor-pointer accent-brand-gold" 
                />
              </div>
              <div className="p-3 bg-brand-gold/10 border border-brand-gold/20 rounded-xl">
                 <p className="text-[9px] font-medium text-brand-gold leading-relaxed uppercase italic">
                    Les commissions sont calculées sur les participations des filleuls.
                 </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
