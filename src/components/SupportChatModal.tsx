import React, { useState, useEffect, useRef } from "react";
import { collection, query, where, onSnapshot, addDoc, orderBy, serverTimestamp, updateDoc, doc, limit } from "firebase/firestore";
import { db } from "../lib/firebase";
import { useAuth } from "../contexts/AuthContext";
import { SupportMessage } from "../types";
import { X, Send, MessageSquare, Bell, Sparkles, Shield, User as UserIcon, CheckCheck, HelpCircle, ArrowRight, PhoneCall } from "lucide-react";
import { toast } from "sonner";
import { formatFCFA } from "../lib/utils";

interface NotificationItem {
  id: string;
  title: string;
  body: string;
  type?: "info" | "success" | "warning" | "error";
  target?: string;
  createdAt?: any;
  readBy?: string[];
}

interface SupportChatModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialTab?: "chat" | "notifications";
}

const USER_QUICK_TOPICS = [
  "💰 Question sur mon dépôt ou retrait",
  "⚽ Problème ou question sur une salle",
  "🎁 Comment obtenir un bonus jouable ?",
  "📋 Vérification KYC de mon compte",
];

export default function SupportChatModal({ isOpen, onClose, initialTab = "chat" }: SupportChatModalProps) {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState<"chat" | "notifications">(initialTab);
  const [messages, setMessages] = useState<SupportMessage[]>([]);
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (initialTab) {
      setActiveTab(initialTab);
    }
  }, [initialTab, isOpen]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  // Listen to support messages
  useEffect(() => {
    if (!isOpen || !user) return;

    const q = query(
      collection(db, "support_messages"),
      where("userId", "==", user.uid),
      orderBy("createdAt", "asc")
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const list: SupportMessage[] = snapshot.docs.map((docSnap) => ({
        id: docSnap.id,
        ...docSnap.data(),
      } as SupportMessage));
      
      setMessages(list);

      // Mark admin messages as read when user opens the chat
      snapshot.docs.forEach(async (docSnap) => {
        const data = docSnap.data();
        if (data.senderRole === "admin" && data.read === false) {
          try {
            await updateDoc(doc(db, "support_messages", docSnap.id), { read: true });
          } catch (e) {
            // silent catch
          }
        }
      });

      setTimeout(scrollToBottom, 100);
    }, (err) => {
      console.warn("Erreur messages support:", err);
    });

    return () => unsubscribe();
  }, [isOpen, user]);

  // Listen to notifications
  useEffect(() => {
    if (!isOpen) return;

    const q = query(
      collection(db, "notifications"),
      orderBy("createdAt", "desc"),
      limit(25)
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const list = snapshot.docs
        .map((docSnap) => ({ id: docSnap.id, ...docSnap.data() } as NotificationItem))
        .filter((n) => {
          if (!n.target || n.target === "all") return true;
          if (user && n.target === user.uid) return true;
          return false;
        });

      setNotifications(list);
    }, (err) => {
      console.warn("Erreur notifications:", err);
    });

    return () => unsubscribe();
  }, [isOpen, user]);

  useEffect(() => {
    if (activeTab === "chat") {
      scrollToBottom();
    }
  }, [messages, activeTab]);

  if (!isOpen) return null;

  const handleSendMessage = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!user) {
      toast.error("Veuillez vous connecter pour contacter le support.");
      return;
    }
    const content = text.trim();
    if (!content || sending) return;

    setSending(true);
    try {
      await addDoc(collection(db, "support_messages"), {
        userId: user.uid,
        userName: user.displayName || user.email || "Joueur",
        userEmail: user.email || "",
        senderId: user.uid,
        senderName: user.displayName || "Joueur",
        senderRole: "user",
        content,
        createdAt: serverTimestamp(),
        read: false,
        type: "text",
      });

      setText("");
      toast.success("Message envoyé au support ! Un administrateur vous répondra sous peu.");
    } catch (err: any) {
      console.error("Erreur envoi:", err);
      toast.error("Erreur lors de l'envoi du message : " + (err?.message || ""));
    } finally {
      setSending(false);
    }
  };

  const markNotificationAsRead = async (id: string, readBy: string[] = []) => {
    if (!user) return;
    if (readBy.includes(user.uid)) return;
    try {
      await updateDoc(doc(db, "notifications", id), {
        readBy: [...readBy, user.uid],
      });
    } catch (e) {
      // ignore
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-md flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
      <div 
        className="bg-[#121212] border border-white/15 rounded-3xl p-4 sm:p-6 max-w-lg w-full shadow-2xl relative flex flex-col h-[85vh] max-h-[720px] my-auto animate-in fade-in zoom-in-95 duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header avec Tabs */}
        <div className="flex items-center justify-between pb-3 border-b border-white/10 shrink-0">
          <div className="flex items-center gap-2">
            <button
              onClick={() => setActiveTab("chat")}
              className={`flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs font-black uppercase transition-all cursor-pointer ${
                activeTab === "chat"
                  ? "bg-brand-red text-white shadow-md shadow-brand-red/30"
                  : "bg-white/5 text-gray-400 hover:text-white"
              }`}
            >
              <MessageSquare size={14} />
              <span>Support Direct</span>
            </button>

            <button
              onClick={() => setActiveTab("notifications")}
              className={`flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs font-black uppercase transition-all cursor-pointer ${
                activeTab === "notifications"
                  ? "bg-brand-gold text-brand-black shadow-md shadow-brand-gold/30"
                  : "bg-white/5 text-gray-400 hover:text-white"
              }`}
            >
              <Bell size={14} />
              <span>Alertes ({notifications.length})</span>
            </button>
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

        {/* TAB 1: LIVE SUPPORT MESSAGING */}
        {activeTab === "chat" && (
          <div className="flex flex-col flex-1 min-h-0 pt-2">
            {!user ? (
              <div className="flex-1 flex flex-col items-center justify-center text-center p-6 space-y-4">
                <Shield size={36} className="text-brand-red" />
                <h4 className="text-sm font-black uppercase text-white">Connexion Requise</h4>
                <p className="text-xs text-gray-400 max-w-xs leading-relaxed">
                  Connectez-vous pour échanger directement avec l'équipe d'administration et recevoir vos réponses en temps réel.
                </p>
              </div>
            ) : (
              <>
                {/* Bandeau d'information support */}
                <div className="bg-brand-red/10 border border-brand-red/20 rounded-2xl p-2.5 mb-2 flex items-center justify-between shrink-0">
                  <div className="flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full bg-green-500 animate-pulse" />
                    <span className="text-[10px] font-black uppercase text-white tracking-wider">
                      Support Konamix En Ligne
                    </span>
                  </div>
                  <span className="text-[9px] font-bold text-gray-400">
                    Réponse 24h/24 & 7j/7
                  </span>
                </div>

                {/* Suggestions de questions rapides */}
                <div className="shrink-0 mb-2">
                  <div className="flex gap-1.5 overflow-x-auto pb-1 scrollbar-none">
                    {USER_QUICK_TOPICS.map((topic, idx) => (
                      <button
                        key={idx}
                        type="button"
                        onClick={() => setText(topic)}
                        className="whitespace-nowrap text-[9px] font-bold px-2.5 py-1 rounded-lg bg-white/5 hover:bg-brand-red/20 hover:text-white border border-white/10 text-gray-300 transition-all shrink-0 cursor-pointer"
                      >
                        {topic}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Conversation History */}
                <div className="flex-1 overflow-y-auto pr-1 space-y-3 min-h-0 py-2">
                  {messages.length === 0 ? (
                    <div className="h-full flex flex-col items-center justify-center text-center p-6 text-gray-500 space-y-2">
                      <MessageSquare size={32} className="opacity-30 text-brand-red" />
                      <p className="text-xs font-bold uppercase tracking-wider text-gray-300">Bienvenue au Support Konamix</p>
                      <p className="text-[10px] text-gray-500 max-w-xs">
                        Posez votre question, signalez un incident ou répondez aux messages de l'administration ici. Nous vous répondons instantanément.
                      </p>
                    </div>
                  ) : (
                    messages.map((msg) => {
                      const isMe = msg.senderRole === "user";
                      return (
                        <div 
                          key={msg.id} 
                          className={`flex flex-col ${isMe ? "items-end" : "items-start"}`}
                        >
                          <div className="flex items-center gap-1.5 mb-1 px-1">
                            <span className="text-[9px] font-black uppercase text-gray-400">
                              {isMe ? "👤 Vous" : "🛡️ Administration Konamix"}
                            </span>
                            <span className="text-[8px] text-gray-500">
                              {msg.createdAt?.toDate ? msg.createdAt.toDate().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : "À l'instant"}
                            </span>
                          </div>
                          <div 
                            className={`max-w-[85%] rounded-2xl px-4 py-2.5 text-xs font-medium leading-relaxed shadow-md ${
                              isMe 
                                ? "bg-brand-red text-white font-semibold rounded-tr-none" 
                                : "bg-brand-gold/15 border border-brand-gold/30 text-brand-gold rounded-tl-none font-bold"
                            }`}
                          >
                            <p className="whitespace-pre-wrap">{msg.content}</p>
                          </div>
                        </div>
                      );
                    })
                  )}
                  <div ref={messagesEndRef} />
                </div>

                {/* Saisie & Envoi */}
                <form onSubmit={handleSendMessage} className="pt-2 border-t border-white/10 shrink-0 space-y-2">
                  <div className="relative">
                    <input
                      type="text"
                      value={text}
                      onChange={(e) => setText(e.target.value)}
                      placeholder="Votre message à l'administration..."
                      className="w-full bg-black/60 border border-white/15 focus:border-brand-red rounded-xl px-4 py-3 text-xs text-white placeholder-gray-500 outline-none pr-24"
                      required
                    />
                    <button
                      type="submit"
                      disabled={sending || !text.trim()}
                      className="absolute right-1.5 top-1.5 bottom-1.5 bg-brand-red hover:bg-brand-red/90 text-white px-4 rounded-lg font-black text-xs uppercase flex items-center gap-1 shadow-md active:scale-95 disabled:opacity-40 transition-all cursor-pointer"
                    >
                      <Send size={12} />
                      <span>{sending ? "..." : "Envoyer"}</span>
                    </button>
                  </div>
                </form>
              </>
            )}
          </div>
        )}

        {/* TAB 2: OFFICIAL NOTIFICATIONS */}
        {activeTab === "notifications" && (
          <div className="flex flex-col flex-1 min-h-0 pt-3 overflow-y-auto space-y-2.5 pr-1">
            {notifications.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-center p-6 text-gray-500 space-y-2">
                <Bell size={32} className="opacity-30 text-brand-gold" />
                <p className="text-xs font-bold uppercase tracking-wider text-gray-400">Aucune alerte reçue</p>
                <p className="text-[10px] text-gray-500">Toutes les annonces officielles et notifications apparaîtront ici.</p>
              </div>
            ) : (
              notifications.map((n) => {
                const isRead = user && n.readBy?.includes(user.uid);
                return (
                  <div 
                    key={n.id}
                    onClick={() => markNotificationAsRead(n.id, n.readBy)}
                    className={`p-3.5 rounded-2xl border transition-all cursor-pointer space-y-1.5 ${
                      isRead 
                        ? "bg-white/[0.02] border-white/5 opacity-70" 
                        : "bg-white/[0.06] border-brand-gold/30 shadow-md"
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className={`w-2 h-2 rounded-full ${isRead ? "bg-gray-600" : "bg-brand-gold"}`} />
                        <h4 className="text-xs font-black uppercase text-white tracking-wide">{n.title}</h4>
                      </div>
                      <span className="text-[9px] font-mono text-gray-500">
                        {n.createdAt?.toDate ? n.createdAt.toDate().toLocaleDateString() : "Récemment"}
                      </span>
                    </div>
                    <p className="text-[11px] text-gray-300 font-medium leading-relaxed pl-4">
                      {n.body}
                    </p>
                  </div>
                );
              })
            )}
          </div>
        )}
      </div>
    </div>
  );
}
