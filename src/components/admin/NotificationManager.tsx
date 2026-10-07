import { useState } from "react";
import { collection, addDoc, serverTimestamp } from "firebase/firestore";
import { db } from "../../lib/firebase";
import { Send, Bell, Users, Landmark, AlertTriangle } from "lucide-react";
import { toast } from "sonner";

export default function NotificationManager() {
  const [notification, setNotification] = useState({
    title: "",
    body: "",
    type: "info" as "info" | "success" | "warning" | "error",
    target: "all" as "all" | "active" | "admin"
  });
  const [sending, setSending] = useState(false);

  const sendNotification = async () => {
    if (!notification.title || !notification.body) return;
    setSending(true);
    try {
      await addDoc(collection(db, "notifications"), {
        ...notification,
        createdAt: serverTimestamp(),
        readBy: []
      });
      toast.success("Notification envoyée avec succès !");
      setNotification({ title: "", body: "", type: "info", target: "all" });
    } catch (e) {
      toast.error("Erreur lors de l'envoi");
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      <div className="card space-y-6">
        <div className="flex items-center gap-3 border-b border-white/5 pb-4">
          <Bell className="text-brand-gold" size={20} />
          <h3 className="text-sm font-black uppercase italic tracking-tight">Envoyer une Notification</h3>
        </div>

        <div className="space-y-4">
          <div className="space-y-1.5">
            <label className="text-[10px] font-black uppercase text-gray-500 px-1">Titre de l'alerte</label>
            <input 
              value={notification.title}
              onChange={e => setNotification({...notification, title: e.target.value})}
              placeholder="Ex: Maintenance programmée..."
              className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-3 text-sm font-bold outline-none focus:border-brand-gold transition-all"
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-[10px] font-black uppercase text-gray-500 px-1">Message</label>
            <textarea 
              value={notification.body}
              onChange={e => setNotification({...notification, body: e.target.value})}
              placeholder="Entrez votre message ici..."
              rows={4}
              className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-3 text-sm font-bold outline-none focus:border-brand-gold transition-all resize-none"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="text-[10px] font-black uppercase text-gray-500 px-1">Type d'icône</label>
              <select 
                value={notification.type}
                onChange={e => setNotification({...notification, type: e.target.value as any})}
                className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-3 text-xs font-black uppercase outline-none"
              >
                <option value="info">Information (Bleu)</option>
                <option value="success">Succès (Vert)</option>
                <option value="warning">Alerte (Or)</option>
                <option value="error">Urgent (Rouge)</option>
              </select>
            </div>
            <div className="space-y-1.5">
              <label className="text-[10px] font-black uppercase text-gray-500 px-1">Audience Cible</label>
              <select 
                value={notification.target}
                onChange={e => setNotification({...notification, target: e.target.value as any})}
                className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-3 text-xs font-black uppercase outline-none"
              >
                <option value="all">Tout le monde</option>
                <option value="active">Joueurs en ligne</option>
                <option value="admin">Administrateurs</option>
              </select>
            </div>
          </div>

          <button 
            disabled={sending || !notification.title}
            onClick={sendNotification}
            className="w-full bg-brand-gold text-brand-black font-black uppercase py-4 rounded-2xl flex items-center justify-center gap-2 hover:opacity-90 active:scale-[0.98] transition-all disabled:opacity-50"
          >
            <Send size={18} />
            {sending ? "ENVOI EN COURS..." : "DIFFUSER LA NOTIFICATION"}
          </button>
        </div>
      </div>

      <div className="space-y-4">
        <h3 className="text-[10px] font-black uppercase text-gray-500 tracking-widest px-1">Aperçu du message</h3>
        <div className={`card border-l-4 p-4 ${
          notification.type === 'info' ? 'border-l-blue-500 bg-blue-500/5' :
          notification.type === 'success' ? 'border-l-green-500 bg-green-500/5' :
          notification.type === 'warning' ? 'border-l-brand-gold bg-brand-gold/5' :
          'border-l-brand-red bg-brand-red/5'
        }`}>
          <div className="flex gap-3">
            <div className={`w-10 h-10 rounded-lg flex items-center justify-center shrink-0 ${
              notification.type === 'info' ? 'bg-blue-500/20 text-blue-500' :
              notification.type === 'success' ? 'bg-green-500/20 text-green-500' :
              notification.type === 'warning' ? 'bg-brand-gold/20 text-brand-gold' :
              'bg-brand-red/20 text-brand-red'
            }`}>
              {notification.type === 'info' && <Bell size={20} />}
              {notification.type === 'success' && <Landmark size={20} />}
              {notification.type === 'warning' && <AlertTriangle size={20} />}
              {notification.type === 'error' && <AlertTriangle size={20} />}
            </div>
            <div>
              <h4 className="font-black text-sm text-white italic uppercase tracking-tight">{notification.title || "Titre de la notification"}</h4>
              <p className="text-xs text-gray-400 mt-1 leading-relaxed">
                {notification.body || "Le contenu de votre message s'affichera ici pour tous les utilisateurs sélectionnés."}
              </p>
            </div>
          </div>
        </div>
        
        <div className="card border-dashed border-white/5 opacity-50 flex flex-col items-center justify-center py-12 text-center">
            <Users size={32} className="mb-2 text-gray-600" />
            <p className="text-[10px] font-black uppercase tracking-widest text-gray-600 italic">Historique des pushs<br/>bientôt disponible</p>
        </div>
      </div>
    </div>
  );
}
