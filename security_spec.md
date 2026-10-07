# Security Specification for Konamix

## 1. Data Invariants
- A User must have a unique UID matching their Auth UID.
- A Room must have 7 positions (P1-P7).
- A Transaction's `userId` must match the requester for creation.
- Only Admins can approve transactions (which would normally trigger a balance update via Cloud Function, but here we assume direct client update for demo if not using functions, wait, the instructions say "Default to server-side" for keys, but for Firestore we use rules).
- Users cannot modify their own balance directly.
- Room status transitions must be linear (created -> simulating -> results).

## 2. The "Dirty Dozen" Payloads (Anti-Patterns to block)
1. **Balance Spoofing**: User A updates their own `balance` to 1,000,000.
2. **Identity Theft**: User A creates a Room with `creatorId = User B`.
3. **Role Escalation**: User A sets their `role` to 'admin' during profile creation.
4. **Shadow Field Injection**: Adding `isVerified: true` to a Room doc.
5. **ID Poisoning**: Creating a Room with a $1.5$KB string as ID.
6. **Self-Approval**: User A updates their own Transaction status to 'approved'.
7. **Negative Bet**: Creating a Room with `stakePerPosition = -5000`.
8. **Orphaned Room**: Creating a Room without a valid `creatorId`.
9. **History Rewriting**: Changing `createdAt` timestamp on a User doc.
10. **State Skipping**: Updating Room status from `created` directly to `finished`.
11. **Winner Injection**: User A updates Room `winnerId` as a player before simulation finishes.
12. **PII Leak**: Non-admin reading another user's full profile including potential private info.

## 3. Test Runner Concept
The `firestore.rules.test.ts` will verify these are blocked.
