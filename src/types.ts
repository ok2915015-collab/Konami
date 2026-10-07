export type Mode = "Expert" | "Random" | "Top" | "Flop";
export type RoomStatus = "created" | "selecting" | "waiting" | "secondary_bets" | "countdown" | "simulating" | "results" | "finished" | "partie_terminee";
export type TransactionStatus = "pending" | "approved" | "rejected" | "cancelled";
export type TransactionType = "deposit" | "withdrawal" | "bonus" | "admin_adjustment";
export type KYCStatus = "none" | "pending" | "verified" | "rejected";

export interface User {
  uid: string;
  email: string;
  displayName: string;
  photoURL: string;
  balance: number;
  role: "admin" | "user";
  createdAt: any;
  phoneNumber?: string;
  username?: string;
  gender?: "homme" | "femme";
  postalCode?: string;
  address?: string;
  contactEmail?: string;
  isBanned?: boolean;
  kycStatus?: KYCStatus;
  kycPhotoUrl?: string;
  stats?: {
    totalGames: number;
    wonGames: number;
  };
  referralCode?: string;
  referredBy?: string;
  referralsCount?: number;
  bonusBalance?: number;
  totalBonusReceived?: number;
  lastBonusDate?: any;
  lastBonusReason?: string;
}

export interface Team {
  id: string;
  name: string;
  logo: string;
  league: string;
}

export interface Position {
  playerId: string | null;
  displayName?: string;
  isBot: boolean;
  isLeverage?: boolean; // Added for leverage tracking
  filledBy?: string; // UID of user/admin who placed or filled this bot
  teams: {
    top: Team | null;
    bottom: Team | null;
  };
  score?: {
    top: number;
    bottom: number;
  };
  winner?: "top" | "bottom";
}

export interface Challenge {
  id: string;
  creatorUid: string;
  creatorPKey: string;
  creatorDisplayName: string;
  stake: number;
  status: "pending" | "accepted" | "resolved" | "cancelled";
  targetPKey?: string;
  accepterUid?: string | null;
  accepterPKey?: string;
  accepterDisplayName?: string;
  autoAcceptedByAdmin?: boolean;
  winnerUid?: string | null;
  winnerPKey?: string;
  wonAmount?: number;
  at: number;
  acceptedAt?: number;
}

export interface Room {
  id: string;
  creatorId: string;
  creatorDisplayName?: string;
  mode: Mode;
  stakePerPosition: number;
  totalStake: number;
  status: RoomStatus;
  positions: Record<string, Position>;
  secondaryBets: any[];
  oracleResults?: any;
  winnerId?: string;
  winnerName?: string;
  winnerIsBot?: boolean;
  adminCreditedUid?: string | null;
  commission: number;
  isPrivate: boolean;
  password?: string;
  league?: string;
  maxPlayers?: number;
  createdAt: any;
  updatedAt: any;
  isLeverageActive?: boolean; // Whether leverage rules applied here
  challenges?: Challenge[];
}

export interface Transaction {
  id: string;
  userId: string;
  userName?: string;
  type: TransactionType;
  amount: number;
  status: TransactionStatus;
  method?: string;
  description?: string;
  phoneNumber?: string;
  reference?: string;
  transactionId?: string;
  createdAt: any;
  updatedAt?: any;
  validatedBy?: string;
  rejectionReason?: string;
  provider?: string;
}

export interface AuditLog {
  id: string;
  adminId: string;
  action: string;
  targetId: string;
  details: string;
  createdAt: any;
}

export interface SupportTicket {
  id: string;
  userId: string;
  subject: string;
  message: string;
  status: "open" | "closed";
  createdAt: any;
}

export interface Report {
  id: string;
  reporterId: string;
  targetId: string;
  reason: string;
  createdAt: any;
  status: "pending" | "resolved";
}

export interface AppConfig {
  id: "global";
  minStake?: number;
  maxStake?: number;
  minDeposit: number;
  minWithdrawal: number;
  commissionRate: number;
  leverageEnabled: boolean;
  leverageBudget: number;
  leverageUsedToday: number;
  autoAcceptAdminPvP?: boolean; // When players challenge admin-filled positions, auto-accept and debit admin balance
  leverageRules: {
    lowFilling: boolean;
    maxCapacity: boolean;
    noHighStakes: boolean;
    offPeak: boolean;
    lossAlert: number;
  };
  paymentMethods: {
    wave: { enabled: boolean; number: string; name: string };
    om: { enabled: boolean; number: string; name: string };
    mtn: { enabled: boolean; number: string; name: string };
  };
  treasury: {
    wave: number;
    om: number;
    mtn: number;
  };
  maintenanceMode: boolean;
  referralRate: number; // Percentage for referral commission
  oraclePrice: number;
  updatedAt: any;
}

export interface PaymentMethod {
  id: string;
  name: string;
  logo: string;
  color: string;
  enabled: boolean;
  createdAt: any;
}

export interface PaymentApi {
  id: string;
  provider: string;
  apiKey: string;
  environment: "sandbox" | "live";
  isActive: boolean;
  updatedAt: any;
}

export interface SupportMessage {
  id: string;
  userId: string;
  userName: string;
  userEmail?: string;
  senderId: string;
  senderName: string;
  senderRole: "admin" | "user";
  content: string;
  createdAt: any;
  read: boolean;
  type?: "text" | "bonus" | "alert" | "info";
}
