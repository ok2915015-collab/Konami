# Architecture des Duels P vs P & Distribution des Cagnottes (Joueur vs Admin & Joueur vs Joueur)

Ce document formalise les règles de fonctionnement, l'attribution financière des cagnottes de duels P vs P et les outils de supervision pour l'administration dans Konamix.

---

## Synthèse du Fonctionnement des Duels P vs P

```
┌─────────────────────────────────────────────────────────────┐
│                    SALLE DE PRÉDICTION                      │
│                  Section « Duels P vs P »                   │
└──────────────────────────────┬──────────────────────────────┘
                               │
               Lancement d'un Défi (Mise: X FCFA)
                               │
               ┌───────────────┴───────────────┐
               │                               │
       [Adversaire: HUMAIN]            [Adversaire: BOT LEVIER ADMIN]
               │                               │
         Statut: En Attente             Statut: Accepté Instantanément
        (Validation manuelle)          (Débit auto admin: -X FCFA)
               │                               │
               └───────────────┬───────────────┘
                               │
                    Fin du Match / Résultats
                               │
               ┌───────────────┴───────────────┐
               │                               │
       [Le Joueur Gagne]               [Le Levier Admin Gagne]
               │                               │
               ▼                               ▼
    Le Joueur Empoche 2x X FCFA        L'ADMINISTRATEUR Empoche 2x X FCFA
    (Sa mise + mise du levier)        (ok2915015@gmail.com)
                                      Récupère sa mise + mise du joueur
```

---

## User Review & Décisions Clés

> [!IMPORTANT]
> Les deux types de duels (contre d'autres humains et contre les leviers de l'admin) sont 100% actifs et opérationnels. En cas de victoire du levier, les 2x la mise reviennent directement au compte de l'administrateur.

- **Décision 1 (Duels Multiples) :** Un joueur peut lancer autant de défis P vs P qu'il le souhaite contre différents leviers ou différents joueurs dans la même salle, à condition d'avoir le solde suffisant.
- **Décision 2 (Acceptation Automatique Admin) :** Lorsqu'un défi cible un levier, il est accepté sans délai par le système pour dynamiser la salle, et le compte admin engage la contrepartie financière.
- **Décision 3 (Attribution 100% Net sans Commission par Défaut) :** Le gagnant du duel remporte la totalité des 2 mises (sans commission déduite sur les duels, la commission de 5% ne s'appliquant qu'à la cagnotte principale de la salle).
- **Décision 4 (Supervision dans le Dashboard Admin) :** Ajout d'un encart dédié dans la console administration pour suivre en direct les gains nets issus des duels remportés par les leviers.

---

## 1. Vue d'Ensemble & Règles Métier

### A. Défi contre un autre Humain
1. Le Joueur A mise 1 000 FCFA pour défier le Joueur B (débit de 1 000 FCFA sur le solde de A).
2. Le Joueur B reçoit une alerte et clique sur **« ACCEPTER LE DÉFI »** (débit de 1 000 FCFA sur le solde de B).
3. À la fin de la simulation :
   - Si A gagne : A reçoit 2 000 FCFA.
   - Si B gagne : B reçoit 2 000 FCFA.
   - Si égalité : A et B sont remboursés de 1 000 FCFA chacun.

### B. Défi contre un Levier Admin (L'Admin)
1. Le Joueur A mise 2 000 FCFA pour défier un bot levier présent dans la salle.
2. Le système accepte immédiatement :
   - Débit de 2 000 FCFA sur le solde du Joueur A.
   - Débit de 2 000 FCFA sur le solde de l'administrateur (`ok2915015@gmail.com`).
3. Cagnotte en jeu sur ce duel : **4 000 FCFA**.
4. À la fin de la simulation :
   - **Si le Levier gagne :** Les 4 000 FCFA sont crédités sur le solde de l'administrateur. L'administration gagne donc 2 000 FCFA nets.
   - **Si le Joueur gagne :** Les 4 000 FCFA sont crédités sur le solde du joueur. L'administration perd sa mise de 2 000 FCFA.
   - **Si égalité :** L'administrateur et le joueur sont remboursés de 2 000 FCFA chacun.

---

## 2. Expérience Utilisateur & Interface

### Interface de Salle (`RoomDetail.tsx`)
- **Badge d'adversaire distinctif :**
  - Contre un levier : badge doré `🛡️ Défi vs Levier Admin (Acceptation Immédiate)`.
  - Contre un joueur : badge bleu `👤 Défi vs Joueur (En attente d'acceptation)`.
- **Récapitulatif des Gains P vs P en fin de match :**
  - Section dédiée sous les scores de fin de partie avec le listing de chaque duel :
    - `Duel #1 vs Levier Alpha : Gagné (+4 000 FCFA)` ou `Perdu (Gain reversé à l'Admin)`.

### Interface Admin (`LeverageControl.tsx`)
- **Compteur « Bénéfices des Duels P vs P » :**
  - Total des duels relevés par les leviers.
  - Taux de victoire des leviers.
  - Bénéfice net cumulé en FCFA reversé sur le compte de l'administrateur.

---

## 3. Architecture Technique

```
┌─────────────────────────────────┐
│     Création Défi P vs P        │
│   (RoomDetail: challengeStake)  │
└────────────────┬────────────────┘
                 │
      Position cible = Bot ?
                 │
         ┌───────┴───────┐
         │ OUI           │ NON
         ▼               ▼
  Auto-acceptation   En attente
  Débit Admin + J    Débit Joueur seul
         │               │
         └───────┬───────┘
                 │
        Résolution en fin
         de match (scores)
                 │
         ┌───────┴───────┐
         │ Levier gagne  │ Joueur gagne
         ▼               ▼
    Crédit Admin   Crédit Joueur
    (2x la mise)    (2x la mise)
```

### Fichiers Concernés :
- `src/pages/RoomDetail.tsx` : Confirmation visuelle des duels et libellés explicites des bénéficiaires de cagnotte.
- `src/components/admin/LeverageControl.tsx` : Suivi statistique des duels disputés par les bots leviers.
- `src/types.ts` : Extension des métadonnées de challenges (`isLeverageChallenge`, `adminNetGain`).
