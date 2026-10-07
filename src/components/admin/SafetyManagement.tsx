import { useState, useEffect } from "react";
import { collection, query, onSnapshot, orderBy, limit } from "firebase/firestore";
import { db } from "../../lib/firebase";
import { ShieldAlert, MessageSquare, AlertTriangle, ShieldCheck, Search, Filter, Eye } from "lucide-react";
import { formatFCFA, cn } from "../../lib/utils";

export default function SafetyManagement() {
  const [reports, setReports] = useState<any[]>([]);
  const [search, setSearch] = useState("");

  useEffect(() => {
    const q = query(collection(db, "reports"), orderBy("createdAt", "desc"), limit(50));
    const unsubscribe = onSnapshot(
      q, 
      (snap) => {
        setReports(snap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
      },
      (err) => console.warn("Reports quota/offline:", err?.message)
    );
    return unsubscribe;
  }, []);

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="card border-white/5 bg-gradient-to-br from-brand-red/5 to-transparent">
          <div className="flex items-center gap-3 mb-2">
            <AlertTriangle className="text-brand-red" size={20} />
            <h3 className="text-[10px] font-black uppercase text-gray-500">Signalements Actifs</h3>
          </div>
          <p className="text-3xl font-black italic tracking-tighter">{reports.filter(r => r.status === 'pending').length}</p>
        </div>
        <div className="card border-white/5">
          <div className="flex items-center gap-3 mb-2">
            <MessageSquare className="text-blue-500" size={20} />
            <h3 className="text-[10px] font-black uppercase text-gray-500">Messages Signalés</h3>
          </div>
          <p className="text-3xl font-black italic tracking-tighter">0</p>
        </div>
        <div className="card border-white/5">
          <div className="flex items-center gap-3 mb-2">
            <ShieldCheck className="text-green-500" size={20} />
            <h3 className="text-[10px] font-black uppercase text-gray-500">Résolus (24h)</h3>
          </div>
          <p className="text-3xl font-black italic tracking-tighter">{reports.filter(r => r.status === 'resolved').length}</p>
        </div>
      </div>

      <div className="card p-0 border-white/5 overflow-hidden">
        <div className="p-4 border-b border-white/5 flex flex-wrap items-center justify-between gap-4">
          <h3 className="text-xs font-black uppercase italic flex items-center gap-2">
            <ShieldAlert className="text-brand-red" size={16} />
            Centre de Modération
          </h3>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" size={14} />
            <input 
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Rechercher..."
              className="bg-black/40 border border-white/10 rounded-lg pl-9 pr-4 py-1.5 text-[10px] focus:border-brand-gold outline-none w-48"
            />
          </div>
        </div>

        <div className="divide-y divide-white/5">
          {reports.length === 0 ? (
            <div className="p-12 text-center text-gray-600">
              <ShieldCheck size={32} className="mx-auto mb-2 opacity-20" />
              <p className="text-[10px] font-black uppercase tracking-widest">Aucun signalement en attente</p>
            </div>
          ) : (
            reports.map(report => (
              <div key={report.id} className="p-4 hover:bg-white/[0.02] transition-colors flex items-center justify-between gap-4">
                <div className="flex items-center gap-4">
                  <div className="w-10 h-10 rounded-xl bg-brand-red/10 border border-brand-red/20 flex items-center justify-center text-brand-red">
                    <AlertTriangle size={20} />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold uppercase">{report.type}</span>
                      <span className="px-2 py-0.5 rounded text-[8px] font-black bg-white/5 text-gray-500 uppercase italic">
                        ID: {report.targetId}
                      </span>
                    </div>
                    <p className="text-[10px] text-gray-400 mt-0.5">Signalé par: {report.reporterName || 'Anonyme'}</p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <div className="text-right">
                    <p className="text-[10px] font-black uppercase text-gray-500">Statut</p>
                    <p className={cn(
                      "text-[10px] font-black uppercase italic",
                      report.status === 'pending' ? 'text-brand-gold' : 'text-green-500'
                    )}>
                      {report.status === 'pending' ? 'EN ATTENTE' : 'RÉSOLU'}
                    </p>
                  </div>
                  <button className="bg-white/5 border border-white/10 p-2 rounded-lg hover:bg-white/10 transition-colors">
                    <Eye size={16} />
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
