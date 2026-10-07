import { v4 as uuidv4 } from "uuid";
import { doc, getDoc, writeBatch, serverTimestamp } from "firebase/firestore";
import { db } from "./firebase";

// Secret key matching firestore.rules
const LEDGER_SECRET = "KONAMIX_LEDGER_SECRET_2026";

export type LedgerAccountType = "ASSET" | "LIABILITY" | "EQUITY" | "REVENUE" | "EXPENSE";
export type LedgerEntryType = "DEBIT" | "CREDIT";

export interface LedgerTransactionEntry {
  accountId: string;
  type: LedgerEntryType;
  amount: number;
}

/**
 * Double-Entry Bookkeeping Service using Firebase Web Client SDK for reliability in this environment
 */
export class LedgerService {
  /**
   * Initializes the 7 core ledger accounts
   */
  static async initializeAccounts() {
    const accounts = [
      { id: "REAL_TREASURY", name: "Trésorerie Réelle / Agrégateur", type: "ASSET" },
      { id: "USER_WALLET", name: "Portefeuille Utilisateur", type: "LIABILITY" },
      { id: "ROOM_ESCROW", name: "Séquestre des Salles/Cagnottes", type: "LIABILITY" },
      { id: "ADMIN_REVENUE", name: "Revenus Konamix", type: "REVENUE" },
      { id: "WITHDRAWAL_FEE_POOL", name: "Frais de Retrait", type: "REVENUE" },
      { id: "MARKETING_POOL", name: "Budget Marketing & Parrainage", type: "EXPENSE" },
      { id: "AGGREGATOR_FEE_POOL", name: "Frais Agrégateur - Charge", type: "EXPENSE" },
    ];

    const batch = writeBatch(db);

    for (const acc of accounts) {
      const docRef = doc(db, "ledger_accounts", acc.id);
      
      // We use set with merge to avoid zeroing out existing balances
      batch.set(docRef, {
        id: acc.id,
        name: acc.name,
        type: acc.type,
        balance: 0,
        secret: LEDGER_SECRET,
        updatedAt: serverTimestamp()
      }, { merge: true });
    }

    await batch.commit();
  }

  /**
   * Records a double-entry transaction
   */
  static async recordTransaction(
    description: string,
    entries: LedgerTransactionEntry[],
    reference?: { type: string; id: string; userId?: string }
  ) {
    const totalDebits = entries
      .filter((e) => e.type === "DEBIT")
      .reduce((sum, e) => sum + e.amount, 0);
    const totalCredits = entries
      .filter((e) => e.type === "CREDIT")
      .reduce((sum, e) => sum + e.amount, 0);

    if (Math.abs(totalDebits - totalCredits) > 0.001) {
      throw new Error(`Invalid transaction: Debits (${totalDebits}) and Credits (${totalCredits}) must balance.`);
    }

    const txRef = uuidv4();

    // 1. Fetch current balances via Client SDK
    const accountIds = Array.from(new Set(entries.map((e) => e.accountId)));
    const accountData: Record<string, any> = {};

    for (const id of accountIds) {
      const docRef = doc(db, "ledger_accounts", id);
      const docSnap = await getDoc(docRef);
      if (docSnap.exists()) {
        const data = docSnap.data();
        accountData[id] = {
          type: data.type,
          balance: parseFloat(data.balance || 0)
        };
      } else {
        // Fallback or dynamic initialization config
        accountData[id] = {
          type: id === "REAL_TREASURY" ? "ASSET" : "LIABILITY",
          balance: 0
        };
      }
    }

    // 2. Prepare Atomic Commit using writeBatch
    const batch = writeBatch(db);
    const updatedAccountIds = new Set<string>();

    for (const entry of entries) {
      if (updatedAccountIds.has(entry.accountId)) continue;

      const accInfo = accountData[entry.accountId];
      const accountEntries = entries.filter(e => e.accountId === entry.accountId);
      let balanceDelta = 0;

      for (const ae of accountEntries) {
        if (["ASSET", "EXPENSE"].includes(accInfo.type)) {
          balanceDelta += ae.type === "DEBIT" ? ae.amount : -ae.amount;
        } else if (["LIABILITY", "EQUITY", "REVENUE"].includes(accInfo.type)) {
          balanceDelta += ae.type === "CREDIT" ? ae.amount : -ae.amount;
        }
      }

      const newBalance = accInfo.balance + balanceDelta;

      if (entry.accountId === "USER_WALLET" && newBalance < 0) {
        throw new Error("Solde insuffisant pour cette opération.");
      }

      const docRef = doc(db, "ledger_accounts", entry.accountId);
      batch.set(docRef, {
        balance: newBalance,
        secret: LEDGER_SECRET,
        updatedAt: serverTimestamp()
      }, { merge: true });

      updatedAccountIds.add(entry.accountId);
    }

    // Journal/Transactions logs
    for (const entry of entries) {
      const entryId = uuidv4();
      const docRef = doc(db, "ledger_transactions", entryId);
      batch.set(docRef, {
        id: entryId,
        transactionRef: txRef,
        accountId: entry.accountId,
        type: entry.type,
        amount: entry.amount,
        description: description,
        referenceType: reference?.type || "manual",
        referenceId: reference?.id || "manual",
        userId: reference?.userId || "",
        secret: LEDGER_SECRET,
        createdAt: serverTimestamp()
      });
    }

    await batch.commit();

    return { transactionRef: txRef };
  }

  // --- BUSINESS SCENARIOS ---

  static async handleUserDeposit(userId: string, amount: number, transactionId: string) {
    const estimatedFee = amount * 0.01; // Estimate 1% FedaPay fee paid by admin
    const netTreasury = amount - estimatedFee;

    return this.recordTransaction(
      `Dépôt utilisateur ${userId} via MM (Frais admin)`,
      [
        { accountId: "USER_WALLET", type: "CREDIT", amount },
        { accountId: "AGGREGATOR_FEE_POOL", type: "DEBIT", amount: estimatedFee },
        { accountId: "REAL_TREASURY", type: "DEBIT", amount: netTreasury },
      ],
      { type: "deposit", id: transactionId, userId }
    );
  }

  static async handleRoomEntry(userId: string, roomId: string, amount: number) {
    return this.recordTransaction(
      `Mise utilisateur ${userId} salle ${roomId}`,
      [
        { accountId: "USER_WALLET", type: "DEBIT", amount },
        { accountId: "ROOM_ESCROW", type: "CREDIT", amount },
      ],
      { type: "room", id: roomId, userId }
    );
  }

  static async handleRoomFinish(roomId: string, totalPot: number, winnerId: string, commissionPercent: number) {
    const commissionAmount = (totalPot * commissionPercent) / 100;
    const winnerGain = totalPot - commissionAmount;

    return this.recordTransaction(
      `Fermeture salle ${roomId} - Pot ${totalPot}`,
      [
        { accountId: "ROOM_ESCROW", type: "DEBIT", amount: totalPot },
        { accountId: "USER_WALLET", type: "CREDIT", amount: winnerGain },
        { accountId: "ADMIN_REVENUE", type: "CREDIT", amount: commissionAmount },
      ],
      { type: "room", id: roomId, userId: winnerId }
    );
  }

  static async handleUserWithdrawal(userId: string, amount: number, withdrawalId: string) {
    // Admin pays base withdrawal fees.
    // Above 250,000 XOF, user pays 1.5% fee.
    const userFee = amount > 250000 ? amount * 0.015 : 0;
    const netAmountToUser = amount - userFee;
    const estimatedAggregatorFee = 100; // Flat estimate 100 XOF for payout fee
    const totalOutflowFromTreasury = netAmountToUser + estimatedAggregatorFee;

    return this.recordTransaction(
      `Retrait utilisateur ${userId} (Seuil 250k: ${userFee > 0 ? "Frais 1.5%" : "Gratuit"})`,
      [
        { accountId: "USER_WALLET", type: "DEBIT", amount: amount },
        { accountId: "AGGREGATOR_FEE_POOL", type: "DEBIT", amount: estimatedAggregatorFee },
        { accountId: "WITHDRAWAL_FEE_POOL", type: "CREDIT", amount: userFee },
        { accountId: "REAL_TREASURY", type: "CREDIT", amount: totalOutflowFromTreasury },
      ],
      { type: "withdrawal", id: withdrawalId, userId }
    );
  }

  static async handleInternalTransfer(fromId: string, toId: string, amount: number, adminId: string) {
    return this.recordTransaction(
      `Transfert interne de ${fromId} vers ${toId}`,
      [
        { accountId: fromId, type: "DEBIT", amount },
        { accountId: toId, type: "CREDIT", amount },
      ],
      { type: "manual", id: "transfer", userId: adminId }
    );
  }
}
