import { useState, ChangeEvent } from "react";
import { Team } from "../types";
import { Search, X, PlusCircle, Trophy, Upload } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { toast } from "sonner";
import { db } from "../lib/firebase";
import { collection, addDoc, doc, updateDoc } from "firebase/firestore";
import { cn } from "../lib/utils";
import { useAuth } from "../contexts/AuthContext";
import { FALLBACK_LOGO, getTeamLogo } from "../constants/teams";

interface TeamSelectorProps {
  teams: Team[];
  onSelect: (top: Team | null, bottom: Team | null) => void;
  onClose: () => void;
  mode: "Expert" | "Random" | "Top" | "Flop";
}

export default function TeamSelector({ teams, onSelect, onClose, mode }: TeamSelectorProps) {
  const { isAdmin } = useAuth();
  const [topTeam, setTopTeam] = useState<Team | null>(null);
  const [bottomTeam, setBottomTeam] = useState<Team | null>(null);
  const [search, setSearch] = useState("");
  const [selectingSlot, setSelectingSlot] = useState<"top" | "bottom">(mode === "Flop" ? "bottom" : "top");
  const [isAddingCustom, setIsAddingCustom] = useState(false);
  const [customTeam, setCustomTeam] = useState({ name: "", logo: "" });

  const filteredTeams = teams.filter(t => 
    (t.name || "").toLowerCase().includes(search.toLowerCase()) || 
    (t.league || "").toLowerCase().includes(search.toLowerCase())
  );

  const handleFileUpload = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 200 * 1024) {
        toast.error("Fichier trop lourd (max 200KB)");
        return;
      }
      const reader = new FileReader();
      reader.onload = (ev) => {
        setCustomTeam({ ...customTeam, logo: ev.target?.result as string });
      };
      reader.readAsDataURL(file);
    }
  };

  const createCustomTeam = async () => {
    if (!customTeam.name || !customTeam.logo) return;
    try {
      const docRef = await addDoc(collection(db, "teams"), {
        ...customTeam,
        league: "CUSTOM",
        id: `custom_${Date.now()}`
      });
      const newT = { ...customTeam, id: docRef.id, league: "CUSTOM" };
      handleTeamClick(newT);
      setIsAddingCustom(false);
      setCustomTeam({ name: "", logo: "" });
    } catch (e) {
      toast.error("Erreur creation: " + e);
    }
  };

  const handleTeamClick = (team: Team) => {
    if (mode === "Top") {
      onSelect(team, null);
    } else if (mode === "Flop") {
      onSelect(null, team);
    } else if (mode === "Expert") {
      if (selectingSlot === "top") {
        setTopTeam(team);
        setSelectingSlot("bottom");
      } else {
        onSelect(topTeam, team);
      }
    }
  };

  return (
    <div className="fixed inset-0 z-[60] glass flex items-end sm:items-center justify-center p-4">
      <motion.div 
        initial={{ y: 100, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        exit={{ y: 100, opacity: 0 }}
        className="bg-brand-black border border-white/10 w-full max-w-md rounded-2xl overflow-hidden flex flex-col max-h-[90vh]"
      >
        <div className="p-4 border-b border-white/5 flex justify-between items-center">
          <div>
            <h3 className="font-black italic text-lg tracking-tighter uppercase px-1">Choisir vos équipes</h3>
            <p className="text-[10px] text-brand-gold font-bold uppercase tracking-widest px-1">
              Mode {mode} • {selectingSlot === 'top' ? 'SÉLECTION MÉTIER (TOP)' : 'SÉLECTION ADVERSAIRE (BOTTOM)'}
            </p>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-white/5 rounded-full"><X size={20}/></button>
        </div>

        <div className="p-4 border-b border-white/5">
          <div className="flex gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
              <input 
                autoFocus
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="RECHERCHER UNE ÉQUIPE..."
                className="w-full bg-white/5 border border-white/10 rounded-lg py-3 pl-10 pr-4 text-[10px] font-black outline-none focus:border-brand-red transition-all"
              />
            </div>
            <button 
              onClick={() => setIsAddingCustom(!isAddingCustom)}
              className={cn(
                "p-3 rounded-lg border transition-all active:scale-95 flex items-center justify-center gap-2 font-black text-[9px] uppercase tracking-widest",
                isAddingCustom ? "bg-brand-red border-brand-red text-white" : "bg-white/5 border-white/10 text-gray-400 hover:bg-white/10"
              )}
            >
               {isAddingCustom ? <X size={16}/> : <PlusCircle size={16}/>}
               {isAddingCustom ? "Annuler" : "Logo Perso"}
            </button>
          </div>

          <AnimatePresence>
            {isAddingCustom && (
              <motion.div 
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: "auto", opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                className="mt-3 space-y-3 overflow-hidden"
              >
                <div className="flex gap-3">
                  <div className="w-12 h-12 bg-white border border-black rounded-lg flex items-center justify-center p-1.5 shrink-0 shadow-lg">
                    {customTeam.logo ? (
                      <img src={customTeam.logo || undefined} className="max-w-full max-h-full object-contain" />
                    ) : (
                      <Trophy className="text-gray-200" size={20} />
                    )}
                  </div>
                  <div className="flex-1 space-y-2">
                    <input 
                      value={customTeam.name}
                      onChange={e => setCustomTeam({...customTeam, name: e.target.value})}
                      placeholder="NOM DE L'ÉQUIPE..."
                      className="w-full bg-black/40 border border-white/10 rounded-lg px-3 py-2 text-[10px] font-black uppercase outline-none focus:border-brand-gold"
                    />
                    <label className="w-full bg-brand-gold/10 border border-brand-gold/30 rounded-lg py-2 flex items-center justify-center gap-2 text-[9px] font-black italic text-brand-gold cursor-pointer hover:bg-brand-gold/20 transition-all">
                       <Upload size={14} /> JOINDRE LOGO
                       <input type="file" className="hidden" accept="image/*" onChange={handleFileUpload} />
                    </label>
                  </div>
                </div>
                <button 
                  disabled={!customTeam.name || !customTeam.logo}
                  onClick={createCustomTeam}
                  className="w-full bg-brand-gold text-brand-black font-black uppercase py-2.5 rounded-lg text-[10px] tracking-widest shadow-lg shadow-brand-gold/10 disabled:opacity-30 transition-all active:scale-95"
                >
                  VALIDER ÉQUIPE PERSONNALISÉE
                </button>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        <div className="flex-1 overflow-y-auto p-2 grid grid-cols-2 gap-2">
          {(Array.from(new Map(filteredTeams.map(item => [item.id, item])).values()) as Team[]).map(team => (
            <button
               key={team.id}
               onClick={() => handleTeamClick(team)}
               className="card bg-white/5 hover:bg-white/10 flex flex-col items-center gap-2 p-3 group transition-transform active:scale-95"
            >
              <div className="w-12 h-12 bg-white border-2 border-black rounded-xl p-1.5 shadow-xl flex items-center justify-center group-hover:scale-110 transition-transform relative">
                <img 
                  src={getTeamLogo(team)} 
                  className="max-w-full max-h-full object-contain" 
                  alt={team.name} 
                  referrerPolicy="no-referrer" 
                  onError={(e) => { (e.target as HTMLImageElement).src = FALLBACK_LOGO }}
                />
              </div>
              <span className="text-[9px] font-black uppercase text-center leading-tight line-clamp-2">{team.name}</span>
              <span className="text-[7px] text-gray-500 font-bold uppercase">{team.league}</span>
            </button>
          ))}
        </div>

        {mode === "Expert" && topTeam && (
          <div className="p-3 bg-brand-red/10 border-t border-brand-red/20 flex items-center gap-3">
             <div className="w-8 h-8 bg-black/20 rounded p-1 flex items-center justify-center flex-shrink-0 shadow-inner">
                <img src={topTeam.logo || undefined} className="max-w-full max-h-full object-contain filter drop-shadow-sm" alt="" referrerPolicy="no-referrer" />
             </div>
             <div className="text-[10px] font-black">TOP: {topTeam.name}</div>
             <div className="ml-auto text-[8px] font-black uppercase text-brand-gold animate-pulse">Sélectionnez le BOTTOM</div>
          </div>
        )}
      </motion.div>
    </div>
  );
}
