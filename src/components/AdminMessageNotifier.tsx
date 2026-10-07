import React, { useEffect, useRef } from "react";
import { collection, query, where, onSnapshot, orderBy, limit } from "firebase/firestore";
import { db } from "../lib/firebase";
import { useAuth } from "../contexts/AuthContext";
import { toast } from "sonner";
import { playMetallicNavSound } from "../utils/audio";

export default function AdminMessageNotifier() {
  const { user } = useAuth();
  const initialLoadRef = useRef(true);
  const seenMessageIds = useRef<Set<string>>(new Set());

  useEffect(() => {
    if (!user) {
      initialLoadRef.current = true;
      seenMessageIds.current.clear();
      return;
    }

    const q = query(
      collection(db, "support_messages"),
      where("userId", "==", user.uid),
      orderBy("createdAt", "desc"),
      limit(10)
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      // Avoid firing toast on the first snapshot load
      if (initialLoadRef.current) {
        snapshot.docs.forEach(docSnap => seenMessageIds.current.add(docSnap.id));
        initialLoadRef.current = false;
        return;
      }

      snapshot.docChanges().forEach((change) => {
        if (change.type === "added") {
          const docId = change.doc.id;
          if (seenMessageIds.current.has(docId)) return;
          seenMessageIds.current.add(docId);

          const data = change.doc.data();
          if (data.senderRole === "admin" && data.read === false) {
            playMetallicNavSound();
            toast.info("💬 Nouveau message de l'administration", {
              description: data.content,
              duration: 8000,
              action: {
                label: "Ouvrir",
                onClick: () => {
                  window.dispatchEvent(
                    new CustomEvent("open_support_modal", { detail: { tab: "chat" } })
                  );
                },
              },
            });
          }
        }
      });
    }, (err) => {
      console.warn("Erreur écoute AdminMessageNotifier:", err);
    });

    return () => unsubscribe();
  }, [user]);

  return null;
}
