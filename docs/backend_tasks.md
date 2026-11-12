# Medicine Batch Traceability MVP — Backend Source of Truth

> **Purpose:** Track implementation progress for the Solidity smart contracts, Remix deployment, and contract integration handoff.
>
> **MVP boundary:** Implement only (1) batch registration, (2) custody transfer, and (3) public authenticity/history verification. Do not add inventory, expiry alerts, recalls, payments, prescriptions, product sales, QR scanning, or other features.

## 1. Backend responsibility and architecture

The backend is the source of truth. Authorization and custody rules must be enforced by Solidity, not trusted to the frontend.

```text
Admin
  | registers/verifies role assignments
  v
RoleManager
  | exposes role checks
  +------------------------------+
                                 |
Manufacturer -> BatchRegistry   |
                  |              |
                  | batch exists |
                  v              |
              CustodyTracker <---+
                  |
                  +-- emits CustodyTransferred events

Public / frontend
  |-- read batch authenticity and batch details
  +-- read complete custody history
```

### Contract responsibilities

| Module | Responsibility | Must not own |
|---|---|---|
| `RoleManager` | Admin-controlled registration of manufacturer, distributor, pharmacy, and patient addresses; public role lookup/checks | Batch metadata or custody history |
| `BatchRegistry` | Register a batch from an authorized manufacturer; expose batch existence/details | Custody transfer sequence/history |
| `CustodyTracker` | Record transfers from the current custodian to the next party; emit an event; expose history | Role assignment or batch creation |

Use separate contracts with small interfaces. Keep cross-contract dependencies explicit through constructor-injected contract addresses/interfaces. Do not introduce a framework or upgradeability pattern for this MVP.

## 2. Actors and minimum permission model

- **Admin:** One deployer/admin account. Registers role addresses and is the trusted authority for role assignment/batch verification.
- **Manufacturer:** Registers a batch. The first custodian is the manufacturer.
- **Distributor:** Can receive custody and transfer it onward.
- **Pharmacy:** Can receive custody and transfer it onward to the patient.
- **Patient:** Can receive custody. Patient does not need a transfer function for this MVP.
- **Anyone:** Can read batch authenticity and custody history.

**Permission decisions to implement**
- [ ] Only admin can assign or change actor roles.
- [ ] Only an address registered as a manufacturer can create a batch.
- [ ] Only the current custodian can initiate a transfer.
- [ ] Transfer recipient must have an allowed next role according to the agreed flow.
- [ ] Patient is a terminal recipient in the MVP.
- [ ] Read functions are public.
- [ ] A batch is considered authentic only if it exists in `BatchRegistry` and its registration was accepted by the admin-controlled system.

**Suggested allowed flow:** Manufacturer → Distributor → Pharmacy → Patient. Confirm this exact transition rule with the team before coding. Avoid allowing arbitrary role jumps.

## 3. Shared interface contract for frontend

Finalize these details early and send them to the frontend owner. Function names below are suggested; if changed, update this document and the frontend handoff together.

### Suggested public API

**RoleManager**
- `registerRole(address account, Role role)` — admin only.
- `getRole(address account)` — public view.
- `hasRole(address account, Role role)` — public view.

**BatchRegistry**
- `registerBatch(bytes32 batchId, string medicineName, string batchMetadata)` — manufacturer only; stores manufacturer as initial custodian or exposes it for custody initialization.
- `getBatch(bytes32 batchId)` — public view.
- `batchExists(bytes32 batchId)` — public view.

**CustodyTracker**
- `initializeCustody(bytes32 batchId, address manufacturer)` — callable only by the registry/authorized integration path when a batch is registered.
- `transferCustody(bytes32 batchId, address to)` — current custodian only; validates recipient role/transition.
- `getCustodyHistory(bytes32 batchId)` — public view returning recorded transfer entries.

### Suggested data model

- Batch: `batchId`, `medicineName`, `batchMetadata`, `manufacturer`, `createdAt`, `exists`.
- Custody record: `from`, `to`, `timestamp`.
- History order: oldest to newest.
- Batch ID: use `bytes32` consistently. Frontend can convert a human-readable ID with `ethers.id("BATCH-001")`, or backend may choose a string ID. Decide once and share the exact encoding rule.

### Event requirement

- [ ] Emit `CustodyTransferred` for every successful custody change.
- [ ] Include at minimum `batchId`, `from`, `to`, and `timestamp` (or enough data to recover time).
- [ ] Mark indexed fields sensibly, e.g. `batchId`, `from`, and `to`.
- [ ] Document the exact event signature for the frontend/demo.

The event log is the audit trail. The contract's history getter should also return the complete stored history so the frontend can display it simply.

## 4. Task breakdown and progress tracker

Update checkboxes as work is completed. Record interface changes in Section 3 before the frontend integrates.

### BE-0 — Design decisions and setup

- [ ] Confirm Solidity compiler version and pragma.
  - [ ] Use a current stable Solidity 0.8.x compiler supported by Remix (for example, `pragma solidity ^0.8.28;` if that is the compiler selected in Remix).
  - [ ] Pin the same compiler version in Remix and document it.
  - [ ] Reason: Solidity 0.8.x includes built-in arithmetic overflow/underflow checks and is supported by current Remix tooling; a caret pragma allows compatible later 0.8.x versions, so compile with one explicitly selected version for reproducibility.
- [ ] Confirm batch ID representation and encoding.
- [ ] Confirm batch metadata fields; keep them minimal.
- [ ] Confirm exact custody flow and whether a patient may receive custody only.
- [ ] Confirm contract deployment order and constructor dependencies.
- [ ] Confirm function names, argument types, return values, and event signature with frontend owner.

**Done when:** The team has one agreed contract API and no unresolved data-model decisions.

### BE-1 — RoleManager.sol

- [ ] Define a small `Role` enum for `None`, `Admin`, `Manufacturer`, `Distributor`, `Pharmacy`, and `Patient` (or equivalent agreed representation).
- [ ] Store the deployer as the single admin.
- [ ] Add a custom error for unauthorized admin access.
- [ ] Add a custom error for invalid account/role assignment.
- [ ] Implement `registerRole`.
  - [ ] Admin-only.
  - [ ] Reject zero address.
  - [ ] Prevent assigning the admin role to another account if the design requires exactly one admin.
  - [ ] Decide whether role reassignment is permitted; keep the rule explicit.
- [ ] Implement public `getRole`.
- [ ] Implement public `hasRole`.
- [ ] Add NatSpec to public functions and events.
- [ ] Avoid unnecessary role-management features.

**Done when:** Admin can register the four actor types and public calls return the expected role.

### BE-2 — BatchRegistry.sol

- [ ] Define a small interface for the role checks needed from `RoleManager`.
- [ ] Accept the `RoleManager` address in the constructor.
- [ ] Store the minimum batch data.
- [ ] Add custom errors for unauthorized manufacturer, duplicate batch ID, invalid batch ID, and any invalid required field.
- [ ] Implement `registerBatch`.
  - [ ] Require caller role `Manufacturer`.
  - [ ] Require a unique, nonzero batch ID.
  - [ ] Store the caller as manufacturer.
  - [ ] Store creation timestamp.
  - [ ] Initialize custody through the agreed `CustodyTracker` integration.
- [ ] Implement `batchExists`.
- [ ] Implement `getBatch`.
- [ ] Add NatSpec to public functions and events.
- [ ] Keep batch registration separate from custody history logic.

**Done when:** A registered manufacturer can create a unique batch and anyone can read its stored details.

### BE-3 — CustodyTracker.sol

- [ ] Define the minimum interfaces needed to verify batch existence and recipient roles.
- [ ] Accept required contract addresses/interfaces in the constructor.
- [ ] Store a list of custody records per batch ID.
- [ ] Add custom errors for unknown batch, unauthorized current custodian, invalid recipient, and invalid role transition.
- [ ] Implement the registry-only custody initialization path.
  - [ ] Ensure it cannot be called by arbitrary users.
  - [ ] Add the manufacturer as the initial custodian/history entry if that is the agreed representation.
- [ ] Implement `transferCustody`.
  - [ ] Require the batch to exist.
  - [ ] Require `msg.sender` to be the current custodian.
  - [ ] Require a nonzero recipient.
  - [ ] Require recipient role to be the next permitted role.
  - [ ] Append a custody record with timestamp.
  - [ ] Emit `CustodyTransferred`.
- [ ] Implement `getCustodyHistory`.
  - [ ] Public view.
  - [ ] Return all records in chronological order.
- [ ] Add NatSpec to public functions and events.
- [ ] Ensure patient is terminal if the team adopts the suggested flow.

**Done when:** Only the current custodian can transfer a known batch to a permitted next actor, and the history/event are updated.

### BE-4 — Cross-contract integration

- [ ] Confirm constructor wiring and deployment order.
- [ ] Ensure `BatchRegistry` can initialize custody without opening that function to arbitrary callers.
- [ ] Ensure `CustodyTracker` can check batch existence without circular deployment problems.
- [ ] Resolve any circular dependency deliberately.
  - [ ] Preferred simple approach: deploy `RoleManager`, then `CustodyTracker` with the role manager and registry address set through a one-time admin configuration; or use a small registry interface and a controlled setter if needed.
  - [ ] Keep any one-time wiring function admin-only and callable only once.
- [ ] Verify public read calls do not require a signer.
- [ ] Compile all contracts together in Remix.
- [ ] Remove temporary placeholders before final deployment.

**Done when:** All contracts compile and their deployed addresses are wired correctly.

### BE-5 — Remix deployment and role setup

- [ ] Open Remix IDE.
- [ ] Create the Solidity files.
- [ ] Select the chosen Solidity 0.8.x compiler version.
- [ ] Compile all contracts.
- [ ] Deploy to Remix VM first for fast local validation.
- [ ] Record the deployer/admin address.
- [ ] Deploy contracts in the agreed order and wire constructor/configuration addresses.
- [ ] Register manufacturer, distributor, pharmacy, and patient wallet addresses.
- [ ] Copy deployed addresses and ABIs for frontend integration.
- [ ] If using Sepolia:
  - [ ] Switch MetaMask to Sepolia.
  - [ ] Obtain Sepolia test ETH from a reputable faucet.
  - [ ] Connect Remix to MetaMask through **Injected Provider - MetaMask**.
  - [ ] Deploy and record the Sepolia addresses.
- [ ] Never use real funds or mainnet for this university demo.

**Done when:** Contracts are deployed, roles are assigned, and the deployment details are shared with frontend.

### BE-6 — Core scenario verification

Run these manually in Remix; these are scenario checks, not a request to build a test suite.

- [ ] Admin registers all actor addresses.
- [ ] Manufacturer creates a new batch successfully.
- [ ] An unregistered/non-manufacturer account cannot create a batch.
- [ ] Duplicate batch ID is rejected.
- [ ] Manufacturer transfers custody to the registered distributor.
- [ ] Distributor transfers custody to the registered pharmacy.
- [ ] Pharmacy transfers custody to the registered patient.
- [ ] A non-current custodian cannot transfer custody.
- [ ] A recipient with an invalid role/transition is rejected.
- [ ] Patient cannot transfer custody onward if patient is terminal.
- [ ] Public history read returns entries in chronological order.
- [ ] `CustodyTransferred` appears in Remix transaction logs for every successful transfer.
- [ ] Unknown batch returns a clear not-found result/revert, as designed.

**Done when:** All core positive and negative scenarios behave as specified.

### BE-7 — Frontend handoff

- [ ] Export/copy final ABI for each deployed contract.
- [ ] Share contract addresses and target chain ID.
- [ ] Share exact function signatures and parameter order.
- [ ] Share batch ID encoding rule and one example ID.
- [ ] Share event signature and history return structure.
- [ ] Share role registration addresses for the demo.
- [ ] Provide one successful transaction hash for registration and each custody transfer.
- [ ] Confirm public read functions work without a connected signer.

**Done when:** Frontend can integrate without guessing any Solidity interface detail.

## 5. Suggested backend file structure

```text
contracts/
├── RoleManager.sol
├── BatchRegistry.sol
├── CustodyTracker.sol
└── interfaces/
    ├── IRoleManager.sol
    ├── IBatchRegistry.sol
    └── ICustodyTracker.sol
```

Use interfaces only where they clarify a real cross-contract dependency. If three small interfaces create unnecessary overhead for this MVP, keep only the interfaces actually needed.

## 6. Two-day backend execution plan

### Day 1 — Contract design and core implementation

- [ ] BE-0: Freeze the data model, role flow, batch ID format, and API.
- [ ] BE-1: Implement and compile `RoleManager`.
- [ ] BE-2: Implement `BatchRegistry`.
- [ ] BE-3: Implement `CustodyTracker`.
- [ ] BE-4: Resolve deployment wiring and compile all contracts together.
- [ ] Send the frontend owner the provisional/final ABI, function signatures, and data structures as early as possible.

**Day 1 deliverable:** All three contracts compile in Remix, and frontend/backend interfaces are agreed.

### Day 2 — Deployment, verification, and integration

- [ ] BE-5: Deploy to Remix VM and assign demo roles.
- [ ] BE-6: Run positive and negative scenario checks.
- [ ] Deploy to Sepolia only if the team needs a persistent shared test deployment and has enough time/test ETH.
- [ ] BE-7: Share ABI, addresses, chain ID, sample IDs, and transaction hashes.
- [ ] Support frontend integration and rehearse the end-to-end demo.

**Day 2 deliverable:** A deployed, role-configured contract system with verified batch creation, custody transfers, and public history reads.

## 7. Deployment notes and demo sequence

### Recommended two-day strategy

1. Build and validate in **Remix VM** first. It is immediate and avoids faucet/network delays.
2. Use **Sepolia** only for the final shared demonstration if time permits.
3. Keep the same contract code and function interfaces across both environments.
4. Save all deployed addresses separately for each network; Remix VM addresses are not Sepolia addresses.

### Demo sequence

1. Connect Remix with the admin account and deploy/wire the contracts.
2. Register manufacturer, distributor, pharmacy, and patient addresses.
3. Switch MetaMask/Remix to the manufacturer account.
4. Register a sample batch, e.g. `BATCH-001` (using the agreed bytes32 encoding if applicable).
5. Switch to the manufacturer account and transfer custody to the distributor.
6. Switch to the distributor account and transfer custody to the pharmacy.
7. Switch to the pharmacy account and transfer custody to the patient.
8. Read the batch details and full custody history from a public view function.
9. Inspect transaction logs and confirm a `CustodyTransferred` event for each successful transfer.
10. Attempt a transfer from an account that is not the current custodian and show the authorization failure.

## 8. Backend acceptance checklist

- [ ] Contracts are separated by responsibility.
- [ ] Admin alone manages role assignments.
- [ ] Only a registered manufacturer can register a batch.
- [ ] Only the current custodian can transfer custody.
- [ ] Recipient role/transition is validated.
- [ ] Every successful custody change emits an auditable event.
- [ ] Anyone can read batch existence/details and full custody history.
- [ ] Custom errors are used instead of revert strings.
- [ ] Public functions and events have NatSpec comments.
- [ ] All contracts compile with the documented Solidity compiler.
- [ ] Remix demo scenarios pass.
- [ ] Final ABI, addresses, chain ID, and interface details are shared with frontend.

## 9. Decisions and blockers log

| Date/time | Decision or blocker | Owner | Resolution/status |
|---|---|---|---|
| | | | |
| | | | |
| | | | |

## 10. Final handoff

Before the demo, the backend owner must provide:
- [ ] Solidity source files.
- [ ] Compiler version used.
- [ ] Deployment network and chain ID.
- [ ] Deployed addresses for all contracts.
- [ ] ABI files for all frontend-used contracts.
- [ ] Role/account mapping for the demo.
- [ ] Sample batch ID and exact encoding.
- [ ] Successful transaction hashes.
- [ ] Known limitations or unresolved issues.


## 11. Required backend test cases

Run these as manual scenario checks in Remix. Use separate MetaMask accounts or Remix VM accounts to represent the roles.

| ID | Scenario | Caller/input | Expected result |
|---|---|---|---|
| BE-T01 | Deployer becomes admin | Deploy `RoleManager` | Deployer is reported as admin |
| BE-T02 | Admin registers actors | Admin registers manufacturer, distributor, pharmacy, patient | Each address returns the expected role |
| BE-T03 | Non-admin assigns a role | Any non-admin calls `registerRole` | Reverts with the relevant custom authorization error |
| BE-T04 | Reject zero role address | Admin supplies `address(0)` | Reverts with invalid-account error |
| BE-T05 | Manufacturer creates batch | Registered manufacturer submits unused valid batch ID | Batch is stored and reports as existing |
| BE-T06 | Non-manufacturer creates batch | Distributor/pharmacy/patient calls batch registration | Reverts with unauthorized-role error |
| BE-T07 | Duplicate batch ID | Manufacturer registers the same ID twice | Second registration reverts |
| BE-T08 | Invalid batch input | Manufacturer submits zero/invalid ID or required empty field | Reverts with the relevant custom error |
| BE-T09 | Initialize first custodian | Batch registration completes | Manufacturer is recorded as initial custodian |
| BE-T10 | Valid manufacturer-to-distributor transfer | Current manufacturer transfers to registered distributor | Transfer succeeds, history updates, event is emitted |
| BE-T11 | Valid distributor-to-pharmacy transfer | Current distributor transfers to registered pharmacy | Transfer succeeds, history updates, event is emitted |
| BE-T12 | Valid pharmacy-to-patient transfer | Current pharmacy transfers to registered patient | Transfer succeeds, history updates, event is emitted |
| BE-T13 | Non-custodian transfer | An account other than current custodian calls transfer | Reverts with unauthorized-custodian error |
| BE-T14 | Invalid role transition | Manufacturer attempts to transfer directly to patient, or another disallowed jump | Reverts with invalid-transition error |
| BE-T15 | Zero recipient | Current custodian transfers to `address(0)` | Reverts with invalid-recipient error |
| BE-T16 | Unknown batch transfer | Caller attempts transfer for an unregistered batch ID | Reverts with unknown-batch error |
| BE-T17 | Patient is terminal | Patient attempts to transfer custody onward | Reverts with invalid-transition/terminal-role error |
| BE-T18 | Public batch lookup | Any account calls `batchExists` and `getBatch` | Correct batch details are returned without role restriction |
| BE-T19 | Public custody history | Any account calls `getCustodyHistory` | All records are returned oldest to newest |
| BE-T20 | Event audit | Inspect transaction logs after each successful transfer | Exactly one expected `CustodyTransferred` event is emitted per successful transfer |
| BE-T21 | Failed transfer has no record | Attempt an unauthorized/invalid transfer, then read history | No new custody record is added |
| BE-T22 | Batch authenticity check | Query a registered and an unknown batch ID | Registered batch is true; unknown batch is false/not found as designed |

**Backend test exit criteria:** BE-T01–BE-T22 should be checked. At minimum, demonstrate BE-T05, BE-T06, BE-T10–BE-T14, BE-T18–BE-T20 in the final presentation.
