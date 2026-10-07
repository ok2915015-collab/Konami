import React from "react";
import { ChevronRight, HelpCircle, BookOpen, MessageSquare, ShieldAlert, Zap, Target, TrendingUp } from "lucide-react";
import { Link } from "react-router-dom";

export default function Help() {
  const categories = [
    {
      title: "Comment Jouer ?",
      icon: BookOpen,
      color: "text-blue-500",
      content: [
        { q: "C'est quoi Konamix ?", a: "Konamix est un jeu de prédiction boursière d'équipes de foot. Vous misez sur la performance de vos équipes favorites (ou détestées) !" },
        { q: "Mode TOP vs Mode FLOP ?", a: "En mode TOP, vous gagnez si votre équipe marque beaucoup de buts. En mode FLOP, vous gagnez si elle encaisse plus que prévu ou perd." },
        { q: "Le mode EXPERT ?", a: "Pour les vrais connaisseurs. Vous choisissez 2 équipes et devez prédire un différentiel exact de points." },
      ]
    },
    {
      title: "Paiements & Sécurité",
      icon: ShieldAlert,
      color: "text-brand-red",
      content: [
        { q: "Comment déposer ?", a: "Allez dans 'Portefeuille', choisissez Wave, Orange ou MTN, entrez le montant et suivez les instructions USSD." },
        { q: "Temps de retrait ?", a: "Les retraits sont généralement traités en moins de 15 minutes, 24h/24 et 7j/7." },
        { q: "Mes données sont-elles sûres ?", a: "Oui, Konamix utilise un cryptage de niveau bancaire et ne stocke jamais vos codes secrets Mobile Money." },
      ]
    },
    {
      title: "Social & Parrainage",
      icon: Zap,
      color: "text-brand-gold",
      content: [
        { q: "Comment parrainer ?", a: "Copiez votre lien unique dans votre profil. Vous gagnez 10% sur chaque commission générée par vos filleuls, À VIE !" },
      ]
    }
  ];

  return (
    <div className="space-y-6 pb-20 pt-4">
      <div className="px-1 space-y-1">
        <h1 className="text-2xl font-black italic tracking-tighter uppercase leading-none">Centre d'Aide</h1>
        <p className="text-[10px] text-gray-500 font-bold uppercase tracking-widest italic">Tout comprendre sur Konamix</p>
      </div>

      <div className="space-y-4">
        {categories.map((cat, i) => (
          <section key={i} className="space-y-3">
            <div className="flex items-center gap-2 px-1">
                <cat.icon size={16} className={cat.color} />
                <h3 className="text-xs font-black uppercase text-white/80 tracking-wide">{cat.title}</h3>
            </div>
            <div className="grid gap-2">
                {cat.content.map((item, j) => (
                    <div key={j} className="card bg-white/[0.02] border-white/5 p-4 space-y-2">
                        <p className="text-[11px] font-black italic text-brand-gold uppercase">{item.q}</p>
                        <p className="text-[10px] text-gray-500 font-bold leading-relaxed">{item.a}</p>
                    </div>
                ))}
            </div>
          </section>
        ))}
      </div>

      {/* Support Contact */}
      <div className="card bg-brand-red/10 border-brand-red/20 p-6 flex flex-col items-center text-center gap-4">
        <MessageSquare size={32} className="text-brand-red animate-bounce" />
        <div>
            <h4 className="text-sm font-black uppercase italic">Besoin d'aide supplémentaire ?</h4>
            <p className="text-[10px] text-gray-500 font-bold uppercase">Nos agents et administrateurs sont en ligne 24h/24 pour vous répondre</p>
        </div>
        <button 
          onClick={() => window.dispatchEvent(new CustomEvent("open_support_modal", { detail: { tab: "chat" } }))}
          className="w-full bg-brand-red hover:bg-brand-red/90 text-white py-3 rounded-xl font-black uppercase tracking-widest text-[10px] shadow-lg shadow-brand-red/20 active:scale-95 transition-all cursor-pointer flex items-center justify-center gap-2"
        >
          <MessageSquare size={16} />
          CONTACTER LE SUPPORT EN DIRECT
        </button>
      </div>

      <div className="p-4 border border-dashed border-white/10 rounded-2xl text-center space-y-2">
        <p className="text-[9px] font-black uppercase text-gray-600">Jouer comporte des risques : endettement, dépendance... Appelez le 0800 00 00 00 (appel gratuit)</p>
        <p className="text-[10px] font-black text-brand-red uppercase italic">18+</p>
      </div>
    </div>
  );
}
