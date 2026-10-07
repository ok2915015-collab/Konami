import { useState, useEffect } from "react";
import { collection, query, onSnapshot, orderBy, limit } from "firebase/firestore";
import { db } from "../../lib/firebase";
import { History, Search, Filter, Shield, User, Wallet, Layout } from "lucide-react";
import { format } from "date-fns";
import { fr } from "date-fns/locale";

export default function AuditLogs() {
  const [logs, setLogs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const q = query(collection(db, "audit_logs"), orderBy("createdAt", "desc"), limit(100));
    const unsubscribe = onSnapshot(
      q, 
      (snap) => {
        setLogs(snap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
        setLoading(false);
      },
      (err) => {
        console.warn("Audit logs quota/offline:", err?.message);
        setLoading(false);
      }
    );
    return unsubscribe;
  }, []);

  const getActionIcon = (action: string) => {
    if (action.includes("BALANCE")) return <Wallet className="text-brand-gold" size={14} />;
    if (action.includes("BAN") || action.includes("KYC")) return <Shield className="text-brand-red" size={14} />;
    if (action.includes("ROOM")) return <Layout className="text-blue-500" size={14} />;
    return <User className="text-gray-400" size={14} />;
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <History className="text-brand-gold" size={24} />
          <div>
            <h2 className="text-xl font-black italic uppercase tracking-tighter">Journal d'Audit</h2>
            <p className="text-[10px] font-bold text-gray-500 uppercase tracking-widest">Suivi complet des actions administratives</p>
          </div>
        </div>
      </div>

      <div className="card p-0 border-white/5 overflow-hidden">
        <div className="p-4 border-b border-white/5 bg-white/5 flex items-center justify-between">
          <h3 className="text-[10px] font-black uppercase tracking-widest text-gray-500 italic">Historique récent (100 dernières actions)</h3>
          <button className="text-[9px] font-black uppercase text-brand-gold hover:underline">Exporter CSV</button>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead className="bg-white/5 text-[9px] font-black uppercase text-gray-500 italic border-b border-white/5">
              <tr>
                <th className="p-4">Date & Heure</th>
                <th className="p-4">Admin ID</th>
                <th className="p-4">Action</th>
                <th className="p-4">Cible</th>
                <th className="p-4">Détails</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5 text-[11px]">
              {logs.length === 0 ? (
                <tr>
                  <td colSpan={5} className="p-12 text-center text-gray-600 uppercase font-black italic opacity-20">
                    Aucun log enregistré pour le moment
                  </td>
                </tr>
              ) : (
                logs.map(log => (
                  <tr key={log.id} className="hover:bg-white/[0.02] transition-colors">
                    <td className="p-4 font-mono text-gray-400 whitespace-nowrap">
                      {log.createdAt?.seconds ? format(log.createdAt.seconds * 1000, "dd MMM yyyy HH:mm:ss", { locale: fr }) : "N/A"}
                    </td>
                    <td className="p-4">
                      <span className="font-mono text-[10px] px-2 py-1 bg-white/5 border border-white/10 rounded-md">
                        {log.adminId?.slice(0, 8)}...
                      </span>
                    </td>
                    <td className="p-4">
                      <div className="flex items-center gap-2">
                        {getActionIcon(log.action)}
                        <span className="font-black uppercase tracking-tight italic">{log.action}</span>
                      </div>
                    </td>
                    <td className="p-4">
                      <span className="font-mono text-[10px] opacity-60">{log.targetId}</span>
                    </td>
                    <td className="p-4 italic text-gray-400">
                      {log.details || "-"}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
