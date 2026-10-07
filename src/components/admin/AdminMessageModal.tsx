import React, { useState, useEffect, useRef } from "react";
import { collection, query, where, onSnapshot, addDoc, orderBy, serverTimestamp, updateDoc, doc } from "firebase/firestore";
import { db } from "../../lib/firebase";
import { User, SupportMessage } from "../../types";
import { formatFCFA } from "../../lib/utils";
import { X, Send, Mail, User as UserIcon, ShieldAlert, Sparkles, CheckCheck, Clock } from "lucide-react";
import { toast } from "sonner";

interface AdminMessageModalProps {
  isOpen: boolean;
  onClose: () => void;
  targetUser: User | null;
  adminUser: User | null;
}

const TEMPLATES = [
  "🎉 Félicitations pour vos gains récents sur Konamix !",
  "🎁 Un bonus a été crédité sur votre compte et est immédiatement jouable.",
  "⚠️ Veuillez compléter la vérification de votre identité (KYC) dans votre profil.",
  "✅ Votre demande de retrait a été validée avec succès par nos services.",
  "ℹ️ Bonjour, l'administration est à votre écoute. Comment pouvons-nous vous aider ?",
];

export default function AdminMessageModal({ isOpen, onClose, targetUser, adminUser }: AdminMessageModalProps) {
  const [messages, setMessages] = useState<SupportMessage[]>([]);
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom of conversation
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    if (!isOpen || !targetUser) return;

    // Realtime listener for messages between admin and this user
    const q = query(
      collection(db, "support_messages"),
      where("userId", "==", targetUser.uid),
      orderBy("createdAt", "asc")
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const list: SupportMessage[] = snapshot.docs.map(docSnap => ({
        id: docSnap.id,
        ...docSnap.data()
      } as SupportMessage));
      
      setMessages(list);

      // Mark unread user messages as read by admin
      snapshot.docs.forEach(async (docSnap) => {
        const data = docSnap.data();
        if (data.senderRole === "user" && data.read === false) {
          try {
            await updateDoc(doc(db, "support_messages", docSnap.id), { read: true });
          } catch (e) {
            // Ignore if rules or offline
          }
        }
      });

      setTimeout(scrollToBottom, 100);
    }, (err) => {
      console.warn("Erreur écoute messages support:", err);
    });

    return () => unsubscribe();
  }, [isOpen, targetUser]);

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  if (!isOpen || !targetUser) return null;

  const handleSend = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const content = text.trim();
    if (!content || sending) return;

    setSending(true);
    try {
      // 1. Ajouter le message de support
      await addDoc(collection(db, "support_messages"), {
        userId: targetUser.uid,
        userName: targetUser.displayName || targetUser.email || "Joueur",
        userEmail: targetUser.email || "",
        senderId: adminUser?.uid || "admin",
        senderName: adminUser?.displayName || "Support Administrateur",
        senderRole: "admin",
        content,
        createdAt: serverTimestamp(),
        read: false,
        type: "text",
      });

      // 2. Envoyer une notification ciblée au joueur
      await addDoc(collection(db, "notifications"), {
        title: "Message de l'administration",
        body: content,
        type: "info",
        target: targetUser.uid,
        createdAt: serverTimestamp(),
        readBy: []
      });

      setText("");
      toast.success(`Message envoyé avec succès à ${targetUser.displayName || targetUser.email} !`);
    } catch (err: any) {
      console.error("Erreur envoi message:", err);
      toast.error("Échec de l'envoi du message : " + (err?.message || "Erreur réseau"));
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-md flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
      <div 
        className="bg-[#121212] border border-white/15 rounded-3xl p-5 sm:p-6 max-w-xl w-full shadow-2xl relative flex flex-col h-[85vh] max-h-[750px] my-auto animate-in fade-in zoom-in-95 duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header Fixe */}
        <div className="flex items-center justify-between pb-3 border-b border-white/10 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-brand-gold/15 text-brand-gold flex items-center justify-center border border-brand-gold/30 shrink-0">
              <Mail size={20} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base font-black uppercase italic tracking-tighter text-white">
                  Message à {targetUser.displayName || "Joueur"}
                </h3>
                <span className="text-[9px] font-black uppercase px-2 py-0.5 rounded-full bg-brand-gold/20 text-brand-gold border border-brand-gold/30">
                  {targetUser.role === "admin" ? "Admin" : "Joueur"}
                </span>
              </div>
              <p className="text-[10px] text-gray-400 font-bold uppercase truncate max-w-xs">
                {targetUser.email} • Solde: <span className="text-brand-gold font-mono">{formatFCFA(targetUser.balance || 0)}</span>
                {targetUser.phoneNumber ? ` • ${targetUser.phoneNumber}` : ""}
              </p>
            </div>
          </div>
          <button 
            type="button"
            onClick={onClose}
            className="text-gray-400 hover:text-white p-2 rounded-xl bg-white/5 hover:bg-white/10 cursor-pointer transition-colors"
            title="Fermer"
          >
            <X size={18} />
          </button>
        </div>

        {/* Quick templates chips */}
        <div className="py-2 shrink-0 border-b border-white/5">
          <p className="text-[9px] font-black uppercase text-gray-400 mb-1.5 flex items-center gap-1">
            <Sparkles size={11} className="text-brand-gold" /> Modèles de messages rapides :
          </p>
          <div className="flex gap-1.5 overflow-x-auto pb-1 scrollbar-none">
            {TEMPLATES.map((tmpl, idx) => (
              <button
                key={idx}
                type="button"
                onClick={() => setText(tmpl)}
                className="whitespace-nowrap text-[9px] font-bold px-2.5 py-1 rounded-lg bg-white/5 hover:bg-brand-gold/20 hover:text-brand-gold border border-white/10 text-gray-300 transition-all shrink-0 cursor-pointer"
              >
                {tmpl.slice(0, 36)}...
              </button>
            ))}
          </div>
        </div>

        {/* Conversation History (Scrollable) */}
        <div className="flex-1 overflow-y-auto py-3 pr-1 space-y-3 min-h-0">
          {messages.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-center p-6 text-gray-500 space-y-2">
              <Mail size={32} className="opacity-30 text-brand-gold" />
              <p className="text-xs font-bold uppercase tracking-wider text-gray-400">Aucun message pour le moment</p>
              <p className="text-[10px] text-gray-500 max-w-xs">
                Envoyez un message direct à ce joueur. Il le recevra en temps réel dans ses notifications et pourra vous répondre depuis son espace support.
              </p>
            </div>
          ) : (
            messages.map((msg) => {
              const isAdmin = msg.senderRole === "admin";
              return (
                <div 
                  key={msg.id} 
                  className={`flex flex-col ${isAdmin ? "items-end" : "items-start"}`}
                >
                  <div className="flex items-center gap-1.5 mb-1 px-1">
                    <span className="text-[9px] font-black uppercase text-gray-400">
                      {isAdmin ? "🛡️ Administration (Vous)" : `👤 ${msg.senderName || "Joueur"}`}
                    </span>
                    <span className="text-[8px] text-gray-500">
                      {msg.createdAt?.toDate ? msg.createdAt.toDate().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : "À l'instant"}
                    </span>
                  </div>
                  <div 
                    className={`max-w-[85%] rounded-2xl px-4 py-2.5 text-xs font-medium leading-relaxed shadow-md ${
                      isAdmin 
                        ? "bg-brand-gold text-brand-black font-semibold rounded-tr-none" 
                        : "bg-white/10 text-white border border-white/10 rounded-tl-none"
                    }`}
                  >
                    <p className="whitespace-pre-wrap">{msg.content}</p>
                    <div className="flex items-center justify-end gap-1 mt-1 opacity-70 text-[8px]">
                      {isAdmin && (
                        <span>{msg.read ? "✓✓ Lu" : "✓ Envoyé"}</span>
                      )}
                    </div>
                  </div>
                </div>
              );
            })
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* Input & Send Form */}
        <form onSubmit={handleSend} className="pt-3 border-t border-white/10 shrink-0 space-y-2">
          <div className="relative">
            <textarea
              value={text}
              onChange={(e) => setText(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
                  handleSend();
                }
              }}
              placeholder={`Écrire un message à ${targetUser.displayName || "ce joueur"}... (Ctrl+Entrée pour envoyer)`}
              rows={2}
              className="w-full bg-black/60 border border-white/15 focus:border-brand-gold rounded-2xl px-4 py-2.5 text-xs text-white placeholder-gray-500 outline-none resize-none transition-all pr-24"
              required
            />
            <button
              type="submit"
              disabled={sending || !text.trim()}
              className="absolute right-2 bottom-2.5 bg-brand-gold hover:bg-brand-gold/90 text-brand-black px-4 py-2 rounded-xl font-black text-xs uppercase flex items-center gap-1.5 shadow-md active:scale-95 disabled:opacity-40 transition-all cursor-pointer"
            >
              <Send size={13} />
              <span>{sending ? "..." : "Envoyer"}</span>
            </button>
          </div>
          <div className="flex items-center justify-between text-[9px] text-gray-500 px-1">
            <span>Le joueur recevra instantanément une alerte et une notification.</span>
            <span>Appuyez sur Ctrl+Entrée pour envoyer rapidement</span>
          </div>
        </form>
      </div>
    </div>
  );
}
