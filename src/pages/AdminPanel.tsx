import { useState, useEffect } from "react";
import { collection, query, orderBy, onSnapshot, doc, getDoc, setDoc, addDoc, serverTimestamp } from "firebase/firestore";
import { db } from "../lib/firebase";
import { AppConfig } from "../types";
import { 
  Users, 
  LayoutDashboard, 
  Wallet, 
  Target, 
  ShieldAlert, 
  Settings,
  Activity,
  Trophy,
  Bell,
  CreditCard,
  Gift
} from "lucide-react";
import { useAuth } from "../contexts/AuthContext";
import { Navigate } from "react-router-dom";
import { getDocs } from "firebase/firestore";

// Modular Components
import Overview from "../components/admin/Overview";
import UserManagement from "../components/admin/UserManagement";
import RoomManagement from "../components/admin/RoomManagement";
import FinanceManagement from "../components/admin/FinanceManagement";
import LeverageControl from "../components/admin/LeverageControl";
import ContentManagement from "../components/admin/ContentManagement";
import SafetyManagement from "../components/admin/SafetyManagement";
import SystemConfig from "../components/admin/SystemConfig";
import AuditLogs from "../components/admin/AuditLogs";
import ReferralManagement from "../components/admin/ReferralManagement";
import NotificationManager from "../components/admin/NotificationManager";
import PaymentManagement from "../components/admin/PaymentManagement";

type AdminTab = "overview" | "users" | "rooms" | "finance" | "payments" | "leverage" | "safety" | "content" | "config" | "logs" | "referrals" | "notifications";

export default function AdminPanel() {
  const { isAdmin } = useAuth();
  const [tab, setTab] = useState<AdminTab>("overview");
  const [showBonusDirectly, setShowBonusDirectly] = useState(false);
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    if (!isAdmin) return;
    
    // Ensure global config exists
    const checkConfig = async () => {
      try {
        const configRef = doc(db, "config", "global");
        const snap = await getDoc(configRef);
        if (!snap.exists()) {
          const defaultConfig: AppConfig = {
            id: "global",
            maintenanceMode: false,
            referralRate: 0.05,
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
              wave: { enabled: true, number: "+221 77 000 00 00", name: "Wave" },
              om: { enabled: true, number: "+221 78 000 00 00", name: "Orange Money" },
              mtn: { enabled: true, number: "+221 76 000 00 00", name: "MTN MoMo" }
            },
            treasury: {
              wave: 0,
              om: 0,
              mtn: 0
            },
            oraclePrice: 250,
            updatedAt: Date.now()
          };
          await setDoc(configRef, defaultConfig);
        }

        // Seed payment methods if empty
        const methodsSnap = await getDocs(collection(db, "payment_methods"));
        if (methodsSnap.empty) {
          const initialMethods = [
            { name: "Wave", logo: "https://upload.wikimedia.org/wikipedia/commons/e/e4/Wave_Mobile_Money_logo.png", color: "bg-[#009FE3]", enabled: true, createdAt: serverTimestamp() },
            { name: "Orange", logo: "https://upload.wikimedia.org/wikipedia/commons/thumb/c/c8/Orange_logo.svg/512px-Orange_logo.svg.png", color: "bg-[#FF7900]", enabled: true, createdAt: serverTimestamp() },
            { name: "MTN", logo: "https://upload.wikimedia.org/wikipedia/commons/thumb/0/05/MTN_Mobile_Money_logo.png/512px-MTN_Mobile_Money_logo.png", color: "bg-[#FFCC00]", enabled: true, createdAt: serverTimestamp() },
            { name: "Moov", logo: "https://upload.wikimedia.org/wikipedia/commons/b/b5/Moov_Africa_Logo.png", color: "bg-[#0066cc]", enabled: true, createdAt: serverTimestamp() }
          ];
          for (const m of initialMethods) {
            await addDoc(collection(db, "payment_methods"), m);
          }
        }
      } catch (err: any) {
        console.warn("AdminPanel config check quota/offline fallback:", err?.message);
      } finally {
        setIsReady(true);
      }
    };
    checkConfig();
  }, [isAdmin]);

  if (!isAdmin) return <Navigate to="/" />;
  if (!isReady) return <div className="min-h-screen flex items-center justify-center italic font-black opacity-20">INITIALISATION...</div>;

  const NavItems = [
    { id: "overview", icon: Activity, label: "Vue d'ensemble" },
    { id: "users", icon: Users, label: "Gestion Joueurs & Bonus" },
    { id: "rooms", icon: Trophy, label: "Salles & Paris" },
    { id: "finance", icon: Wallet, label: "Finances" },
    { id: "payments", icon: CreditCard, label: "Paiements" },
    { id: "leverage", icon: Target, label: "Levier Admin" },
    { id: "content", icon: Trophy, label: "Catalogue" },
    { id: "referrals", icon: Users, label: "Parrainage" },
    { id: "notifications", icon: Bell, label: "Alertes Push" },
    { id: "safety", icon: ShieldAlert, label: "Modération" },
    { id: "logs", icon: Activity, label: "Audits" },
    { id: "config", icon: Settings, label: "Réglages" },
  ];

  return (
    <div className="space-y-6 pb-20">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 px-4 md:px-0 bg-gradient-to-r from-brand-red/10 via-black/40 to-brand-gold/10 p-5 rounded-3xl border border-white/10 shadow-2xl">
        <div className="flex flex-col gap-1">
          <h2 className="text-2xl font-black italic tracking-tighter text-white">CONSOLE ADMIN</h2>
          <p className="text-[10px] text-gray-400 font-bold uppercase tracking-widest">Dashboard de Gestion Konamix</p>
        </div>

        {/* Global Action Button accessible at ALL times */}
        <button
          type="button"
          onClick={() => {
            setTab("users");
            setShowBonusDirectly(true);
          }}
          className="flex items-center justify-center gap-2.5 bg-gradient-to-r from-amber-500 via-brand-gold to-yellow-400 hover:brightness-110 text-brand-black px-6 py-3.5 rounded-2xl font-black text-xs uppercase shadow-xl shadow-brand-gold/30 hover:scale-105 active:scale-95 transition-all cursor-pointer shrink-0"
        >
          <Gift size={20} className="animate-bounce" />
          <span>🎁 AJOUTER UN BONUS</span>
        </button>
      </div>

      {/* Main Navigation */}
      <div className="flex gap-2 overflow-x-auto pb-4 scrollbar-hide px-4 md:px-0">
        {NavItems.map(item => (
          <button 
             key={item.id}
             onClick={() => setTab(item.id as AdminTab)}
             className={`flex flex-col items-center justify-center min-w-[100px] p-4 rounded-2xl border transition-all active:scale-95 ${
               tab === item.id 
               ? 'bg-brand-red border-brand-red text-white shadow-lg shadow-brand-red/20' 
               : 'bg-black/40 border-white/10 text-gray-300 hover:bg-black/60 hover:text-white backdrop-blur-md'
             }`}
          >
            <item.icon size={20} className={tab === item.id ? "animate-pulse" : ""} />
            <span className="text-[8px] font-black uppercase mt-2 text-center leading-tight">{item.label}</span>
          </button>
        ))}
      </div>

      {/* Tab Content */}
      <div className="mt-4 px-4 md:px-0">
          {tab === "overview" && <Overview />}
          {tab === "users" && (
            <UserManagement 
              autoOpenBonus={showBonusDirectly} 
              onBonusModalClose={() => setShowBonusDirectly(false)} 
            />
          )}
          {tab === "rooms" && <RoomManagement />}
          {tab === "finance" && <FinanceManagement />}
          {tab === "payments" && <PaymentManagement />}
          {tab === "leverage" && <LeverageControl />}
          {tab === "content" && <ContentManagement />}
          {tab === "referrals" && <ReferralManagement />}
          {tab === "notifications" && <NotificationManager />}
          {tab === "safety" && <SafetyManagement />}
          {tab === "logs" && <AuditLogs />}
          {tab === "config" && <SystemConfig />}
      </div>
    </div>
  );
}
