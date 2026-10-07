import { useState, useEffect } from "react";
import { collection, query, onSnapshot, where, Timestamp, doc } from "firebase/firestore";
import { db } from "../../lib/firebase";
import { formatFCFA } from "../../lib/utils";
import { TrendingUp, Users, LayoutDashboard, Wallet, AlertTriangle, Dice5 } from "lucide-react";
import { 
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend, BarChart, Bar
} from "recharts";

export default function Overview() {
  const [stats, setStats] = useState({
    treasury: 0,
    dailyVolume: 0,
    p2pVolume: 0,
    activeUsers: 0,
    activeRooms: 0,
    alerts: 0
  });

  const [modeData, setModeData] = useState([
    { name: "Expert", value: 0 },
    { name: "Random", value: 0 },
    { name: "Top", value: 0 },
    { name: "Flop", value: 0 }
  ]);

  const [revenueHistory, setRevenueHistory] = useState([
    { name: "Lun", value: 45000 },
    { name: "Mar", value: 52000 },
    { name: "Mer", value: 38000 },
    { name: "Jeu", value: 65000 },
    { name: "Ven", value: 48000 },
    { name: "Sam", value: 85000 },
    { name: "Dim", value: 92000 }
  ]);

  useEffect(() => {
    // Global Config (Treasury)
    const unsubConfig = onSnapshot(
      doc(db, "config", "global"), 
      (snap) => {
        if (snap.exists()) {
          const data = snap.data();
          const treasuryData = data?.treasury || {};
          const totalTreasury = Object.values(treasuryData).reduce((acc: number, val: any) => acc + (Number(val) || 0), 0);
          setStats(prev => ({ ...prev, treasury: totalTreasury }));
        }
      },
      (err) => console.warn("Overview config quota/offline:", err?.message)
    );

    // Active rooms & P2P Volume
    const qRoomsAll = query(collection(db, "rooms"));
    const unsubscribeRooms = onSnapshot(
      qRoomsAll, 
      (snap) => {
        const activeSize = snap.docs.filter(dock => !['finished', 'partie_terminee'].includes(dock.data().status)).length;
        setStats(prev => ({ ...prev, activeRooms: activeSize }));
        
        const p2pTotal = snap.docs.reduce((acc, dock) => {
            const rData = dock.data();
            const p2p = (rData.secondaryBets || []).reduce((sAcc: number, b: any) => sAcc + (b.amount || 0), 0);
            return acc + p2p;
        }, 0);
        setStats(prev => ({ ...prev, p2pVolume: p2pTotal }));
        
        const modes: Record<string, number> = { Expert: 0, Random: 0, Top: 0, Flop: 0 };
        snap.docs.forEach(dock => {
          const data = dock.data();
          if (!['finished', 'partie_terminee'].includes(data.status)) {
              if (modes[data.mode] !== undefined) modes[data.mode]++;
          }
        });
        
        setModeData(Object.entries(modes).map(([name, value]) => ({ name, value })));
      },
      (err) => console.warn("Overview rooms quota/offline:", err?.message)
    );

    // Today's Volume
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const qTodayVolume = query(
      collection(db, "transactions"), 
      where("type", "==", "deposit"),
      where("status", "==", "approved"),
      where("updatedAt", ">=", Timestamp.fromDate(today))
    );
    const unsubscribeVolume = onSnapshot(
      qTodayVolume, 
      (snap) => {
        const vol = snap.docs.reduce((acc, doc) => acc + (doc.data().amount || 0), 0);
        setStats(prev => ({ ...prev, dailyVolume: vol }));
      },
      (err) => console.warn("Overview volume quota/offline:", err?.message)
    );

    // Withdrawals Alerts (>1h)
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
    const qAlerts = query(
      collection(db, "transactions"), 
      where("type", "==", "withdrawal"),
      where("status", "==", "pending"),
      where("createdAt", "<=", Timestamp.fromDate(oneHourAgo))
    );
    const unsubAlerts = onSnapshot(
      qAlerts, 
      (snap) => {
        setStats(prev => ({ ...prev, alerts: snap.size }));
      },
      (err) => console.warn("Overview alerts quota/offline:", err?.message)
    );

    // Active users
    const qUsers = query(collection(db, "users"));
    const unsubscribeUsers = onSnapshot(
      qUsers, 
      (snap) => {
        setStats(prev => ({ ...prev, activeUsers: snap.size }));
      },
      (err) => console.warn("Overview users quota/offline:", err?.message)
    );

    return () => {
      unsubConfig();
      unsubscribeRooms();
      unsubscribeVolume();
      unsubAlerts();
      unsubscribeUsers();
    };
  }, []);

  const COLORS = ["#FF4B4B", "#FFB800", "#00C2FF", "#9DFF00"];

  return (
    <div className="space-y-6">
      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
        <KPIItem 
           icon={Wallet} 
           label="Trésorerie" 
           value={formatFCFA(stats.treasury)} 
           color="text-brand-gold" 
        />
        <KPIItem 
           icon={TrendingUp} 
           label="Volume (24h)" 
           value={formatFCFA(stats.dailyVolume)} 
           color="text-green-500" 
        />
        <KPIItem 
           icon={Dice5} 
           label="Paris P vs P" 
           value={formatFCFA(stats.p2pVolume)} 
           color="text-blue-400" 
        />
        <KPIItem 
           icon={Users} 
           label="Utilisateurs" 
           value={stats.activeUsers.toString()} 
           color="text-blue-500" 
        />
        <KPIItem 
           icon={LayoutDashboard} 
           label="Salles" 
           value={stats.activeRooms.toString()} 
           color="text-brand-red" 
        />
        <KPIItem 
           icon={AlertTriangle} 
           label="Alertes" 
           value={stats.alerts.toString()} 
           color={stats.alerts > 0 ? "text-brand-red animate-pulse" : "text-gray-500"} 
        />
      </div>

      {/* Charts Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Revenue Chart */}
        <div className="card h-[300px] flex flex-col">
          <h3 className="text-xs font-black uppercase tracking-widest mb-4 opacity-50">Courbe de Revenus (FCFA)</h3>
          <div className="flex-1 min-h-0">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={revenueHistory}>
                <defs>
                  <linearGradient id="colorVal" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#FF4B4B" stopOpacity={0.3}/>
                    <stop offset="95%" stopColor="#FF4B4B" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#ffffff0a" vertical={false} />
                <XAxis 
                   dataKey="name" 
                   axisLine={false} 
                   tickLine={false} 
                   tick={{ fill: '#666', fontSize: 10 }}
                />
                <YAxis 
                   axisLine={false} 
                   tickLine={false} 
                   tick={{ fill: '#666', fontSize: 10 }}
                   tickFormatter={(val) => `${val/1000}k`}
                />
                <Tooltip 
                  contentStyle={{ backgroundColor: '#111', border: 'none', borderRadius: '8px', fontSize: '12px' }}
                  itemStyle={{ color: '#FF4B4B' }}
                />
                <Area 
                  type="monotone" 
                  dataKey="value" 
                  stroke="#FF4B4B" 
                  strokeWidth={2}
                  fillOpacity={1} 
                  fill="url(#colorVal)" 
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Mode Distribution Chart */}
        <div className="card h-[300px] flex flex-col">
          <h3 className="text-xs font-black uppercase tracking-widest mb-4 opacity-50">Modes de Jeu Favoris</h3>
          <div className="flex-1 min-h-0">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={modeData}
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={80}
                  paddingAngle={5}
                  dataKey="value"
                >
                  {modeData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip 
                   contentStyle={{ backgroundColor: '#111', border: 'none', borderRadius: '8px', fontSize: '12px' }}
                />
                <Legend 
                   wrapperStyle={{ fontSize: '10px', fontWeight: 'bold' }}
                />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>
    </div>
  );
}

function KPIItem({ icon: Icon, label, value, color }: { icon: any, label: string, value: string, color: string }) {
  return (
    <div className="card flex flex-col items-center justify-center py-4 bg-white/[0.02]">
      <Icon size={18} className={color + " mb-1"} />
      <span className="text-[8px] font-black uppercase tracking-widest text-gray-500">{label}</span>
      <span className="text-sm font-black italic tracking-tight">{value}</span>
    </div>
  );
}
