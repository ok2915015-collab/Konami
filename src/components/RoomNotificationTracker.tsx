import React, { useEffect, useRef } from "react";
import { collection, query, onSnapshot } from "firebase/firestore";
import { db } from "../lib/firebase";
import { useAuth } from "../contexts/AuthContext";
import { Room, RoomStatus } from "../types";
import { toast } from "sonner";
import { playMetallicSound, playTriumphantSound } from "../utils/audio";
import { handleFirestoreError, OperationType } from "../lib/utils";

const getReadableStatus = (status: RoomStatus) => {
  switch (status) {
    case "created":
      return "Créée ! Prête pour l'inscription ⚽";
    case "selecting":
      return "Sélection des Équipes en cours 🏃‍♂️";
    case "waiting":
      return "En attente d'autres joueurs ⏳";
    case "secondary_bets":
      return "Paris Secondaires Ouverts 🎯";
    case "countdown":
      return "Décompte Final Lancé ! Préparez-vous ⏱️";
    case "simulating":
      return "Match en cours de Simulation... 🥅";
    case "results":
      return "Résultats calculés ! Vérifiez votre score 📈";
    case "finished":
    case "partie_terminee":
      return "Partie terminée ! Le vainqueur est couronné 👑";
    default:
      return status;
  }
};

export default function RoomNotificationTracker() {
  const { user } = useAuth();
  const prevRoomsRef = useRef<Record<string, Room>>({});
  const isFirstRunRef = useRef(true);

  useEffect(() => {
    if (!user) {
      prevRoomsRef.current = {};
      isFirstRunRef.current = true;
      return;
    }

    const q = query(collection(db, "rooms"));

    const unsubscribe = onSnapshot(
      q,
      (snap) => {
        const rooms = snap.docs.map((doc) => ({ id: doc.id, ...doc.data() }) as Room);
        
        // Filter rooms relevant to the logged-in user
        const userRooms = rooms.filter((room) => {
          if (room.creatorId === user.uid) return true;
          return Object.values(room.positions || {}).some(
            (pos: any) => pos && pos.playerId === user.uid
          );
        });

        // If it's the first time running (initial loading of rooms), 
        // just prepopulate the cache to prevent notification spam
        if (isFirstRunRef.current) {
          const initialMap: Record<string, Room> = {};
          userRooms.forEach((r) => {
            initialMap[r.id] = r;
          });
          prevRoomsRef.current = initialMap;
          isFirstRunRef.current = false;
          return;
        }

        // Compare each user room to identify changes
        userRooms.forEach((currentRoom) => {
          const prevRoom = prevRoomsRef.current[currentRoom.id];
          const roomCode = currentRoom.id.slice(-6).toUpperCase();

          if (prevRoom) {
            // 1. Detect Room Status Changes
            if (prevRoom.status !== currentRoom.status) {
              toast.success(
                <div className="flex flex-col gap-1 text-left">
                  <span className="font-extrabold text-xs text-white">🏆 Salle #{roomCode} • Changement</span>
                  <span className="text-[11px] text-gray-300">
                    Statut : <span className="font-bold text-brand-gold">{getReadableStatus(currentRoom.status)}</span>
                  </span>
                </div>,
                {
                  duration: 6000,
                  id: `status-${currentRoom.id}-${currentRoom.status}`
                }
              );

              if (currentRoom.status === "finished" || currentRoom.status === "partie_terminee") {
                playTriumphantSound();
              } else {
                playMetallicSound();
              }
            }

            // 2. Detect New Players Joining
            const prevPlayers = new Set<string>();
            Object.values(prevRoom.positions || {}).forEach((pos: any) => {
              if (pos && pos.playerId) {
                prevPlayers.add(pos.playerId);
              }
            });

            Object.values(currentRoom.positions || {}).forEach((pos: any) => {
              if (pos && pos.playerId) {
                // If a player joined that isn't the current user and wasn't in the previous cache
                if (pos.playerId !== user.uid && !prevPlayers.has(pos.playerId)) {
                  toast.success(
                    <div className="flex flex-col gap-1 text-left">
                      <span className="font-extrabold text-xs text-white">⚽ Nouveau joueur inscrit !</span>
                      <span className="text-[11px] text-gray-300 animate-pulse">
                        <span className="font-black text-brand-red uppercase italic">{pos.displayName || "Un champion"}</span> est entré en position dans votre <span className="font-bold">Salle #{roomCode}</span>.
                      </span>
                    </div>,
                    {
                      duration: 6500,
                      id: `join-${currentRoom.id}-${pos.playerId}`
                    }
                  );
                  playMetallicSound();
                }
              }
            });
          } else {
            // Case where the room wasn't in the local cache yet, meaning they either created it 
            // or registered in it on another screen/device, but wait: 
            // if they just joined/registered in this room themselves, we can notify them or just silently cache it.
            // Let's silently cache it to prevent self-trigger on join.
          }
        });

        // Rebuild current map cache for the next snapshot
        const nextPrevRooms: Record<string, Room> = {};
        userRooms.forEach((r) => {
          nextPrevRooms[r.id] = r;
        });
        prevRoomsRef.current = nextPrevRooms;
      },
      (error) => {
        handleFirestoreError(error, OperationType.GET, "rooms");
      }
    );

    return () => unsubscribe();
  }, [user]);

  return null;
}
