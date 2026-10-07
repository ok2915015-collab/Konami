import React from "react";
import { motion } from "motion/react";
import { cn } from "../../lib/utils";

interface AuthLayoutProps {
  children: React.ReactNode;
  title?: string;
  subtitle?: string;
  isEmbed?: boolean;
}

export default function AuthLayout({ children, title, subtitle, isEmbed = false }: AuthLayoutProps) {
  if (isEmbed) {
    return (
      <div className="w-full space-y-6">
        {(title || subtitle) && (
          <div className="mb-5 text-center">
            {title && <h2 className="text-lg font-black uppercase italic tracking-tighter text-white">{title}</h2>}
            {subtitle && <p className="text-[10px] font-bold text-gray-500 uppercase mt-1">{subtitle}</p>}
          </div>
        )}
        {children}
      </div>
    );
  }

  return (
    <div className="relative min-h-[100dvh] w-full flex items-center justify-center p-6 bg-transparent overflow-hidden font-sans">

      {/* Content Container */}
      <motion.div 
        initial={{ opacity: 0, y: 30 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, ease: "easeOut" }}
        className="relative z-10 w-full max-w-[420px] space-y-8"
      >
        {/* Logo Section */}
        <div className="text-center space-y-2">
          <motion.div
            initial={{ scale: 0.8 }}
            animate={{ scale: 1 }}
            transition={{ type: "spring", stiffness: 200 }}
            className="inline-block"
          >
             <h1 className="text-6xl md:text-7xl font-black italic tracking-tighter text-brand-red mb-1">
               KONAMIX
             </h1>
          </motion.div>
          <p className="text-brand-gold font-bold uppercase tracking-[0.2em] text-[10px] md:text-xs">
            Pariez entre champions
          </p>
        </div>

        {/* Glassmorphism Card */}
        <div className="glass p-8 md:p-10 rounded-[2rem] border border-white/10 shadow-2xl backdrop-blur-xl bg-white/[0.02]">
          {(title || subtitle) && (
            <div className="mb-8 text-center">
              {title && <h2 className="text-xl font-black uppercase italic tracking-tighter text-white">{title}</h2>}
              {subtitle && <p className="text-xs font-bold text-gray-500 uppercase mt-1">{subtitle}</p>}
            </div>
          )}
          {children}
        </div>

        {/* Footer info */}
        <div className="text-center space-y-2 opacity-30">
          <p className="text-[10px] font-black uppercase tracking-widest text-white">
            Transformé • Côte d'Ivoire • 2026
          </p>
          <div className="flex justify-center gap-4 text-[10px] font-bold uppercase text-gray-400">
            <a href="#" className="hover:text-white transition-colors">CGU</a>
            <a href="#" className="hover:text-white transition-colors">Privacy</a>
            <a href="#" className="hover:text-white transition-colors">Support</a>
          </div>
        </div>
      </motion.div>
    </div>
  );
}
