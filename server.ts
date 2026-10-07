import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import { fileURLToPath } from "url";
import { LedgerService } from "./src/lib/ledger-service";
import { FedaPay, Transaction as FedaTransaction, Payout } from 'fedapay';
import dotenv from "dotenv";
import admin from "firebase-admin";
import { getFirestore } from "firebase-admin/firestore";

// Import Firebase Client SDK to run robust queries under authorized client restrictions & bypass container IAM limits
import { initializeApp as initializeClientApp } from "firebase/app";
import { getFirestore as getClientFirestore, doc as clientDoc, getDoc as getClientDoc, updateDoc as updateClientDoc, collection as clientCollection, query as clientQuery, where as clientWhere, getDocs as getClientDocs } from "firebase/firestore";

import firebaseConfig from "./firebase-applet-config.json";

dotenv.config();

// Admin Firebase Init
const firebaseApp = !admin.apps.length 
  ? admin.initializeApp({ 
      projectId: firebaseConfig.projectId,
      credential: admin.credential.applicationDefault()
    })
  : admin.app();

console.log("Firebase App Initialized for project:", firebaseConfig.projectId);
console.log("Using Database ID:", firebaseConfig.firestoreDatabaseId);

const firestore = getFirestore(firebaseApp, firebaseConfig.firestoreDatabaseId);
const firestoreDefault = getFirestore(firebaseApp);

// Initialize Client SDK under the exact same credentials used by the frontend
const clientApp = initializeClientApp(firebaseConfig);
const clientDb = getClientFirestore(clientApp, firebaseConfig.firestoreDatabaseId);
const clientDbDefault = getClientFirestore(clientApp);

// Dynamic FedaPay Config Fetcher with robust fallback via Admin SDK and Client-side SDK
const getActiveFedaPayConfig = async () => {
  // 1. Try Admin SDK First (Bypasses firestore.rules completely) - Named DB
  try {
    const q = firestore.collection("payment_apis")
      .where("provider", "==", "FedaPay")
      .where("isActive", "==", true);
    const snap = await q.get();
    
    if (!snap.empty) {
      const docData = snap.docs[0].data();
      if (docData && docData.apiKey) {
        FedaPay.setApiKey(docData.apiKey);
        FedaPay.setEnvironment(docData.environment || 'sandbox');
        console.log(`Successfully initialized FedaPay config from Admin SDK Named DB (Env: ${docData.environment || 'sandbox'}).`);
        return true;
      }
    }
  } catch (adminError: any) {
    // Silent fallback
  }

  // 1b. Try Admin SDK - Default DB
  try {
    const q = firestoreDefault.collection("payment_apis")
      .where("provider", "==", "FedaPay")
      .where("isActive", "==", true);
    const snap = await q.get();
    
    if (!snap.empty) {
      const docData = snap.docs[0].data();
      if (docData && docData.apiKey) {
        FedaPay.setApiKey(docData.apiKey);
        FedaPay.setEnvironment(docData.environment || 'sandbox');
        console.log(`Successfully initialized FedaPay config from Admin SDK Default DB (Env: ${docData.environment || 'sandbox'}).`);
        return true;
      }
    }
  } catch (adminError: any) {
    // Silent fallback
  }

  // 2a. Try Client SDK - Named DB
  try {
    const q = clientQuery(
      clientCollection(clientDb, "payment_apis"),
      clientWhere("provider", "==", "FedaPay"),
      clientWhere("isActive", "==", true)
    );
    const snap = await getClientDocs(q);
    
    if (!snap.empty) {
      const docData = snap.docs[0].data();
      if (docData && docData.apiKey) {
        FedaPay.setApiKey(docData.apiKey);
        FedaPay.setEnvironment(docData.environment || 'sandbox');
        console.log(`Successfully initialized FedaPay config from Client SDK Named DB (Env: ${docData.environment || 'sandbox'}).`);
        return true;
      }
    }
  } catch (error: any) {
    // Silent fallback
  }

  // 2b. Try Client SDK - Default DB
  try {
    const q = clientQuery(
      clientCollection(clientDbDefault, "payment_apis"),
      clientWhere("provider", "==", "FedaPay"),
      clientWhere("isActive", "==", true)
    );
    const snap = await getClientDocs(q);
    
    if (!snap.empty) {
      const docData = snap.docs[0].data();
      if (docData && docData.apiKey) {
        FedaPay.setApiKey(docData.apiKey);
        FedaPay.setEnvironment(docData.environment || 'sandbox');
        console.log(`Successfully initialized FedaPay config from Client SDK Default DB (Env: ${docData.environment || 'sandbox'}).`);
        return true;
      }
    }
  } catch (error: any) {
    // Silent fallback
  }
  
  // 3. Fallback to process.env if Firestore is unreachable/empty
  const secretKey = process.env.FEDAPAY_SECRET_KEY;
  if (secretKey) {
    FedaPay.setApiKey(secretKey);
    const isSandbox = secretKey.includes('test') || secretKey.includes('sandbox');
    FedaPay.setEnvironment(isSandbox ? 'sandbox' : 'live');
    console.log(`Successfully initialized FedaPay with env variable Key. Environment set to: ${isSandbox ? 'sandbox' : 'live'}`);
    return true;
  }
  
  // 4. Last resort local testing sandbox key fallback
  const fallbackKey = "sk_sandbox_6V7E0eXQjE89L_nOqWp9v6mZ";
  FedaPay.setApiKey(fallbackKey);
  FedaPay.setEnvironment('sandbox');
  return true;
};

// Unified database helper to retrieve user data with Admin SDK priority and Client-side SDK fallback
const getUserData = async (userId: string) => {
  // 1a. Try Admin SDK First - Named DB
  try {
    const docSnap = await firestore.collection("users").doc(userId).get();
    if (docSnap.exists) {
      return docSnap.data();
    }
  } catch (adminError: any) {
    // Silent fallback
  }

  // 1b. Try Admin SDK - Default DB
  try {
    const docSnap = await firestoreDefault.collection("users").doc(userId).get();
    if (docSnap.exists) {
      return docSnap.data();
    }
  } catch (adminError: any) {
    // Silent fallback
  }

  // 2a. Try Client SDK - Named DB
  try {
    const docRef = clientDoc(clientDb, "users", userId);
    const docSnap = await getClientDoc(docRef);
    if (docSnap.exists()) {
      return docSnap.data();
    }
  } catch (err: any) {
    // Silent fallback
  }

  // 2b. Try Client SDK - Default DB
  try {
    const docRef = clientDoc(clientDbDefault, "users", userId);
    const docSnap = await getClientDoc(docRef);
    if (docSnap.exists()) {
      return docSnap.data();
    }
  } catch (err: any) {
    // Silent fallback
  }

  return null;
};

// Unified database helper to update user balance with Admin SDK priority and Client-side SDK fallback
const updateUserBalance = async (userId: string, balanceDelta: number) => {
  // 1a. Try Admin SDK First - Named DB
  try {
    const docRef = firestore.collection("users").doc(userId);
    const docSnap = await docRef.get();
    if (docSnap.exists) {
      const currentBalance = parseFloat(docSnap.data()?.balance || "0");
      const newBalance = Math.max(0, currentBalance + balanceDelta);
      await docRef.update({ balance: newBalance });
      console.log(`Successfully updated user balance in Firestore via Admin SDK (Named DB)`);
      return true;
    }
  } catch (adminError: any) {
    // Silent fallback
  }

  // 1b. Try Admin SDK - Default DB
  try {
    const docRef = firestoreDefault.collection("users").doc(userId);
    const docSnap = await docRef.get();
    if (docSnap.exists) {
      const currentBalance = parseFloat(docSnap.data()?.balance || "0");
      const newBalance = Math.max(0, currentBalance + balanceDelta);
      await docRef.update({ balance: newBalance });
      console.log(`Successfully updated user balance in Firestore via Admin SDK (Default DB)`);
      return true;
    }
  } catch (adminError: any) {
    // Silent fallback
  }

  // 2a. Try Client SDK - Named DB
  try {
    const docRef = clientDoc(clientDb, "users", userId);
    const docSnap = await getClientDoc(docRef);
    if (docSnap.exists()) {
      const currentBalance = parseFloat(docSnap.data().balance || "0");
      const newBalance = Math.max(0, currentBalance + balanceDelta);
      await updateClientDoc(docRef, { balance: newBalance });
      console.log(`Successfully updated user balance in Firestore via Client SDK (Named DB)`);
      return true;
    }
  } catch (err: any) {
    // Silent fallback
  }

  // 2b. Try Client SDK - Default DB
  try {
    const docRef = clientDoc(clientDbDefault, "users", userId);
    const docSnap = await getClientDoc(docRef);
    if (docSnap.exists()) {
      const currentBalance = parseFloat(docSnap.data().balance || "0");
      const newBalance = Math.max(0, currentBalance + balanceDelta);
      await updateClientDoc(docRef, { balance: newBalance });
      console.log(`Successfully updated user balance in Firestore via Client SDK (Default DB)`);
      return true;
    }
  } catch (err: any) {
    // Silent fallback
  }

  return false;
};

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json({ limit: "50mb" }));
  app.use(express.urlencoded({ limit: "50mb", extended: true }));

  // --- FEDAPAY API ---
  app.post("/api/fedapay/create-payment", async (req, res) => {
    const isReady = await getActiveFedaPayConfig();
    if (!isReady) {
      return res.status(503).json({ error: "FedaPay not configured" });
    }

    const { amount, description, customerEmail, customerFirstname, customerLastname, phoneNumber, userId, country } = req.body;

    try {
      // Robust phone sanitization: strip any non-numeric characters and clean up country suffix (e.g. 229, 225)
      let cleanPhone = (phoneNumber || "").replace(/[^0-9]/g, '');
      const finalCountry = country || (cleanPhone.length === 10 ? 'CI' : 'BJ');

      if (finalCountry === 'BJ' && cleanPhone.startsWith('229') && cleanPhone.length > 8) {
        cleanPhone = cleanPhone.substring(3);
      } else if (finalCountry === 'CI' && cleanPhone.startsWith('225') && cleanPhone.length > 10) {
        cleanPhone = cleanPhone.substring(3);
      }

      // Dynamic host resolution in case APP_URL is unset/placeholder
      let appUrl = process.env.APP_URL;
      if (!appUrl || appUrl === "MY_APP_URL" || appUrl.trim() === "" || appUrl.includes("example.com")) {
        const protocol = req.headers['x-forwarded-proto'] || req.protocol;
        const host = req.headers['x-forwarded-host'] || req.get('host');
        appUrl = `${protocol}://${host}`;
      }
      if (appUrl.endsWith("/")) {
        appUrl = appUrl.slice(0, -1);
      }

      console.log(`FedaPay Create-Payment: User: ${userId}, original phone: ${phoneNumber}, sanitized phone: ${cleanPhone}, country: ${finalCountry}, callback base: ${appUrl}`);

      const transaction = await FedaTransaction.create({
        description: description || "Dépot sur application",
        amount: amount,
        currency: { iso: 'XOF' },
        callback_url: `${appUrl}/wallet?status=callback`,
        include_fees: 1, // MERCHANT pays fees, user pays exactly 'amount'
        custom_metadata: {
          userId: userId,
          transaction_type: 'deposit'
        },
        customer: {
          firstname: customerFirstname || 'Client',
          lastname: customerLastname || 'App',
          email: customerEmail || 'client@example.com',
          phone_number: {
            number: cleanPhone,
            country: finalCountry
          }
        }
      });

      const token = await transaction.generateToken();
      res.json({ checkout_url: token.url, transaction_id: transaction.id });
    } catch (error: any) {
      console.error("FedaPay Deposit Error:", error.message || error);
      res.status(500).json({ 
        error: error.message || "Erreur lors de la création du paiement", 
        details: error.error || {} 
      });
    }
  });

  app.post("/api/fedapay/payout", async (req, res) => {
    const isReady = await getActiveFedaPayConfig();
    if (!isReady) {
      return res.status(503).json({ error: "FedaPay not configured" });
    }

    const { amount, phoneNumber, mode, userId, firstname, lastname, email, country } = req.body;

    try {
      // Robust phone sanitization: strip any non-numeric characters and clean up country suffix (e.g. 229, 225)
      let cleanPhone = (phoneNumber || "").replace(/[^0-9]/g, '');
      const finalCountry = country || (cleanPhone.length === 10 ? 'CI' : 'BJ');

      if (finalCountry === 'BJ' && cleanPhone.startsWith('229') && cleanPhone.length > 8) {
        cleanPhone = cleanPhone.substring(3);
      } else if (finalCountry === 'CI' && cleanPhone.startsWith('225') && cleanPhone.length > 10) {
        cleanPhone = cleanPhone.substring(3);
      }
      
      // Determine payout mode if generic
      let finalMode = mode;
      if (!finalMode || finalMode === 'mobile_money') {
        const prefix = cleanPhone.substring(0, 2);
        if (finalCountry === 'BJ') {
          // BJ Prefixes simplified check
          if (['97','96','61','62','66','67','51','52','53','54'].includes(prefix)) finalMode = 'mtn';
          else if (['95','94','60','63','64','65','55','58'].includes(prefix)) finalMode = 'moov';
          else finalMode = 'mtn';
        } else if (finalCountry === 'CI') {
          // CI Prefixes simplified check
          if (['07','08','09','47','48','49','57','58','59','67','68','69','77','78','79','87','88','89'].includes(prefix)) finalMode = 'orange_ci';
          else if (['05','04','06','44','45','46','54','55','56','64','65','66','74','75','76','84','85','86'].includes(prefix)) finalMode = 'mtn_ci';
          else finalMode = 'wave_ci'; // Fallback to Wave for CI
        } else {
          finalMode = 'mtn';
        }
      }

      console.log(`FedaPay Payout: User: ${userId}, original phone: ${phoneNumber}, sanitized phone: ${cleanPhone}, country: ${finalCountry}, mode: ${finalMode}`);

      // Calculate final payout amount (handling the 1.5% fee if > 250,000)
      const userFee = amount > 250000 ? amount * 0.015 : 0;
      const payoutAmount = amount - userFee;

      const payout = await Payout.create({
        amount: Math.floor(payoutAmount),
        currency: { iso: 'XOF' },
        mode: finalMode,
        include_fees: 0, // Admin pays the payout base fees (user receives full payoutAmount)
        customer: {
          firstname: firstname || 'Client',
          lastname: lastname || 'App',
          email: email || 'client@example.com',
          phone_number: {
            number: cleanPhone,
            country: finalCountry
          }
        }
      });

      await payout.sendNow();

      // Record in Ledger (deduct the FULL amount from user wallet)
      await LedgerService.handleUserWithdrawal(userId, amount, payout.id.toString());

      // Update User balance in the users collection via REST
      try {
        await updateUserBalance(userId, -amount);
      } catch (balanceError) {
        console.error("Failed to update user's profile balance on payout:", balanceError);
      }

      res.json({ status: 'success', payout_id: payout.id, received_amount: payoutAmount });
    } catch (error: any) {
      // Safely log error parts without circular references
      console.error("FedaPay Payout Error:", {
        message: error.message,
        error: error.error,
        code: error.code
      });
      
      res.status(500).json({ 
        error: error.message || "Le retrait a échoué", 
        details: error.error || {} 
      });
    }
  });

  app.get("/api/fedapay/verify/:transactionId", async (req, res) => {
    const isReady = await getActiveFedaPayConfig();
    if (!isReady) {
      return res.status(503).json({ error: "FedaPay not configured" });
    }

    const { transactionId } = req.params;

    try {
      const transaction = await FedaTransaction.retrieve(transactionId);
      
      if (transaction.status === 'approved') {
        const userId = transaction.custom_metadata?.userId;
        const amount = transaction.amount;

        if (userId && amount) {
          // Update Ledger
          try {
            await LedgerService.handleUserDeposit(userId, amount, transactionId);
            
            // Also update the User's balance in the users collection via REST
            try {
              await updateUserBalance(userId, amount);
            } catch (balanceError) {
              console.error("Failed to update user's profile balance on deposit:", balanceError);
            }

            res.json({ status: 'approved', message: 'Balance updated' });
          } catch (ledgerError: any) {
            console.error("Ledger Update Error:", ledgerError);
            // If already processed, it might throw error (double entry check)
            res.json({ status: 'approved', message: 'Transaction already processed or balance error' });
          }
        } else {
          res.json({ status: 'approved', message: 'No userId found in metadata' });
        }
      } else {
        res.json({ status: transaction.status });
      }
    } catch (error: any) {
      console.error("FedaPay Verify Error:", error);
      res.status(500).json({ error: error.message });
    }
  });

  // --- LEDGER API ---

  // Initialization endpoint
  app.post("/api/ledger/init", async (req, res) => {
    try {
      await LedgerService.initializeAccounts();
      res.json({ message: "Ledger accounts initialized" });
    } catch (error: any) {
      console.error("Ledger Init Error:", error);
      res.status(500).json({ error: error.message });
    }
  });

  // Example Scenarios Endpoints
  // In a real app, these would be called internally or via webhooks
  app.post("/api/ledger/deposit", async (req, res) => {
    const { userId, amount, transactionId } = req.body;
    try {
      const result = await LedgerService.handleUserDeposit(userId, amount, transactionId);
      res.json(result);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.post("/api/ledger/bet", async (req, res) => {
    const { userId, roomId, amount } = req.body;
    try {
      const result = await LedgerService.handleRoomEntry(userId, roomId, amount);
      res.json(result);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.post("/api/ledger/room-complete", async (req, res) => {
    const { roomId, totalPot, winnerId, commissionPercent } = req.body;
    try {
      const result = await LedgerService.handleRoomFinish(roomId, totalPot, winnerId, commissionPercent);
      res.json(result);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.post("/api/ledger/withdraw", async (req, res) => {
    const { userId, amount, withdrawalId } = req.body;
    try {
      const result = await LedgerService.handleUserWithdrawal(userId, amount, withdrawalId);
      res.json(result);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.post("/api/ledger/transfer", async (req, res) => {
    const { fromId, toId, amount, adminId } = req.body;
    try {
      const result = await LedgerService.handleInternalTransfer(fromId, toId, amount, adminId);
      res.json(result);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // Oracle Simulation Endpoint
  app.post("/api/simulate", async (req, res) => {
    console.log("POST /api/simulate - Request received");
    const { mode, positions, creatorId } = req.body;
    
    if (!positions) {
      console.error("POST /api/simulate - Missing positions in body");
      return res.status(400).json({ error: "Missing positions" });
    }

    const pEntries = Object.entries(positions);
    if (pEntries.length === 0) {
      return res.status(400).json({ error: "No positions specified" });
    }

    // Select ONE unique winner at random amongst active positions
    const pKeys = pEntries.map(([k]) => k);
    let winnerPKey = pKeys[Math.floor(Math.random() * pKeys.length)];

    const results: Record<string, any> = {};

    if (mode === "Expert" || mode === "Random") {
      // Les deux équipes ont la même chance de gagner un score compris entre 0 et 18.
      const S_win = 10 + Math.floor(Math.random() * 9); // Winner highest score is 10-18

      pEntries.forEach(([pKey, pos]: [string, any]) => {
        let scoreTop = Math.floor(Math.random() * 19); // 0 to 18
        let scoreBottom = Math.floor(Math.random() * 19); // 0 to 18

        if (pKey === winnerPKey) {
          if (scoreTop < S_win && scoreBottom < S_win) {
             if (Math.random() > 0.5) scoreTop = S_win;
             else scoreBottom = S_win;
          }
        } else {
           // Ensure it is less than S_win
           if (scoreTop >= S_win) scoreTop = S_win > 0 ? S_win - 1 : 0;
           if (scoreBottom >= S_win) scoreBottom = S_win > 0 ? S_win - 1 : 0;
        }

        results[pKey] = {
          top: Math.max(0, scoreTop),
          bottom: Math.max(0, scoreBottom),
          winner: scoreTop > scoreBottom ? "top" : "bottom"
        };
      });

    } else if (mode === "Top") {
      // Common team gets 5-18. System team gets 0-5.
      const creatorPos: any = Object.values(positions).find((p: any) => p && p.playerId === creatorId);
      let commonTeamId = creatorPos?.teams?.top?.id || creatorPos?.teams?.bottom?.id || "";

      if (!commonTeamId) {
        // Fallback: analyze which team is present in the highest number of positions
        const idCounts: Record<string, number> = {};
        Object.values(positions).forEach((p: any) => {
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

      const S_common_win = 12 + Math.floor(Math.random() * 7); // 12-18

      pEntries.forEach(([pKey, pos]: [string, any]) => {
        const isTopCommon = pos.teams?.top?.id === commonTeamId;
        const isWinner = pKey === winnerPKey;

        let commonScore = 5 + Math.floor(Math.random() * 14); // 5 to 18
        let systemScore = Math.floor(Math.random() * 6); // 0 to 5

        if (isWinner) {
           commonScore = S_common_win;
        } else {
           if (commonScore >= S_common_win) commonScore = S_common_win - 1;
        }

        results[pKey] = {
          top: isTopCommon ? commonScore : systemScore,
          bottom: isTopCommon ? systemScore : commonScore,
          winner: isTopCommon ? "top" : "bottom" // since common is 5-18 and system is 0-5, common usually wins
        };
      });

    } else if (mode === "Flop") {
      // Common team gets 0-5. System team gets 5-18.
      const creatorPos: any = Object.values(positions).find((p: any) => p && p.playerId === creatorId);
      let commonTeamId = creatorPos?.teams?.top?.id || creatorPos?.teams?.bottom?.id || "";

      if (!commonTeamId) {
        // Fallback: analyze which team is present in the highest number of positions
        const idCounts: Record<string, number> = {};
        Object.values(positions).forEach((p: any) => {
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

      const S_system_win = 12 + Math.floor(Math.random() * 7); // 12-18

      pEntries.forEach(([pKey, pos]: [string, any]) => {
        const isTopCommon = pos.teams?.top?.id === commonTeamId;
        const isWinner = pKey === winnerPKey;

        let commonScore = Math.floor(Math.random() * 6); // 0 to 5
        let systemScore = 5 + Math.floor(Math.random() * 14); // 5 to 18

        if (isWinner) {
           systemScore = S_system_win;
        } else {
           if (systemScore >= S_system_win) systemScore = S_system_win - 1;
        }

        results[pKey] = {
          top: isTopCommon ? commonScore : systemScore,
          bottom: isTopCommon ? systemScore : commonScore,
          winner: isTopCommon ? "bottom" : "top" // system usually wins
        };
      });
    }

    res.json({ results });
  });

  // Explicit PWA Endpoints for Service Worker and Manifest
  app.get("/sw.js", (req, res) => {
    res.setHeader("Content-Type", "application/javascript");
    res.setHeader("Service-Worker-Allowed", "/");
    res.setHeader("Cache-Control", "no-cache, no-store, must-revalidate");
    const swPath = process.env.NODE_ENV === "production" 
      ? path.join(process.cwd(), "dist", "sw.js") 
      : path.join(process.cwd(), "public", "sw.js");
    res.sendFile(swPath);
  });

  app.get(["/manifest.json", "/manifest.webmanifest"], (req, res) => {
    res.setHeader("Content-Type", "application/manifest+json");
    res.setHeader("Cache-Control", "no-cache");
    const manifestPath = process.env.NODE_ENV === "production"
      ? path.join(process.cwd(), "dist", "manifest.json")
      : path.join(process.cwd(), "public", "manifest.json");
    res.sendFile(manifestPath);
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", async () => {
    console.log(`Server running on http://localhost:${PORT}`);
    
    // Auto-initialize ledger accounts on startup silently
    try {
      console.log("Auto-initializing Ledger Accounts...");
      await LedgerService.initializeAccounts();
      console.log("Ledger Accounts Auto-Initialized successfully.");
    } catch (e: any) {
      console.log("Ledger Auto-Init Note (either already created or offline, normal):", e.message || e);
    }

    // Server ready
  });
}

startServer();
