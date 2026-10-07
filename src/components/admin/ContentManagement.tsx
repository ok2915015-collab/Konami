import { useState, useEffect, ChangeEvent, useRef } from "react";
import { collection, query, orderBy, onSnapshot, doc, setDoc, addDoc, getDocs, writeBatch, deleteDoc, updateDoc } from "firebase/firestore";
import { db } from "../../lib/firebase";
import { Team } from "../../types";
import { 
  Trophy, 
  Layers, 
  Trash2, 
  Search, 
  PlusCircle, 
  Globe, 
  Upload, 
  ImageOff, 
  Rocket, 
  Check, 
  AlertTriangle, 
  CheckCircle2, 
  Sparkles, 
  FolderSync, 
  ChevronRight,
  ShieldAlert,
  HelpCircle,
  FileSpreadsheet,
  X
} from "lucide-react";
import { toast } from "sonner";
import { LEAGUES, INITIAL_TEAMS, FALLBACK_LOGO, getMergedTeams } from "../../constants/teams";

export default function ContentManagement() {
  const [activeTab, setActiveTab] = useState<"logos" | "catalog">("logos");
  const [teams, setTeams] = useState<Team[]>([]);
  const [dbLeagues, setDbLeagues] = useState<{id: string, name: string, code: string}[]>([]);

  // Confirmation Modal state
  const [confirmModal, setConfirmModal] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    confirmText?: string;
    onConfirm: () => void;
  } | null>(null);
  
  // Logos Workspace state
  const [selectedLeagueFilter, setSelectedLeagueFilter] = useState<string>("ENG");
  const [logoSearch, setLogoSearch] = useState("");
  const [logoStatusFilter, setLogoStatusFilter] = useState<"all" | "missing" | "active">("all");
  const [pastedUrls, setPastedUrls] = useState<{ [teamId: string]: string }>({});
  const [editingUrlTeamId, setEditingUrlTeamId] = useState<string | null>(null);

  // Catalog/Config state
  const [catalogSearch, setCatalogSearch] = useState("");
  const [catalogLeagueFilter, setCatalogLeagueFilter] = useState<string>("ALL");
  const [newTeam, setNewTeam] = useState({ name: "", league: "ENG", logo: "" });
  const [newLeague, setNewLeague] = useState({ name: "", code: "" });
  const [showAddLeague, setShowAddLeague] = useState(false);
  const [importing, setImporting] = useState(false);

  // Daily bonus state
  const [dailyBonus, setDailyBonus] = useState({ title: "", subtitle: "", image: "" });
  const [loadingBonus, setLoadingBonus] = useState(true);

  const fileInputRefs = useRef<{ [teamId: string]: HTMLInputElement | null }>({});

  useEffect(() => {
    const q = query(collection(db, "teams"), orderBy("name", "asc"));
    const unsubscribe = onSnapshot(q, (snap) => {
      const loadedTeams = snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Team));
      setTeams(getMergedTeams(loadedTeams));
    }, (error) => {
      console.error("Teams snapshot error:", error);
      setTeams(getMergedTeams([]));
    });

    const qL = query(collection(db, "leagues"), orderBy("name", "asc"));
    const unsubscribeLeagues = onSnapshot(qL, (snap) => {
      const loadedLeagues = snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as any));
      if (loadedLeagues.length === 0) {
        // Build initial leagues list matching the core constants
        const defaultLeagues = Object.entries(LEAGUES).map(([code, name], index) => ({
          id: String(index + 1),
          name,
          code
        }));
        setDbLeagues(defaultLeagues);
      } else {
        const normalizedLeagues = loadedLeagues.map(l => {
          let name = l.name;
          if (name === "Nations" || name === "Sélections" || name === "Sélections Nationales") name = "Europe";
          if (name === "Reste du monde" || name === "Reste Monde") name = "Asie";
          return { ...l, name };
        });
        setDbLeagues(normalizedLeagues);
      }
    }, (error) => {
      console.error("Leagues snapshot error:", error);
    });

    const unsubBonus = onSnapshot(doc(db, "config", "daily_bonus"), (snap) => {
      if (snap.exists()) {
        setDailyBonus(snap.data() as any);
      }
      setLoadingBonus(false);
    }, (err) => {
      console.warn("Daily bonus quota/offline:", err?.message);
      setLoadingBonus(false);
    });

    return () => { 
      unsubscribe(); 
      unsubscribeLeagues(); 
      unsubBonus();
    };
  }, []);

  const addLeague = async () => {
    if (!newLeague.name || !newLeague.code) {
      toast.error("Veuillez remplir le nom et le code de la ligue");
      return;
    }
    try {
      await addDoc(collection(db, "leagues"), newLeague);
      setNewLeague({ name: "", code: "" });
      setShowAddLeague(false);
      toast.success("Championnat ajouté avec succès !");
    } catch (e) {
      toast.error("Erreur: " + e);
    }
  };

  const handleFileUpload = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 200 * 1024) {
        toast.error("Fichier trop lourd (max 200KB)");
        return;
      }
      const reader = new FileReader();
      reader.onload = (ev) => {
        setNewTeam({ ...newTeam, logo: ev.target?.result as string });
      };
      reader.readAsDataURL(file);
    }
  };

  const addTeam = async () => {
    if (!newTeam.name) {
      toast.error("Veuillez saisir le nom de l'équipe");
      return;
    }
    try {
      await addDoc(collection(db, "teams"), {
        ...newTeam,
        deleted: false,
        createdAt: new Date().toISOString()
      });
      setNewTeam({ name: "", league: catalogLeagueFilter === "ALL" ? "ENG" : catalogLeagueFilter, logo: "" });
      toast.success(`${newTeam.name} ajoutée avec succès !`);
    } catch (e: any) {
      toast.error("Erreur: " + (e?.message || e));
    }
  };

  const deleteTeam = async (id: string, name: string) => {
    try {
      // 1. Permanently record deletion in Firestore teams collection
      await setDoc(doc(db, "teams", id), {
        id,
        name,
        deleted: true,
        updatedAt: new Date().toISOString()
      }, { merge: true });

      // 2. Immediate optimistic update on UI
      setTeams(prev => prev.filter(t => t.id !== id && t.name?.toLowerCase() !== name.toLowerCase()));

      toast.success(`Équipe "${name}" et sa structure supprimées avec succès !`);
    } catch (e: any) {
      console.error("Delete team error:", e);
      toast.error("Erreur lors de la suppression: " + (e?.message || e));
    }
  };

  const promptDeleteTeam = (id: string, name: string) => {
    setConfirmModal({
      isOpen: true,
      title: "Supprimer l'équipe et sa structure ?",
      message: `Voulez-vous supprimer définitivement "${name}" et toute sa structure du catalogue ?`,
      confirmText: "Supprimer",
      onConfirm: () => {
        setConfirmModal(null);
        deleteTeam(id, name);
      }
    });
  };

  const removeLogo = async (team: Team) => {
    setConfirmModal({
      isOpen: true,
      title: "Réinitialiser le logo ?",
      message: `Voulez-vous réinitialiser le logo de "${team.name}" au logo officiel d'origine ?`,
      confirmText: "Réinitialiser",
      onConfirm: async () => {
        setConfirmModal(null);
        try {
          const defaultMatch = INITIAL_TEAMS.find(t => t.id === team.id || t.name.toLowerCase() === team.name.toLowerCase());
          const originalLogo = defaultMatch?.logo || "";
          await setDoc(doc(db, "teams", team.id), { logo: originalLogo, deleted: false }, { merge: true });
          toast.success("Logo réinitialisé avec succès !");
        } catch (e: any) {
          toast.error("Erreur: " + (e?.message || e));
        }
      }
    });
  };

  const handleDirectLogoUpload = (teamId: string, e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 200 * 1024) {
        toast.error("Fichier trop lourd (max 200KB pour éviter de ralentir la base)");
        return;
      }
      const reader = new FileReader();
      reader.onload = async (ev) => {
        try {
          const logoDataURL = ev.target?.result as string;
          await setDoc(doc(db, "teams", teamId), { logo: logoDataURL, deleted: false }, { merge: true });
          toast.success("Logo mis à jour de manière persistante !");
        } catch (err: any) {
          toast.error("Erreur de mise à jour : " + err.message);
        }
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSaveLogoUrl = async (teamId: string) => {
    const url = pastedUrls[teamId]?.trim();
    if (!url) {
      toast.error("Veuillez saisir une URL de logo valide");
      return;
    }
    try {
      await setDoc(doc(db, "teams", teamId), { logo: url, deleted: false }, { merge: true });
      setEditingUrlTeamId(null);
      toast.success("URL du logo enregistrée de manière persistante !");
    } catch (err: any) {
      toast.error("Erreur lors de l'enregistrement de l'URL : " + err.message);
    }
  };

  const importInitialTeams = async () => {
    setImporting(true);
    try {
      const batch = writeBatch(db);
      INITIAL_TEAMS.forEach(team => {
        const teamRef = doc(db, "teams", team.id);
        batch.set(teamRef, {
          ...team,
          deleted: false,
          updatedAt: new Date().toISOString()
        }, { merge: true });
      });
      await batch.commit();
      setTeams(getMergedTeams(INITIAL_TEAMS.map(t => ({ ...t, deleted: false }))));
      toast.success("Importation et restauration du catalogue initial terminée !");
    } catch (e: any) {
      toast.error("Erreur lors de l'import: " + (e?.message || e));
    } finally {
      setImporting(false);
    }
  };

  const promptImportTeams = () => {
    setConfirmModal({
      isOpen: true,
      title: "Recharger le catalogue initial ?",
      message: "Voulez-vous recharger et restaurer l'ensemble des 100+ équipes officielles par défaut ?",
      confirmText: "Recharger le catalogue",
      onConfirm: () => {
        setConfirmModal(null);
        importInitialTeams();
      }
    });
  };

  const clearTeams = async () => {
    try {
      const batch = writeBatch(db);
      
      INITIAL_TEAMS.forEach(team => {
        const teamRef = doc(db, "teams", team.id);
        batch.set(teamRef, { id: team.id, name: team.name, deleted: true, updatedAt: new Date().toISOString() }, { merge: true });
      });

      const snap = await getDocs(collection(db, "teams"));
      snap.docs.forEach(d => {
        batch.set(d.ref, { deleted: true, updatedAt: new Date().toISOString() }, { merge: true });
      });

      await batch.commit();
      setTeams([]);
      toast.success("Catalogue d'équipes entièrement vidé avec succès !");
    } catch (e: any) {
      toast.error("Erreur lors de la réinitialisation: " + (e?.message || e));
    }
  };

  const promptClearTeams = () => {
    setConfirmModal({
      isOpen: true,
      title: "Vider tout le catalogue ?",
      message: "Voulez-vous supprimer TOUTES les équipes du catalogue ? Cette action est immédiate.",
      confirmText: "Tout Vider",
      onConfirm: () => {
        setConfirmModal(null);
        clearTeams();
      }
    });
  };

  const saveBonus = async () => {
    try {
      await updateDoc(doc(db, "config", "daily_bonus"), dailyBonus);
      toast.success("Bonus du jour mis à jour !");
    } catch (e) {
      try {
        const { setDoc } = await import("firebase/firestore");
        await setDoc(doc(db, "config", "daily_bonus"), dailyBonus);
        toast.success("Bonus du jour configuré !");
      } catch (err) {
        toast.error("Erreur lors du paramétrage du bonus: " + err);
      }
    }
  };

  const handleBonusImage = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (ev) => {
        setDailyBonus({ ...dailyBonus, image: ev.target?.result as string });
      };
      reader.readAsDataURL(file);
    }
  };

  // -------------------------------------------------------------
  // Data Filtering & Logic
  // -------------------------------------------------------------

  // Calculate statistics of logos per league/championship
  const getLeagueStats = (code: string) => {
    const leagueTeams = teams.filter(t => t.league === code);
    const total = leagueTeams.length;
    const withLogo = leagueTeams.filter(t => !!t.logo).length;
    const pct = total > 0 ? Math.round((withLogo / total) * 100) : 0;
    return { total, withLogo, pct };
  };

  // Filters for Logos Workspace Tab
  const workspaceTeams = teams.filter(t => t.league === selectedLeagueFilter);
  
  const statusFilteredTeams = workspaceTeams.filter(t => {
    if (logoStatusFilter === "missing") return !t.logo;
    if (logoStatusFilter === "active") return !!t.logo;
    return true;
  });

  const finalLogoTeams = statusFilteredTeams.filter(t => 
    (t.name || "").toLowerCase().includes(logoSearch.toLowerCase())
  );

  // Filters for Catalog Tab
  const catalogFilteredTeams = catalogLeagueFilter === "ALL"
    ? teams
    : teams.filter(t => t.league === catalogLeagueFilter);

  const finalCatalogTeams = catalogFilteredTeams.filter(t => 
    (t.name || "").toLowerCase().includes(catalogSearch.toLowerCase())
  );

  return (
    <div className="space-y-6">
      {/* Confirmation Modal */}
      {confirmModal && confirmModal.isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-neutral-900 border border-white/10 rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-4">
            <div className="flex justify-between items-start">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-red-950/60 border border-brand-red/30 flex items-center justify-center text-brand-red">
                  <AlertTriangle size={20} />
                </div>
                <div>
                  <h3 className="text-sm font-black uppercase text-white tracking-wider">
                    {confirmModal.title}
                  </h3>
                  <p className="text-xs text-gray-400 mt-0.5">
                    Confirmation
                  </p>
                </div>
              </div>
              <button
                onClick={() => setConfirmModal(null)}
                className="text-gray-500 hover:text-white p-1 rounded-lg transition-colors cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>

            <p className="text-xs text-gray-300 leading-relaxed bg-black/30 p-3 rounded-xl border border-white/5">
              {confirmModal.message}
            </p>

            <div className="flex gap-3 pt-2">
              <button
                onClick={() => setConfirmModal(null)}
                className="flex-1 py-2.5 px-4 bg-white/5 hover:bg-white/10 text-gray-300 rounded-xl text-xs font-black uppercase tracking-wider transition-colors cursor-pointer"
              >
                Annuler
              </button>
              <button
                onClick={confirmModal.onConfirm}
                className="flex-1 py-2.5 px-4 bg-brand-red hover:bg-red-600 text-white rounded-xl text-xs font-black uppercase tracking-wider shadow-lg transition-colors cursor-pointer"
              >
                {confirmModal.confirmText || "Confirmer"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Visual Indicator of dedicated Admin sub-navigation */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-b border-white/5 pb-4">
        <div className="flex gap-2 p-1 bg-black/40 border border-white/5 rounded-2xl">
          <button
            onClick={() => setActiveTab("logos")}
            className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs font-black uppercase tracking-wider transition-all cursor-pointer ${
              activeTab === "logos"
                ? "bg-brand-gold text-brand-black shadow-lg shadow-brand-gold/10"
                : "text-gray-400 hover:bg-white/5 hover:text-white"
            }`}
          >
            <Trophy size={14} />
            WORKSPACE LOGOS PAR CHAMPIONNAT
          </button>
          <button
            onClick={() => setActiveTab("catalog")}
            className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs font-black uppercase tracking-wider transition-all cursor-pointer ${
              activeTab === "catalog"
                ? "bg-brand-gold text-brand-black shadow-lg shadow-brand-gold/10"
                : "text-gray-400 hover:bg-white/5 hover:text-white"
            }`}
          >
            <FolderSync size={14} />
            CATALOGUE & CONFIGURATION
          </button>
        </div>

        <div className="flex items-center gap-2 text-[10px] bg-brand-gold/10 border border-brand-gold/20 text-brand-gold px-3 py-1.5 rounded-xl font-bold">
          <Sparkles size={12} className="animate-pulse" />
          <span>{teams.filter(t => !!t.logo).length} / {teams.length} LOGOS PERSISTANTS ACTIFS</span>
        </div>
      </div>

      {/* -------------------------------------------------------------
          TAB 1: WORKSPACE LOGOS PAR CHAMPIONNAT (High focus, zero initials)
          ------------------------------------------------------------- */}
      {activeTab === "logos" && (
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6 animate-in fade-in duration-200">
          
          {/* Left Column: Championships List with logo stats */}
          <div className="lg:col-span-1 space-y-4">
            <div className="card space-y-3">
              <h3 className="text-xs font-black uppercase tracking-widest text-brand-gold flex items-center justify-between">
                <span>CHAMPIONNATS ({dbLeagues.length})</span>
                <HelpCircle size={12} className="text-gray-500" title="Suivi des logos par championnat" />
              </h3>
              <p className="text-[10px] text-gray-500 font-bold uppercase italic leading-tight">
                Sélectionnez un championnat pour administrer ses logos de manière exclusive.
              </p>

              <div className="space-y-2 max-h-[500px] overflow-y-auto pr-1 scrollbar-hide">
                {dbLeagues.map(l => {
                  const { total, withLogo, pct } = getLeagueStats(l.code);
                  const isSelected = selectedLeagueFilter === l.code;
                  return (
                    <button
                      key={l.id}
                      onClick={() => {
                        setSelectedLeagueFilter(l.code);
                        setLogoSearch("");
                      }}
                      className={`w-full text-left p-3 rounded-xl border transition-all text-xs flex flex-col gap-1.5 cursor-pointer relative ${
                        isSelected 
                          ? "bg-brand-gold/10 border-brand-gold text-white" 
                          : "bg-white/[0.02] border-white/5 text-gray-400 hover:bg-white/5 hover:border-white/10"
                      }`}
                    >
                      <div className="flex justify-between items-center font-black">
                        <span className="truncate uppercase">{l.name}</span>
                        <span className={`px-1.5 py-0.5 rounded text-[8px] font-bold ${
                          pct === 100 ? "bg-green-950 text-green-400" : "bg-black/30 text-brand-gold"
                        }`}>
                          {l.code}
                        </span>
                      </div>
                      
                      {/* Logo Progress bar */}
                      <div className="space-y-1">
                        <div className="flex justify-between text-[9px] font-bold text-gray-500">
                          <span>Logos assignés</span>
                          <span className={isSelected ? "text-brand-gold" : "text-gray-400"}>
                            {withLogo} / {total} ({pct}%)
                          </span>
                        </div>
                        <div className="w-full h-1 bg-black/50 rounded-full overflow-hidden">
                          <div 
                            className={`h-full transition-all duration-300 ${
                              pct === 100 ? "bg-green-500" : "bg-brand-gold"
                            }`}
                            style={{ width: `${pct}%` }}
                          />
                        </div>
                      </div>

                      {isSelected && (
                        <div className="absolute right-2 top-1/2 -translate-y-1/2 text-brand-gold">
                          <ChevronRight size={14} />
                        </div>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Right Column: Interactive Grid for Team Logos upload/URL paste */}
          <div className="lg:col-span-3 space-y-4">
            {/* Toolbar: Search & Audit Filters */}
            <div className="flex flex-col md:flex-row gap-3 bg-black/40 p-4 border border-white/5 rounded-2xl">
              <div className="flex-1 relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" size={14} />
                <input 
                  value={logoSearch}
                  onChange={(e) => setLogoSearch(e.target.value)}
                  placeholder="Filtrer les équipes de ce championnat par nom..."
                  className="w-full bg-black/40 border border-white/10 rounded-lg pl-9 pr-4 py-2 text-xs outline-none focus:border-brand-gold placeholder-gray-500 font-bold"
                />
              </div>

              {/* Status filtering tabs */}
              <div className="flex gap-1 bg-black/40 border border-white/5 p-1 rounded-xl shrink-0">
                <button
                  onClick={() => setLogoStatusFilter("all")}
                  className={`px-3 py-1.5 rounded-lg text-[9px] font-black uppercase cursor-pointer transition-all ${
                    logoStatusFilter === "all" ? "bg-white/10 text-white" : "text-gray-500 hover:text-gray-300"
                  }`}
                >
                  Tous ({workspaceTeams.length})
                </button>
                <button
                  onClick={() => setLogoStatusFilter("missing")}
                  className={`px-3 py-1.5 rounded-lg text-[9px] font-black uppercase cursor-pointer transition-all flex items-center gap-1 ${
                    logoStatusFilter === "missing" 
                      ? "bg-brand-red/20 text-brand-red border border-brand-red/30" 
                      : "text-gray-500 hover:text-gray-300"
                  }`}
                >
                  <AlertTriangle size={10} />
                  Logo Manquant ({workspaceTeams.filter(t => !t.logo).length})
                </button>
                <button
                  onClick={() => setLogoStatusFilter("active")}
                  className={`px-3 py-1.5 rounded-lg text-[9px] font-black uppercase cursor-pointer transition-all flex items-center gap-1 ${
                    logoStatusFilter === "active" ? "bg-green-950 text-green-400 border border-green-900/40" : "text-gray-500 hover:text-gray-300"
                  }`}
                >
                  <CheckCircle2 size={10} />
                  Avec Logo ({workspaceTeams.filter(t => !!t.logo).length})
                </button>
              </div>
            </div>

            {/* Selected Championship Summary Header */}
            <div className="bg-brand-gold/[0.02] border border-brand-gold/15 p-4 rounded-2xl flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
              <div>
                <h4 className="text-sm font-black text-white uppercase tracking-wider flex items-center gap-2">
                  <Trophy size={16} className="text-brand-gold" />
                  {dbLeagues.find(l => l.code === selectedLeagueFilter)?.name || selectedLeagueFilter}
                </h4>
                <p className="text-[10px] text-gray-500 font-bold uppercase mt-1">
                  Mettez en ligne des fichiers d'image locaux (PNG/JPEG) ou liez directement une URL de logo externe
                </p>
              </div>
              <span className="text-[10px] font-black bg-brand-gold/10 text-brand-gold border border-brand-gold/20 px-3 py-1 rounded-full italic uppercase tracking-wider">
                {finalLogoTeams.length} Clubs affichés
              </span>
            </div>

            {/* Grid of Teams Logos */}
            {finalLogoTeams.length === 0 ? (
              <div className="card text-center py-20 space-y-3 border-dashed border-white/5">
                <ShieldAlert className="mx-auto text-brand-gold animate-pulse" size={40} />
                <p className="text-sm font-black text-gray-300 uppercase tracking-widest">Aucune équipe correspondante</p>
                <p className="text-xs text-gray-600 max-w-md mx-auto leading-relaxed">
                  Aucune équipe ne correspond à vos filtres actuels dans cette ligue. Ajoutez des équipes dans l'onglet "Catalogue & Configuration".
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
                {finalLogoTeams.map(t => {
                  const hasLogo = !!t.logo;
                  const isEditingUrl = editingUrlTeamId === t.id;

                  return (
                    <div 
                      key={t.id} 
                      className={`card p-4 bg-white/[0.015] border rounded-2xl flex flex-col justify-between transition-all hover:scale-[1.01] ${
                        hasLogo ? "border-white/5 hover:border-brand-gold/20" : "border-brand-red/10 hover:border-brand-red/30 bg-brand-red/[0.005]"
                      }`}
                    >
                      {/* Logo Frame Area */}
                      <div className="relative flex flex-col items-center py-5 bg-black/40 rounded-xl border border-white/[0.03] mb-4 group overflow-hidden">
                        
                        {/* Shield icon & logo visualization - NO INITIALS ALLOWED */}
                        <div className="w-20 h-20 bg-white border border-neutral-900 rounded-3xl p-3 shadow-xl flex items-center justify-center transition-transform group-hover:scale-105 duration-300 relative">
                          <img 
                            src={t.logo || FALLBACK_LOGO} 
                            className="max-w-full max-h-full object-contain" 
                            alt={t.name} 
                            referrerPolicy="no-referrer"
                            onError={(e) => { (e.target as HTMLImageElement).src = FALLBACK_LOGO }}
                          />
                        </div>

                        {/* Banner status badge */}
                        <div className="mt-3 flex items-center gap-1.5">
                          {hasLogo ? (
                            <span className="text-[8px] font-black bg-green-950/60 border border-green-900/40 text-green-400 px-2 py-0.5 rounded-full uppercase tracking-widest flex items-center gap-1">
                              <Check size={8} /> PERSISTANT
                            </span>
                          ) : (
                            <span className="text-[8px] font-black bg-brand-red/20 border border-brand-red/30 text-brand-red px-2 py-0.5 rounded-full uppercase tracking-widest flex items-center gap-1">
                              <AlertTriangle size={8} /> AUCUN LOGO
                            </span>
                          )}
                        </div>

                        {/* Hidden input file tag for local upload */}
                        <input 
                          type="file"
                          ref={el => fileInputRefs.current[t.id] = el}
                          className="hidden"
                          accept="image/*"
                          onChange={(e) => handleDirectLogoUpload(t.id, e)}
                        />
                      </div>

                      {/* Info & Inputs Area */}
                      <div className="space-y-3">
                        <div className="text-center">
                          <h5 className="text-xs font-black uppercase text-white truncate px-1" title={t.name}>
                            {t.name}
                          </h5>
                          <span className="text-[8px] font-bold text-gray-500 uppercase tracking-widest">
                            ID: {t.id.slice(0, 10)}...
                          </span>
                        </div>

                        {/* URL Mode input box (if open) */}
                        {isEditingUrl ? (
                          <div className="space-y-1.5 p-2 bg-black/40 border border-white/5 rounded-xl">
                            <label className="text-[8px] font-black text-brand-gold uppercase block">URL de l'image externe :</label>
                            <div className="flex gap-1">
                              <input 
                                value={pastedUrls[t.id] || ""}
                                onChange={(e) => setPastedUrls({...pastedUrls, [t.id]: e.target.value})}
                                placeholder="https://site.com/logo.png..."
                                className="flex-1 bg-black/40 border border-white/10 rounded px-2 py-1 text-[10px] outline-none text-white focus:border-brand-gold"
                              />
                              <button
                                onClick={() => handleSaveLogoUrl(t.id)}
                                className="bg-brand-gold text-brand-black px-2 py-1 rounded text-[10px] font-black flex items-center justify-center cursor-pointer"
                              >
                                OK
                              </button>
                            </div>
                            <button
                              onClick={() => setEditingUrlTeamId(null)}
                              className="text-[8px] font-bold text-gray-500 uppercase hover:text-white"
                            >
                              Annuler
                            </button>
                          </div>
                        ) : (
                          <div className="grid grid-cols-2 gap-2">
                            {/* Local File upload */}
                            <button
                              onClick={() => fileInputRefs.current[t.id]?.click()}
                              className="flex items-center justify-center gap-1.5 py-2 px-2.5 bg-brand-gold/10 border border-brand-gold/20 hover:bg-brand-gold hover:text-brand-black text-brand-gold transition-all rounded-xl text-[9px] font-black uppercase cursor-pointer"
                            >
                              <Upload size={11} />
                              FICHIER
                            </button>

                            {/* URL trigger */}
                            <button
                              onClick={() => {
                                setEditingUrlTeamId(t.id);
                                if (!pastedUrls[t.id]) {
                                  setPastedUrls({...pastedUrls, [t.id]: t.logo || ""});
                                }
                              }}
                              className="flex items-center justify-center gap-1.5 py-2 px-2.5 bg-white/5 border border-white/10 hover:bg-white/10 text-gray-300 transition-all rounded-xl text-[9px] font-black uppercase cursor-pointer"
                            >
                              <Globe size={11} />
                              LIEN WEB
                            </button>
                          </div>
                        )}

                        {/* Delete Team Structure Trigger */}
                        {!isEditingUrl && (
                          <button
                            onClick={() => promptDeleteTeam(t.id, t.name)}
                            className="w-full flex items-center justify-center gap-1.5 py-1.5 bg-red-950/40 border border-brand-red/20 hover:bg-brand-red hover:text-white transition-all rounded-lg text-[8px] font-black uppercase text-brand-red cursor-pointer"
                          >
                            <Trash2 size={10} />
                            SUPPRIMER L'ÉQUIPE ET SA STRUCTURE
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

        </div>
      )}

      {/* -------------------------------------------------------------
          TAB 2: CATALOGUE & CONFIGURATION (Creation & Group actions)
          ------------------------------------------------------------- */}
      {activeTab === "catalog" && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 animate-in fade-in duration-200">
          
          {/* Left Column: Team Creation & League Creation Form */}
          <div className="lg:col-span-1 space-y-6">
            
            {/* Team Addition Form */}
            <div className="card space-y-4">
              <h3 className="text-xs font-black uppercase tracking-widest text-brand-gold flex items-center justify-between">
                <span className="flex items-center gap-2"><PlusCircle size={14} /> Ajouter une Équipe</span>
                <button 
                  onClick={() => setShowAddLeague(!showAddLeague)}
                  className="text-[9px] bg-white/5 border border-white/10 px-2.5 py-1 rounded-xl hover:bg-white/10 transition-all font-black"
                >
                  {showAddLeague ? "RETOUR" : "NOUVELLE LIGUE"}
                </button>
              </h3>
              
              {showAddLeague ? (
                <div className="space-y-3 p-3 bg-white/5 border border-white/5 rounded-xl animate-in fade-in slide-in-from-top-1">
                  <p className="text-[10px] font-black uppercase text-gray-500 italic">Créer un nouveau championnat</p>
                  
                  <div className="space-y-1">
                    <label className="text-[9px] font-black uppercase text-gray-400 block px-1">Nom du championnat</label>
                    <input 
                       value={newLeague.name}
                       onChange={(e) => setNewLeague({...newLeague, name: e.target.value})}
                       placeholder="Ex: Ligue 1, Eredivisie..."
                       className="w-full bg-black/40 border border-white/10 rounded-lg px-4 py-2 text-xs outline-none focus:border-brand-gold font-bold"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-[9px] font-black uppercase text-gray-400 block px-1">Code Unique (3 Lettres Max)</label>
                    <input 
                       value={newLeague.code}
                       onChange={(e) => setNewLeague({...newLeague, code: e.target.value.toUpperCase().slice(0, 5)})}
                       placeholder="Ex: FRA, ENG, AFR..."
                       className="w-full bg-black/40 border border-white/10 rounded-lg px-4 py-2 text-xs outline-none focus:border-brand-gold font-bold"
                    />
                  </div>

                  <button 
                    onClick={addLeague}
                    className="w-full bg-brand-gold text-brand-black font-black py-2.5 rounded-xl text-xs"
                  >
                    AJOUTER LE CHAMPIONNAT
                  </button>
                </div>
              ) : (
                <div className="space-y-4 bg-white/[0.015] p-4 rounded-xl border border-white/5">
                   <div>
                     <label className="text-[9px] font-black uppercase text-gray-400 block mb-1">Nom de l'équipe</label>
                     <input 
                        value={newTeam.name}
                        onChange={(e) => setNewTeam({...newTeam, name: e.target.value})}
                        placeholder="Ex: Paris SG, Real Madrid, Bayern..."
                        className="w-full bg-black/45 border border-white/10 rounded-lg px-4 py-2 text-xs outline-none focus:border-brand-gold font-bold text-white"
                     />
                   </div>
                   
                   <div>
                     <label className="text-[9px] font-black uppercase text-gray-400 block mb-1">Championnat / Ligue</label>
                     <select 
                        value={newTeam.league}
                        onChange={(e) => setNewTeam({...newTeam, league: e.target.value})}
                        className="w-full bg-black/45 border border-white/10 rounded-lg px-3 py-2 text-xs outline-none text-white focus:border-brand-gold font-bold"
                     >
                        {dbLeagues.map(l => (
                          <option key={l.id} value={l.code} className="bg-neutral-900">{l.name} ({l.code})</option>
                        ))}
                     </select>
                   </div>

                   <div className="space-y-2">
                      <label className="text-[9px] font-black uppercase text-gray-400 block">Logo Initial (PNG/JPG Optionnel)</label>
                      <div className="flex gap-2">
                        <div className="w-12 h-12 bg-white border border-black rounded-xl flex items-center justify-center p-1.5 shrink-0 shadow-lg overflow-hidden">
                          {newTeam.logo ? (
                            <img src={newTeam.logo || undefined} className="max-w-full max-h-full object-contain" alt="" />
                          ) : (
                            <img src={FALLBACK_LOGO} className="max-w-full max-h-full object-contain opacity-25" alt="" />
                          )}
                        </div>
                        <label className="flex-1 bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-[9px] font-black italic cursor-pointer hover:bg-white/10 transition-all flex items-center justify-center gap-1.5 group">
                          <PlusCircle size={14} className="group-hover:text-brand-gold transition-colors text-gray-400" />
                          JOINDRE FICHIER
                          <input 
                            type="file" 
                            className="hidden" 
                            accept="image/*"
                            onChange={handleFileUpload}
                          />
                        </label>
                      </div>
                      {newTeam.logo && (
                        <button
                          type="button"
                          onClick={() => setNewTeam({...newTeam, logo: ""})}
                          className="text-[8px] text-brand-red uppercase font-black"
                        >
                          Retirer l'image sélectionnée
                        </button>
                      )}
                    </div>
                   
                   <button 
                      onClick={addTeam}
                      className="w-full bg-brand-gold text-brand-black font-black py-2.5 rounded-xl text-xs tracking-wider shadow-md hover:scale-[1.02] active:scale-[0.98] transition-all"
                   >
                      CRÉER CETTE ÉQUIPE
                   </button>
                </div>
              )}
            </div>

            {/* Daily Bonus Control Banner */}
            <div className="card space-y-4 border-brand-gold/20 bg-brand-gold/5">
              <h3 className="text-xs font-black uppercase tracking-widest text-brand-gold flex items-center gap-2">
                <Rocket size={14} /> En-tête / Promo du Jour
              </h3>
              <div className="space-y-3">
                 <div className="space-y-1">
                    <label className="text-[9px] font-black uppercase text-gray-500 px-1">Slogan ou tag</label>
                    <input 
                        value={dailyBonus.subtitle}
                        onChange={(e) => setDailyBonus({...dailyBonus, subtitle: e.target.value})}
                        placeholder="Ex: Bonus du Jour..."
                        className="w-full bg-black/40 border border-white/10 rounded-lg px-3 py-2 text-xs outline-none focus:border-brand-gold"
                    />
                 </div>
                 <div className="space-y-1">
                    <label className="text-[9px] font-black uppercase text-gray-500 px-1">Texte Principal</label>
                    <textarea 
                        value={dailyBonus.title}
                        onChange={(e) => setDailyBonus({...dailyBonus, title: e.target.value})}
                        placeholder="Gagnez jusqu'à 25% de bonus de dépôt..."
                        rows={2}
                        className="w-full bg-black/40 border border-white/10 rounded-lg px-3 py-2 text-xs outline-none focus:border-brand-gold resize-none"
                    />
                 </div>
                 <div className="space-y-1">
                    <label className="text-[9px] font-black uppercase text-gray-500 px-1">Image de fond (Base64/URL)</label>
                    <div className="flex gap-2">
                        <div className="w-10 h-10 bg-white/5 border border-white/10 rounded-lg flex items-center justify-center overflow-hidden">
                            {dailyBonus.image ? (
                                <img src={dailyBonus.image || undefined} className="w-full h-full object-cover" alt="" />
                            ) : (
                                <Upload size={14} className="text-gray-600" />
                            )}
                        </div>
                        <label className="flex-1 bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-[9px] font-black italic cursor-pointer hover:bg-white/10 transition-all flex items-center justify-center gap-1">
                          CHANGER L'ILLUSTRATION
                          <input type="file" className="hidden" accept="image/*" onChange={handleBonusImage} />
                        </label>
                    </div>
                 </div>
                 <button 
                    onClick={saveBonus}
                    className="w-full bg-brand-gold text-brand-black font-black py-2 rounded-lg text-[10px] tracking-wider"
                 >
                    APPLIQUER LE BONUS
                 </button>
              </div>
            </div>

            {/* Mass actions */}
            <div className="card space-y-4 border-dashed border-white/10">
              <h3 className="text-xs font-black uppercase tracking-widest text-gray-500 flex items-center gap-2">
                <Layers size={14} /> Actions Globales de Catalogue
              </h3>
              <div className="space-y-2">
                <button 
                    disabled={importing}
                    onClick={promptImportTeams}
                    className="w-full bg-white/5 border border-white/10 py-3 rounded-xl text-[10px] font-black uppercase hover:bg-white/10 transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
                >
                  <FileSpreadsheet size={14} />
                  {importing ? "IMPORTATION..." : "Charger le Catalogue Initial"}
                </button>
                <button 
                    onClick={promptClearTeams}
                    className="w-full bg-brand-red/5 border border-brand-red/10 py-3 rounded-xl text-[10px] font-black uppercase text-brand-red hover:bg-brand-red/10 transition-all flex items-center justify-center gap-2 cursor-pointer"
                >
                  <Trash2 size={14} />
                  Réinitialiser / Tout Vider
                </button>
              </div>
            </div>

          </div>

          {/* Right Column: Complete Searchable Database Table */}
          <div className="lg:col-span-2 space-y-4">
            
            {/* Search filter input */}
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" size={16} />
              <input 
                 value={catalogSearch}
                 onChange={(e) => setCatalogSearch(e.target.value)}
                 placeholder="Rechercher une équipe dans la base de données..."
                 className="w-full bg-black/40 border border-white/10 rounded-xl pl-10 pr-4 py-2.5 text-xs outline-none focus:border-brand-gold placeholder-gray-500 font-bold"
              />
            </div>

            {/* League Tabs row */}
            <div className="flex flex-wrap gap-1.5 p-1 bg-black/30 border border-white/5 rounded-2xl">
              <button
                onClick={() => setCatalogLeagueFilter("ALL")}
                className={`px-3 py-1.5 rounded-xl text-[9px] font-black uppercase tracking-wider transition-all cursor-pointer ${
                  catalogLeagueFilter === "ALL"
                    ? "bg-brand-gold text-brand-black shadow-lg"
                    : "bg-white/5 text-gray-400 hover:bg-white/10 hover:text-white"
                }`}
              >
                TOUTES ({teams.length})
              </button>
              {dbLeagues.map(l => {
                const count = teams.filter(t => t.league === l.code).length;
                return (
                  <button
                    key={l.id}
                    onClick={() => setCatalogLeagueFilter(l.code)}
                    className={`px-3 py-1.5 rounded-xl text-[9px] font-black uppercase tracking-wider transition-all cursor-pointer ${
                      catalogLeagueFilter === l.code
                        ? "bg-brand-gold text-brand-black shadow-lg"
                        : "bg-white/5 text-gray-400 hover:bg-white/10"
                    }`}
                  >
                    {l.code} ({count})
                  </button>
                );
              })}
            </div>

            {/* Table Content */}
            <div className="card space-y-4">
              <div className="flex justify-between items-center">
                <h4 className="text-[10px] font-black uppercase tracking-widest text-gray-400">
                  Registre des Équipes ({finalCatalogTeams.length} Trouvées)
                </h4>
              </div>

              {finalCatalogTeams.length === 0 ? (
                <div className="text-center py-16 text-gray-600 text-xs">
                  Aucune équipe trouvée dans ce filtre du catalogue.
                </div>
              ) : (
                <div className="border border-white/5 rounded-xl overflow-hidden max-h-[500px] overflow-y-auto pr-1">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="bg-white/[0.02] border-b border-white/5 text-[9px] font-black uppercase text-gray-500">
                        <th className="p-3">Logo</th>
                        <th className="p-3">Nom</th>
                        <th className="p-3">Ligue</th>
                        <th className="p-3 text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-white/5 text-xs">
                      {finalCatalogTeams.map(t => (
                        <tr key={t.id} className="hover:bg-white/[0.01] transition-colors">
                          <td className="p-3">
                            <div className="w-8 h-8 bg-white border border-black rounded p-1 flex items-center justify-center overflow-hidden">
                              <img 
                                src={t.logo || FALLBACK_LOGO} 
                                className="max-w-full max-h-full object-contain" 
                                alt="" 
                                referrerPolicy="no-referrer"
                                onError={(e) => { (e.target as HTMLImageElement).src = FALLBACK_LOGO }}
                              />
                            </div>
                          </td>
                          <td className="p-3 font-bold text-white uppercase">{t.name}</td>
                          <td className="p-3">
                            <span className="bg-white/5 px-2 py-0.5 rounded text-[9px] font-black uppercase text-brand-gold">
                              {t.league}
                            </span>
                          </td>
                          <td className="p-3 text-right">
                            <button
                              onClick={() => promptDeleteTeam(t.id, t.name)}
                              className="p-1.5 bg-red-950/40 text-brand-red border border-brand-red/10 rounded-lg hover:bg-brand-red hover:text-white transition-colors cursor-pointer inline-flex items-center"
                              title="Supprimer définitivement l'équipe"
                            >
                              <Trash2 size={12} />
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

          </div>

        </div>
      )}

    </div>
  );
}
