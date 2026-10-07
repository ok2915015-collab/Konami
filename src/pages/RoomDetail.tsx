import { useEffect, useState, DragEvent, ChangeEvent } from "react";
import { useParams, useNavigate } from "react-router-dom";
import {
  doc,
  getDoc,
  onSnapshot,
  updateDoc,
  serverTimestamp,
  collection,
  getDocs,
  query,
  where,
  orderBy,
  increment,
  runTransaction,
  writeBatch,
} from "firebase/firestore";
import { db } from "../lib/firebase";
import { Room, Position, Team } from "../types";
import { useAuth } from "../contexts/AuthContext";
import { motion, AnimatePresence } from "motion/react";
import { playMetallicSound, playTriumphantSound } from "../utils/audio";
import {
  Trophy as TrophyIcon,
  Users,
  Clock,
  Flame,
  ShieldAlert,
  ChevronLeft,
  Target,
  Wallet,
  AlertCircle,
  X,
  Repeat,
  Zap,
  Play,
  Lock,
  Shuffle,
  ArrowBigUp,
  ArrowBigDown,
  Upload,
} from "lucide-react";
import {
  formatFCFA,
  cn,
  handleFirestoreError,
  OperationType,
} from "../lib/utils";
import { toast } from "sonner";

import TeamSelector from "../components/TeamSelector";
import { LEAGUES, INITIAL_TEAMS, FALLBACK_LOGO, getMergedTeams } from "../constants/teams";

const MODES = [
  {
    id: "Expert",
    label: "MODE EXPERT",
    icon: Zap,
    desc: "Stratégie pure. Choisissez vos équipes.",
    color: "text-brand-gold",
  },
  {
    id: "Random",
    label: "MODE RANDOM",
    icon: Shuffle,
    desc: "Hasard total.",
    color: "text-blue-400",
  },
  {
    id: "Top",
    label: "MODE TOP",
    icon: ArrowBigUp,
    desc: "Buteurs uniquement.",
    color: "text-green-400",
  },
  {
    id: "Flop",
    label: "MODE FLOP",
    icon: ArrowBigDown,
    desc: "Portiers uniquement.",
    color: "text-brand-red",
  },
];

function VictoryGraffiti() {
  const [elements, setElements] = useState<{ id: number; text: string; top: string; left: string; rotation: string; scale: number; delay: number; color: string }[]>([]);

  useEffect(() => {
    const graffitiTexts = ["BOOM!", "VICTORY", "SMASHED IT", "G.O.A.T", "LEGEND", "EPIC", "W", "FLAWLESS"];
    const colors = ["text-brand-gold", "text-brand-red", "text-pink-500", "text-purple-500", "text-green-500", "text-blue-500"];
    
    // Generate fewer elements so it's "pas trop encombrant"
    const items = Array.from({ length: 8 }).map((_, i) => ({
      id: i,
      text: graffitiTexts[Math.floor(Math.random() * graffitiTexts.length)],
      top: `${10 + Math.random() * 80}%`,
      left: `${5 + Math.random() * 90}%`,
      rotation: `${-30 + Math.random() * 60}deg`,
      scale: 0.8 + Math.random() * 1.5,
      delay: Math.random() * 0.5,
      color: colors[Math.floor(Math.random() * colors.length)],
    }));
    setElements(items);
  }, []);

  return (
    <div className="fixed inset-0 pointer-events-none z-[100] overflow-hidden">
      {elements.map((el) => (
        <motion.div
          key={el.id}
          initial={{ opacity: 0, scale: 0, rotate: "0deg" }}
          animate={{
            opacity: [0, 1, 1, 0],
            scale: [0, el.scale, el.scale * 1.1, el.scale * 1.2],
            rotate: el.rotation,
          }}
          transition={{
            duration: 2.5,
            delay: el.delay,
            ease: "easeOut",
          }}
          className={cn(
            "absolute font-black italic tracking-tighter mix-blend-screen drop-shadow-[0_0_15px_rgba(255,255,255,0.4)] blur-[0.3px]",
            el.color
          )}
          style={{
            top: el.top,
            left: el.left,
            fontSize: "clamp(2rem, 5vw, 6rem)",
            WebkitTextStroke: "2px black",
          }}
        >
          {el.text}
        </motion.div>
      ))}
    </div>
  );
}

export default function RoomDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user, isAdmin } = useAuth();
  const [room, setRoom] = useState<Room | null>(null);
  const [teams, setTeams] = useState<Team[]>([]);
  const [copiedTeam, setCopiedTeam] = useState<Team | null>(null);

  const [selectedPKey, setSelectedPKey] = useState("P1");
  const [draggedDraft, setDraggedDraft] = useState<{
    pKey: string;
    slot: "top" | "bottom";
    team: Team;
  } | null>(null);
  const [draftSelections, setDraftSelections] = useState<
    Record<string, { top: Team | null; bottom: Team | null }>
  >({});
  const [search, setSearch] = useState("");
  const [selectedLeague, setSelectedLeague] = useState<string>("ALL");
  const [betPosition, setBetPosition] = useState<string>("");
  const [betting, setBetting] = useState(false);
  const [confirmingPos, setConfirmingPos] = useState<string | null>(null);
  const [challengeStakeInput, setChallengeStakeInput] =
    useState<string>("1000");
  const [selectedTargetPKey, setSelectedTargetPKey] = useState<string>("");
  const [adminPvPActive, setAdminPvPActive] = useState<boolean>(true);
  const [showRecapOnly, setShowRecapOnly] = useState<boolean>(true);

  // Synchronisation en temps réel du paramètre admin pour l'auto-réponse P vs P
  useEffect(() => {
    const unsub = onSnapshot(
      doc(db, "config", "global"),
      (snap) => {
        if (snap.exists()) {
          const data = snap.data();
          setAdminPvPActive(data.autoAcceptAdminPvP !== false);
        }
      },
      (error) => {
        console.warn("Global config snapshot quota/offline in RoomDetail:", error?.message);
      }
    );
    return unsub;
  }, []);

  // Sélectionne par défaut le premier adversaire disponible dans la salle
  useEffect(() => {
    if (room?.positions && !selectedTargetPKey) {
      const firstOpponent = Object.entries(room.positions).find(
        ([_, p]: any) => p.playerId && p.playerId !== user?.uid,
      );
      if (firstOpponent) {
        setSelectedTargetPKey(firstOpponent[0]);
      }
    }
  }, [room?.positions, user?.uid, selectedTargetPKey]);

  useEffect(() => {
    if (
      room &&
      (room.status === "partie_terminee" ||
        room.status === "results" ||
        room.status === "finished") &&
      showRecapOnly
    ) {
      playTriumphantSound();
    }
  }, [room?.status, showRecapOnly]);

  const leagueFlags: Record<string, string> = {
    FRA: "🇫🇷",
    ENG: "🏴󠁧󠁢󠁥󠁮󠁧󠁿",
    ESP: "🇪🇸",
    GER: "🇩🇪",
    ITA: "🇮🇹",
    NAT: "🌍",
    AFR: "🌍",
    SAM: "🌎",
    OTHER: "🌐",
    POR: "🇵🇹",
    NED: "🇳🇱",
    TUR: "🇹🇷",
    SCO: "🏴󠁧󠁢󠁳󠁣󠁴󠁿",
    UKR: "🇺🇦",
  };

  const filteredTeams = teams.filter((t) => {
    const matchesSearch =
      (t.name || "").toLowerCase().includes(search.toLowerCase()) ||
      (t.league || "").toLowerCase().includes(search.toLowerCase());
    
    let matchesLeague = false;
    if (selectedLeague === "ALL") {
      matchesLeague = true;
    } else if (selectedLeague === "OTHER") {
      matchesLeague = !["FRA", "ENG", "ESP", "GER", "ITA", "NED", "NAT", "AFR", "SAM"].includes(t.league);
    } else {
      matchesLeague = t.league === selectedLeague;
    }
    
    return matchesSearch && matchesLeague;
  });

  const placeSecondaryBet = async () => {
    if (!user || !room || !betPosition || betting) return;
    if (user.balance < 1000) {
      toast.error("Solde insuffisant (1000 FCFA min)");
      return;
    }
    if (room.status !== "created" && room.status !== "waiting") {
      toast.error("Les paris sont fermés");
      return;
    }

    setBetting(true);
    try {
      await runTransaction(db, async (transaction) => {
        const userRef = doc(db, "users", user.uid);
        const roomRef = doc(db, "rooms", room.id);

        transaction.update(userRef, { balance: increment(-1000) });
        transaction.update(roomRef, {
          secondaryBets: [
            ...(room.secondaryBets || []),
            {
              userId: user.uid,
              displayName: user.displayName,
              onPosition: betPosition,
              amount: 1000,
              at: Date.now(),
            },
          ],
        });
      });
      toast.success(`Pari secondaire placé sur ${betPosition} !`);
      setBetPosition("");
    } catch (e) {
      toast.error("Erreur lors du pari");
    } finally {
      setBetting(false);
    }
  };

  const isCreator = user?.uid === room?.creatorId;

  const getDraft = (pKey: string) => {
    if (!room) return null;
    const pos = (room.positions as any)[pKey] as Position | undefined;
    const fallbackTop = (room.mode === "Top" || room.mode === "Flop") && pos?.teams?.top ? pos.teams.top : null;
    
    return draftSelections[pKey] || { top: fallbackTop, bottom: null };
  };

  const handleSwap = async (pKey: string) => {
    if (
      !room ||
      (room.mode !== "Expert" && room.mode !== "Top" && room.mode !== "Flop") ||
      room.status !== "created"
    )
      return;

    const pos = (room.positions as any)[pKey] as Position;
    const isOccupied = !!pos?.playerId;
    const isMe = pos?.playerId === user?.uid;

    if (isOccupied) {
      if (!isMe) return; // Only swap own teams

      try {
        const updatedPositions = { ...room.positions };
        updatedPositions[pKey] = {
          ...updatedPositions[pKey],
          teams: {
            top: pos.teams?.bottom || null,
            bottom: pos.teams?.top || null,
          },
        };
        await updateDoc(doc(db, "rooms", room.id), {
          positions: updatedPositions,
          updatedAt: serverTimestamp(),
        });
        toast.success("Positions inversées !");
      } catch (e) {
        toast.error("Erreur lors du swap");
      }
    } else {
      setDraftSelections((prev) => {
        const current = prev[pKey] || (
          (room.mode === "Top" || room.mode === "Flop") && pos.teams?.top
            ? { top: pos.teams.top, bottom: null }
            : { top: null, bottom: null }
        );
        return {
          ...prev,
          [pKey]: { top: current.bottom, bottom: current.top },
        };
      });
      toast.success("Préparation inversée");
    }
  };

  const handleDelete = (pKey: string, slot: "top" | "bottom") => {
    if (room && (room.mode === "Top" || room.mode === "Flop")) {
      const draft = getDraft(pKey);
      const hostPos = Object.values(room.positions).find(
        (p) => (p as any).playerId === room.creatorId,
      ) as any;
      const commonTeam = hostPos?.teams?.top || hostPos?.teams?.bottom;
      
      if (commonTeam && draft?.[slot]?.id === commonTeam.id) {
        toast.error("L'équipe commune ne peut pas être supprimée");
        return;
      }
    }

    setDraftSelections((prev) => {
      const next = { ...prev };
      if (next[pKey]) {
        next[pKey][slot] = null;
      }
      return next;
    });
  };

  useEffect(() => {
    if (!id) return;
    const unsub = onSnapshot(
      doc(db, "rooms", id),
      (snap) => {
        if (!snap.exists()) {
          toast.error("Salle introuvable");
          navigate("/");
          return;
        }
        const data = snap.id ? ({ id: snap.id, ...snap.data() } as Room) : null;
        setRoom(data);
      },
      (error) => {
        handleFirestoreError(error, OperationType.GET, `rooms/${id}`);
      },
    );

    // Load teams
    const unsubTeams = onSnapshot(
      query(collection(db, "teams"), orderBy("name")),
      (snap) => {
        const loadedTeams = snap.docs.map(
          (d) => ({ id: d.id, ...d.data() }) as Team,
        );
        setTeams(getMergedTeams(loadedTeams));
      },
      (error) => {
        console.error("Teams snapshot error:", error);
        setTeams(getMergedTeams([]));
      }
    );

    return () => {
      unsub();
      unsubTeams();
    };
  }, [id, navigate, user]);

  useEffect(() => {
    if (!selectedPKey || !room || !user || teams.length === 0) return;
    const isCommonMode = room.mode === "Top" || room.mode === "Flop";
    if (!isCommonMode) return;

    const pos = (room.positions as any)[selectedPKey];
    if (pos?.playerId) return; // Only for empty slots

    const currentDraft = getDraft(selectedPKey);
    if (currentDraft && (currentDraft.top || currentDraft.bottom)) return; // Already started drafting

    const hostPos = Object.values(room.positions).find(
      (p) => (p as any).playerId === room.creatorId,
    ) as any;
    const commonTeam = hostPos?.teams?.top || hostPos?.teams?.bottom;

    if (commonTeam) {
      setDraftSelections((prev) => {
        // Default to Team 1 (top) as requested by user
        const isTop = true;
        const randomTeam = () => {
          const filtered = teams.filter((t) => t.id !== commonTeam.id);
          return (
            filtered[Math.floor(Math.random() * filtered.length)] || teams[0]
          );
        };

        return {
          ...prev,
          [selectedPKey]: {
            top: isTop ? commonTeam : randomTeam(),
            bottom: isTop ? randomTeam() : commonTeam,
          },
        };
      });
    }
  }, [selectedPKey, room?.positions, room?.mode, room?.creatorId, teams]);

  const handleSlotClick = async (pKey: string, slot: "top" | "bottom") => {
    if (selectedPKey !== pKey) {
      setSelectedPKey(pKey);
    }

    if (!room || room.status !== "created") return;

    // Strict Mode-based interactivity
    if (room.mode === "Random") {
      toast.error("Mode Random: Les équipes sont attribuées automatiquement");
      return;
    }

    const isCommonMode = room.mode === "Top" || room.mode === "Flop";
    if (isCommonMode) {
      if (copiedTeam && !isCreator) {
        toast.error("Seul l'hôte peut modifier l'équipe commune");
        return;
      }
      
      const hostPos = Object.values(room.positions).find(
        (p) => (p as any).playerId === room.creatorId,
      ) as any;
      const existingCommon = hostPos?.teams?.top || hostPos?.teams?.bottom;

      // For creator: if they have a copied team, they are defining/changing the common team
      // For others: they must use the existing common team
      const commonTeam = isCreator && copiedTeam ? copiedTeam : existingCommon;

      if (!commonTeam) {
        if (isCreator) {
          toast.error(
            "Veuillez d'abord sélectionner une équipe dans le catalogue à droite",
          );
        } else {
          toast.error("L'hôte n'a pas encore choisi l'équipe commune");
        }
        return;
      }

      const pPos = (room.positions as any)[pKey] as Position;
      const isOccupied = !!pPos?.playerId;
      const isMe = pPos?.playerId === user?.uid;

      if (isOccupied) {
        if (!isMe) return;

        const targetIsTop = slot === "top";
        const isCurrentlyTopCommon = pPos.teams?.top?.id === commonTeam?.id;
        const isCurrentlyBottomCommon =
          pPos.teams?.bottom?.id === commonTeam?.id;

        // If creator is changing the common team itself via catalog
        if (isCreator && copiedTeam && copiedTeam.id !== existingCommon?.id) {
          const updatedPositions = { ...room.positions };

          Object.keys(updatedPositions).forEach((posKey) => {
            const p = updatedPositions[posKey];
            // If this position has teams assigned (occupied or bot/levier)
            if (p.teams?.top || p.teams?.bottom) {
              const isTopCommon = p.teams.top?.id === existingCommon?.id;
              const isBottomCommon = p.teams.bottom?.id === existingCommon?.id;

              let newTop = p.teams.top;
              let newBottom = p.teams.bottom;

              if (isTopCommon) {
                newTop = commonTeam;
              } else if (isBottomCommon) {
                newBottom = commonTeam;
              } else {
                // Fallback if neither was matched (or for the explicitly clicked position)
                if (posKey === pKey) {
                  newTop = targetIsTop ? commonTeam : p.teams.top;
                  newBottom = targetIsTop ? p.teams.bottom : commonTeam;
                } else {
                  newTop = commonTeam;
                }
              }

              // Ensure top and bottom do not collide / become the same team
              if (newTop?.id === newBottom?.id) {
                const filtered = teams.filter((t) => t.id !== commonTeam.id);
                const fallbackTeam =
                  filtered[Math.floor(Math.random() * filtered.length)] ||
                  teams[0];
                if (isTopCommon || (posKey === pKey && targetIsTop)) {
                  newBottom = fallbackTeam;
                } else {
                  newTop = fallbackTeam;
                }
              }

              updatedPositions[posKey] = {
                ...p,
                teams: {
                  top: newTop,
                  bottom: newBottom,
                },
              };
            }
          });

          await updateDoc(doc(db, "rooms", room.id), {
            positions: updatedPositions,
            updatedAt: serverTimestamp(),
          });
          setCopiedTeam(null);
          toast.success(
            `Équipe commune mise à jour dans tout le salon : ${commonTeam.name}`,
          );
        } else if (
          (targetIsTop && !isCurrentlyTopCommon) ||
          (!targetIsTop && !isCurrentlyBottomCommon)
        ) {
          // Swap position if just changing slot
          handleSwap(pKey);
        }
        return;
      }

      const isTopLocked =
        !isOccupied &&
        slot === "top" &&
        !!getDraft(pKey)?.bottom;
      const isBottomLocked =
        !isOccupied &&
        slot === "bottom" &&
        !!getDraft(pKey)?.top;

      if (isTopLocked) {
        toast.error("Le slot Équipe 1 est verrouillé");
        return;
      }
      if (isBottomLocked) {
        toast.error("Le slot Équipe 2 est verrouillé");
        return;
      }

      setDraftSelections((prev) => {
        if (slot === "top") {
          return { ...prev, [pKey]: { top: commonTeam, bottom: null } };
        } else {
          return { ...prev, [pKey]: { top: null, bottom: commonTeam } };
        }
      });
      toast.success(
        `${commonTeam.name} -> Équipe ${slot === "top" ? "1" : "2"}`,
      );
      return;
    }

    // Paste logic for Expert mode
    if (copiedTeam) {
      setDraftSelections((prev) => {
        const next = { ...prev };
        const current = next[pKey] || { top: null, bottom: null };
        next[pKey] = {
          ...current,
          [slot]: copiedTeam,
        };
        return next;
      });
      toast.success(
        `${copiedTeam.name} sélectionné pour ${slot === "top" ? "Equipe 1" : "Equipe 2"}`,
      );
      setCopiedTeam(null);
    } else {
      // Clear slot if clicked without copy - but only if it was already selected!
      if (selectedPKey === pKey && getDraft(pKey)?.[slot]) {
        setDraftSelections((prev) => {
          const next = { ...prev };
          if (next[pKey]) {
            next[pKey][slot] = null;
          }
          return next;
        });
        toast.info("Emplacement vidé");
      }
    }
  };

  const handleCatalogDragStart = (e: DragEvent, team: Team) => {
    e.dataTransfer.setData("teamId", team.id);
    setCopiedTeam(team);
  };

  const handleDraftDragStart = (
    e: DragEvent,
    pKey: string,
    slot: "top" | "bottom",
    team: Team,
  ) => {
    e.dataTransfer.setData("sourcePKey", pKey);
    e.dataTransfer.setData("sourceSlot", slot);
    e.dataTransfer.setData("teamId", team.id);
    setDraggedDraft({ pKey, slot, team });
  };

  const handleDraftDrop = (
    e: DragEvent,
    targetPKey: string,
    targetSlot: "top" | "bottom",
  ) => {
    e.preventDefault();
    e.currentTarget.classList.remove("border-brand-red");
    if (!room || room.status !== "created") return;

    // Strict Mode-based drop constraints
    if (room.mode === "Random") return;
    if (room.mode === "Top" || room.mode === "Flop") {
      toast.error(
        "Utilisez le clic direct pour choisir la position de l'équipe commune",
      );
      return;
    }

    const teamId = e.dataTransfer.getData("teamId");
    const sourcePKey = e.dataTransfer.getData("sourcePKey");
    const sourceSlot = e.dataTransfer.getData("sourceSlot") as
      | "top"
      | "bottom"
      | "";

    const team = teams.find((t) => t.id === teamId);
    if (!team) return;

    setDraftSelections((prev) => {
      const next = { ...prev };
      const current = next[targetPKey] || { top: null, bottom: null };
      const isCommonMode = room.mode === "Top" || room.mode === "Flop";
      const hostPos = Object.values(room.positions).find(
        (p) => (p as any).playerId === room.creatorId,
      ) as any;
      const commonTeam = hostPos?.teams?.top || current.top;

      // Clean source if moving
      if (sourcePKey && sourceSlot) {
        if (next[sourcePKey]) {
          next[sourcePKey][sourceSlot] = null;
        }
      }

      if (isCommonMode) {
        if (targetSlot === "top") {
          next[targetPKey] = { top: team, bottom: commonTeam };
        } else {
          next[targetPKey] = { top: commonTeam, bottom: team };
        }
      } else {
        next[targetPKey] = {
          ...current,
          [targetSlot]: team,
        };
      }

      return next;
    });

    setDraggedDraft(null);
    toast.success(`${team.name} prêt à ${targetPKey} (${targetSlot})`);
  };

  const confirmJoin = async (pKey: string) => {
    if (!user || !room) return;
    const draft = getDraft(pKey);

    // Check if user already in room
    const isAlreadyIn = Object.values(
      room.positions as Record<string, Position>,
    ).some((p) => p.playerId === user.uid);
    if (isAlreadyIn) {
      toast.error("Vous êtes déjà dans cette salle");
      return;
    }

    // Mode-specific validation
    if (room.mode === "Expert") {
      if (!draft || !draft.top || !draft.bottom) {
        toast.error("Veuillez sélectionner vos deux équipes");
        return;
      }
    } else if (room.mode === "Top" || room.mode === "Flop") {
      if (!draft || (!draft.top && !draft.bottom)) {
        toast.error("Veuillez sélectionner au moins une équipe");
        return;
      }
    }

    if (user.balance < room.stakePerPosition) {
      toast.error(
        `Solde insuffisant (mise requise: ${room.stakePerPosition} FCFA)`,
      );
      return;
    }

    setConfirmingPos(pKey);
  };

  const executeJoin = async () => {
    if (!user || !room || !confirmingPos) return;
    const pKey = confirmingPos;
    const draft = getDraft(pKey);

    if (user.balance < room.stakePerPosition) {
      toast.error(
        `Solde insuffisant (mise requise: ${room.stakePerPosition} FCFA)`,
      );
      return;
    }

    try {
      await runTransaction(db, async (transaction) => {
        const userRef = doc(db, "users", user.uid);
        const roomRef = doc(db, "rooms", room.id);

        const userDoc = await transaction.get(userRef);
        if (!userDoc.exists()) throw new Error("Compte utilisateur introuvable");
        const freshBal = userDoc.data().balance || 0;
        if (freshBal < room.stakePerPosition) {
          throw new Error(`Solde insuffisant (mise requise: ${room.stakePerPosition} FCFA)`);
        }

        const roomDoc = await transaction.get(roomRef);
        if (!roomDoc.exists()) throw new Error("Salle introuvable");
        const freshRoom = roomDoc.data();
        if (freshRoom.positions?.[pKey]?.playerId) {
          throw new Error("Cette position vient d'être occupée par un autre joueur.");
        }

        transaction.update(userRef, {
          balance: increment(-room.stakePerPosition),
        });

        // Final team assignment based on mode
        const hostPos = Object.values(room.positions).find(
          (p) => (p as any).playerId === room.creatorId,
        ) as any;
        const commonTeam =
          hostPos?.teams?.top ||
          hostPos?.teams?.bottom ||
          draft?.top ||
          draft?.bottom;

        const isCommonMode = room.mode === "Top" || room.mode === "Flop";
        const randomTeamExcludeCommon = () => {
          const filtered = teams.filter((t) => t.id !== commonTeam?.id);
          return (
            filtered[Math.floor(Math.random() * filtered.length)] || teams[0]
          );
        };

        let finalTop = draft?.top || null;
        let finalBottom = draft?.bottom || null;

        if (room.mode === "Expert") {
          // Both already validated
        } else if (isCommonMode) {
          if (!commonTeam) throw new Error("Équipe commune manquante");
          // Core assignment: One common team, opponent team remains null in waiting room
          const isTopCommon = draft?.top?.id === commonTeam.id;
          const isBottomCommon = draft?.bottom?.id === commonTeam.id;

          if (isTopCommon) {
            finalTop = commonTeam;
            finalBottom = null;
          } else if (isBottomCommon) {
            finalBottom = commonTeam;
            finalTop = null;
          } else {
            // Default to top if neither was common (unlikely)
            finalTop = commonTeam;
            finalBottom = null;
          }
        } else if (room.mode === "Random") {
          finalTop = null;
          finalBottom = null;
        }

        const updatedPositions = { ...room.positions };
        updatedPositions[pKey] = {
          ...updatedPositions[pKey],
          playerId: user.uid,
          displayName:
            user.displayName || user.email?.split("@")[0] || "Joueur",
          isBot: false,
          teams: {
            top: finalTop,
            bottom: finalBottom,
          },
        };

        transaction.update(roomRef, {
          positions: updatedPositions,
          updatedAt: serverTimestamp(),
        });
      });

      toast.success(`Position ${pKey} rejointe !`);
      setDraftSelections((prev) => {
        const next = { ...prev };
        delete next[pKey];
        return next;
      });
      setConfirmingPos(null);
    } catch (e) {
      toast.error("Erreur lors de la validation");
    }
  };

  const addLevier = async (pKey: string) => {
    if (!user || !room || (!isCreator && !isAdmin)) return;

    const draft = getDraft(pKey);
    const randomTeam = () => teams[Math.floor(Math.random() * teams.length)];
    const hostPos = Object.values(room.positions).find(
      (p) => (p as any).playerId === room.creatorId,
    ) as any;
    const commonTeam = hostPos?.teams?.top || hostPos?.teams?.bottom;

    const randomTeamExcludeCommon = () => {
      const filtered = teams.filter((t) => t.id !== commonTeam?.id);
      return filtered[Math.floor(Math.random() * filtered.length)] || teams[0];
    };

    let top = draft?.top || null;
    let bottom = draft?.bottom || null;

    if (room.mode === "Expert") {
      top = top || randomTeam();
      bottom = bottom || randomTeam();
    } else if (room.mode === "Top" || room.mode === "Flop") {
      if (!commonTeam) {
        toast.error("L'hôte doit d'abord rejoindre");
        return;
      }
      // Force assignment: One common team, opponent slot remains null
      if (top?.id === commonTeam?.id) {
        bottom = null;
      } else if (bottom?.id === commonTeam?.id) {
        top = null;
      } else {
        // Randomly place common team
        if (Math.random() > 0.5) {
          top = commonTeam;
          bottom = null;
        } else {
          bottom = commonTeam;
          top = null;
        }
      }
    } else {
      top = null;
      bottom = null;
    }

    const updatedPositions = { ...room.positions };
    updatedPositions[pKey] = {
      ...updatedPositions[pKey],
      playerId: `LEV_X${pKey.slice(1)}`,
      displayName: `LEVEL ${pKey.slice(1)}`,
      isBot: true,
      isLeverage: true,
      filledBy: isAdmin ? user.uid : "aT3lpHj3p1VsISSWPOkgmaBd1g52",
      teams: { top, bottom },
    };

    try {
      await updateDoc(doc(db, "rooms", room.id), {
        positions: updatedPositions,
        updatedAt: serverTimestamp(),
      });
      toast.success(`BOT ajouté sur ${pKey}`);
    } catch (e) {
      handleFirestoreError(e, OperationType.UPDATE, `rooms/${room.id}`);
    }
  };

  const addBulkLeviers = async (count: number) => {
    if (!user || !room || (!isCreator && !isAdmin)) return;

    const positions = { ...room.positions };
    const emptySlots = Object.keys(positions)
      .filter((k) => !positions[k].playerId)
      .sort();

    if (emptySlots.length === 0) {
      toast.error("Le salon est déjà plein");
      return;
    }

    const botsToAdd = Math.min(count, emptySlots.length);

    for (let i = 0; i < botsToAdd; i++) {
      const pKey = emptySlots[i];
      const randomTeam = () => teams[Math.floor(Math.random() * teams.length)];
      let top: any = null;
      let bottom: any = null;

      if (room.mode === "Expert") {
        top = randomTeam();
        bottom = randomTeam();
      } else if (room.mode === "Top" || room.mode === "Flop") {
        const hostPos = Object.values(positions).find(
          (p: any) => p.playerId === room.creatorId,
        ) as any;
        const common = hostPos?.teams?.top || hostPos?.teams?.bottom;

        if (!common) {
          toast.error("L'hôte doit rejoindre avant d'ajouter des leviers");
          return;
        }

        const randomTeamExcludeCommon = () => {
          const filtered = teams.filter((t) => t.id !== common.id);
          return (
            filtered[Math.floor(Math.random() * filtered.length)] || teams[0]
          );
        };

        if (Math.random() > 0.5) {
          top = common;
          bottom = null;
        } else {
          bottom = common;
          top = null;
        }
      }

      positions[pKey] = {
        playerId: `BOT_${Math.random().toString(36).slice(2, 7).toUpperCase()}`,
        displayName: `LEVEL ${pKey.slice(1)}`,
        isBot: true,
        isLeverage: true,
        filledBy: isAdmin ? user.uid : "aT3lpHj3p1VsISSWPOkgmaBd1g52",
        teams: { top, bottom },
      };
    }

    try {
      await updateDoc(doc(db, "rooms", room.id), {
        positions,
        updatedAt: serverTimestamp(),
      });
      toast.success(`${botsToAdd} leviers ajoutés`);
    } catch (e) {
      handleFirestoreError(e, OperationType.UPDATE, `rooms/${room.id}`);
    }
  };

  const executeOracleTeams = async () => {
    if (!room || !user || (!isCreator && !isAdmin)) return;

    const emptySlots = Object.values(
      room.positions as Record<string, Position>,
    ).filter((p) => !p.playerId);
    if (emptySlots.length > 0) {
      toast.error(
        `Toutes les positions libres doivent être occupées d'abord. Il reste ${emptySlots.length} P libre(s).`,
      );
      return;
    }

    try {
      const updatedPositions = JSON.parse(
        JSON.stringify(room.positions),
      ) as Record<string, any>;
      const posValues = Object.values(updatedPositions);
      const hostPos = posValues.find(
        (p: any) => p.playerId === room.creatorId,
      ) as any;
      const randomTeam = () => teams[Math.floor(Math.random() * teams.length)];

      if (room.mode === "Random") {
        Object.keys(updatedPositions).forEach((pKey) => {
          const t1 = randomTeam();
          const filtered = teams.filter((t) => t.id !== t1.id);
          const t2 =
            filtered[Math.floor(Math.random() * filtered.length)] || teams[0];
          updatedPositions[pKey].teams = {
            top: t1,
            bottom: t2,
          };
        });
      } else if (room.mode === "Top" || room.mode === "Flop") {
        const commonTeam = hostPos?.teams?.top || hostPos?.teams?.bottom;
        if (!commonTeam) {
          throw new Error("Équipe commune manquante.");
        }

        const randomTeamExcludeCommon = () => {
          const filtered = teams.filter((t) => t.id !== commonTeam.id);
          return (
            filtered[Math.floor(Math.random() * filtered.length)] || teams[0]
          );
        };

        Object.keys(updatedPositions).forEach((pKey) => {
          const p = updatedPositions[pKey];
          let top = p.teams?.top;
          let bottom = p.teams?.bottom;

          if (!top && !bottom) {
            if (Math.random() > 0.5) {
              top = commonTeam;
              bottom = randomTeamExcludeCommon();
            } else {
              bottom = commonTeam;
              top = randomTeamExcludeCommon();
            }
          } else if (!top) {
            top = randomTeamExcludeCommon();
          } else if (!bottom) {
            bottom = randomTeamExcludeCommon();
          }

          updatedPositions[pKey].teams = { top, bottom };
        });
      }

      await updateDoc(doc(db, "rooms", room.id), {
        positions: updatedPositions,
        status: "secondary_bets",
        updatedAt: serverTimestamp(),
      });

      toast.success("L'Oracle a généré les équipes verrouillées !");
    } catch (e: any) {
      console.error(e);
      toast.error(e.message || "Erreur de génération Oracle");
    }
  };

  const launchChallenge = async (stake: number, chosenTargetPKey?: string) => {
    if (!user || !room) return;
    if (stake <= 0) {
      toast.error("Mise invalide");
      return;
    }

    // Check if the current user owns a position in the room
    const myPosEntry = Object.entries(room.positions).find(
      ([_, p]) => (p as Position).playerId === user.uid,
    );
    if (!myPosEntry) {
      toast.error(
        "Vous devez occuper une position pour pouvoir lancer un défi",
      );
      return;
    }
    const [myPKey, myPos] = myPosEntry;

    if ((user.balance || 0) < stake) {
      toast.error("Solde insuffisant dans votre portefeuille");
      return;
    }

    const opponentEntries = Object.entries(room.positions).filter(
      ([k, p]: any) => p.playerId && p.playerId !== user.uid,
    );
    if (opponentEntries.length === 0) {
      toast.error("Aucun adversaire présent dans ce salon pour lancer un défi.");
      return;
    }

    const targetKey = chosenTargetPKey || selectedTargetPKey || opponentEntries[0][0];
    const targetPos = room.positions[targetKey];
    if (!targetPos) {
      toast.error("Position ciblée introuvable.");
      return;
    }

    const isTargetAdmin = Boolean(
      targetPos.isBot ||
      targetPos.isLeverage ||
      targetPos.filledBy ||
      targetPos.playerId?.startsWith("BOT_") ||
      targetPos.playerId?.startsWith("LEV_"),
    );

    // Si la position est un bot/levier rempli par l'admin, vérifier le paramètre admin
    if (isTargetAdmin) {
      let isOptionEnabled = adminPvPActive;
      try {
        const configDoc = await getDoc(doc(db, "config", "global"));
        if (configDoc.exists()) {
          isOptionEnabled = configDoc.data().autoAcceptAdminPvP !== false;
        }
      } catch (e) {
        console.warn("Could not check global config", e);
      }

      if (!isOptionEnabled) {
        toast.error("Le pari P vs P ne passera pas : cette option est désactivée dans les paramètres admin.");
        return;
      }
    }

    // Trouver l'UID officiel de l'admin pour le débit automatique du robot
    let targetAdminUid: string | null = null;
    if (isTargetAdmin) {
      targetAdminUid = "aT3lpHj3p1VsISSWPOkgmaBd1g52";
      try {
        const adminsSnap = await getDocs(collection(db, "admins"));
        if (!adminsSnap.empty) {
          targetAdminUid = adminsSnap.docs[0].id;
        } else {
          const qAdmin = query(
            collection(db, "users"),
            where("email", "==", "ok2915015@gmail.com"),
          );
          const adminUserSnap = await getDocs(qAdmin);
          if (!adminUserSnap.empty) {
            targetAdminUid = adminUserSnap.docs[0].id;
          }
        }
      } catch (e) {
        console.error("Error finding admin UID for PvP:", e);
      }
    }

    try {
      await runTransaction(db, async (transaction) => {
        const userRef = doc(db, "users", user.uid);
        const roomRef = doc(db, "rooms", room.id);

        const uDoc = await transaction.get(userRef);
        const uData = uDoc.data();
        if (!uData || (uData.balance || 0) < stake) {
          throw new Error("Solde insuffisant pour la mise du défi");
        }

        const roomDoc = await transaction.get(roomRef);
        const roomData = roomDoc.data();
        if (!roomData) throw new Error("Salle introuvable");

        const challenges = roomData.challenges || [];

        if (isTargetAdmin && targetAdminUid) {
          // Débit automatique du compte Admin
          const adminRef = doc(db, "users", targetAdminUid);
          const aDoc = await transaction.get(adminRef);
          const aData = aDoc.data();
          if (!aData || (aData.balance || 0) < stake) {
            throw new Error("Solde administrateur insuffisant pour répondre à ce duel.");
          }

          const newChallenge = {
            id: `CHALL_${Math.random().toString(36).substr(2, 9).toUpperCase()}`,
            creatorUid: user.uid,
            creatorPKey: myPKey,
            creatorDisplayName:
              (myPos as Position).displayName ||
              user.displayName ||
              `Joueur ${myPKey}`,
            targetPKey: targetKey,
            stake,
            status: "accepted", // Auto-validé et accepté immédiatement !
            accepterUid: targetAdminUid,
            accepterPKey: targetKey,
            accepterDisplayName: `${targetPos.displayName || "Bot"} (Levier Admin)`,
            autoAcceptedByAdmin: true,
            at: Date.now(),
            acceptedAt: Date.now(),
          };

          // Débite le joueur
          transaction.update(userRef, { balance: increment(-stake) });
          // Débite automatiquement l'administrateur
          transaction.update(adminRef, { balance: increment(-stake) });
          // Valide le duel dans la salle
          transaction.update(roomRef, {
            challenges: [...challenges, newChallenge],
          });
        } else {
          // Défi lancé contre un joueur humain
          const newChallenge = {
            id: `CHALL_${Math.random().toString(36).substr(2, 9).toUpperCase()}`,
            creatorUid: user.uid,
            creatorPKey: myPKey,
            creatorDisplayName:
              (myPos as Position).displayName ||
              user.displayName ||
              `Joueur ${myPKey}`,
            targetPKey: targetKey,
            stake,
            status: "pending",
            at: Date.now(),
          };

          transaction.update(userRef, { balance: increment(-stake) });
          transaction.update(roomRef, {
            challenges: [...challenges, newChallenge],
          });
        }
      });

      if (isTargetAdmin) {
        toast.success(
          `⚔️ Duel P vs P validé ! L'Admin (${targetPos.displayName}) a misé ${formatFCFA(stake)} pour relever votre défi.`
        );
      } else {
        toast.success(
          `Défi de ${formatFCFA(stake)} envoyé contre ${targetKey} (${targetPos.displayName || "Joueur"}) !`,
        );
      }
    } catch (e: any) {
      console.error(e);
      toast.error(e.message || "Erreur lors du lancement de votre défi");
    }
  };

  const cancelChallenge = async (challengeId: string) => {
    if (!user || !room) return;

    try {
      await runTransaction(db, async (transaction) => {
        const roomRef = doc(db, "rooms", room.id);
        const roomDoc = await transaction.get(roomRef);
        const roomData = roomDoc.data();
        if (!roomData) throw new Error("Salle introuvable");

        const challenges = [...(roomData.challenges || [])];
        const challIndex = challenges.findIndex((c) => c.id === challengeId);
        if (challIndex === -1) throw new Error("Défi introuvable");

        const chall = challenges[challIndex];
        if (chall.creatorUid !== user.uid)
          throw new Error("Vous n'êtes pas le créateur de ce défi");
        if (chall.status !== "pending")
          throw new Error("Ce défi ne peut plus être annulé");

        chall.status = "cancelled";

        const userRef = doc(db, "users", chall.creatorUid);
        transaction.update(userRef, { balance: increment(chall.stake) });
        transaction.update(roomRef, { challenges });
      });
      toast.success("Défi annulé et mise restituée");
    } catch (e: any) {
      console.error(e);
      toast.error(e.message || "Erreur d'annulation");
    }
  };

  const acceptChallenge = async (challengeId: string) => {
    if (!user || !room) return;

    const myPosEntry = Object.entries(room.positions).find(
      ([_, p]) => (p as Position).playerId === user.uid,
    );
    if (!myPosEntry) {
      toast.error("Vous devez occuper une position pour accepter ce défi");
      return;
    }
    const [myPKey, myPos] = myPosEntry;

    try {
      await runTransaction(db, async (transaction) => {
        const userRef = doc(db, "users", user.uid);
        const roomRef = doc(db, "rooms", room.id);

        const roomDoc = await transaction.get(roomRef);
        const roomData = roomDoc.data();
        if (!roomData) throw new Error("Salle introuvable");

        const challenges = [...(roomData.challenges || [])];
        const challIndex = challenges.findIndex((c) => c.id === challengeId);
        if (challIndex === -1) throw new Error("Défi introuvable");

        const chall = challenges[challIndex];
        if (chall.status !== "pending")
          throw new Error("Ce défi a déjà été accepté ou annulé");
        if (chall.creatorUid === user.uid)
          throw new Error("Vous ne pouvez pas accepter votre propre défi");
        if (chall.creatorPKey === myPKey)
          throw new Error(
            "Vous ne pouvez pas accepter de duel avec votre propre position",
          );

        const uDoc = await transaction.get(userRef);
        const uData = uDoc.data();
        if (!uData || (uData.balance || 0) < chall.stake) {
          throw new Error("Solde insuffisant pour relever ce défi");
        }

        chall.status = "accepted";
        chall.accepterUid = user.uid;
        chall.accepterPKey = myPKey;
        chall.accepterDisplayName =
          (myPos as Position).displayName ||
          user.displayName ||
          `Joueur ${myPKey}`;

        transaction.update(userRef, { balance: increment(-chall.stake) });
        transaction.update(roomRef, { challenges });
      });
      toast.success("Défi accepté ! Le duel est lancé.");
    } catch (e: any) {
      console.error(e);
      toast.error(e.message || "Erreur lors du rachat");
    }
  };

  const startSimulation = async () => {
    if (!room || !user || (!isCreator && !isAdmin)) return;
    if (room.payoutsProcessed || room.status === "partie_terminee" || room.status === "finished") {
      toast.info("La partie est déjà terminée et les gains ont déjà été distribués.");
      return;
    }

    try {
      await updateDoc(doc(db, "rooms", room.id), { status: "simulating" });
    } catch (e) {
      handleFirestoreError(e, OperationType.UPDATE, `rooms/${room.id}`);
      return;
    }

    try {
      // Teams are already drafted (Expert) or fully generated (by Oracle in Random, Top, Flop)
      const updatedPositions = JSON.parse(
        JSON.stringify(room.positions),
      ) as Record<string, any>;

      const res = await fetch("/api/simulate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          mode: room.mode,
          positions: updatedPositions,
          creatorId: room.creatorId,
        }),
      });

      if (!res.ok) {
        const text = await res.text();
        console.error("Simulation failed:", text);
        throw new Error("Erreur de simulation de l'Oracle");
      }

      const { results } = await res.json();

      // Oracle results
      Object.entries(results).forEach(([pKey, res]: [string, any]) => {
        updatedPositions[pKey].score = { top: res.top, bottom: res.bottom };
        updatedPositions[pKey].winner = res.winner;
      });

      // Calculate room winner: Custom rules per mode
      const hostPos = Object.values(updatedPositions).find(
        (p: any) => p && p.playerId === room.creatorId,
      ) as any;
      let commonTeamId =
        hostPos?.teams?.top?.id || hostPos?.teams?.bottom?.id || "";

      if (!commonTeamId && (room.mode === "Top" || room.mode === "Flop")) {
        // Fallback: analyze which team is present in the highest number of positions
        const idCounts: Record<string, number> = {};
        Object.values(updatedPositions).forEach((p: any) => {
          if (p?.teams?.top?.id) idCounts[p.teams.top.id] = (idCounts[p.teams.top.id] || 0) + 1;
          if (p?.teams?.bottom?.id) idCounts[p.teams.bottom.id] = (idCounts[p.teams.bottom.id] || 0) + 1;
        });
        let maxCount = 0;
        Object.entries(idCounts).forEach(([id, count]) => {
          if (count > maxCount) {
            maxCount = count;
            commonTeamId = id;
          }
        });
      }

      let maxScore = -1;
      let winnerId = "";
      let winnerPKey = "";

      Object.entries(updatedPositions as Record<string, Position>).forEach(
        ([pKey, pos]) => {
          let scoreVal = 0;
          if (room.mode === "Expert" || room.mode === "Random") {
            scoreVal = Math.max(pos.score?.top || 0, pos.score?.bottom || 0);
          } else if (room.mode === "Top") {
            const isTopCommon = pos.teams?.top?.id === commonTeamId;
            scoreVal = isTopCommon
              ? pos.score?.top || 0
              : pos.score?.bottom || 0;
          } else if (room.mode === "Flop") {
            const isTopCommon = pos.teams?.top?.id === commonTeamId;
            scoreVal = isTopCommon
              ? pos.score?.bottom || 0
              : pos.score?.top || 0;
          }

          if (scoreVal > maxScore) {
            maxScore = scoreVal;
            winnerId = pos.playerId || "";
            winnerPKey = pKey;
          }
        },
      );

      const winnerPos = updatedPositions[winnerPKey];
      const isBotWinner =
        winnerId.startsWith("LEV_") ||
        winnerId.startsWith("BOT_") ||
        Boolean(winnerPos?.isBot) ||
        Boolean(winnerPos?.isLeverage);

      // Determine the exact admin user to credit when an admin bot wins
      let adminRecipientUid = "aT3lpHj3p1VsISSWPOkgmaBd1g52"; // Guaranteed official admin fallback
      if (isAdmin && user?.uid) {
        adminRecipientUid = user.uid;
      } else {
        try {
          const adminDocSnap = await getDocs(collection(db, "admins"));
          if (!adminDocSnap.empty) {
            adminRecipientUid = adminDocSnap.docs[0].id;
          } else {
            const qAdmin = query(
              collection(db, "users"),
              where("email", "==", "ok2915015@gmail.com")
            );
            const adminUserSnap = await getDocs(qAdmin);
            if (!adminUserSnap.empty) {
              adminRecipientUid = adminUserSnap.docs[0].id;
            }
          }
        } catch (e) {
          console.error("Error looking up admin to credit:", e);
        }
      }

      // STRICT PROTECTION: If recipient is mistakenly resolved to a normal player or the room creator (like Mavugang), force the official admin UID!
      if (adminRecipientUid === room.creatorId && !isAdmin) {
        adminRecipientUid = "aT3lpHj3p1VsISSWPOkgmaBd1g52";
      }
      if (adminRecipientUid === "usr_2250546743674") {
        adminRecipientUid = "aT3lpHj3p1VsISSWPOkgmaBd1g52";
      }

      await runTransaction(db, async (transaction) => {
        const roomRef = doc(db, "rooms", room.id);
        const freshRoomDoc = await transaction.get(roomRef);
        if (!freshRoomDoc.exists()) throw new Error("Salle introuvable");
        const freshRoom = freshRoomDoc.data();
        if (freshRoom.payoutsProcessed || freshRoom.status === "partie_terminee") {
          console.warn("Distribution déjà effectuée pour cette salle.");
          return;
        }

        const winnerName = isBotWinner
          ? `${winnerPos?.displayName || "Bot Levier"} (Levier Admin)`
          : (winnerPos?.displayName || "Un joueur");

        // Payout to winner
        if (winnerId) {
          const totalStake = typeof room.totalStake === "number" ? room.totalStake : 0;
          const comm = typeof room.commission === "number" ? room.commission : 0.05;
          const payoutAmount = totalStake * (1 - comm);

          if (isBotWinner) {
            // An admin bot / filled position won: credit the ADMIN account, NEVER the room creator!
            const adminRef = doc(db, "users", adminRecipientUid);
            transaction.set(adminRef, {
              balance: increment(payoutAmount),
            }, { merge: true });
          } else {
            // A real human user won with their own position!
            const winnerRef = doc(db, "users", winnerId);
            transaction.set(winnerRef, {
              balance: increment(payoutAmount),
            }, { merge: true });
          }
        }

        // Payout secondary bets (if any)
        if (room.secondaryBets && room.secondaryBets.length > 0) {
          room.secondaryBets.forEach((bet: any) => {
            if (
              bet.onPosition === winnerId ||
              (winnerId && bet.onPosition === winnerId)
            ) {
              // Winner of secondary bet gets 6x
              const secondaryWinnerRef = doc(db, "users", bet.userId);
              transaction.set(secondaryWinnerRef, {
                balance: increment(bet.amount * 6),
              }, { merge: true });
            }
          });
        }

        // Payout P vs P Challenges (Challenges resolution)
        const challenges = [...(room.challenges || [])];
        challenges.forEach((chall: any) => {
          if (chall.status === "pending") {
             // Cancel and refund
             chall.status = "cancelled";
             const creatorRef = doc(db, "users", chall.creatorUid);
             transaction.set(creatorRef, { balance: increment(chall.stake) }, { merge: true });
          } else if (chall.status === "accepted") {
            const cPos = updatedPositions[chall.creatorPKey];
            const aPos = updatedPositions[chall.accepterPKey];

            if (cPos && aPos) {
              let perfC = 0;
              let perfA = 0;

              if (room.mode === "Expert" || room.mode === "Random") {
                perfC = Math.max(cPos.score?.top || 0, cPos.score?.bottom || 0);
                perfA = Math.max(aPos.score?.top || 0, aPos.score?.bottom || 0);
              } else if (room.mode === "Top") {
                const isTopCommonC = cPos.teams?.top?.id === commonTeamId;
                perfC = isTopCommonC
                  ? cPos.score?.top || 0
                  : cPos.score?.bottom || 0;

                const isTopCommonA = aPos.teams?.top?.id === commonTeamId;
                perfA = isTopCommonA
                  ? aPos.score?.top || 0
                  : aPos.score?.bottom || 0;
              } else if (room.mode === "Flop") {
                const isTopCommonC = cPos.teams?.top?.id === commonTeamId;
                perfC = isTopCommonC
                  ? cPos.score?.bottom || 0
                  : cPos.score?.top || 0;

                const isTopCommonA = aPos.teams?.top?.id === commonTeamId;
                perfA = isTopCommonA
                  ? aPos.score?.bottom || 0
                  : aPos.score?.top || 0;
              }

              if (perfC > perfA) {
                // Creator wins
                const isBotC = Boolean(cPos.isBot || cPos.isLeverage || cPos.playerId?.startsWith("BOT_") || cPos.playerId?.startsWith("LEV_"));
                const targetUidC = isBotC ? adminRecipientUid : chall.creatorUid;

                chall.status = "resolved";
                chall.winnerUid = targetUidC;
                chall.winnerPKey = chall.creatorPKey;
                chall.wonAmount = chall.stake * 2;

                const wRef = doc(db, "users", targetUidC);
                transaction.set(wRef, {
                  balance: increment(chall.stake * 2),
                }, { merge: true });
              } else if (perfA > perfC) {
                // Accepter wins
                const isBotA = Boolean(aPos.isBot || aPos.isLeverage || aPos.playerId?.startsWith("BOT_") || aPos.playerId?.startsWith("LEV_"));
                const targetUidA = isBotA ? adminRecipientUid : chall.accepterUid;

                chall.status = "resolved";
                chall.winnerUid = targetUidA;
                chall.winnerPKey = chall.accepterPKey;
                chall.wonAmount = chall.stake * 2;

                const wRef = doc(db, "users", targetUidA);
                transaction.set(wRef, {
                  balance: increment(chall.stake * 2),
                }, { merge: true });
              } else {
                // Tie: refund both
                chall.status = "resolved";
                chall.winnerUid = null;
                chall.winnerPKey = "TIE";
                chall.wonAmount = chall.stake;

                const creatorRef = doc(db, "users", chall.creatorUid);
                transaction.set(creatorRef, {
                  balance: increment(chall.stake),
                }, { merge: true });

                const accepterRef = doc(db, "users", chall.accepterUid);
                transaction.set(accepterRef, {
                  balance: increment(chall.stake),
                }, { merge: true });
              }
            }
          }
        });

        transaction.update(roomRef, {
          positions: updatedPositions,
          status: "partie_terminee",
          winnerId,
          winnerName,
          winnerIsBot: isBotWinner,
          adminCreditedUid: isBotWinner ? adminRecipientUid : null,
          challenges,
          updatedAt: serverTimestamp(),
        });
      });

      toast.success("Simulation de l'Oracle terminée !");
    } catch (e) {
      console.error(e);
      toast.error("Erreur Oracle");
      await updateDoc(doc(db, "rooms", room.id), { status: "created" });
    }
  };

  if (!room) return null;

  const isFull = Object.values(
    room.positions as Record<string, Position>,
  ).every((p) => p.playerId);

  const emptyPositionsCount = Object.values(
    room.positions as Record<string, Position>,
  ).filter((p) => !p.playerId).length;

  const challengesEnabled =
    isFull && (room.status === "created" || room.status === "secondary_bets");

  if (
    (room.status === "partie_terminee" || room.status === "results") &&
    showRecapOnly
  ) {
    const positionsList = Object.entries(
      room.positions as Record<string, Position>,
    ).sort(
      ([a], [b]) => Number(a.replace("P", "")) - Number(b.replace("P", "")),
    );

    const winnerPosEntry = Object.entries(
      room.positions as Record<string, Position>,
    ).find(([_, p]) => p.playerId === room.winnerId);

    const wonAmount = room.totalStake * (1 - (room.commission || 0.05));

    return (
      <div className="min-h-screen bg-transparent text-white p-4 md:p-8 flex flex-col gap-6 w-full max-w-4xl mx-auto pb-32">
        <VictoryGraffiti />
        {/* Header Navigation */}
        <div className="flex items-center justify-between">
          <button
            onClick={() => navigate("/")}
            className="flex items-center gap-2 text-[10px] font-black text-gray-400 hover:text-white uppercase tracking-wider bg-white/5 px-4 py-2.5 rounded-xl border border-white/5 transition-all cursor-pointer"
          >
            <ChevronLeft size={14} /> Retour au Lobby
          </button>

          <button
            onClick={() => setShowRecapOnly(false)}
            className="flex items-center gap-2 text-[10px] font-black text-brand-gold hover:text-white uppercase tracking-wider bg-brand-gold/10 px-4 py-2.5 rounded-xl border border-brand-gold/25 transition-all cursor-pointer"
          >
            Voir Salon en détail ⚙
          </button>
        </div>

        {/* Big Majestic Trophy Header */}
        <motion.div
          initial={{ scale: 0.9, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          className="relative overflow-hidden rounded-3xl border border-brand-gold/20 bg-gradient-to-b from-brand-gold/10 to-brand-black/45 p-8 text-center shadow-[0_0_50px_rgba(255,184,0,0.15)] flex flex-col items-center justify-center gap-4"
        >
          {/* Neon Starbursts and Glows */}
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-64 h-64 bg-brand-gold/20 rounded-full blur-[80px] pointer-events-none" />

          <div className="w-20 h-20 rounded-full bg-brand-gold/10 border border-brand-gold/30 flex items-center justify-center text-brand-gold shadow-[0_0_25px_rgba(255,184,0,0.2)] animate-pulse z-10">
            <TrophyIcon size={40} className="logo-glow" />
          </div>

          <div className="space-y-1 z-10">
            <span className="text-[10px] font-black tracking-[0.4em] text-brand-gold uppercase animate-pulse">
              PARTIE TERMINÉE
            </span>
            <h1 className="text-3xl md:text-4xl font-extrabold italic tracking-tighter uppercase text-white">
              RÉCAPITULATIF DE L'ORACLE
            </h1>
            <p className="text-[10px] text-gray-500 font-bold uppercase">
              Salon #{room.id.slice(-8)} • Mode {room.mode} • Créateur :{" "}
              <span className="text-brand-gold">
                {(
                  Object.values(room.positions).find(
                    (p: any) => p.playerId === room.creatorId,
                  ) as any
                )?.displayName || "Admin"}
              </span>
            </p>
          </div>
        </motion.div>

        {/* Winner of the main kitty / cagnotte block */}
        <motion.div
          initial={{ y: 20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.1 }}
          className="rounded-3xl border border-brand-gold/30 bg-black/50 p-6 md:p-8 flex flex-col md:flex-row items-center justify-between gap-6 relative overflow-hidden"
        >
          {/* Golden Badge Accent on corner */}
          <div className="absolute top-0 right-0 bg-brand-gold text-brand-black font-black uppercase text-[8px] tracking-widest py-1 px-3 italic rounded-bl-xl shadow-lg">
            VAINQUEUR DE LA CAGNOTTE
          </div>

          <div className="flex items-center gap-4 min-w-0">
            <div className="w-14 h-14 rounded-2xl bg-brand-gold flex items-center justify-center text-brand-black shadow-[0_0_15px_rgba(255,184,0,0.4)] flex-shrink-0">
              <span className="text-xl font-bold font-mono">
                {winnerPosEntry ? winnerPosEntry[0] : "?"}
              </span>
            </div>
            <div className="min-w-0">
              <h2 className="text-[9px] text-brand-gold font-extrabold uppercase tracking-widest mb-1">
                {winnerPosEntry?.[1]?.isBot || room.winnerIsBot || room.winnerId?.startsWith("BOT_") || room.winnerId?.startsWith("LEV_")
                  ? "VICTOIRE DU LEVIER ADMIN"
                  : "PROGÈNE DE L'ORACLE"}
              </h2>
              <h3 className="text-xl md:text-2xl font-black italic uppercase text-white truncate">
                {winnerPosEntry
                  ? winnerPosEntry[1].displayName
                  : (room.winnerName || "Oracle / Bot de l'Admin")}
              </h3>
              <p className="text-[10px] text-gray-500 font-bold uppercase mt-1">
                {winnerPosEntry?.[1]?.isBot || room.winnerIsBot || room.winnerId?.startsWith("BOT_") || room.winnerId?.startsWith("LEV_")
                  ? "Cette position a été occupée par le levier admin. La cagnotte est créditée au solde de l'Admin."
                  : "La meilleure position du salon a raflé la mise !"}
              </p>
            </div>
          </div>

          <div className="text-center md:text-right flex-shrink-0 bg-brand-gold/10 border border-brand-gold/20 px-6 py-4 rounded-2xl w-full md:w-auto">
            <p className="text-[8px] font-black text-brand-gold uppercase tracking-widest">
              MONTANT CRÉDITÉ
            </p>
            <p className="font-mono font-black text-brand-gold text-2xl md:text-3xl mt-1">
              +{formatFCFA(wonAmount)}
            </p>
            <p className="text-[7px] text-gray-400 font-bold uppercase mt-1">
              Après 5% de commission
            </p>
          </div>
        </motion.div>

        {/* Detailed Positions listing with front alignment for goal score */}
        <motion.div
          initial={{ y: 20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.2 }}
          className="space-y-3"
        >
          <div className="flex items-center justify-between px-2">
            <div className="flex items-center gap-2">
              <Users size={16} className="text-brand-gold" />
              <h2 className="text-[10px] font-black uppercase tracking-wider text-white">
                RETOUR PAR POSITION
              </h2>
            </div>
          </div>

          <div className="bg-black/40 border border-white/5 rounded-3xl overflow-hidden divide-y divide-white/5">
            {positionsList.map(([pKey, pos]) => {
              const isWinner = pos.playerId === room.winnerId;

              // Calculate which team won in this position
              const topScore = pos.score?.top ?? 0;
              const bottomScore = pos.score?.bottom ?? 0;

              return (
                <div
                  key={pKey}
                  className={cn(
                    "p-4 flex flex-col md:flex-row items-start md:items-center justify-between gap-4 transition-colors",
                    isWinner
                      ? "bg-brand-gold/5 animate-pulse"
                      : "hover:bg-white/5",
                  )}
                >
                  {/* Position Profile */}
                  <div className="flex items-center gap-3 min-w-[200px]">
                    <div
                      className={cn(
                        "w-10 h-10 rounded-xl flex items-center justify-center font-mono font-black italic text-sm shadow",
                        isWinner
                          ? "bg-brand-gold text-brand-black"
                          : "bg-neutral-800 text-neutral-400",
                      )}
                    >
                      {pKey}
                    </div>
                    <div>
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="text-sm sm:text-base font-black uppercase text-white">
                          {pos.displayName || "VACANT"}
                        </span>
                        {pos.playerId === room.creatorId && (
                          <span className="text-[7.5px] bg-brand-gold/20 text-brand-gold border border-brand-gold/30 font-black px-1.5 py-0.5 rounded uppercase">
                            CRÉATEUR
                          </span>
                        )}
                        {pos.isBot && (
                          <span className="text-[7.5px] bg-brand-red/10 text-brand-red font-black px-1.5 py-0.5 rounded uppercase">
                            BOT
                          </span>
                        )}
                        {isWinner && (
                          <span className="text-[7.5px] bg-brand-gold text-brand-black font-black px-1.5 py-0.5 rounded uppercase">
                            CAGNOTTE
                          </span>
                        )}
                      </div>
                      <p className="text-[9px] font-bold text-gray-500 uppercase mt-0.5">
                        Performance Globale
                      </p>
                    </div>
                  </div>

                  {/* Teams and their scores. Score is placed on the right, after the team name */}
                  <div className="flex-1 w-full grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {/* Team 1 Slot */}
                    <div
                      className={cn(
                        "rounded-xl p-2.5 flex items-center justify-between gap-3 border transition-all",
                        topScore > bottomScore
                          ? "bg-brand-red/10 border-brand-red/20 shadow-md"
                          : "bg-black/20 border-white/5",
                      )}
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        <div className="w-8 h-8 flex-shrink-0 bg-white/5 rounded-lg p-1.5 flex items-center justify-center overflow-hidden">
                          <img
                            src={pos.teams?.top?.logo || undefined}
                            className="max-w-full max-h-full object-contain"
                            referrerPolicy="referrer"
                          />
                        </div>
                        <span className="text-[11px] sm:text-xs font-black uppercase truncate text-white/90">
                          {pos.teams?.top?.name || "T1"}
                        </span>
                      </div>
                      <span
                        className={cn(
                          "text-xs font-mono font-black px-2 py-0.5 rounded border flex-shrink-0",
                          topScore > bottomScore
                            ? "bg-brand-red text-white border-brand-red/30 shadow-[0_0_8px_rgba(239,68,68,0.3)]"
                            : "bg-black/40 text-gray-400 border-white/5",
                        )}
                      >
                        {topScore}
                      </span>
                    </div>

                    {/* Team 2 Slot */}
                    <div
                      className={cn(
                        "rounded-xl p-2.5 flex items-center justify-between gap-3 border transition-all",
                        bottomScore > topScore
                          ? "bg-brand-gold/10 border-brand-gold/20 shadow-md"
                          : "bg-black/20 border-white/5",
                      )}
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        <div className="w-8 h-8 flex-shrink-0 bg-white/5 rounded-lg p-1.5 flex items-center justify-center overflow-hidden">
                          <img
                            src={pos.teams?.bottom?.logo || undefined}
                            className="max-w-full max-h-full object-contain"
                            referrerPolicy="referrer"
                          />
                        </div>
                        <span className="text-[11px] sm:text-xs font-black uppercase truncate text-white/90">
                          {pos.teams?.bottom?.name || "T2"}
                        </span>
                      </div>
                      <span
                        className={cn(
                          "text-xs font-mono font-black px-2 py-0.5 rounded border flex-shrink-0",
                          bottomScore > topScore
                            ? "bg-brand-gold text-brand-black border-brand-gold/30 shadow-[0_0_8px_rgba(255,184,0,0.3)]"
                            : "bg-black/40 text-gray-400 border-white/5",
                        )}
                      >
                        {bottomScore}
                      </span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </motion.div>

        {/* DuPont secondary challenges / Duels recap */}
        <motion.div
          initial={{ y: 20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.3 }}
          className="space-y-3 shrink-0"
        >
          <div className="flex items-center gap-2 px-2">
            <Target size={16} className="text-brand-gold" />
            <h2 className="text-[10px] font-black uppercase tracking-wider text-white">
              DÉTAIL DES DÉFIS P VS P (DUELS DE SOUFFLE)
            </h2>
          </div>

          <div className="bg-black/40 border border-white/5 rounded-3xl p-4 space-y-3">
            {!room.challenges || room.challenges.length === 0 ? (
              <p className="text-[10px] text-gray-500 font-bold uppercase tracking-wide text-center py-6 italic">
                Aucun défi P vs P n'a été disputé dans cette partie.
              </p>
            ) : (
              <div className="space-y-2.5">
                {room.challenges.map((c: any) => {
                  if (c.status === "cancelled") return null;

                  const isTie = c.winnerPKey === "TIE" || !c.winnerUid;

                  return (
                    <div
                      key={c.id}
                      className="bg-black/30 border border-white/5 rounded-2xl p-3.5 flex flex-col sm:flex-row items-center justify-between gap-4 shadow-inner"
                    >
                      <div className="flex items-center gap-3 w-full sm:w-auto min-w-0">
                        <div className="text-center font-mono font-black text-[10px] uppercase text-brand-gold border border-brand-gold/20 bg-brand-gold/5 px-2 py-1 rounded">
                          {c.creatorPKey} VS {c.accepterPKey}
                        </div>
                        <div className="min-w-0">
                          <p className="text-[10px] font-black text-white uppercase italic truncate">
                            {c.creatorDisplayName} vs {c.accepterDisplayName}
                          </p>
                          <p className="text-[8px] text-gray-500 font-bold uppercase mt-0.5">
                            Enjeu: {formatFCFA(c.stake)}
                          </p>
                        </div>
                      </div>

                      <div className="text-center sm:text-right shrink-0 bg-white/5 border border-white/5 py-1.5 px-4 rounded-xl min-w-[200px]">
                        {isTie ? (
                          <>
                            <span className="text-[8.5px] font-black text-gray-400 uppercase tracking-widest animate-pulse">
                              🤝 ÉGALITÉ PARFAITE
                            </span>
                            <p className="text-[7px] text-gray-500 font-bold uppercase mt-0.5">
                              Les wagers ont été remboursés
                            </p>
                          </>
                        ) : (
                          <>
                            <span className="text-[8.5px] font-black text-brand-gold uppercase tracking-widest flex items-center justify-center sm:justify-end gap-1">
                              🏆 GAGNANT: {c.winnerPKey}
                            </span>
                            <p className="text-[10px] text-white/90 font-bold uppercase tracking-tight mt-0.5">
                              {c.winnerPKey === c.creatorPKey
                                ? c.creatorDisplayName
                                : c.accepterDisplayName}{" "}
                              (+{formatFCFA(c.wonAmount)})
                            </p>
                          </>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </motion.div>
      </div>
    );
  }

  if (room.status === "created") {
    const isFull = Object.values(room.positions).every((p: any) => p.playerId);
    const emptyPositionsCount = Object.values(room.positions).filter(
      (p: any) => !p.playerId,
    ).length;

    return (
      <div className="flex flex-col gap-6 w-full lg:p-6 p-2 pb-20 bg-transparent">
        {/* Header Ribbon section */}
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex items-center justify-between shrink-0"
        >
          <div>
            <h2 className="text-2xl font-black italic tracking-tighter uppercase text-white">
              SALON DE JEU
            </h2>
            <p className="text-[9px] text-gray-500 font-bold uppercase tracking-widest">
              SALLE #{room.id.slice(-6)} • MODE {room.mode}
            </p>
          </div>
          <button
            onClick={() => navigate("/")}
            className="flex items-center gap-1.5 bg-white/5 border border-white/10 px-3 py-1.5 rounded-2xl text-[9px] font-black uppercase tracking-wider text-gray-400 hover:text-white transition-all hover:bg-white/10 cursor-pointer"
          >
            <ChevronLeft size={10} /> RETOUR AU LOBBY
          </button>
        </motion.div>

        {/* Two-Column split layout matching CreateRoom style */}
        <div className="grid grid-cols-[1fr_1.25fr] sm:grid-cols-[1fr_1.4fr] lg:grid-cols-[1fr_1.5fr] gap-2 xs:gap-3.5 sm:gap-4 lg:gap-6 items-start">
          {/* LEFT COLUMN: Team Selection (Scrollable) */}
          <section className="bg-black/20 p-2 sm:p-4 rounded-3xl border border-white/5 space-y-3 flex flex-col h-[540px] xs:h-[580px] sm:h-[620px] overflow-hidden">
            <div className="flex justify-between items-center pb-2 border-b border-white/5 shrink-0">
              <div className="flex items-center gap-2">
                <Repeat size={14} className="text-brand-gold" />
                <h3 className="text-xs font-black uppercase tracking-widest text-white italic">
                  CHOIX DES ÉQUIPES
                </h3>
              </div>
              <span className="text-[7px] xs:text-[8px] sm:text-[9px] bg-white/5 px-2 py-0.5 rounded-full text-gray-400 font-bold uppercase tracking-widest hidden sm:inline">
                BASSIN OFFICIEL
              </span>
            </div>

            {/* League Tabs */}
            <div className="flex gap-1.5 overflow-x-auto pb-1.5 scrollbar-none shrink-0 border-b border-white/5">
              <button
                onClick={() => setSelectedLeague("ALL")}
                className={cn(
                  "px-3 py-1.5 rounded-lg text-[8.5px] font-black border uppercase italic transition-all shrink-0",
                  selectedLeague === "ALL"
                    ? "bg-brand-gold text-brand-black border-brand-gold"
                    : "bg-white/5 text-gray-500 border-transparent hover:bg-white/10",
                )}
              >
                TOUS
              </button>
              {Object.entries(LEAGUES).map(([key, name]) => (
                <button
                  key={key}
                  onClick={() => setSelectedLeague(key)}
                  className={cn(
                    "px-3 py-1.5 rounded-lg text-[8.5px] font-black border uppercase italic transition-all shrink-0 flex items-center gap-1.5",
                    selectedLeague === key
                      ? "bg-brand-red text-white border-brand-red"
                      : "bg-white/5 text-gray-400 border-transparent hover:bg-white/10",
                  )}
                >
                  <span className="text-xs shrink-0">
                    {leagueFlags[key] || "⚽"}
                  </span>
                  <span>{name.split(" ")[0]}</span>
                </button>
              ))}
            </div>

            {/* Search Input */}
            <div className="relative shrink-0">
              <div className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-500">
                <Target size={12} />
              </div>
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Rechercher une formation..."
                className="w-full bg-black/40 border border-white/5 rounded-xl py-2 pl-9 pr-3 text-[10px] font-black italic tracking-wide text-white focus:outline-none focus:border-brand-gold/30 placeholder:text-gray-600 transition-all uppercase"
              />
            </div>

            {/* Scrollable Team List */}
            <div className="flex-1 overflow-y-auto pr-1 flex flex-col gap-3 scrollbar-none">
              {(() => {
                const uniqueTeams = Array.from(
                  new Map(
                    filteredTeams.map((item) => [item.id, item]),
                  ).values(),
                ) as Team[];

                if (search.trim() !== "" || selectedLeague !== "ALL") {
                  return (
                    <div className="flex flex-wrap items-center gap-2 sm:gap-3 py-1">
                      {uniqueTeams.map((team) => (
                        <motion.div
                          layout
                          key={team.id}
                          onClick={() => {
                            setCopiedTeam(team);
                            toast.success(`${team.name} prêt`, {
                              duration: 600,
                            });
                          }}
                          onMouseEnter={playMetallicSound}
                          className={cn(
                            "w-8 h-8 xs:w-9 xs:h-9 sm:w-11 sm:h-11 rounded-full bg-white border-2 flex items-center justify-center p-1 xs:p-1.5 transition-all cursor-pointer select-none shrink-0 relative hover:scale-110 active:scale-95 shadow-md",
                            copiedTeam?.id === team.id
                              ? "border-brand-red shadow-[0_0_12px_rgba(239,68,68,0.35)]"
                              : "border-neutral-900 hover:border-brand-red"
                          )}
                          title={team.name}
                        >
                          <img
                            src={team.logo || FALLBACK_LOGO}
                            className="max-w-full max-h-full object-contain"
                            alt=""
                            referrerPolicy="no-referrer"
                            onError={(e) => { (e.target as HTMLImageElement).src = FALLBACK_LOGO }}
                          />
                        </motion.div>
                      ))}
                    </div>
                  );
                }

                return [
                  {
                    key: "ENG",
                    name: "PREMIER LEAGUE",
                    gradient: "from-purple-900/40 via-purple-950/20 to-transparent",
                    border: "border-purple-500/20 text-purple-300",
                  },
                  {
                    key: "FRA",
                    name: "LIGUE 1",
                    gradient: "from-blue-900/40 via-blue-950/20 to-transparent",
                    border: "border-blue-500/20 text-blue-300",
                  },
                  {
                    key: "ESP",
                    name: "LA LIGA",
                    gradient: "from-yellow-900/40 via-yellow-950/20 to-transparent",
                    border: "border-yellow-500/20 text-yellow-300",
                  },
                  {
                    key: "GER",
                    name: "BUNDESLIGA",
                    gradient: "from-red-900/40 via-red-950/20 to-transparent",
                    border: "border-red-500/20 text-red-300",
                  },
                  {
                    key: "ITA",
                    name: "SERIE A",
                    gradient: "from-emerald-900/40 via-emerald-950/20 to-transparent",
                    border: "border-emerald-500/20 text-emerald-300",
                  },
                  {
                    key: "NED",
                    name: "EREDIVISIE",
                    gradient: "from-orange-900/40 via-orange-950/20 to-transparent",
                    border: "border-orange-500/20 text-orange-300",
                  },
                  {
                    key: "NAT",
                    name: "EUROPE",
                    gradient: "from-teal-900/40 via-teal-950/20 to-transparent",
                    border: "border-teal-500/20 text-teal-300",
                  },
                  {
                    key: "AFR",
                    name: "AFRIQUE",
                    gradient: "from-amber-900/40 via-amber-950/20 to-transparent",
                    border: "border-amber-500/20 text-amber-300",
                  },
                  {
                    key: "SAM",
                    name: "S. AMÉRIQUE",
                    gradient: "from-cyan-900/40 via-cyan-950/20 to-transparent",
                    border: "border-cyan-500/20 text-cyan-300",
                  },
                  {
                    key: "OTHER",
                    name: "ASIE",
                    gradient: "from-gray-900/40 via-gray-950/20 to-transparent",
                    border: "border-gray-500/30 text-gray-400",
                  },
                ].map((group) => {
                  const matchedTeams = uniqueTeams.filter((t) => {
                    if (group.key === "OTHER") {
                      return ![
                        "ENG",
                        "FRA",
                        "ESP",
                        "GER",
                        "ITA",
                        "NED",
                        "NAT",
                        "AFR",
                        "SAM",
                      ].includes(t.league);
                    }
                    return t.league === group.key;
                  });

                  if (matchedTeams.length === 0) return null;

                  return (
                    <div
                      key={group.key}
                      className="space-y-2 shrink-0 flex flex-col"
                    >
                      <div className={cn(
                        "relative overflow-hidden px-2.5 py-1 rounded-xl border font-black tracking-wider text-[8px] xs:text-[9.5px] uppercase bg-gradient-to-r",
                        group.gradient,
                        group.border
                      )}>
                        {group.name}
                      </div>
                      <div className="flex flex-wrap items-center gap-2 xs:gap-3 py-1">
                        {matchedTeams.map((team) => (
                          <motion.div
                            layout
                            key={team.id}
                            onClick={() => {
                              setCopiedTeam(team);
                              toast.success(`${team.name} prêt`, {
                                duration: 600,
                              });
                            }}
                            onMouseEnter={playMetallicSound}
                            className={cn(
                              "w-7 h-7 xs:w-9 xs:h-9 sm:w-11 sm:h-11 rounded-full bg-white border-2 flex items-center justify-center p-1 xs:p-1.5 transition-all cursor-pointer select-none shrink-0 relative hover:scale-110 active:scale-95 shadow-md",
                              copiedTeam?.id === team.id
                                ? "border-brand-red shadow-[0_0_12px_rgba(239,68,68,0.35)]"
                                : "border-neutral-900 hover:border-brand-red"
                            )}
                            title={team.name}
                          >
                            <img
                            src={team.logo || FALLBACK_LOGO}
                            className="max-w-full max-h-full object-contain"
                            alt=""
                            referrerPolicy="no-referrer"
                            onError={(e) => { (e.target as HTMLImageElement).src = FALLBACK_LOGO }}
                          />
                          </motion.div>
                        ))}
                      </div>
                    </div>
                  );
                });
              })()}
            </div>
          </section>

          {/* RIGHT COLUMN: Room layout configurations & Positions (Scrollable, same height) */}
          <section className="bg-black/20 p-2 sm:p-4 rounded-3xl border border-white/5 flex flex-col justify-between h-[540px] xs:h-[580px] sm:h-[620px] overflow-hidden">
            {/* 1. Game Mode Details (Disabled/Read-Only profile) */}
            <div className="space-y-1 shrink-0">
              <span className="text-[7.5px] xs:text-[9px] font-black text-gray-500 uppercase tracking-widest px-1">
                MODE DE JEU
              </span>
              <div className="grid grid-cols-4 gap-1.5">
                {MODES.map((m) => {
                  const isActive = room.mode === m.id;
                  return (
                    <button
                      key={m.id}
                      disabled
                      className={cn(
                        "text-[7.5px] xs:text-[8px] font-black tracking-wider py-1.5 rounded-lg border uppercase transition-all shrink-0 select-none opacity-45",
                        isActive &&
                          "opacity-100 " +
                            (m.id === "Expert"
                              ? "border-brand-gold text-brand-gold bg-brand-gold/10 shadow-[0_0_12px_rgba(234,179,8,0.2)]"
                              : m.id === "Random"
                                ? "border-blue-500 text-blue-400 bg-blue-500/10 shadow-[0_0_12px_rgba(59,130,246,0.2)]"
                                : m.id === "Top"
                                  ? "border-green-500 text-green-400 bg-green-500/10 shadow-[0_0_12px_rgba(34,197,94,0.2)]"
                                  : "border-rose-500 text-rose-400 bg-rose-500/10 shadow-[0_0_12px_rgba(244,63,94,0.2)]"),
                      )}
                    >
                      {m.id}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* 2. Stake per position display */}
            <div className="space-y-1.5 shrink-0">
              <span className="text-[7.5px] xs:text-[9px] font-black text-gray-500 uppercase tracking-widest px-1">
                MISE DU SALON
              </span>
              <div className="flex items-center justify-between px-1.5 py-1 rounded-2xl border border-white/5 bg-black/10 gap-1 overflow-x-auto scrollbar-none">
                {[500, 1000, 2000, 5000].map((s) => {
                  const isSelected = room.stakePerPosition === s;
                  return (
                    <button
                      key={s}
                      disabled
                      className={cn(
                        "w-9 h-9 xs:w-11 xs:h-11 sm:w-13 sm:h-13 rounded-full flex flex-col items-center justify-center font-mono border relative shadow-lg select-none shrink-0 opacity-40",
                        isSelected &&
                          "opacity-100 bg-gradient-to-b from-brand-gold/25 via-black/90 to-brand-gold/15 border-brand-gold ring-1 ring-brand-gold/30 text-brand-gold scale-105 shadow-[0_0_15px_rgba(234,179,8,0.25)]",
                      )}
                    >
                      <span className="text-[8px] xs:text-[9.5px] sm:text-[10px] md:text-[11px] font-black leading-none">
                        {s}
                      </span>
                      <span className="text-[4px] xs:text-[5px] sm:text-[5.5px] font-black text-gray-500 tracking-wider mt-0.5 font-sans">
                        FCFA
                      </span>
                    </button>
                  );
                })}
              </div>
              {![500, 1000, 2000, 5000].includes(room.stakePerPosition) && (
                <div className="px-1">
                  <input
                    type="text"
                    readOnly
                    value={`${formatFCFA(room.stakePerPosition)} (Mise personnalisée)`}
                    className="w-full bg-black/35 border border-brand-gold/10 rounded-xl px-2 py-1 text-[7.5px] xs:text-[8px] font-mono text-brand-gold font-bold focus:outline-none text-center"
                  />
                </div>
              )}
            </div>

            {/* 3. Positions List (Styled exactly like CreateRoom rows) */}
            <div className="space-y-1.5 shrink-0 flex-1 min-h-0 py-3 flex flex-col w-full overflow-hidden">
              <span className="text-[7.5px] xs:text-[9px] font-black text-gray-500 uppercase tracking-widest px-1 border-b border-white/5 pb-1 shrink-0">
                POSITIONS SALLE
              </span>
              <div className="space-y-1.5 flex-1 overflow-y-auto overflow-x-auto pb-1.5 pr-1 scrollbar-thin scrollbar-thumb-white/10 pt-1 w-full">
                <div className="min-w-max flex flex-col space-y-1.5">
                  {[1, 2, 3, 4, 5, 6, 7].map((i) => {
                    const pKey = `P${i}`;
                    const pos = (room.positions as any)[pKey] as Position;
                    const isOccupied = !!pos?.playerId;
                    const isMe = pos?.playerId === user?.uid;
                    const isSelected = selectedPKey === pKey;
                    const draft = getDraft(pKey);

                    const hostPos = Object.values(room.positions).find(
                      (p) => (p as any).playerId === room.creatorId,
                    ) as any;
                    const commonTeam =
                      hostPos?.teams?.top || hostPos?.teams?.bottom;

                    const isTopLocked =
                      !isOccupied &&
                      (room.mode === "Random" ||
                        ((room.mode === "Top" || room.mode === "Flop") &&
                          !!draft?.bottom));
                    const isBottomLocked =
                      !isOccupied &&
                      (room.mode === "Random" ||
                        ((room.mode === "Top" || room.mode === "Flop") &&
                          !!draft?.top));

                    return (
                      <div
                        key={pKey}
                        onMouseEnter={playMetallicSound}
                        onClick={() => {
                          if (selectedPKey !== pKey) {
                            setSelectedPKey(pKey);
                          }
                        }}
                        className={cn(
                          "h-[34px] xs:h-[38px] sm:h-[44px] rounded-xl flex items-center px-2 xs:px-3 justify-between transition-all border select-none cursor-pointer shrink-0 min-w-[200px] max-w-[260px] mx-auto",
                          isSelected
                            ? "bg-white/10 border-brand-red/60 shadow-[0_0_12px_rgba(239,68,68,0.15)] ring-1 ring-brand-red/35"
                            : isOccupied
                              ? "bg-zinc-800/20 border-white/5 opacity-100"
                              : "bg-black/35 border-white/10 hover:bg-neutral-800/40 hover:border-white/15",
                        )}
                      >
                        <div className="flex items-center justify-center shrink-0 w-8 h-8 xs:w-10 xs:h-10 sm:w-12 sm:h-12 rounded-lg bg-black/40 border border-white/10 ml-1">
                          <span className={cn(
                            "text-xs xs:text-sm sm:text-lg font-black italic tracking-widest text-center",
                            isSelected ? "text-brand-red font-black" : "text-white/90 font-bold"
                          )}>
                            {pKey}
                          </span>
                        </div>

                        <div className="flex items-center gap-1.5 sm:gap-2 flex-1 justify-end ml-1.5 xs:ml-3">
                          {isOccupied ? (
                            <div className="flex items-center gap-1.5 justify-end shrink-0">
                              {/* Team 1/Top */}
                              <div
                                className="h-6.5 xs:h-7.5 w-[40px] xs:w-[50px] sm:w-[70px] rounded-lg bg-black/45 border border-white/5 flex items-center justify-center shrink-0 gap-1 overflow-hidden"
                                title={pos.teams?.top?.name}
                              >
                                {pos.teams?.top ? (
                                  <div className="w-5 h-5 xs:w-6 xs:h-6 shrink-0 bg-white border border-black rounded flex items-center justify-center p-0.5">
                                    <img
                                      src={pos.teams.top.logo || undefined}
                                      className="max-w-full max-h-full object-contain"
                                      referrerPolicy="no-referrer"
                                      onError={(e) => { (e.target as HTMLImageElement).src = FALLBACK_LOGO }}
                                    />
                                  </div>
                                ) : (
                                  <span className="text-[5.5px] text-gray-600 font-extrabold italic uppercase">
                                    -
                                  </span>
                                )}
                              </div>

                              {/* Swap Button Icon (Static for occupied) */}
                              <div className="w-[16px] h-[16px] xs:w-5 xs:h-4 rounded-full flex items-center justify-center text-white/10 shrink-0">
                                <Repeat size={9} />
                              </div>

                              {/* Team 2/Bottom */}
                              <div
                                className="h-6.5 xs:h-7.5 w-[40px] xs:w-[50px] sm:w-[70px] rounded-lg bg-black/45 border border-white/5 flex items-center justify-center shrink-0 gap-1 overflow-hidden"
                                title={pos.teams?.bottom?.name}
                              >
                                {pos.teams?.bottom ? (
                                  <div className="w-5 h-5 xs:w-6 xs:h-6 shrink-0 bg-white border border-black rounded flex items-center justify-center p-0.5">
                                    <img
                                      src={pos.teams.bottom.logo || undefined}
                                      className="max-w-full max-h-full object-contain"
                                      referrerPolicy="no-referrer"
                                      onError={(e) => { (e.target as HTMLImageElement).src = FALLBACK_LOGO }}
                                    />
                                  </div>
                                ) : (
                                  <span className="text-[5.5px] text-gray-600 font-extrabold italic uppercase">
                                    -
                                  </span>
                                )}
                              </div>
                            </div>
                          ) : room.mode === "Random" ? (
                            <div className="text-[6.5px] xs:text-[7px] font-black text-gray-300 uppercase tracking-widest bg-black/45 px-2.5 py-1 rounded border border-white/5 shrink-0">
                              🎲 HASARD AUTOMATIQUE
                            </div>
                          ) : (
                            <>
                              {/* Slot 1 Team */}
                              <div
                                onClick={(e) => {
                                  if (!isSelected) return;
                                  e.stopPropagation();
                                  handleSlotClick(pKey, "top");
                                }}
                                className={cn(
                                  "h-6.5 xs:h-7.5 sm:h-8.5 rounded-lg bg-black/50 border flex items-center justify-center transition-all flex-1 min-w-[40px] max-w-[70px]",
                                  isSelected
                                    ? "border-white/25 hover:border-brand-red/50 cursor-pointer bg-white/[0.03]"
                                    : "border-white/5 text-gray-500 cursor-default",
                                  draft?.top ? "bg-white/10 border-white/30 shadow-inner" : "",
                                )}
                              >
                                {isTopLocked ? (
                                  <div className="flex items-center gap-0.5 mx-auto text-[5.5px] text-gray-500">
                                    <Lock size={6} /> <span className="font-bold uppercase text-[6px]">CADENAS</span>
                                  </div>
                                ) : draft?.top ? (
                                  <div className="flex items-center justify-center w-full h-full relative group">
                                    <div className="w-5 h-5 xs:w-6 xs:h-6 bg-white border border-black rounded flex items-center justify-center p-0.5 shadow-sm">
                                      <img
                                        src={draft.top.logo || undefined}
                                        className="max-w-full max-h-full object-contain shrink-0"
                                        alt=""
                                        referrerPolicy="no-referrer"
                                        onError={(e) => { (e.target as HTMLImageElement).src = FALLBACK_LOGO }}
                                      />
                                    </div>
                                    {(!commonTeam || draft.top.id !== commonTeam.id) && (
                                      <button
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          handleDelete(pKey, "top");
                                        }}
                                        className="absolute -top-1 -right-1 opacity-100 bg-red-500 text-white rounded-full p-0.5 shadow-sm transition-all z-10"
                                      >
                                        <X size={8} strokeWidth={3} />
                                      </button>
                                    )}
                                  </div>
                                ) : (
                                  <span className="text-[6.5px] xs:text-[7px] text-zinc-300 font-extrabold italic uppercase text-center w-full">
                                    Équipe 1
                                  </span>
                                )}
                              </div>

                              {/* Swap Button Icon */}
                              <button
                                onClick={(e) => {
                                  if (!isSelected) return;
                                  e.stopPropagation();
                                  handleSwap(pKey);
                                }}
                                className={cn(
                                  "w-[16px] h-[16px] xs:w-5 xs:h-5 rounded-full flex items-center justify-center transition-all bg-black/50 text-gray-400 shrink-0",
                                  isSelected
                                    ? "hover:text-brand-gold hover:bg-black border border-white/15 active:scale-90"
                                    : "opacity-30 border-transparent cursor-default",
                                )}
                              >
                                <Repeat size={9} />
                              </button>

                              {/* Slot 2 Team */}
                              <div
                                onClick={(e) => {
                                  if (!isSelected) return;
                                  e.stopPropagation();
                                  handleSlotClick(pKey, "bottom");
                                }}
                                className={cn(
                                  "h-6.5 xs:h-7.5 sm:h-8.5 rounded-lg bg-black/50 border flex items-center justify-center transition-all flex-1 min-w-[40px] max-w-[70px]",
                                  isSelected
                                    ? "border-white/25 hover:border-brand-red/50 cursor-pointer bg-white/[0.03]"
                                    : "border-white/5 text-gray-500 cursor-default",
                                  draft?.bottom ? "bg-white/10 border-white/30 shadow-inner" : "",
                                )}
                              >
                                {isBottomLocked ? (
                                  <div className="flex items-center gap-0.5 mx-auto text-[5.5px] text-gray-500">
                                    <Lock size={6} /> <span className="font-bold uppercase text-[6px]">CADENAS</span>
                                  </div>
                                ) : draft?.bottom ? (
                                  <div className="flex items-center justify-center w-full h-full relative group">
                                    <div className="w-5 h-5 xs:w-6 xs:h-6 bg-white border border-black rounded flex items-center justify-center p-0.5 shadow-sm">
                                      <img
                                        src={draft.bottom.logo || undefined}
                                        className="max-w-full max-h-full object-contain shrink-0"
                                        alt=""
                                        referrerPolicy="no-referrer"
                                        onError={(e) => { (e.target as HTMLImageElement).src = FALLBACK_LOGO }}
                                      />
                                    </div>
                                    {(!commonTeam || draft.bottom.id !== commonTeam.id) && (
                                      <button
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          handleDelete(pKey, "bottom");
                                        }}
                                        className="absolute -top-1 -right-1 opacity-100 bg-red-500 text-white rounded-full p-0.5 shadow-sm transition-all z-10"
                                      >
                                        <X size={8} strokeWidth={3} />
                                      </button>
                                    )}
                                  </div>
                                ) : (
                                  <span className="text-[6.5px] xs:text-[7px] text-zinc-300 font-extrabold italic uppercase text-center w-full">
                                    Équipe 2
                                  </span>
                                )}
                              </div>
                            </>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* 4. Action Join Button */}
            <div className="pt-2 shrink-0">
              {(() => {
                const myPosEn = Object.entries(room.positions).find(
                  ([_, p]) => (p as Position).playerId === user?.uid,
                );
                const alreadyJoined = !!myPosEn;

                if (alreadyJoined) {
                  return (
                    <div className="text-center bg-green-500/10 border border-green-500/30 p-2 rounded-2xl">
                      <p className="text-[9.5px] xs:text-[10px] font-black text-green-400 uppercase tracking-wider italic">
                        ✓ COMMIS À LA POSITION {myPosEn[0]}
                      </p>
                      <p className="text-[7.5px] text-gray-400 mt-0.5 uppercase">
                        En attente du démarrage par le créateur...
                      </p>
                    </div>
                  );
                }

                if (isFull) {
                  return (
                    <div className="text-center bg-brand-gold/10 border border-brand-gold/30 p-2 rounded-2xl">
                      <p className="text-[9.5px] xs:text-[10px] font-black text-brand-gold uppercase tracking-wider italic">
                        SALON COMPLET (FERMÉE)
                      </p>
                      <p className="text-[7.5px] text-gray-400 mt-0.5 uppercase animate-pulse">
                        Lancement de la simulation imminent...
                      </p>
                    </div>
                  );
                }

                const draft = getDraft(selectedPKey);
                const isSelectedPosOccupied = !!(room.positions as any)[
                  selectedPKey
                ]?.playerId;

                const canJoin =
                  !isSelectedPosOccupied &&
                  (room.mode === "Random" ||
                    (room.mode === "Expert" && draft?.top && draft?.bottom) ||
                    ((room.mode === "Top" || room.mode === "Flop") &&
                      (draft?.top || draft?.bottom)));

                return (
                  <button
                    disabled={!canJoin}
                    onClick={() => confirmJoin(selectedPKey)}
                    className="w-full h-[42px] sm:h-[46px] rounded-2xl bg-gradient-to-r from-red-600 to-brand-red border border-red-500/30 text-white flex items-center overflow-hidden hover:brightness-110 active:scale-98 transition-all disabled:opacity-30 disabled:pointer-events-none cursor-pointer shadow-lg"
                  >
                    <div className="w-[38%] h-full bg-black/30 flex flex-col items-center justify-center border-r border-white/10 select-none">
                      <span className="text-[6.5px] xs:text-[7px] uppercase font-bold text-gray-400 tracking-wider">
                        Mise {selectedPKey}
                      </span>
                      <span className="text-[9px] xs:text-[10px] font-mono font-black text-brand-gold">
                        {formatFCFA(room.stakePerPosition)}
                      </span>
                    </div>
                    <div className="flex-1 flex items-center justify-center gap-1 xs:gap-1.5 font-black uppercase text-[8.5px] xs:text-[10px] tracking-wider italic">
                      <span>REJOINDRE LA SALLE</span>
                      <Zap
                        size={10}
                        className="text-brand-gold animate-bounce"
                      />
                    </div>
                  </button>
                );
              })()}
            </div>
          </section>
        </div>

        {/* Creator Tools & admin panel rendered cleanly underneath */}
        {(user?.uid === room?.creatorId || isAdmin) && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-white/5 border border-white/10 p-3.5 sm:p-5 rounded-3xl flex flex-col md:flex-row gap-4 items-center justify-between shadow-2xl shrink-0"
          >
            <div className="flex flex-col gap-1 text-center md:text-left animate-fade-in">
              <h4 className="text-xs font-black text-brand-gold uppercase tracking-wider italic">
                Contrôles du Créateur (Hôte)
              </h4>
              <p className="text-[9.5px] text-gray-400 uppercase font-bold">
                Remplissez de bots ou déclenchez immédiatement l'Oracle
              </p>
            </div>
            <div className="flex flex-wrap gap-2.5 justify-center">
              {emptyPositionsCount > 0 && (
                <button
                  onClick={() => addBulkLeviers(emptyPositionsCount)}
                  className="py-2.5 px-4 bg-brand-red hover:bg-brand-red/90 text-white font-black italic uppercase rounded-xl transition-all shadow-md active:scale-95 text-[9px] cursor-pointer"
                >
                  <Users size={12} className="inline mr-1" />
                  <span>AJOUTER LES BOTS (x{emptyPositionsCount})</span>
                </button>
              )}
              {isFull && room.status === "created" && (
                <button
                  onClick={
                    room.mode === "Expert"
                      ? async () => {
                          await updateDoc(doc(db, "rooms", room.id), {
                            status: "secondary_bets",
                            updatedAt: serverTimestamp(),
                          });
                          toast.success("Phase de Paris Défi (P vs P) ouverte !");
                        }
                      : executeOracleTeams
                  }
                  className="py-2.5 px-5 bg-brand-gold hover:bg-brand-gold/90 text-brand-black font-black italic uppercase rounded-xl transition-all shadow-md active:scale-95 text-[9px] flex items-center gap-1.5 cursor-pointer"
                >
                  <Play size={12} fill="currentColor" />
                  <span>
                    {room.mode === "Expert"
                      ? "OUVRIR LES PARIS P VS P"
                      : "APPELER L'ORACLE & PARIS P VS P"}
                  </span>
                </button>
              )}
              {room.status === "secondary_bets" && (
                <button
                  onClick={startSimulation}
                  className="py-2.5 px-5 bg-brand-gold hover:bg-brand-gold/90 text-brand-black font-black italic uppercase rounded-xl transition-all shadow-md active:scale-95 text-[9px] flex items-center gap-1.5 cursor-pointer"
                >
                  <Play size={12} fill="currentColor" />
                  <span>AFFICHER LES SCORES DE LA PARTIE</span>
                </button>
              )}
            </div>
          </motion.div>
        )}

        {/* Floating Chat Button */}
        <button className="fixed bottom-6 right-6 w-14 h-14 bg-brand-gold text-brand-black rounded-full shadow-2xl flex items-center justify-center hover:scale-110 active:scale-95 transition-all z-50 group border-4 border-black shadow-[0_0_20px_rgba(255,184,0,0.4)]">
          <motion.div
            animate={{ scale: [1, 1.1, 1] }}
            transition={{ repeat: Infinity, duration: 2 }}
          >
            <Zap size={24} fill="currentColor" />
          </motion.div>
          <span className="absolute bottom-full right-0 mb-4 whitespace-nowrap bg-brand-gold text-brand-black font-black text-[8px] px-3 py-1.5 rounded-xl border-4 border-black opacity-0 group-hover:opacity-100 transition-opacity uppercase italic tracking-widest shadow-2xl">
            Chat salon
          </span>
        </button>

        {/* JOIN/CONFIRMATION MODAL OVERLAYS */}
        <AnimatePresence>
          {confirmingPos && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-[100] bg-brand-black/80 backdrop-blur-md flex items-center justify-center p-4"
            >
              <motion.div
                initial={{ scale: 0.9, y: 20 }}
                animate={{ scale: 1, y: 0 }}
                exit={{ scale: 0.9, y: 20 }}
                className="bg-black/80 border border-white/10 rounded-3xl p-6 sm:p-8 max-w-md w-full shadow-2xl text-center space-y-5"
              >
                <div className="w-14 h-14 bg-brand-gold/20 rounded-full flex items-center justify-center mx-auto border border-brand-gold/30">
                  <Wallet className="text-brand-gold" size={28} />
                </div>
                <div className="space-y-4">
                  <div className="space-y-1.5">
                    <h3 className="text-lg font-black uppercase italic text-white tracking-tight">
                      Confirmation d'inscription
                    </h3>
                    <p className="text-xs text-gray-400 font-bold uppercase leading-relaxed text-[10px]">
                      Afin de valider votre siège, veuillez acquitter le montant
                      du wager requis :
                    </p>
                  </div>

                  <div className="bg-black/60 border border-brand-gold/30 rounded-2xl p-4 shadow-inner">
                    <p className="text-[8px] font-bold text-gray-500 uppercase">
                      MONTANT DE LA MISE
                    </p>
                    <p className="text-2xl font-mono font-black text-brand-gold mt-1">
                      {formatFCFA(room.stakePerPosition)}
                    </p>
                    <p className="text-[8px] text-gray-500 font-bold uppercase mt-1">
                      DÉBITÉ À LA CONFIRMATION
                    </p>
                  </div>
                </div>

                <div className="flex gap-3 pt-1">
                  <button
                    onClick={() => setConfirmingPos(null)}
                    className="flex-1 py-3.5 rounded-2xl bg-white/5 border border-white/10 text-white font-black uppercase italic hover:bg-white/10 transition-all active:scale-95 text-[10px]"
                  >
                    NON
                  </button>
                  <button
                    onClick={executeJoin}
                    className="flex-1 py-3.5 rounded-2xl bg-brand-gold text-brand-black font-black uppercase italic shadow-lg shadow-brand-gold/20 hover:bg-brand-gold/90 transition-all active:scale-95 text-[10px]"
                  >
                    OUI
                  </button>
                </div>
              </motion.div>
            </motion.div>
          )}

          {room.status === "simulating" && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-[60] bg-brand-black/95 backdrop-blur-xl flex flex-col items-center justify-center p-10 text-center"
            >
              <div className="w-24 h-24 border-[10px] border-brand-red border-t-transparent rounded-full animate-spin mb-8 shadow-[0_0_50px_rgba(239,68,68,0.3)]" />
              <h3 className="text-4xl font-black italic mb-3 tracking-tighter text-white uppercase">
                SIMULATION ORACLE
              </h3>
              <p className="text-brand-gold font-black uppercase tracking-[0.25em] text-xs animate-pulse italic">
                Analyse IA en cours...
              </p>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6 w-full lg:p-6 p-2 pb-20 bg-transparent">
      <div className="flex flex-col lg:flex-row gap-6 items-start w-full">
        {/* Only Column: POSITIONS */}
        <div className="w-full max-w-3xl mx-auto flex flex-col gap-4">
          <div className="flex items-center justify-between px-2">
            <div className="flex items-center gap-3">
              <div className="w-1.5 h-6 bg-brand-gold rounded-full" />
              <h2 className="text-xl font-black italic tracking-tighter uppercase text-white">
                POSITIONS
              </h2>
            </div>
            {(room.status === "partie_terminee" ||
              room.status === "results") && (
              <button
                onClick={() => setShowRecapOnly(true)}
                className="bg-brand-gold text-brand-black text-[9px] font-black uppercase italic px-3 py-1.5 rounded-xl hover:scale-105 active:scale-95 transition-all shadow-md flex items-center gap-1 cursor-pointer"
              >
                <TrophyIcon size={12} /> VOIR RÉCAPITULATIF
              </button>
            )}
            <div className="flex items-center gap-2 bg-black/40 px-3 py-1 rounded-full border border-white/10 shadow-xl">
              <Users size={12} className="text-brand-gold" />
              <span className="text-[10px] font-black text-gray-400">
                {
                  Object.values(
                    room.positions as Record<string, Position>,
                  ).filter((p) => p.playerId).length
                }
                /{Object.keys(room.positions).length} JOUEURS
              </span>
            </div>
          </div>

          {/* Column Headers */}
          <div className="hidden lg:flex items-center gap-4 px-4 py-1 border-b border-white/5 opacity-50">
            <div className="w-36 text-[8px] font-black text-gray-500 uppercase italic">
              SALON / JOUEUR
            </div>
            <div className="flex-1 text-[8px] font-black text-brand-red uppercase italic text-center">
              SLOT ÉQUIPE 1
            </div>
            <div className="flex-1 text-[8px] font-black text-brand-gold uppercase italic text-center">
              SLOT ÉQUIPE 2
            </div>
          </div>

          {(isCreator || isAdmin) &&
            room.status === "created" &&
            emptyPositionsCount > 0 && (
              <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                className="mx-2 p-4 rounded-2xl bg-black/60 border border-brand-red/30 shadow-2xl flex flex-col gap-3 relative overflow-hidden"
              >
                <div className="flex items-center gap-2">
                  <Users size={16} className="text-brand-red animate-pulse" />
                  <span className="text-[10px] font-black uppercase text-brand-red tracking-wider">
                    Remplissage Administratif
                  </span>
                </div>
                <p className="text-[9px] text-gray-400 font-medium leading-relaxed">
                  Il reste{" "}
                  <span className="text-brand-red font-black font-mono">
                    {emptyPositionsCount} P libre(s)
                  </span>
                  . Vous pouvez remplir automatiquement toutes les places avec
                  les bots de l'admin.
                </p>
                <button
                  onClick={() => addBulkLeviers(emptyPositionsCount)}
                  className="w-full py-2.5 bg-brand-red hover:bg-brand-red/90 text-white font-black italic uppercase rounded-xl shadow-lg flex items-center justify-center gap-2 active:scale-[0.98] transition-all cursor-pointer text-[10px]"
                >
                  <Users size={14} />
                  <span>AJOUTER LES BOTS (x{emptyPositionsCount})</span>
                </button>
              </motion.div>
            )}

          {room.status === "secondary_bets" && (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              className="mx-2 p-3.5 bg-gradient-to-r from-brand-gold/15 to-brand-red/15 border border-brand-gold/40 rounded-2xl flex items-center justify-between gap-3 shadow-2xl relative overflow-hidden"
            >
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-brand-gold/20 border border-brand-gold/40 flex items-center justify-center shrink-0">
                  <Zap size={20} className="text-brand-gold animate-pulse" />
                </div>
                <div>
                  <h3 className="text-xs font-black uppercase tracking-wider text-brand-gold flex items-center gap-2">
                    ⚡ SECOND PARI : DÉFI P VS P EN COURS
                  </h3>
                  <p className="text-[9.5px] text-gray-200 font-bold uppercase mt-0.5">
                    Défiez d'autres joueurs en duel P vs P ou misez sur les positions avant l'affichage des scores !
                  </p>
                </div>
              </div>
            </motion.div>
          )}

          {room.mode === "Expert" && (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              className="mx-2 p-3 bg-brand-gold/10 border border-brand-gold/30 rounded-xl flex items-start gap-3 shadow-2xl relative overflow-hidden group"
            >
              <div className="absolute top-0 right-0 p-1 opacity-10 group-hover:opacity-20 transition-opacity">
                <ShieldAlert size={40} className="text-brand-gold" />
              </div>
              <AlertCircle
                size={18}
                className="text-brand-gold shrink-0 mt-1"
              />
              <div className="space-y-1 relative z-10">
                <p className="text-[10px] font-black uppercase text-brand-gold italic">
                  MODE EXPERT — RÈGLES
                </p>
                <ul className="space-y-1">
                  <li className="text-[9px] text-gray-300 font-bold flex items-center gap-2">
                    <div className="w-1 h-1 bg-brand-gold rounded-full" />
                    Choisis librement tes deux équipes
                  </li>
                </ul>
              </div>
            </motion.div>
          )}

          {(room.mode === "Top" || room.mode === "Flop") && (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              className="mx-2 p-3 bg-brand-red/10 border border-brand-red/30 rounded-xl flex items-start gap-3 shadow-2xl relative overflow-hidden group"
            >
              <div className="absolute top-0 right-0 p-1 opacity-10 group-hover:opacity-20 transition-opacity">
                <Target size={40} className="text-brand-red" />
              </div>
              <ShieldAlert size={18} className="text-brand-red shrink-0 mt-1" />
              <div className="space-y-1 relative z-10">
                <p className="text-[10px] font-black uppercase text-brand-red italic">
                  {room.mode === "Top"
                    ? "MODE TOP — BUTEURS"
                    : "MODE FLOP — PORTIERS"}
                </p>
                <ul className="space-y-1">
                  <li className="text-[9px] text-gray-300 font-bold flex items-center gap-2">
                    <div className="w-1 h-1 bg-brand-red rounded-full" />
                    L'équipe commune est imposée par l'hôte
                  </li>
                  <li className="text-[9px] text-gray-300 font-bold flex items-center gap-2">
                    <div className="w-1 h-1 bg-brand-red rounded-full" />
                    {room.mode === "Top"
                      ? "L'équipe commune marquera BEAUCOUP"
                      : "L'équipe commune marquera PEU"}
                  </li>
                  <li className="text-[9px] text-gray-300 font-bold flex items-center gap-2">
                    <div className="w-1 h-1 bg-brand-red rounded-full" />
                    Choisis sa position (Équipe 1 ou 2) pour gagner
                  </li>
                </ul>
              </div>
            </motion.div>
          )}

          <div className="flex-1 space-y-3 p-1 overflow-y-auto max-h-[70vh] scrollbar-none">
            {Object.keys(room.positions as Record<string, Position>)
              .sort()
              .map((pKey) => {
                const pos = (room.positions as any)[pKey] as Position;
                const draft = getDraft(pKey);
                const isOccupied = !!pos.playerId;
                const isMe = pos.playerId === user?.uid;
                const isPosCreator = pos.playerId === room.creatorId;
                const isSelected = selectedPKey === pKey;

                const hostPos = Object.values(room.positions).find(
                  (p) => (p as any).playerId === room.creatorId,
                ) as any;
                const commonTeam =
                  hostPos?.teams?.top || hostPos?.teams?.bottom;

                const isTopLocked =
                  !isOccupied &&
                  room.status === "created" &&
                  (room.mode === "Random" ||
                    ((room.mode === "Top" || room.mode === "Flop") &&
                      !!draft?.bottom));
                const isBottomLocked =
                  !isOccupied &&
                  room.status === "created" &&
                  (room.mode === "Random" ||
                    ((room.mode === "Top" || room.mode === "Flop") &&
                      !!draft?.top));

                return (
                  <motion.div
                    layout
                    key={pKey}
                    onClick={() => setSelectedPKey(pKey)}
                    className={cn(
                      "h-[40px] xs:h-[44px] sm:h-[48px] rounded-xl flex items-center px-2 xs:px-3 justify-between transition-all border select-none cursor-pointer shrink-0 min-w-[200px] max-w-[280px] mx-auto",
                      isSelected
                        ? "bg-white/10 border-brand-gold/60 shadow-[0_0_12px_rgba(255,215,0,0.15)] ring-1 ring-brand-gold/35"
                        : "bg-black/35 border-white/10 hover:bg-neutral-800/40 hover:border-white/15",
                      isOccupied ? "opacity-100" : "opacity-80",
                    )}
                  >
                    <div className="flex items-center justify-center shrink-0 w-8 h-8 xs:w-10 xs:h-10 rounded-lg bg-black/40 border border-white/10 ml-1">
                      <span className={cn(
                        "text-xs xs:text-sm sm:text-base font-black italic tracking-widest text-center leading-none",
                        isOccupied ? "text-brand-gold" : isSelected ? "text-brand-gold font-black" : "text-white/90 font-bold"
                      )}>
                        {pKey}
                      </span>
                    </div>

                    <div className="flex items-center gap-1.5 sm:gap-2 flex-1 justify-end ml-1.5 xs:ml-3 relative">
                      {/* Floating Swap Button */}
                      {!isOccupied &&
                        isSelected &&
                        room.status === "created" &&
                        room.mode !== "Random" && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleSwap(pKey);
                            }}
                            className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-5 h-5 rounded-full bg-black border border-white/15 text-brand-gold hover:text-white hover:bg-white/10 flex items-center justify-center transition-all z-[25] shadow-2xl active:scale-90 cursor-pointer"
                            title="Inverser les équipes"
                          >
                            <Repeat size={10} />
                          </button>
                        )}

                      {/* Equipe 1 Slot */}
                      <div
                        onClick={(e) => {
                          e.stopPropagation();
                          if (!isOccupied && !isTopLocked) {
                            handleSlotClick(pKey, "top");
                          }
                        }}
                        className={cn(
                          "h-7 sm:h-8 rounded-lg bg-black/50 border flex items-center justify-center transition-all flex-1 min-w-[40px] max-w-[70px] relative overflow-hidden",
                          pos.teams?.top || draft?.top || pos.score?.top !== undefined
                            ? "bg-brand-red/10 border-brand-red/30"
                            : "bg-black/40 border-white/5",
                          !isOccupied && !isTopLocked
                            ? "cursor-pointer hover:bg-white/5"
                            : "cursor-not-allowed grayscale-[40%]",
                        )}
                      >
                        {isTopLocked && (
                          <div className="absolute inset-0 bg-black/85 backdrop-blur-[1px] flex items-center justify-center gap-1 z-20 select-none text-[6px] font-black text-gray-500 uppercase">
                            <Lock size={8} /> <span>LOCK</span>
                          </div>
                        )}

                        <div className="relative z-10 w-full h-full flex items-center justify-center">
                          {pos.teams?.top || draft?.top ? (
                            <div className="flex items-center justify-center w-full h-full relative group/btn">
                              <div className="w-5 h-5 sm:w-6 sm:h-6 rounded-lg bg-white p-0.5 flex items-center justify-center border border-black shadow-lg">
                                <img
                                  src={(pos.teams?.top || draft?.top)?.logo || undefined}
                                  className="w-full h-full object-contain filter drop-shadow-sm"
                                  alt=""
                                  referrerPolicy="no-referrer"
                                />
                              </div>
                              {pos.score && (
                                <span className="absolute -bottom-1 text-[8px] font-mono font-black text-brand-gold bg-black/80 px-1 rounded shadow shadow-brand-gold/30">
                                  {pos.score.top}
                                </span>
                              )}
                            </div>
                          ) : (
                            <span className="text-[6px] font-black text-white/10 uppercase italic">
                              EQ1
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Equipe 2 Slot */}
                      <div
                        onClick={(e) => {
                          e.stopPropagation();
                          if (!isOccupied && !isBottomLocked) {
                            handleSlotClick(pKey, "bottom");
                          }
                        }}
                        className={cn(
                          "h-7 sm:h-8 rounded-lg bg-black/50 border flex items-center justify-center transition-all flex-1 min-w-[40px] max-w-[70px] relative overflow-hidden",
                          pos.teams?.bottom || draft?.bottom || pos.score?.bottom !== undefined
                            ? "bg-brand-gold/10 border-brand-gold/30"
                            : "bg-black/40 border-white/5",
                          !isOccupied && !isBottomLocked
                            ? "cursor-pointer hover:bg-white/5"
                            : "cursor-not-allowed grayscale-[40%]",
                        )}
                      >
                        {isBottomLocked && (
                          <div className="absolute inset-0 bg-black/85 backdrop-blur-[1px] flex items-center justify-center gap-1 z-20 select-none text-[6px] font-black text-gray-500 uppercase">
                            <Lock size={8} /> <span>LOCK</span>
                          </div>
                        )}

                        <div className="relative z-10 w-full h-full flex items-center justify-center">
                          {pos.teams?.bottom || draft?.bottom ? (
                            <div className="flex items-center justify-center w-full h-full relative group/btn">
                              <div className="w-5 h-5 sm:w-6 sm:h-6 rounded-lg bg-white p-0.5 flex items-center justify-center border border-black shadow-lg">
                                <img
                                  src={(pos.teams?.bottom || draft?.bottom)?.logo || undefined}
                                  className="w-full h-full object-contain filter drop-shadow-sm"
                                  alt=""
                                  referrerPolicy="no-referrer"
                                />
                              </div>
                              {pos.score && (
                                <span className="absolute -bottom-1 text-[8px] font-mono font-black text-brand-gold bg-black/80 px-1 rounded shadow shadow-brand-gold/30">
                                  {pos.score.bottom}
                                </span>
                              )}
                            </div>
                          ) : (
                            <span className="text-[6px] font-black text-white/10 uppercase italic">
                              EQ2
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Join Button (Overlay or bottom on selected) */}
                    {!isOccupied && room.status === "created" && isSelected && (
                      <motion.button
                        initial={{ opacity: 0, scale: 0.9 }}
                        animate={{ opacity: 1, scale: 1 }}
                        onClick={(e) => {
                          e.stopPropagation();
                          confirmJoin(pKey);
                        }}
                        className="lg:absolute lg:right-3 lg:top-1/2 lg:-translate-y-1/2 lg:w-24 h-10 bg-brand-red hover:bg-brand-red/90 text-white font-black italic uppercase rounded-xl shadow-2xl flex items-center justify-center gap-2 active:scale-[0.98] transition-all z-20"
                      >
                        <Zap size={14} className="animate-pulse" />
                        <span className="lg:hidden text-[10px]">
                          Valider ma position
                        </span>
                        <span className="hidden lg:inline text-[8px]">
                          VALIDER
                        </span>
                      </motion.button>
                    )}
                  </motion.div>
                );
              })}

            {/* DÉFIS P vs P (DUELS) SECTION */}
            {challengesEnabled && (
              <motion.div
                initial={{ opacity: 0, y: 15 }}
                animate={{ opacity: 1, y: 0 }}
                className="mt-4 p-4 rounded-2xl bg-black/60 border border-brand-gold/20 shadow-2xl space-y-4"
              >
                <div className="flex items-center justify-between border-b border-white/5 pb-2">
                  <div className="flex items-center gap-2">
                    <Target
                      size={18}
                      className="text-brand-gold animate-bounce"
                    />
                    <h3 className="text-xs font-black uppercase text-brand-gold italic tracking-widest">
                      🎯 DÉFIS P vs P (DUEL DE SOUFFLE)
                    </h3>
                  </div>
                  <span className="text-[7px] bg-brand-gold/10 text-brand-gold px-2 py-0.5 rounded-full font-bold uppercase font-mono">
                    Solde: {formatFCFA(user?.balance || 0)}
                  </span>
                </div>

                {/* Launch challenge controls (Only if user has a position in the room) */}
                {Object.values(room.positions).some(
                  (p: any) => p.playerId === user?.uid,
                ) ? (
                  (() => {
                    const opponentEntries = Object.entries(room.positions).filter(
                      ([k, p]: any) => p.playerId && p.playerId !== user?.uid,
                    );
                    const currentTargetKey = selectedTargetPKey || opponentEntries[0]?.[0] || "";
                    const currentTargetPos = currentTargetKey ? room.positions[currentTargetKey] : null;
                    const isTargetAdmin = Boolean(
                      currentTargetPos?.isBot ||
                      currentTargetPos?.isLeverage ||
                      currentTargetPos?.filledBy ||
                      currentTargetPos?.playerId?.startsWith("BOT_") ||
                      currentTargetPos?.playerId?.startsWith("LEV_")
                    );
                    const isTargetBlocked = isTargetAdmin && !adminPvPActive;

                    return (
                      <div className="space-y-2.5">
                        <div className="flex items-center justify-between">
                          <span className="text-[8.5px] font-black text-gray-400 uppercase tracking-wider">
                            Cibler une position adverse :
                          </span>
                          {currentTargetKey && (
                            <span className={`text-[7.5px] font-black uppercase px-2 py-0.5 rounded-full font-mono ${
                              isTargetAdmin
                                ? adminPvPActive
                                  ? 'bg-brand-gold/15 text-brand-gold border border-brand-gold/30'
                                  : 'bg-brand-red/15 text-brand-red border border-brand-red/30'
                                : 'bg-blue-500/15 text-blue-400 border border-blue-500/30'
                            }`}>
                              {isTargetAdmin
                                ? adminPvPActive
                                  ? '🤖 Levier Admin (Auto-réponse immédiate)'
                                  : '🔒 Défi contre Admin désactivé'
                                : '👤 Joueur Réel'}
                            </span>
                          )}
                        </div>

                        <div className="grid grid-cols-3 sm:grid-cols-6 gap-1.5">
                          {opponentEntries.map(([k, p]: any) => {
                            const isSelected = currentTargetKey === k;
                            const isBot = Boolean(
                              p.isBot ||
                              p.isLeverage ||
                              p.filledBy ||
                              p.playerId?.startsWith("BOT_") ||
                              p.playerId?.startsWith("LEV_")
                            );

                            return (
                              <button
                                key={k}
                                type="button"
                                onClick={() => setSelectedTargetPKey(k)}
                                className={`p-2 rounded-xl border text-center transition-all cursor-pointer flex flex-col items-center gap-0.5 ${
                                  isSelected
                                    ? 'bg-brand-gold/20 border-brand-gold text-white shadow-md scale-[1.02]'
                                    : 'bg-white/5 border-white/10 text-gray-400 hover:text-white hover:bg-white/10'
                                }`}
                              >
                                <span className="text-[11px] font-black font-mono">{k}</span>
                                <span className="text-[7.5px] uppercase truncate max-w-full font-bold">
                                  {isBot ? "Admin" : (p.displayName || "Joueur")}
                                </span>
                              </button>
                            );
                          })}
                        </div>

                        {isTargetBlocked && (
                          <div className="p-2.5 rounded-xl bg-brand-red/10 border border-brand-red/30 text-brand-red text-[8.5px] font-black uppercase leading-tight animate-fade-in">
                            ⚠️ Le pari P vs P ne passera pas : cette option est désactivée dans les paramètres admin.
                          </div>
                        )}

                        <p className="text-[8.5px] text-gray-400 font-bold uppercase pt-1">
                          Mise du défi de souffle :
                        </p>
                        <div className="grid grid-cols-5 gap-1">
                          {[100, 500, 1000, 2000, 5000].map((amt) => {
                            return (
                              <button
                                key={amt}
                                type="button"
                                disabled={isTargetBlocked || (user?.balance || 0) < amt}
                                onClick={() => {
                                  setChallengeStakeInput(amt.toString());
                                  launchChallenge(amt, currentTargetKey);
                                }}
                                className="bg-brand-gold/10 hover:bg-brand-gold hover:text-brand-black text-brand-gold font-black font-mono text-[9px] py-1.5 rounded-lg border border-brand-gold/20 transition-all disabled:opacity-30 disabled:pointer-events-none active:scale-95 cursor-pointer text-center"
                              >
                                +{amt}
                              </button>
                            );
                          })}
                        </div>
                        <div className="flex gap-2 items-center bg-black/40 p-2 rounded-xl border border-white/5 mt-1 relative">
                          <span className="text-[7.5px] text-gray-500 font-extrabold uppercase font-mono shrink-0">
                            Montant perso:
                          </span>
                          <div className="flex-1 relative flex items-center">
                            <input
                              type="number"
                              min="100"
                              step="50"
                              value={challengeStakeInput}
                              onChange={(e) => setChallengeStakeInput(e.target.value)}
                              onBlur={() => {
                                const val = Number(challengeStakeInput);
                                if (!challengeStakeInput || isNaN(val) || val < 100) {
                                  setChallengeStakeInput("100");
                                }
                              }}
                              className="w-full bg-black/60 border border-white/10 rounded-lg px-2 py-1 pr-6 text-xs font-mono text-brand-gold font-bold focus:outline-none focus:border-brand-gold/50"
                              placeholder="Min. 100 FCFA"
                            />
                            {challengeStakeInput && (
                              <button
                                type="button"
                                onClick={() => setChallengeStakeInput("")}
                                className="absolute right-2 text-gray-400 hover:text-white text-[10px] font-black"
                                title="Effacer"
                              >
                                ✕
                              </button>
                            )}
                          </div>
                          <button
                            type="button"
                            disabled={isTargetBlocked}
                            onClick={() => {
                              const amt = Number(challengeStakeInput) || 0;
                              if (amt < 100) {
                                toast.error("La mise minimum est de 100 FCFA");
                                setChallengeStakeInput("100");
                                return;
                              }
                              if ((user?.balance || 0) < amt) {
                                toast.error("Solde insuffisant pour ce défi");
                                return;
                              }
                              launchChallenge(amt, currentTargetKey);
                            }}
                            className="bg-brand-gold font-black text-brand-black text-[9px] py-1.5 px-3 rounded-lg hover:scale-105 transition-all active:scale-95 cursor-pointer uppercase shrink-0 disabled:opacity-30 disabled:pointer-events-none"
                          >
                            DÉFIER
                          </button>
                        </div>
                      </div>
                    );
                  })()
                ) : (
                  <p className="text-[8px] text-brand-red font-bold uppercase italic text-center p-2 bg-brand-red/5 rounded-lg border border-brand-red/10">
                    ⚠️ Rejoignez une position pour lancer des défis
                  </p>
                )}

                {/* Active / Pending Challenges List */}
                <div className="space-y-2 max-h-48 overflow-y-auto pr-1 scrollbar-thin">
                  {!room.challenges || room.challenges.length === 0 ? (
                    <p className="text-[9.5px] text-gray-600 font-medium text-center py-4 italic">
                      Aucun duel provoqué pour l'instant. Soyez le premier !
                    </p>
                  ) : (
                    [...room.challenges]
                      .reverse()
                      .filter((c: any) => c.status !== "cancelled")
                      .map((chall: any) => {
                        const isChallCreator = chall.creatorUid === user?.uid;
                        const hasPosition = Object.values(room.positions).some(
                          (p: any) => p.playerId === user?.uid,
                        );
                        const myPosEn = Object.entries(room.positions).find(
                          ([_, p]: any) => p.playerId === user?.uid,
                        );
                        const myPKey = myPosEn ? myPosEn[0] : null;

                        const canAccept =
                          hasPosition &&
                          !isChallCreator &&
                          myPKey !== chall.creatorPKey &&
                          chall.status === "pending";

                        return (
                          <div
                            key={chall.id}
                            className={cn(
                              "p-2.5 rounded-xl border flex flex-col gap-2 transition-all",
                              chall.status === "pending"
                                ? "bg-white/5 border-white/5"
                                : chall.status === "accepted"
                                  ? "bg-brand-gold/5 border-brand-gold/20 shadow-md"
                                  : "bg-white/5 border-white/5 opacity-85",
                            )}
                          >
                            <div className="flex items-center justify-between">
                              <span className="text-[8px] font-mono text-gray-500">
                                {new Date(chall.at).toLocaleTimeString([], {
                                  hour: "2-digit",
                                  minute: "2-digit",
                                })}
                              </span>
                              {chall.status === "pending" ? (
                                <span className="text-[7px] bg-brand-red text-white px-1.5 py-0.5 rounded-full font-black uppercase tracking-wide animate-pulse">
                                  DÉFI OUVERT
                                </span>
                              ) : chall.status === "accepted" ? (
                                <span className="text-[7px] bg-brand-gold text-brand-black px-1.5 py-0.5 rounded-full font-black uppercase tracking-wide">
                                  DUEL EN COURS
                                </span>
                              ) : (
                                <span className="text-[7px] bg-gray-500 text-black px-1.5 py-0.5 rounded-full font-black uppercase tracking-wide">
                                  DUEL CLOS
                                </span>
                              )}
                            </div>

                            <div className="text-[9px] font-bold text-gray-300 leading-normal uppercase">
                              {chall.status === "pending" && (
                                <p>
                                  <span className="text-brand-red font-black font-mono">
                                    {chall.creatorPKey}
                                  </span>{" "}
                                  ({chall.creatorDisplayName}) mise{" "}
                                  <span className="text-brand-gold font-mono font-black">
                                    {formatFCFA(chall.stake)}
                                  </span>{" "}
                                  sur son souffle.
                                </p>
                              )}
                              {chall.status === "accepted" && (
                                <p>
                                  <span className="text-brand-red font-black font-mono">
                                    {chall.creatorPKey}
                                  </span>{" "}
                                  ({chall.creatorDisplayName}) VS{" "}
                                  <span className="text-brand-gold font-black font-mono">
                                    {chall.accepterPKey}
                                  </span>{" "}
                                  ({chall.accepterDisplayName}) <br />
                                  Cagnotte :{" "}
                                  <span className="text-brand-gold font-mono font-black">
                                    {formatFCFA(chall.stake * 2)}
                                  </span>
                                  {chall.autoAcceptedByAdmin && (
                                    <span className="ml-2 text-[7.5px] bg-brand-gold/15 text-brand-gold border border-brand-gold/30 px-1.5 py-0.5 rounded font-bold uppercase">
                                      ⚡ Débité Admin
                                    </span>
                                  )}
                                </p>
                              )}
                              {chall.status === "resolved" && (
                                <div>
                                  {chall.winnerUid === null ? (
                                    <p className="text-brand-gold">
                                      🤝 ÉGALITÉ PARFAITE ! Le duel est
                                      remboursé ({formatFCFA(chall.stake)})
                                    </p>
                                  ) : chall.winnerUid === user?.uid ? (
                                    <p className="text-green-400 font-extrabold animate-pulse">
                                      🎉 VOUS AVEZ GAGNÉ LE DUEL ! +
                                      {formatFCFA(chall.wonAmount)}
                                    </p>
                                  ) : (
                                    <p className="text-gray-400">
                                      🏆 VAINQUEUR :{" "}
                                      <span className="text-brand-gold font-mono">
                                        {chall.winnerPKey}
                                      </span>{" "}
                                      (
                                      {chall.winnerUid === chall.creatorUid
                                        ? chall.creatorDisplayName
                                        : chall.accepterDisplayName}
                                      ) ({formatFCFA(chall.wonAmount)})
                                    </p>
                                  )}
                                </div>
                              )}
                            </div>

                            {/* Action Button */}
                            {chall.status === "pending" && (
                              <div className="flex justify-end gap-1.5 pt-1 border-t border-white/5">
                                {isChallCreator ? (
                                  <button
                                    onClick={() => cancelChallenge(chall.id)}
                                    className="px-2.5 py-1 rounded bg-brand-red/10 text-brand-red hover:bg-brand-red hover:text-white font-black uppercase text-[8px] transition-all cursor-pointer"
                                  >
                                    Annuler mon défi
                                  </button>
                                ) : canAccept ? (
                                  <button
                                    onClick={() => acceptChallenge(chall.id)}
                                    className="px-2.5 py-1 rounded bg-brand-gold text-brand-black hover:scale-105 font-black uppercase text-[8px] transition-all cursor-pointer"
                                  >
                                    Relever le défi (-{chall.stake} F)
                                  </button>
                                ) : (
                                  <span className="text-[7.5px] text-gray-600 font-black uppercase italic">
                                    En attente d'adversaire...
                                  </span>
                                )}
                              </div>
                            )}
                          </div>
                        );
                      })
                  )}
                </div>
              </motion.div>
            )}

            {/* CREATOR ACTION BUTTONS */}
            {user?.uid === room?.creatorId && (
              <>
                {room.status === "created" && isFull && (
                  <motion.button
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    onClick={
                      room.mode === "Expert"
                        ? async () => {
                            await updateDoc(doc(db, "rooms", room.id), {
                              status: "secondary_bets",
                              updatedAt: serverTimestamp(),
                            });
                            toast.success("Phase de Paris Défi (P vs P) ouverte !");
                          }
                        : executeOracleTeams
                    }
                    className="w-full bg-brand-gold hover:bg-brand-gold/90 text-brand-black py-4 rounded-2xl font-black italic text-lg uppercase shadow-[0_0_40px_rgba(255,184,0,0.3)] border-b-4 border-black/20 flex items-center justify-center gap-3 active:translate-y-1 active:border-b-0 transition-all mt-4 shrink-0 cursor-pointer"
                  >
                    <Play size={24} fill="currentColor" />{" "}
                    {room.mode === "Expert"
                      ? "LANCER LA PHASE DE PARIS DEFI (P VS P)"
                      : "APPELER L'ORACLE & PARIS P VS P"}
                  </motion.button>
                )}

                {room.status === "secondary_bets" && (
                  <motion.button
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    onClick={startSimulation}
                    className="w-full bg-brand-gold hover:bg-brand-gold/90 text-brand-black py-4 rounded-2xl font-black italic text-lg uppercase shadow-[0_0_40px_rgba(255,184,0,0.3)] border-b-4 border-black/20 flex items-center justify-center gap-3 active:translate-y-1 active:border-b-0 transition-all mt-4 shrink-0 cursor-pointer"
                  >
                    <Play size={24} fill="currentColor" /> AFFICHER LES SCORES
                    DES ÉQUIPES
                  </motion.button>
                )}
              </>
            )}
          </div>
        </div>

        {/* Right Column: EQUIPES logic removed as it does not belong here */}


        {/* Floating Chat Button */}
        <button className="fixed bottom-6 right-6 w-14 h-14 bg-brand-gold text-brand-black rounded-full shadow-2xl flex items-center justify-center hover:scale-110 active:scale-95 transition-all z-50 group border-4 border-black shadow-[0_0_20px_rgba(255,184,0,0.4)]">
          <motion.div
            animate={{ scale: [1, 1.1, 1] }}
            transition={{ repeat: Infinity, duration: 2 }}
          >
            <Zap size={24} fill="currentColor" />
          </motion.div>
          <span className="absolute bottom-full right-0 mb-4 whitespace-nowrap bg-brand-gold text-brand-black font-black text-[8px] px-3 py-1.5 rounded-xl border-4 border-black opacity-0 group-hover:opacity-100 transition-opacity uppercase italic tracking-widest shadow-2xl">
            Chat salon
          </span>
        </button>

        {/* Overlays */}
        <AnimatePresence>
          {confirmingPos && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-[100] bg-brand-black/80 backdrop-blur-md flex items-center justify-center p-4"
            >
              <motion.div
                initial={{ scale: 0.9, y: 20 }}
                animate={{ scale: 1, y: 0 }}
                exit={{ scale: 0.9, y: 20 }}
                className="bg-black/80 border border-white/10 rounded-3xl p-8 max-w-md w-full shadow-2xl text-center space-y-6"
              >
                <div className="w-16 h-16 bg-brand-gold/20 rounded-full flex items-center justify-center mx-auto border border-brand-gold/30">
                  <Wallet className="text-brand-gold" size={32} />
                </div>
                <div className="space-y-4">
                  <div className="space-y-2">
                    <h3 className="text-xl font-black uppercase italic text-white tracking-tight">
                      Confirmation d'inscription
                    </h3>
                    <p className="text-xs text-gray-400 font-medium leading-relaxed">
                      Pour valider votre inscription dans ce salon, vous devez
                      miser le montant requis par le créateur de la salle :
                    </p>
                  </div>

                  <div className="bg-black/60 border border-brand-gold/30 rounded-2xl p-5 shadow-inner">
                    <p className="text-[10px] font-bold text-gray-500 uppercase">
                      MONTANT DE LA MISE
                    </p>
                    <p className="text-2xl font-mono font-black text-brand-gold mt-1">
                      {formatFCFA(room.stakePerPosition)}
                    </p>
                    <p className="text-[8px] text-gray-500 font-bold uppercase mt-1">
                      Débité de votre solde
                    </p>
                  </div>
                </div>

                <div className="flex gap-3">
                  <button
                    onClick={() => setConfirmingPos(null)}
                    className="flex-1 py-4 rounded-2xl bg-white/5 border border-white/10 text-white font-black uppercase italic hover:bg-white/10 transition-all active:scale-95"
                  >
                    NON
                  </button>
                  <button
                    onClick={executeJoin}
                    className="flex-1 py-4 rounded-2xl bg-brand-gold text-brand-black font-black uppercase italic shadow-lg shadow-brand-gold/20 hover:bg-brand-gold/90 transition-all active:scale-95"
                  >
                    OUI
                  </button>
                </div>
              </motion.div>
            </motion.div>
          )}

          {room.status === "simulating" && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-[60] bg-brand-black/95 backdrop-blur-xl flex flex-col items-center justify-center p-10 text-center"
            >
              <div className="w-32 h-32 border-[12px] border-brand-red border-t-transparent rounded-full animate-spin mb-12 shadow-[0_0_50px_rgba(239,68,68,0.3)]" />
              <h3 className="text-5xl font-black italic mb-4 tracking-tighter text-white uppercase">
                SIMULATION ORACLE
              </h3>
              <p className="text-brand-gold font-black uppercase tracking-[0.3em] text-sm animate-pulse italic">
                L'IA analyse les tactiques et génère les scores...
              </p>
            </motion.div>
          )}
        </AnimatePresence>

        {room?.status === "results" && (
          <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-40 w-full max-w-lg px-4">
            <motion.div
              initial={{ y: 50, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              className="space-y-3"
            >
              <div className="card bg-brand-gold text-brand-black border-none text-center p-6 shadow-[0_0_50px_rgba(255,184,0,0.4)]">
                <TrophyIcon
                  className="mx-auto mb-2 text-brand-black"
                  size={32}
                />
                <h4 className="text-2xl font-black uppercase italic tracking-tighter">
                  FIN DE PARTIE
                </h4>
                <p className="font-bold text-xs uppercase tracking-widest">
                  Le gagnant a été crédité du cash
                </p>
              </div>
              <button
                onClick={() => navigate("/")}
                className="w-full h-14 bg-white/10 hover:bg-white/20 text-white rounded-2xl font-black italic uppercase border border-white/10 transition-all backdrop-blur-md"
              >
                RETOURNER AU LOBBY
              </button>
            </motion.div>
          </div>
        )}
      </div>
    </div>
  );
}

function Trophy(props: any) {
  return (
    <svg
      {...props}
      xmlns="http://www.w3.org/2000/svg"
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="lucide lucide-trophy"
    >
      <path d="M6 9H4.5a2.5 2.5 0 0 1 0-5H6" />
      <path d="M18 9h1.5a2.5 2.5 0 0 0 0-5H18" />
      <path d="M4 22h16" />
      <path d="M10 14.66V17c0 .55-.47.98-.97 1.21C7.85 18.75 7 20.24 7 22" />
      <path d="M14 14.66V17c0 .55.47.98.97 1.21C16.15 18.75 17 20.24 17 22" />
      <path d="M18 2H6v7a6 6 0 0 0 12 0V2Z" />
    </svg>
  );
}
