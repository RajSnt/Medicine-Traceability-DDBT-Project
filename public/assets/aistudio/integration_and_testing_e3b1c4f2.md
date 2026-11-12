# Medicine Batch Traceability MVP — End-to-End Build, Integration & Testing Guide

> **Purpose:** The single chronological execution guide for building the backend and frontend, connecting them, testing the complete system, and preparing the final university demonstration.
>
> **Time limit:** Two days.
>
> **Scope lock:** Implement only batch creation, custody transfer, and public authenticity/history verification. Do not add features outside these three functions.

---

## 1. Final system and responsibility split

### Actors

- **Admin:** Deploys/configures the system and registers the four actor addresses.
- **Manufacturer:** Creates a medicine batch and initially owns its custody.
- **Distributor:** Receives custody from the manufacturer and transfers it to the pharmacy.
- **Pharmacy:** Receives custody from the distributor and transfers it to the patient.
- **Patient:** Receives custody; terminal role for this MVP.
- **Public visitor:** Reads batch authenticity and custody history without needing a write role.

### Contract modules

| File/contract | Responsibility |
|---|---|
| `RoleManager.sol` | Admin and actor role assignments |
| `BatchRegistry.sol` | Batch registration, batch details and existence/authenticity lookup |
| `CustodyTracker.sol` | Initial custodian, custody transfers, transfer history and events |

### Frontend modules

| File/component | Responsibility |
|---|---|
| `WalletConnect.tsx` | Connect MetaMask, show account and network |
| `CreateBatchForm.tsx` | Submit batch registration |
| `TransferCustodyForm.tsx` | Submit custody transfer |
| `VerifyBatch.tsx` | Read batch status and render custody history |
| `lib/contracts.ts` | Contract addresses, ABIs and chain ID |
| `lib/contractCalls.ts` | Reusable ethers.js contract calls |

---

## 2. Freeze the interface before parallel development

Do this first. Frontend and backend must use the same names, types, and data structures.

### 2.1 Agree on these decisions

- [ ] Solidity compiler version supported by Remix (select and pin one stable 0.8.x release).
- [ ] Batch ID representation: recommended `bytes32`, generated in frontend with `ethers.id("BATCH-001")`.
- [ ] Required batch fields: keep to batch ID, medicine name, and minimal metadata.
- [ ] Custody path: Manufacturer → Distributor → Pharmacy → Patient.
- [ ] Patient cannot transfer onward.
- [ ] Whether the initial manufacturer custody is represented as a history entry or as the initial current-custodian state. Choose one representation and use it consistently.
- [ ] Exact return shape for batch details and custody history.
- [ ] Exact event signature and indexed fields.
- [ ] Target network for the shared demo: Remix VM first; Sepolia if time permits.

### 2.2 Suggested API contract

Use these suggested names or document the team's replacements before frontend coding:

```solidity
// RoleManager
registerRole(address account, Role role)
getRole(address account) view returns (Role)
hasRole(address account, Role role) view returns (bool)

// BatchRegistry
registerBatch(bytes32 batchId, string medicineName, string batchMetadata)
batchExists(bytes32 batchId) view returns (bool)
getBatch(bytes32 batchId) view returns (Batch)

// CustodyTracker
transferCustody(bytes32 batchId, address to)
getCustodyHistory(bytes32 batchId) view returns (CustodyRecord[])
```

The registry and custody tracker also need a restricted integration path for initializing the manufacturer's custody. Do not expose that path to arbitrary users.

**Important integration design check:** Avoid a constructor dependency cycle. Decide the deployment wiring before writing all constructors. A straightforward option is to deploy `RoleManager`, deploy `BatchRegistry`, deploy `CustodyTracker` with the registry and role manager addresses, then configure the tracker address in the registry through a one-time admin-only setter. If using this approach, the setter must reject a second configuration and batch registration must be disabled until configuration is complete. Another valid design is acceptable if it avoids circular constructor dependencies and is kept simple.

### 2.3 Interface handoff

- [ ] Backend writes the agreed signatures and struct layouts here.
- [ ] Backend shares provisional ABI early, then final ABI after compilation.
- [ ] Frontend confirms it can call each function using ethers.js.
- [ ] Both owners agree on one sample batch ID and its exact encoding.

---

## 3. Day 1 — Build the backend and frontend foundation

### Step 1 — Create the project folders

Create a shared repository or project folder:

```text
medicine-traceability/
├── contracts/
│   ├── RoleManager.sol
│   ├── BatchRegistry.sol
│   ├── CustodyTracker.sol
│   └── interfaces/
├── frontend/
│   ├── app/
│   ├── components/
│   ├── lib/
│   └── abi/
└── docs/
    ├── frontend_tasks.md
    ├── backend_tasks.md
    └── integration_and_testing.md
```

- [ ] Create folders.
- [ ] Add the two task tracker files and this integration guide under `docs/` (or keep them at repository root if simpler).
- [ ] Confirm both developers can access the same agreed API notes.

**Expected result:** Both workstreams have a clear place for code and shared documentation.

### Step 2 — Backend: implement role management

1. Open Remix IDE at `https://remix.ethereum.org`.
2. In **File Explorer**, create `RoleManager.sol`.
3. Define the role enum and deployer-admin state.
4. Implement admin-only `registerRole`, plus public role lookup/check functions.
5. Use custom errors and NatSpec.
6. Select the chosen Solidity 0.8.x compiler in **Solidity Compiler**.
7. Click **Compile RoleManager.sol**.

**Expected result:** The contract compiles and the deployer is the admin. Admin can assign Manufacturer, Distributor, Pharmacy, and Patient roles.

### Step 3 — Backend: implement batch registry

1. Create `BatchRegistry.sol`.
2. Add the role-manager interface/reference.
3. Define the minimum batch struct and mapping.
4. Implement manufacturer-only `registerBatch`.
5. Implement `batchExists` and `getBatch`.
6. Add the restricted custody-initialization integration described in Section 2.2.
7. Compile the contract.

**Expected result:** A registered manufacturer can create a unique batch; a non-manufacturer and duplicate ID are rejected.

### Step 4 — Backend: implement custody tracker

1. Create `CustodyTracker.sol`.
2. Add the role and batch-existence interfaces/references.
3. Define the custody record struct and per-batch history storage.
4. Implement the registry-only initial-custody setup.
5. Implement current-custodian-only `transferCustody`.
6. Validate the recipient role and allowed next step.
7. Append the custody record and emit `CustodyTransferred`.
8. Implement public `getCustodyHistory`.
9. Compile all Solidity files together.

**Expected result:** Valid transfers work in order; invalid roles and non-current custodians are rejected; each successful transfer emits an event.

### Step 5 — Frontend: initialize Next.js

In a terminal:

```bash
npx create-next-app@latest frontend
```

Suggested prompts:
- TypeScript: Yes
- ESLint: Yes
- Tailwind: optional
- App Router: Yes
- `src/` directory: optional; be consistent
- Import alias: default is fine

Then:

```bash
cd frontend
npm install ethers
npm run dev
```

Open the local URL printed by Next.js, usually `http://localhost:3000`.

**Expected result:** A running Next.js page.

### Step 6 — Frontend: create the minimal UI and wallet connection

1. Create the three page sections: Create Batch, Transfer Custody, Verify Batch.
2. Add a Connect Wallet button.
3. In client-side code, detect `window.ethereum`.
4. Use ethers.js v6 `BrowserProvider` to connect to MetaMask.
5. Display the connected address and chain ID.
6. Handle account and chain changes.
7. Do not call `window` during server rendering.

**Expected result:** MetaMask connects and the UI displays the active account and network.

### Step 7 — Day 1 interface sync

Before ending Day 1:

- [ ] Backend shares the current contract signatures, ABI if available, role enum values, and struct shapes.
- [ ] Frontend creates the contract configuration/helper files using the agreed API.
- [ ] Both developers confirm the batch ID encoding.
- [ ] Resolve the deployment/wiring approach.
- [ ] Do not proceed with guessed function names or field order.

**Day 1 exit criteria:** All three contracts compile; frontend runs and connects to MetaMask; API and data structures are agreed.

---

## 4. Day 2 — Deploy, integrate, and test

### Step 8 — Deploy backend to Remix VM first

1. In Remix, open **Deploy & Run Transactions**.
2. Under **Environment**, choose **Remix VM**.
3. Select the admin/deployer account.
4. Deploy `RoleManager`.
5. Copy its deployed address.
6. Deploy `BatchRegistry` using the `RoleManager` address in its constructor, if required by the implementation.
7. Deploy `CustodyTracker` using the agreed constructor arguments.
8. Complete any one-time admin-only contract wiring.
9. Record all deployed addresses.

**Expected result:** All contracts are deployed in the local Remix VM and their cross-contract references are configured.

### Step 9 — Register actor roles

Use separate Remix VM accounts to represent each actor.

1. Keep the admin account selected.
2. Expand `RoleManager`.
3. Call `registerRole` for the manufacturer address and select the Manufacturer enum value.
4. Repeat for distributor, pharmacy, and patient.
5. Call `getRole` for each address to confirm the assignments.

**Expected result:** Each test address returns its expected role.

### Step 10 — Export ABI and deployment configuration

1. In Remix, open each compiled contract in the compiler/deployment interface.
2. Copy/download the ABI from the compilation details.
3. Add the ABI JSON files to `frontend/abi/`.
4. Put the deployed addresses and target chain ID in one frontend configuration file.
5. Confirm the ABI matches the exact deployed contract version.

Example configuration shape (replace placeholders with actual values):

```ts
export const CONTRACTS = {
  chainId: 0, // replace with actual chain ID
  roleManager: "0x...",
  batchRegistry: "0x...",
  custodyTracker: "0x...",
};
```

**Expected result:** Frontend can instantiate each contract using the correct ABI, address, and network.

### Step 11 — Connect frontend to the contracts

1. Create a read provider using the configured RPC/provider strategy.
2. Create signer-connected contract instances for write operations.
3. Use the signer for `registerBatch` and `transferCustody`.
4. Use read-only calls for `batchExists`, `getBatch`, and `getCustodyHistory`.
5. Check the connected chain ID before enabling write actions.
6. Convert the human-readable sample batch ID using the agreed encoding, e.g. `ethers.id("BATCH-001")` for `bytes32`.
7. Wait for each write transaction receipt before showing success.
8. Refresh history after a confirmed custody transfer.

**Expected result:** The frontend can read contract data and submit the two state-changing workflows.

### Step 12 — Implement the three user flows

#### Flow A: Create batch

1. Connect MetaMask using the manufacturer account.
2. Enter the batch ID and required medicine fields.
3. Submit the form.
4. Approve the transaction in MetaMask.
5. Wait for confirmation.
6. Display success and transaction hash.

**Expected result:** `batchExists(batchId)` returns true and `getBatch(batchId)` returns the submitted data.

#### Flow B: Transfer custody

1. Keep the manufacturer account selected.
2. Enter the sample batch ID and distributor address.
3. Submit and confirm the transaction.
4. Switch MetaMask to the distributor account.
5. Enter the same batch ID and pharmacy address.
6. Submit and confirm.
7. Switch to the pharmacy account.
8. Enter the same batch ID and patient address.
9. Submit and confirm.

**Expected result:** Each transfer succeeds only from the current custodian and a new custody record/event is created each time.

#### Flow C: Verify batch and history

1. Open the Verify Batch section.
2. Enter the sample batch ID.
3. Click Verify.
4. Read the batch existence/authenticity result.
5. Read the custody history.
6. Display records in chronological order.

**Expected result:** Anyone can see the registered batch and its complete custody path without needing a role or write transaction.

---

## 5. Required test plan

Run the tests below in the listed environments. Remix VM is the fastest place to validate Solidity behavior. Then repeat the critical end-to-end scenarios against Sepolia if the team deploys there.

### 5.1 Backend contract tests — Remix

| ID | Test | Procedure | Expected result |
|---|---|---|---|
| BE-01 | Admin assignment | Deploy RoleManager | Deployer has Admin role |
| BE-02 | Register roles | Admin registers all four actor addresses | Each role lookup is correct |
| BE-03 | Non-admin role assignment | Non-admin calls `registerRole` | Reverts with custom authorization error |
| BE-04 | Manufacturer registration | Manufacturer calls `registerBatch` with new ID | Batch created |
| BE-05 | Unauthorized registration | Distributor calls `registerBatch` | Reverts |
| BE-06 | Duplicate registration | Register same ID twice | Second call reverts |
| BE-07 | First custodian | Create a batch | Manufacturer is current/initial custodian |
| BE-08 | Manufacturer transfer | Manufacturer transfers to distributor | Succeeds; history/event updated |
| BE-09 | Distributor transfer | Distributor transfers to pharmacy | Succeeds; history/event updated |
| BE-10 | Pharmacy transfer | Pharmacy transfers to patient | Succeeds; history/event updated |
| BE-11 | Non-custodian transfer | Old custodian or unrelated account attempts transfer | Reverts |
| BE-12 | Invalid transition | Attempt a disallowed role jump | Reverts |
| BE-13 | Zero recipient | Transfer to zero address | Reverts |
| BE-14 | Unknown batch | Transfer an unregistered batch ID | Reverts |
| BE-15 | Patient terminal role | Patient attempts another transfer | Reverts |
| BE-16 | Public authenticity | Read existing and unknown batch IDs | Existing=true; unknown=false/not found |
| BE-17 | Public history | Read history from an unrelated account | Full chronological history returned |
| BE-18 | Event audit | Inspect logs for successful transfers | One `CustodyTransferred` event per successful transfer |
| BE-19 | Failed transfer integrity | Attempt a failing transfer and reread history | No new history record |

### 5.2 Frontend tests

| ID | Test | Procedure | Expected result |
|---|---|---|---|
| FE-01 | MetaMask detection | Open app without MetaMask | Clear install/enable message; no crash |
| FE-02 | Wallet connection | Connect and approve MetaMask | Account and chain shown |
| FE-03 | Rejected connection | Reject MetaMask prompt | Cancellation handled cleanly |
| FE-04 | Wrong network | Connect on a different chain | Warning shown; writes disabled |
| FE-05 | Valid batch form | Submit as manufacturer | Transaction confirms and success shown |
| FE-06 | Wrong-role batch form | Submit as non-manufacturer | Revert shown; no false success |
| FE-07 | Valid transfer | Submit as current custodian | Transaction confirms |
| FE-08 | Invalid transfer | Submit as non-custodian | Revert shown |
| FE-09 | Invalid address | Enter malformed/zero recipient | Frontend blocks submission |
| FE-10 | Existing batch lookup | Search a registered ID | Authentic/registered result and details shown |
| FE-11 | Unknown batch lookup | Search unknown ID | Not found/not verified shown |
| FE-12 | History rendering | Search after all three transfers | Correct chronological path shown |
| FE-13 | Pending transaction | Leave transaction pending | Loading state and duplicate-submit protection |
| FE-14 | Read error | Use invalid address/RPC | Helpful error shown; app does not crash |
| FE-15 | History refresh | Transfer then refresh page | New history remains visible |

### 5.3 End-to-end acceptance test

Perform this exact sequence with the frontend connected to Remix VM or Sepolia:

1. [ ] Admin registers manufacturer, distributor, pharmacy, and patient.
2. [ ] Manufacturer creates `BATCH-001`.
3. [ ] Verify `BATCH-001` from a separate/public read session.
4. [ ] Manufacturer transfers to distributor.
5. [ ] Distributor transfers to pharmacy.
6. [ ] Pharmacy transfers to patient.
7. [ ] Verify the batch again.
8. [ ] Confirm all custody records appear in the correct order.
9. [ ] Inspect the three transfer transaction logs for `CustodyTransferred`.
10. [ ] Attempt a transfer from an unrelated account and confirm rejection.
11. [ ] Attempt an invalid role transition and confirm rejection.
12. [ ] Verify an unknown batch ID and confirm it is not marked authentic.

**End-to-end pass condition:** All three core functions work, history is complete and chronological, unauthorized writes fail, and public verification works.

---

## 6. Optional final deployment to Sepolia

Do this only after Remix VM tests pass.

1. Open MetaMask.
2. Enable/show the Sepolia test network.
3. Obtain Sepolia test ETH from a reputable Sepolia faucet. Faucet availability and eligibility vary; never send real ETH to obtain test funds.
4. In Remix, select **Deploy & Run Transactions**.
5. Set **Environment** to **Injected Provider - MetaMask**.
6. Approve the Remix connection in MetaMask.
7. Confirm MetaMask is on Sepolia and the expected account is selected.
8. Deploy the contracts in the same order and perform the same wiring as the VM deployment.
9. Register the demo actor addresses.
10. Copy the Sepolia contract addresses and ABIs into the frontend configuration.
11. Set the frontend expected chain ID to Sepolia's chain ID (`11155111`).
12. Repeat the critical create → transfer → verify flow.

**Expected result:** The same MVP works on Sepolia and can be accessed by teammates using the same deployed addresses and network.

---

## 7. Final demonstration script

Keep the live presentation to approximately 4–6 minutes.

1. **Explain the architecture (30 seconds):** RoleManager handles roles, BatchRegistry stores batch details, CustodyTracker records transfers.
2. **Show roles (30 seconds):** Show the admin-registered manufacturer, distributor, pharmacy, and patient accounts.
3. **Create a batch (45 seconds):** Connect as manufacturer and create `BATCH-001`.
4. **Transfer custody (90 seconds):** Transfer manufacturer → distributor → pharmacy → patient, switching MetaMask accounts between transfers.
5. **Verify (60 seconds):** Search `BATCH-001` and show authenticity plus the chronological custody history.
6. **Show auditability and access control (45 seconds):** Point to the emitted `CustodyTransferred` logs and demonstrate a rejected unauthorized transfer.

### Demo backup plan

- [ ] Keep a successful Remix VM deployment available if Sepolia/faucet/network fails.
- [ ] Save contract addresses and sample IDs.
- [ ] Save successful transaction hashes/screenshots.
- [ ] Keep the frontend configured for the deployment currently being demonstrated.
- [ ] Do not claim a transaction succeeded unless its receipt confirms success.

---

## 8. Final project completion checklist

### Backend

- [ ] Three responsibilities separated into contracts/modules.
- [ ] Role assignments are admin-controlled.
- [ ] Only manufacturers create batches.
- [ ] Only current custodians make valid transfers.
- [ ] Role transitions are enforced.
- [ ] Every successful transfer emits the documented event.
- [ ] Public batch and history reads work.
- [ ] Custom errors and NatSpec are present.
- [ ] All required backend tests pass.

### Frontend

- [ ] MetaMask connection and network checks work.
- [ ] Batch creation form works.
- [ ] Custody transfer form works.
- [ ] Public verification/history view works.
- [ ] Transaction pending/success/error states work.
- [ ] All required frontend tests pass.

### Integration and submission

- [ ] Frontend uses final ABIs and correct deployed addresses.
- [ ] Both sides use the same chain ID and batch ID encoding.
- [ ] End-to-end acceptance test passes.
- [ ] README contains install/run instructions.
- [ ] Source code and three Markdown trackers are in the project folder.
- [ ] Demo accounts, sample batch ID, and transaction references are ready.
- [ ] No out-of-scope features were added.

---

## 9. Two-day milestone board

| Milestone | Target | Owner | Status |
|---|---|---|---|
| Interface and data model frozen | Day 1, first hour | Both | Not started |
| RoleManager compiled | Day 1 | Backend | Not started |
| BatchRegistry compiled | Day 1 | Backend | Not started |
| CustodyTracker compiled | Day 1 | Backend | Not started |
| Next.js app and MetaMask connection | Day 1 | Frontend | Not started |
| Contract ABI/interface handed over | Day 1, end | Backend | Not started |
| Remix VM deployment and role setup | Day 2, morning | Backend | Not started |
| Frontend contract integration | Day 2 | Frontend | Not started |
| Required tests and end-to-end flow | Day 2, afternoon | Both | Not started |
| Final demo rehearsal | Day 2, evening | Both | Not started |

Update the status column as the project progresses. Use the frontend and backend task files for detailed subtasks; use this document for the chronological build and integration sequence.
