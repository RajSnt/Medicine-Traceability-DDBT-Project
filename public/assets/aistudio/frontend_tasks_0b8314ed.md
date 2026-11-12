# Medicine Batch Traceability MVP — Frontend Source of Truth

> **Purpose:** Track implementation progress for the React/Next.js frontend of the university DDBT project.
>
> **MVP boundary:** The frontend supports only (1) batch creation by an authorized manufacturer, (2) custody transfer by the current authorized custodian, and (3) public batch authenticity/history verification. Do not add dashboards, inventory, prescriptions, payments, QR scanning, notifications, or other features.

## 1. Frontend responsibility and architecture

The frontend is a thin client. It must not decide whether a batch is authentic or whether a user is authorized; the smart contracts enforce those rules.

```text
User
  |
  v
Next.js UI
  |-- Connect MetaMask / display active account
  |-- Create batch form ----------------------> BatchRegistry
  |-- Transfer custody form ------------------> CustodyTracker
  |-- Verify batch + render history ----------> BatchRegistry + CustodyTracker
  |
  v
ethers.js BrowserProvider / Contract
  |
  v
Deployed Solidity contracts
```

**Frontend stack**
- Next.js (App Router) + React
- TypeScript (recommended for ABI and contract-call safety)
- ethers.js v6
- MetaMask browser extension
- Plain CSS or a minimal styling approach; avoid spending time on a component library

## 2. Shared contract integration agreement

Do not build contract calls against guessed function names. Backend must provide the final ABI and deployed addresses before frontend integration.

### Required backend handoff

- [ ] Final contract names and deployed addresses for the selected network.
- [ ] ABI for `RoleManager`, `BatchRegistry`, and `CustodyTracker` (or the final agreed contract structure).
- [ ] Exact function signatures and parameter order for:
  - [ ] Register/create a batch.
  - [ ] Transfer custody.
  - [ ] Read batch details.
  - [ ] Read full custody history.
  - [ ] Determine whether a batch is authentic/registered.
- [ ] Role identifiers and the contract's authorization rules.
- [ ] Event name and argument layout for custody changes.
- [ ] Network name and chain ID used for the demo.
- [ ] One sample batch ID and sample addresses for the demonstration.

**Integration rule:** Keep ABI and deployed addresses in one configuration module. Do not duplicate addresses across pages or components.

## 3. Task breakdown and progress tracker

Update each checkbox as work is completed. Add a short note under a task if a decision or blocker needs to be recorded.

### FE-0 — Project setup

- [ ] Create the Next.js project.
  - [ ] Initialize with the App Router.
  - [ ] Select TypeScript.
  - [ ] Install `ethers`.
  - [ ] Confirm the development server starts locally.
- [ ] Establish a minimal folder structure.
  - [ ] `app/` — page and route layout.
  - [ ] `components/` — wallet, forms, and history display.
  - [ ] `lib/` — ethers provider, contract configuration, and contract helpers.
  - [ ] `types/` — shared frontend types, if needed.
- [ ] Add a simple page heading and three clearly separated sections: Create Batch, Transfer Custody, Verify Batch.
- [ ] Add a short README note with install and run commands.

**Done when:** The app runs locally and the three core sections are visible.

### FE-1 — Wallet connection

- [ ] Detect whether `window.ethereum` (MetaMask) is available.
  - [ ] If unavailable, show a clear “Install or enable MetaMask” message.
  - [ ] Do not crash during server-side rendering; access `window` only in client-side code.
- [ ] Add a **Connect Wallet** button.
  - [ ] Request accounts using MetaMask.
  - [ ] Create an ethers.js v6 `BrowserProvider`.
  - [ ] Get the signer and active account.
- [ ] Display the connected account in shortened form.
- [ ] Display the current chain ID/network.
- [ ] Handle account changes.
  - [ ] Refresh the displayed account/signer.
- [ ] Handle chain changes.
  - [ ] Refresh network state and warn if it is not the configured deployment network.
- [ ] Add a **Disconnect / reset UI** control only if it can be implemented simply; MetaMask connection permissions are managed by MetaMask itself.

**Done when:** A user can connect MetaMask and the app displays the active address and network without page errors.

### FE-2 — Contract configuration and ethers client

- [ ] Create one contract configuration file.
  - [ ] Store target chain ID.
  - [ ] Store deployed addresses.
  - [ ] Import ABI JSON files or generated ABI constants.
- [ ] Create a provider helper using ethers.js v6.
- [ ] Create a signer-connected contract helper for state-changing calls.
- [ ] Create a read-only contract helper for public verification calls.
- [ ] Check that the wallet is on the expected network before enabling write actions.
- [ ] Show a useful error if a contract address is missing or invalid.
- [ ] Keep contract access code out of presentation components where practical.

**Done when:** The frontend can instantiate all required contract interfaces from the agreed ABI and addresses.

### FE-3 — Create medicine batch

- [ ] Build a minimal form using only fields required by the backend batch model.
  - [ ] Batch identifier, if entered by the user rather than generated by the contract.
  - [ ] Medicine name.
  - [ ] Manufacturer details/address, only if required by the contract.
  - [ ] Any other required batch metadata confirmed by backend.
- [ ] Validate required fields before sending a transaction.
- [ ] Ensure the connected wallet is the manufacturer account registered by the admin.
- [ ] Call the backend's batch-registration function using the signer.
- [ ] Show transaction-pending state while MetaMask is open/mining.
- [ ] Wait for transaction confirmation.
- [ ] Display success and transaction hash after confirmation.
- [ ] Display readable errors for rejected transactions, missing role, duplicate batch, or invalid input.
- [ ] Clear the form only after confirmed success.

**Done when:** An authorized manufacturer can register one batch and the UI reports the confirmed transaction.

### FE-4 — Transfer custody

- [ ] Build a minimal transfer form.
  - [ ] Batch ID.
  - [ ] Recipient address.
- [ ] Validate the batch ID and recipient address using ethers utilities.
- [ ] Call the backend custody-transfer function with the connected signer.
- [ ] Show transaction-pending state.
- [ ] Wait for confirmation.
- [ ] Display success and transaction hash.
- [ ] Handle contract reverts, including unauthorized sender, invalid recipient, unknown batch, or any backend-defined transition restriction.
- [ ] Refresh the displayed batch history after a successful transfer.

**Done when:** The current authorized custodian can transfer a batch to the next party and the confirmed transfer appears in history.

### FE-5 — Verify authenticity and custody history

- [ ] Build a read-only verification form with a Batch ID input.
- [ ] Call the contract's public batch lookup.
- [ ] Call the contract's custody-history lookup.
- [ ] Display whether the batch is registered/authentic according to the contract.
- [ ] If no batch exists, show **Not found / Not verified**; do not infer authenticity from user-entered text.
- [ ] Render the custody history in chronological order.
  - [ ] From address.
  - [ ] To address.
  - [ ] Timestamp/block time, if stored or derivable from the event.
  - [ ] Transaction/event reference, if available.
- [ ] Clearly label the manufacturer registration and each subsequent custody change.
- [ ] Handle empty history and read errors.
- [ ] Allow anyone to use this section without connecting a wallet, if the selected RPC/provider setup supports read-only access.

**Done when:** A visitor can enter a batch ID and see its contract-backed authenticity result and full recorded custody history.

### FE-6 — UI states, errors, and usability

- [ ] Provide loading states for reads and transactions.
- [ ] Disable duplicate submission while a transaction is pending.
- [ ] Show actionable error messages without exposing raw stack traces.
- [ ] Distinguish wallet/network errors from contract reverts.
- [ ] Make read-only verification available independently of write permissions.
- [ ] Keep layout usable on a laptop and mobile screen.
- [ ] Do not add features outside the three agreed functions.

**Done when:** The three flows are understandable and do not leave the user guessing whether a transaction succeeded.

### FE-7 — Integration and demo readiness

- [ ] Import final ABIs and addresses from backend handoff.
- [ ] Confirm frontend and contracts use the same chain ID.
- [ ] Test with the admin, manufacturer, distributor, pharmacy, and patient accounts supplied for the demo.
- [ ] Confirm unauthorized accounts cannot complete write actions.
- [ ] Confirm a patient/other visitor can read verification history.
- [ ] Confirm the UI refreshes history after a transfer.
- [ ] Prepare a short demo sequence and sample data.
- [ ] Record any known limitations for the presentation.

**Done when:** The complete three-function demo works from the frontend against the deployed contracts.

## 4. Suggested frontend file structure

```text
frontend/
├── app/
│   ├── layout.tsx
│   ├── page.tsx
│   └── globals.css
├── components/
│   ├── WalletConnect.tsx
│   ├── CreateBatchForm.tsx
│   ├── TransferCustodyForm.tsx
│   └── VerifyBatch.tsx
├── lib/
│   ├── contracts.ts
│   ├── wallet.ts
│   └── contractCalls.ts
├── abi/
│   ├── RoleManager.json
│   ├── BatchRegistry.json
│   └── CustodyTracker.json
└── README.md
```

This is a suggested structure, not a requirement to create empty files upfront. Keep it smaller if the implementation remains readable.

## 5. Two-day frontend execution plan

### Day 1 — UI foundation and wallet

- [ ] FE-0: Project setup.
- [ ] FE-1: MetaMask connection and network display.
- [ ] FE-2: Contract configuration/client helpers (use temporary ABI placeholders only until backend handoff).
- [ ] Build the three page sections and basic forms with agreed field names.
- [ ] Agree the exact contract interface with the backend developer before the end of Day 1.

**Day 1 deliverable:** A running Next.js UI with wallet connection, three basic forms/sections, and an agreed contract interface.

### Day 2 — Contract integration and demo

- [ ] FE-3: Batch registration integration.
- [ ] FE-4: Custody transfer integration.
- [ ] FE-5: Public verification/history integration.
- [ ] FE-6: Pending, success, and error states.
- [ ] FE-7: End-to-end test and demo rehearsal.

**Day 2 deliverable:** A working frontend demo connected to the deployed contracts.

## 6. Frontend acceptance checklist

- [ ] MetaMask connects and shows the active account/network.
- [ ] Manufacturer account can submit a batch registration transaction.
- [ ] Current custodian can submit a custody transfer.
- [ ] Unauthorized account cannot complete a restricted transaction.
- [ ] Anyone can look up a batch and see whether it is registered.
- [ ] Anyone can view the full recorded custody history.
- [ ] A successful transfer appears in the history.
- [ ] UI clearly reports pending, success, and failure states.
- [ ] No out-of-scope functionality has been added.

## 7. Decisions and blockers log

| Date/time | Decision or blocker | Owner | Resolution/status |
|---|---|---|---|
| | | | |
| | | | |
| | | | |

## 8. Final handoff

Before the demo, the frontend owner must provide:
- [ ] Repository/folder location and run instructions.
- [ ] Final contract address configuration.
- [ ] Confirmation of the target network and chain ID.
- [ ] Any known limitations or unresolved issues.
- [ ] A verified demo path from connect → create → transfer → verify.


## 9. Required frontend test cases

Run these manually during the two-day MVP build. Record Pass/Fail and any transaction hash or screenshot evidence.

| ID | Scenario | Steps | Expected result |
|---|---|---|---|
| FE-T01 | MetaMask unavailable | Open the app in a browser without MetaMask | App remains usable; wallet-dependent actions explain that MetaMask is required |
| FE-T02 | Connect wallet | Click **Connect Wallet** and approve in MetaMask | Active address and network are displayed |
| FE-T03 | User rejects connection | Click connect, then reject the MetaMask prompt | App shows a non-crashing cancellation message |
| FE-T04 | Wrong network | Connect on a chain other than the configured deployment chain | Wrong-network warning appears; write actions are disabled |
| FE-T05 | Create valid batch | Connect as registered manufacturer and submit valid batch fields | MetaMask transaction is requested; after confirmation success and transaction hash appear |
| FE-T06 | Create batch as wrong role | Connect as distributor/pharmacy/patient and submit batch form | Contract rejects the transaction; UI displays a readable authorization error |
| FE-T07 | Duplicate batch ID | Submit an already registered batch ID | Contract rejects it; UI does not display false success |
| FE-T08 | Transfer as current custodian | Submit a valid recipient address for an existing batch | Transaction confirms and success is displayed |
| FE-T09 | Transfer as non-custodian | Connect with an account that is not the current custodian and submit transfer | Contract rejects the transaction; UI displays a readable error |
| FE-T10 | Invalid recipient input | Enter malformed or zero address | Frontend validation prevents submission |
| FE-T11 | Verify existing batch | Enter a registered batch ID without connecting a wallet | Authentic/registered status and batch details are displayed |
| FE-T12 | Verify unknown batch | Enter an unregistered batch ID | UI clearly displays not found/not verified |
| FE-T13 | View custody history | Verify a batch after multiple successful transfers | All records appear in oldest-to-newest order with correct from/to values |
| FE-T14 | Refresh after transfer | Complete a transfer, then reload/refresh the history | Newly confirmed custody record remains visible |
| FE-T15 | Pending transaction | Submit a transaction and keep the wallet confirmation/mining pending | Loading state appears and duplicate submission is prevented |
| FE-T16 | RPC/read failure | Temporarily use an unavailable/wrong RPC or invalid contract address | UI shows a read/configuration error instead of crashing |

**Frontend test exit criteria:** FE-T02, FE-T05, FE-T08, FE-T11, FE-T12, and FE-T13 must pass for the demo. Authorization and invalid-input cases FE-T06, FE-T09, and FE-T10 must also be demonstrated or verified in Remix.
