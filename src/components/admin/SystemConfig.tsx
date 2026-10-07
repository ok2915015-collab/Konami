import { useState, useEffect } from "react";
import { doc, onSnapshot, updateDoc, setDoc } from "firebase/firestore";
import { db } from "../../lib/firebase";
import { AppConfig } from "../../types";
import { Settings, Save, RefreshCw, Shield, Zap, Percent, Wallet, Info, Gift } from "lucide-react";
import { toast } from "sonner";

export default function SystemConfig() {
  const [config, setConfig] = useState<AppConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const unsub = onSnapshot(doc(db, "config", "global"), (snap) => {
      if (snap.exists()) {
        const data = snap.data();
        const mergedConfig = {
          maintenanceMode: false,
          referralRate: 0.05,
          minDeposit: 1000,
          minWithdrawal: 5000,
          commissionRate: 0.1,
          leverageEnabled: true,
          leverageBudget: 1000000,
          leverageUsedToday: 0,
          updatedAt: Date.now(),
          ...data,
          leverageRules: {
            lowFilling: true,
            maxCapacity: true,
            noHighStakes: true,
            offPeak: true,
            lossAlert: 50000,
            ...(data.leverageRules || {})
          },
          paymentMethods: {
            wave: { enabled: true, number: "", name: "WAVE" },
            om: { enabled: true, number: "", name: "ORANGE MONEY" },
            mtn: { enabled: true, number: "", name: "MTN MOMO" },
            ...(data.paymentMethods || {})
          },
          treasury: {
            wave: 0,
            om: 0,
            mtn: 0,
            ...(data.treasury || {})
          },
          id: "global"
        } as AppConfig;
        setConfig(mergedConfig);
      } else {
        // Initialize default config if not exists
        const defaultConfig: AppConfig = {
          id: "global",
          maintenanceMode: false,
          referralRate: 0.05, // 5% default
          minDeposit: 1000,
          minWithdrawal: 5000,
          commissionRate: 0.1,
          leverageEnabled: true,
          leverageBudget: 1000000,
          leverageUsedToday: 0,
          leverageRules: {
            lowFilling: true,
            maxCapacity: true,
            noHighStakes: true,
            offPeak: true,
            lossAlert: 50000
          },
          paymentMethods: {
            wave: { enabled: true, number: "", name: "WAVE" },
            om: { enabled: true, number: "", name: "ORANGE MONEY" },
            mtn: { enabled: true, number: "", name: "MTN MOMO" }
          },
          treasury: {
            wave: 0,
            om: 0,
            mtn: 0
          },
          oraclePrice: 250,
          updatedAt: Date.now()
        };
        setDoc(doc(db, "config", "global"), defaultConfig);
      }
      setLoading(false);
    }, (err) => {
      console.warn("SystemConfig quota/offline:", err?.message);
      setLoading(false);
    });
    return unsub;
  }, []);

  const handleSave = async () => {
    if (!config) return;
    setSaving(true);
    try {
      await updateDoc(doc(db, "config", "global"), {
        ...config,
        updatedAt: Date.now()
      });
      toast.success("Configuration système mise à jour !");
    } catch (e) {
      toast.error("Erreur de sauvegarde: " + e);
    } finally {
      setSaving(false);
    }
  };

  if (loading) return (
    <div className="flex items-center justify-center h-64 opacity-20">
      <RefreshCw size={32} className="animate-spin" />
    </div>
  );

  return (
    <div className="max-w-4xl space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Settings className="text-brand-gold" size={24} />
          <div>
            <h2 className="text-xl font-black italic uppercase tracking-tighter">Configuration Système</h2>
            <p className="text-[10px] font-bold text-gray-500 uppercase tracking-widest">Paramètres globaux de la plateforme</p>
          </div>
        </div>
        <button 
          onClick={handleSave}
          disabled={saving}
          className="flex items-center gap-2 bg-brand-gold text-brand-black px-6 py-2.5 rounded-xl font-black italic text-xs hover:scale-105 active:scale-95 transition-all disabled:opacity-50"
        >
          {saving ? <RefreshCw size={16} className="animate-spin" /> : <Save size={16} />}
          SAUVEGARDER LES MODIFICATIONS
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Platform Status */}
        <div className="card space-y-4">
          <div className="flex items-center gap-2 text-brand-gold border-b border-white/5 pb-3 mb-4">
            <Shield size={18} />
            <h3 className="text-xs font-black uppercase italic">État de la Plateforme</h3>
          </div>
          
          <div className="flex items-center justify-between p-3 bg-white/5 rounded-xl border border-white/5">
            <div>
              <p className="text-[10px] font-black uppercase italic">Mode Maintenance</p>
              <p className="text-[9px] text-gray-500 uppercase font-bold leading-tight">Coupe l'accès public au site</p>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input 
                type="checkbox" 
                checked={config?.maintenanceMode}
                onChange={(e) => setConfig(c => c ? {...c, maintenanceMode: e.target.checked} : null)}
                className="sr-only peer" 
              />
              <div className="w-11 h-6 bg-white/10 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-brand-red"></div>
            </label>
          </div>

          <div className="flex items-center justify-between p-3 bg-white/5 rounded-xl border border-white/5">
            <div>
              <p className="text-[10px] font-black uppercase italic">Système de Levier</p>
              <p className="text-[9px] text-gray-500 uppercase font-bold leading-tight">Active l'intervention des bots admin</p>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input 
                type="checkbox" 
                checked={config?.leverageEnabled}
                onChange={(e) => setConfig(c => c ? {...c, leverageEnabled: e.target.checked} : null)}
                className="sr-only peer" 
              />
              <div className="w-11 h-6 bg-white/10 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-green-500"></div>
            </label>
          </div>

          <div className="flex items-center justify-between p-3 bg-white/5 rounded-xl border border-white/5">
            <div>
              <p className="text-[10px] font-black uppercase italic">Défis P vs P contre Admin</p>
              <p className="text-[9px] text-gray-500 uppercase font-bold leading-tight">Débite l'admin pour valider automatiquement les duels contre ses positions</p>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input 
                type="checkbox" 
                checked={config?.autoAcceptAdminPvP ?? true}
                onChange={(e) => setConfig(c => c ? {...c, autoAcceptAdminPvP: e.target.checked} : null)}
                className="sr-only peer" 
              />
              <div className="w-11 h-6 bg-white/10 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-brand-gold"></div>
            </label>
          </div>
        </div>

        {/* Trésorerie */}
        <div className="card space-y-4">
          <div className="flex items-center gap-2 text-brand-gold border-b border-white/5 pb-3 mb-4">
            <Wallet size={18} />
            <h3 className="text-xs font-black uppercase italic">Suivi Trésorerie</h3>
          </div>
          
          <div className="grid grid-cols-1 gap-2">
            {config && Object.entries(config.treasury).map(([key, balance]) => (
              <div key={key} className="flex items-center justify-between p-3 bg-white/5 rounded-xl border border-white/5">
                <span className="text-[10px] font-black uppercase italic">{key.toUpperCase()}</span>
                <div className="flex items-center gap-2">
                  <input 
                    type="number"
                    value={balance}
                    onChange={(e) => {
                      const newTreasury = { ...config.treasury };
                      newTreasury[key as keyof typeof config.treasury] = parseInt(e.target.value);
                      setConfig({ ...config, treasury: newTreasury });
                    }}
                    className="w-24 bg-black/40 border border-white/5 rounded-lg px-2 py-1 text-[10px] font-mono text-right outline-none focus:border-brand-gold"
                  />
                  <span className="text-[10px] font-bold text-gray-500">FCFA</span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Financial Settings */}
        <div className="card space-y-4">
          <div className="flex items-center gap-2 text-brand-gold border-b border-white/5 pb-3 mb-4">
            <Wallet size={18} />
            <h3 className="text-xs font-black uppercase italic">Paramètres Financiers</h3>
          </div>

          <div className="space-y-4">
            <div>
              <div className="flex justify-between mb-1.5 px-1">
                <label className="text-[9px] font-black uppercase text-gray-500">Commission Plateforme (%)</label>
                <span className="text-[10px] font-black italic text-brand-gold">{(config?.commissionRate || 0) * 100}%</span>
              </div>
              <input 
                type="range"
                min="0"
                max="0.5"
                step="0.01"
                value={config?.commissionRate}
                onChange={(e) => setConfig(c => c ? {...c, commissionRate: parseFloat(e.target.value)} : null)}
                className="w-full h-1.5 bg-white/10 rounded-lg appearance-none cursor-pointer accent-brand-gold"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="text-[9px] font-black uppercase text-gray-500 px-1">Dépôt Min (FCFA)</label>
                <input 
                  type="number"
                  value={config?.minDeposit}
                  onChange={(e) => setConfig(c => c ? {...c, minDeposit: parseInt(e.target.value)} : null)}
                  className="w-full bg-black/40 border border-white/5 rounded-xl px-3 py-2 text-xs font-black italic focus:border-brand-gold outline-none"
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-[9px] font-black uppercase text-gray-500 px-1">Retrait Min (FCFA)</label>
                <input 
                  type="number"
                  value={config?.minWithdrawal}
                  onChange={(e) => setConfig(c => c ? {...c, minWithdrawal: parseInt(e.target.value)} : null)}
                  className="w-full bg-black/40 border border-white/5 rounded-xl px-3 py-2 text-xs font-black italic focus:border-brand-gold outline-none"
                />
              </div>
            </div>
          </div>
        </div>

        {/* Oracle Settings */}
        <div className="card space-y-4">
          <div className="flex items-center gap-2 text-brand-gold border-b border-white/5 pb-3 mb-4">
            <Zap size={18} />
            <h3 className="text-xs font-black uppercase italic">Paramètres Oracle</h3>
          </div>

          <div className="space-y-4">
            <div className="space-y-1.5">
              <label className="text-[9px] font-black uppercase text-gray-500 px-1">Prix de l'Oracle (FCFA/appel)</label>
              <input 
                type="number"
                value={config?.oraclePrice}
                onChange={(e) => setConfig(c => c ? {...c, oraclePrice: parseInt(e.target.value)} : null)}
                className="w-full bg-black/40 border border-white/5 rounded-xl px-3 py-2 text-xs font-black italic focus:border-brand-gold outline-none"
              />
            </div>

            <div className="p-3 bg-brand-gold/10 border border-brand-gold/20 rounded-xl flex items-start gap-3">
              <Info className="text-brand-gold shrink-0 mt-0.5" size={14} />
              <p className="text-[9px] font-medium text-brand-gold leading-relaxed uppercase italic">
                Ce montant est prélevé du jackpot global à chaque simulation de résultat pour couvrir les frais de l'IA Konamix.
              </p>
            </div>
          </div>
        </div>

        {/* Budget Levier */}
        <div className="card space-y-4">
          <div className="flex items-center gap-2 text-brand-gold border-b border-white/5 pb-3 mb-4">
            <Percent size={18} />
            <h3 className="text-xs font-black uppercase italic">Budget Levier Admin</h3>
          </div>

          <div className="space-y-4">
            <div className="space-y-1.5">
              <label className="text-[9px] font-black uppercase text-gray-500 px-1">Plafond Maximal Mensuel (FCFA)</label>
              <input 
                type="number"
                value={config?.leverageBudget}
                onChange={(e) => setConfig(c => c ? {...c, leverageBudget: parseInt(e.target.value)} : null)}
                className="w-full bg-black/40 border border-white/5 rounded-xl px-3 py-2 text-xs font-black italic focus:border-brand-gold outline-none"
              />
            </div>
            <p className="text-[9px] text-gray-500 uppercase font-black italic text-center px-4">
              Limite les pertes potentielles de la plateforme lors de l'utilisation du levier pour remplir les salons.
            </p>
          </div>
        </div>

        {/* Parrainage */}
        <div className="card space-y-4">
          <div className="flex items-center gap-2 text-brand-gold border-b border-white/5 pb-3 mb-4">
            <Gift size={18} />
            <h3 className="text-xs font-black uppercase italic">Système de Parrainage</h3>
          </div>

          <div className="space-y-4">
            <div>
              <div className="flex justify-between mb-1.5 px-1">
                <label className="text-[9px] font-black uppercase text-gray-500">Taux de Parrainage (%)</label>
                <span className="text-[10px] font-black italic text-brand-gold">{(config?.referralRate || 0) * 100}%</span>
              </div>
              <input 
                type="range"
                min="0"
                max="0.2"
                step="0.005"
                value={config?.referralRate}
                onChange={(e) => setConfig(c => c ? {...c, referralRate: parseFloat(e.target.value)} : null)}
                className="w-full h-1.5 bg-white/10 rounded-lg appearance-none cursor-pointer accent-brand-gold"
              />
              <p className="text-[8px] text-gray-500 uppercase font-black italic mt-2 px-1">
                Commission versée au parrain sur les gains ou mises du filleul (selon la logique du salon).
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
