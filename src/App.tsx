import React, { createContext, useContext, useEffect, useState, Suspense } from "react";
import { BrowserRouter, Routes, Route, Navigate, useLocation, Link, useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "motion/react";
import { onAuthStateChanged } from "firebase/auth";
import { doc, getDoc, setDoc, onSnapshot, serverTimestamp, updateDoc, collection, query, where } from "firebase/firestore";
import { auth, db, signInWithGoogle } from "./lib/firebase";
import { User } from "./types";
import { Toaster, toast } from "sonner";
import { Home as HomeIcon, Trophy, Wallet, User as UserIcon, PlusCircle, LayoutDashboard, Bell, MessageSquare } from "lucide-react";
import { cn, handleFirestoreError, OperationType, formatFCFA } from "./lib/utils";

// Audio
import { playMetallicSound, playHeavyClick, playMetallicNavSound } from "./utils/audio";

// Components
const Home = React.lazy(() => import("./pages/Home"));
const Lobby = React.lazy(() => import("./pages/Lobby"));
const RoomDetail = React.lazy(() => import("./pages/RoomDetail"));
const Profile = React.lazy(() => import("./pages/Profile"));
const AdminPanel = React.lazy(() => import("./pages/AdminPanel"));
const WalletPage = React.lazy(() => import("./pages/Wallet"));
const Auth = React.lazy(() => import("./pages/Auth"));
const CreateRoom = React.lazy(() => import("./pages/CreateRoom"));
const Help = React.lazy(() => import("./pages/Help"));
const RoomHistory = React.lazy(() => import("./pages/RoomHistory"));
const Settings = React.lazy(() => import("./pages/Settings"));
import RoomNotificationTracker from "./components/RoomNotificationTracker";
import { OfflineIndicator } from "./components/OfflineIndicator";
import SupportChatModal from "./components/SupportChatModal";
import AdminMessageNotifier from "./components/AdminMessageNotifier";

import { AuthContext, useAuth } from "./contexts/AuthContext";


const AuthProvider = ({ children }: { children: React.ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);

  useEffect(() => {
    let activeUnsubscribe: (() => void) | null = null;

    const authUnsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      if (activeUnsubscribe) {
        activeUnsubscribe();
        activeUnsubscribe = null;
      }

      if (firebaseUser) {
        const userRef = doc(db, "users", firebaseUser.uid);
        const adminRef = doc(db, "admins", firebaseUser.uid);
        
        // Check admin role
        let isUserAdmin = false;
        try {
          const adminDoc = await getDoc(adminRef);
          isUserAdmin = adminDoc.exists() || firebaseUser.email === "ok2915015@gmail.com";
          
          // Self-seed admin record if hardcoded email matches but doc doesn't exist
          if (!adminDoc.exists() && firebaseUser.email === "ok2915015@gmail.com") {
            await setDoc(adminRef, { 
              email: firebaseUser.email,
              assignedAt: serverTimestamp(),
              addedBy: "system_init"
            });
          }
          
          setIsAdmin(isUserAdmin);
        } catch (error) {
          // If the collection doesn't exist yet, we still check the hardcoded email
          if (firebaseUser.email === "ok2915015@gmail.com") {
            isUserAdmin = true;
            setIsAdmin(true);
          } else {
            console.error("Admin check failed", error);
          }
        }

        // Initialize user doc only if it does not exist yet (never reset balance of existing user!)
        try {
          const userSnap = await getDoc(userRef);
          if (!userSnap.exists()) {
            const newUser: User = {
              uid: firebaseUser.uid,
              email: firebaseUser.email || "",
              displayName: firebaseUser.displayName || "Joueur",
              photoURL: firebaseUser.photoURL || "",
              balance: firebaseUser.email === "ok2915015@gmail.com" ? 50000 : 0, 
              role: isUserAdmin ? "admin" : "user",
              createdAt: serverTimestamp(),
            };
            await setDoc(userRef, newUser);
          } else {
            const existingData = userSnap.data();
            const updates: Record<string, any> = {};
            if (isUserAdmin && existingData?.role !== "admin") {
              updates.role = "admin";
            }
            if (existingData?.balance === undefined || existingData?.balance === null) {
              updates.balance = firebaseUser.email === "ok2915015@gmail.com" ? 50000 : 0;
            }
            if (Object.keys(updates).length > 0) {
              await updateDoc(userRef, updates);
            }
          }
        } catch (initErr) {
          console.error("User init check error:", initErr);
        }

        // Real-time listener strictly synchronizes without overwriting balance
        activeUnsubscribe = onSnapshot(userRef, (snap) => {
          if (snap.exists()) {
            const userData = snap.data() as User;
            setUser(userData);
            localStorage.setItem(`konamix_user_cache_${firebaseUser.uid}`, JSON.stringify(userData));
          }
          setLoading(false);
        }, (error) => {
          console.warn("Snapshot quota/offline fallback:", error?.message);
          const cachedStr = localStorage.getItem(`konamix_user_cache_${firebaseUser.uid}`);
          if (cachedStr) {
            try {
              const cachedData = JSON.parse(cachedStr);
              setUser(cachedData);
              setIsAdmin(cachedData.role === "admin" || cachedData.email === "ok2915015@gmail.com");
            } catch (e) {}
          } else {
            setUser((prev) => prev || {
              uid: firebaseUser.uid,
              email: firebaseUser.email || "",
              displayName: firebaseUser.displayName || "Joueur",
              photoURL: firebaseUser.photoURL || "",
              balance: firebaseUser.email === "ok2915015@gmail.com" ? 50000 : 10000,
              role: isUserAdmin ? "admin" : "user",
              createdAt: Date.now(),
            });
          }
          setLoading(false);
        });
      } else {
        const sessionUid = localStorage.getItem("konamix_session_uid");
        if (sessionUid) {
          const userRef = doc(db, "users", sessionUid);
          activeUnsubscribe = onSnapshot(userRef, (snap) => {
            if (snap.exists()) {
              const userData = snap.data() as User;
              setUser(userData);
              localStorage.setItem(`konamix_user_cache_${sessionUid}`, JSON.stringify(userData));
              setIsAdmin(userData.role === "admin" || userData.email === "ok2915015@gmail.com");
            } else {
              setUser(null);
              setIsAdmin(false);
            }
            setLoading(false);
          }, (error) => {
            console.warn("Local session quota/offline fallback:", error?.message);
            const cachedStr = localStorage.getItem(`konamix_user_cache_${sessionUid}`);
            if (cachedStr) {
              try {
                const cachedData = JSON.parse(cachedStr);
                setUser(cachedData);
                setIsAdmin(cachedData.role === "admin" || cachedData.email === "ok2915015@gmail.com");
              } catch (e) {}
            }
            setLoading(false);
          });
        } else {
          setUser(null);
          setIsAdmin(false);
          setLoading(false);
        }
      }
    });

    const handleCustomAuthChange = () => {
      const sessionUid = localStorage.getItem("konamix_session_uid");
      if (sessionUid) {
        const userRef = doc(db, "users", sessionUid);
        if (activeUnsubscribe) activeUnsubscribe();
        activeUnsubscribe = onSnapshot(userRef, (snap) => {
          if (snap.exists()) {
            const userData = snap.data() as User;
            setUser(userData);
            localStorage.setItem(`konamix_user_cache_${sessionUid}`, JSON.stringify(userData));
            setIsAdmin(userData.role === "admin" || userData.email === "ok2915015@gmail.com");
          }
          setLoading(false);
        }, (err) => {
          console.warn("Custom auth snapshot quota/offline:", err?.message);
          const cachedStr = localStorage.getItem(`konamix_user_cache_${sessionUid}`);
          if (cachedStr) {
            try {
              const cachedData = JSON.parse(cachedStr);
              setUser(cachedData);
              setIsAdmin(cachedData.role === "admin" || cachedData.email === "ok2915015@gmail.com");
            } catch (e) {}
          }
          setLoading(false);
        });
      } else if (!auth.currentUser) {
        setUser(null);
        setIsAdmin(false);
        setLoading(false);
      }
    };

    window.addEventListener("konamix_auth_changed", handleCustomAuthChange);

    return () => {
      authUnsubscribe();
      if (activeUnsubscribe) {
        activeUnsubscribe();
      }
      window.removeEventListener("konamix_auth_changed", handleCustomAuthChange);
    };
  }, []);

  return (
    <AuthContext.Provider value={{ user, loading, isAdmin }}>
      {children}
    </AuthContext.Provider>
  );
};

const Layout = ({ children }: { children: React.ReactNode }) => {
  const { user, loading, isAdmin } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();

  // Support & Notifications Modal State
  const [supportOpen, setSupportOpen] = useState(false);
  const [supportTab, setSupportTab] = useState<"chat" | "notifications">("chat");
  const [unreadCount, setUnreadCount] = useState(0);

  // Global event listener to open support modal from anywhere (e.g. Help page)
  useEffect(() => {
    const handleOpenSupport = (e: any) => {
      if (e.detail?.tab) setSupportTab(e.detail.tab);
      setSupportOpen(true);
    };
    window.addEventListener("open_support_modal", handleOpenSupport);
    return () => window.removeEventListener("open_support_modal", handleOpenSupport);
  }, []);

  // Track unread messages from admin
  useEffect(() => {
    if (!user) {
      setUnreadCount(0);
      return;
    }
    const q = query(
      collection(db, "support_messages"),
      where("userId", "==", user.uid),
      where("senderRole", "==", "admin"),
      where("read", "==", false)
    );
    const unsub = onSnapshot(q, (snap) => {
      setUnreadCount(snap.size);
    }, () => {});
    return () => unsub();
  }, [user]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="w-12 h-12 border-4 border-brand-red border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!user && location.pathname !== "/auth") return <Navigate to="/auth" />;

  const isWidePage = location.pathname.startsWith("/room/") || location.pathname.startsWith("/admin");

  const navItems = [
    { icon: HomeIcon, label: "Accueil", path: "/" },
    { icon: Trophy, label: "Mes Salles", path: "/lobby" },
    { icon: Wallet, label: "Wallet", path: "/wallet" },
    { icon: UserIcon, label: "Profil", path: "/profile" },
  ];

  return (
    <div className="min-h-screen pb-24 text-white overflow-x-hidden">
      <header className="p-4 flex items-center justify-between sticky top-0 z-50 glass">
        <h1 className="text-2xl font-black tracking-tighter text-brand-red italic cursor-pointer active:scale-95 transition-transform" onClick={() => navigate("/")}>
          KONAMIX
        </h1>
        <div className="flex items-center gap-2.5">
          {/* Bouton Support & Notifications avec Badge Non-lu */}
          <button 
            type="button"
            onClick={() => {
              setSupportTab("chat");
              setSupportOpen(true);
            }}
            className="p-2 relative bg-white/5 hover:bg-white/10 text-gray-300 hover:text-white rounded-lg border border-white/10 transition-all cursor-pointer group"
            title="Support & Alertes"
          >
            <Bell size={18} className="group-hover:scale-110 transition-transform" />
            {unreadCount > 0 && (
              <span className="absolute -top-1.5 -right-1.5 min-w-[18px] h-[18px] px-1 rounded-full bg-brand-red text-white text-[9px] font-black flex items-center justify-center animate-pulse border-2 border-black">
                {unreadCount > 9 ? "9+" : unreadCount}
              </span>
            )}
          </button>

          {isAdmin && (
            <button 
              onClick={() => navigate("/admin")}
              className="p-2 bg-brand-gold/10 text-brand-gold rounded-lg border border-brand-gold/20 hover:bg-brand-gold hover:text-black transition-all group"
              title="Panel Admin"
            >
              <LayoutDashboard size={18} className="group-hover:scale-110 transition-transform" />
            </button>
          )}
          <div className="text-right">
            <p className="text-[10px] uppercase text-gray-400 font-bold">Solde</p>
            <p className="text-brand-gold font-mono font-bold leading-tight">
              {formatFCFA(user?.balance || 0)}
            </p>
          </div>
        </div>
      </header>

      {/* Support Chat & Notifications Modal */}
      <SupportChatModal 
        isOpen={supportOpen} 
        onClose={() => setSupportOpen(false)} 
        initialTab={supportTab} 
      />

      <main className={cn(
        "container mx-auto p-4 transition-all duration-300",
        isWidePage ? "max-w-6xl" : "max-w-lg"
      )}>
        <AnimatePresence mode="wait">
          <motion.div
            key={location.pathname}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.2 }}
          >
            {children}
          </motion.div>
        </AnimatePresence>
      </main>

      <nav className="fixed bottom-0 left-0 right-0 glass h-20 flex items-center justify-around px-2 z-50 border-t border-white/5">
        {/* First 2 items */}
        {navItems.slice(0, 2).map((item) => (
          <Link
            key={item.path}
            to={item.path}
            className={cn(
              "flex flex-col items-center gap-1 transition-all flex-1",
              location.pathname === item.path ? "text-brand-red scale-110" : "text-gray-500 hover:text-white"
            )}
          >
            <item.icon size={22} />
            <span className="text-[9px] font-black uppercase tracking-tighter">{item.label}</span>
          </Link>
        ))}

        {/* Central Create Button */}
        <div className="flex-1 flex justify-center">
          <button 
             onClick={() => navigate("/create-room")}
             className="bg-brand-red w-14 h-14 rounded-full flex items-center justify-center -translate-y-6 shadow-xl shadow-brand-red/30 active:scale-90 transition-transform border-4 border-[#0a0a0a]"
          >
            <PlusCircle size={32} className="text-white" />
          </button>
        </div>

        {/* Last 2 items */}
        {navItems.slice(2).map((item) => (
          <Link
            key={item.path}
            to={item.path}
            className={cn(
              "flex flex-col items-center gap-1 transition-all flex-1",
              location.pathname === item.path ? "text-brand-red scale-110" : "text-gray-500 hover:text-white"
            )}
          >
            <item.icon size={22} />
            <span className="text-[9px] font-black uppercase tracking-tighter">{item.label}</span>
          </Link>
        ))}
      </nav>

      <Toaster position="top-center" theme="dark" />
    </div>
  );
};

function NavigationSoundListener() {
  const location = useLocation();
  const isFirstMount = React.useRef(true);

  useEffect(() => {
    if (isFirstMount.current) {
      isFirstMount.current = false;
      return;
    }
    // Play metallic sound on navigation across all parts of the app
    playMetallicNavSound();
  }, [location.pathname, location.search]);

  return null;
}

export default function App() {
  useEffect(() => {
    const handleMouseOver = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (target.closest('button') || target.closest('a') || target.closest('.cursor-pointer')) {
        playMetallicSound({ volume: 0.08, pitchMultiplier: 1.2 });
      }
    };

    const handleClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (
        target.closest('button') || 
        target.closest('a') || 
        target.closest('.cursor-pointer') ||
        target.closest('input[type="checkbox"]') ||
        target.closest('input[type="radio"]') ||
        target.closest('[role="button"]') ||
        target.closest('[role="tab"]')
      ) {
        playHeavyClick();
      }
    };

    document.addEventListener('mouseover', handleMouseOver);
    document.addEventListener('click', handleClick);

    return () => {
      document.removeEventListener('mouseover', handleMouseOver);
      document.removeEventListener('click', handleClick);
    };
  }, []);

  return (
    <AuthProvider>
      <BrowserRouter>
        {/* 🏟️ Fond d'écran immersif : Stade avec gradins, pelouse verte éclatante & ballon de foot au centre */}
        <div 
          className="fixed inset-0 z-0 pointer-events-none select-none overflow-hidden" 
          aria-hidden="true"
        >
          <img 
            src="/images/stadium_wallpaper.jpg" 
            alt="Stade avec gradins, pelouse verte et ballon de foot au centre"
            className="w-full h-full object-cover object-center"
            referrerPolicy="no-referrer"
          />
          {/* Voile d'ambiance ultra-léger pour que la pelouse verte, les gradins et le ballon soient éclatants et parfaitement visibles */}
          <div className="absolute inset-0 bg-gradient-to-b from-black/25 via-transparent to-black/40" />
        </div>

        <div className="relative z-10 min-h-screen flex flex-col">
          <NavigationSoundListener />
          <OfflineIndicator />
          <RoomNotificationTracker />
          <AdminMessageNotifier />
          <Suspense fallback={
            <div className="min-h-screen flex items-center justify-center">
              <div className="w-12 h-12 border-4 border-brand-red border-t-transparent rounded-full animate-spin" />
            </div>
          }>
            <Routes>
              <Route path="/auth" element={<Auth />} />
              <Route path="/" element={<Layout><Home /></Layout>} />
              <Route path="/lobby" element={<Layout><Lobby /></Layout>} />
              <Route path="/my-rooms" element={<Layout><Lobby /></Layout>} />
              <Route path="/room/:id" element={<Layout><RoomDetail /></Layout>} />
              <Route path="/profile" element={<Layout><Profile /></Layout>} />
              <Route path="/wallet" element={<Layout><WalletPage /></Layout>} />
              <Route path="/admin" element={<Layout><AdminPanel /></Layout>} />
              <Route path="/create-room" element={<Layout><CreateRoom /></Layout>} />
              <Route path="/help" element={<Layout><Help /></Layout>} />
              <Route path="/room-history" element={<Layout><RoomHistory /></Layout>} />
              <Route path="/settings" element={<Layout><Settings /></Layout>} />
              <Route path="*" element={<Navigate to="/" />} />
            </Routes>
          </Suspense>
        </div>
      </BrowserRouter>
    </AuthProvider>
  );
}
