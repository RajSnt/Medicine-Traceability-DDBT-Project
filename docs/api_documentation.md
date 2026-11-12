# Medicine Batch Traceability MVP — API & Contract Interface Specification

> **Version:** 1.0.0 (Frozen MVP Interface)  
> **Compiler:** Solidity `^0.8.28` (Validated with `solc 0.8.38` / pinned `0.8.28` in Remix)  
> **EVM Targets:** Remix VM (Local EVM, Chain ID `1337`) / Ethereum Sepolia Testnet (Chain ID `11155111`)  
> **Client Framework:** React 19 + TypeScript + Vite + ethers.js v6 + Tailwind CSS  
> **Scope Lock:** Limited strictly to: (1) Batch Creation, (2) Custody Transfer, and (3) Public Authenticity & Provenance Verification.

---

## 1. System Deployment Architecture & Wiring

To eliminate constructor dependency cycles between `BatchRegistry` and `CustodyTracker`, the system employs a deterministic 4-step deployment sequence:

```text
Step 1: Deploy RoleManager()
        └── Deployer automatically registered as sole Admin

Step 2: Deploy BatchRegistry(roleManagerAddress)
        └── Batch registration disabled until tracker is configured

Step 3: Deploy CustodyTracker(roleManagerAddress, batchRegistryAddress)
        └── References both contracts directly via constructor

Step 4: Admin calls BatchRegistry.setCustodyTracker(custodyTrackerAddress)
        └── Admin-only, callable exactly once, enables batch registration
```

### Deployed Contract Addresses (Remix VM / Local EVM)

| Contract | Address | Compiler | Verification Status |
|---|---|---|---|
| `RoleManager` | `0xd9145CCE52D386f254917e481eB44e9943F39138` | `^0.8.28` | Verified & Compiled |
| `BatchRegistry` | `0xd8b934580fcE35a11B58C6D73aDeE468a2833fa8` | `^0.8.28` | Verified & Compiled |
| `CustodyTracker` | `0xf8e81D47203A594245E36C48e151709F0C19fBe8` | `^0.8.28` | Verified & Compiled |

### Role / Account Mapping for Evaluation & Demo

| Role | Enum Value | Demo Account Address | Capabilities & Restrictions |
|---|---|---|---|
| `Admin` | `1` | `0x5B38Da6a701c568545dCfcB03FcB875f56beddC4` | Sole deployer; assigns roles, configures custody tracker |
| `Manufacturer` | `2` | `0xAb8483F64d9C6d1EcF9b849Ae677dD3315835cb2` | Registers batches; initial custodian; transfers to Distributor |
| `Distributor` | `3` | `0x4B20993Bc481177ec7E8f571ceCaE8A9e22C02db` | Receives from Manufacturer; transfers to Pharmacy |
| `Pharmacy` | `4` | `0x78731D3Ca6b7E34aC0F824c42a7cC18A495cabaB` | Receives from Distributor; transfers to Patient |
| `Patient` | `5` | `0x617F2E2fD72FD98b532c12513BE8602197f80E3f` | Terminal recipient; cannot transfer custody onward |
| `Public / None` | `0` | Any Ethereum Address | Can read batch authenticity, details, and custody history |

---

## 2. Batch ID Representation & Encoding Rule

All batch identifiers are stored on-chain as `bytes32`.

### Encoding Rule:
Human-readable string identifiers (e.g. `"BATCH-001"`) are encoded using standard keccak-256 via `ethers.id()`:
```ts
const batchId = ethers.id("BATCH-001");
// Returns: "0x34d402123896fa33c2da9f939ff7c030ef1d10e9f193ebc4ea1ec87d4677762a"
```
If a raw 66-character hex string starting with `0x` is provided, it is validated and used directly. Batch IDs cannot be `bytes32(0)` (`0x000...000`).

---

## 3. Data Structures & Events

### 3.1 Batch Struct (`BatchRegistry.sol`)
```solidity
struct Batch {
    bytes32 batchId;          // Unique 32-byte identifier hash
    string medicineName;      // Name of pharmaceutical product
    string batchMetadata;     // Minimal lot, dosage, and expiry metadata
    address manufacturer;     // Address of registered manufacturer
    uint256 createdAt;        // Block timestamp when registered
    bool exists;              // True if batch exists in registry
}
```

### 3.2 CustodyRecord Struct (`CustodyTracker.sol`)
```solidity
struct CustodyRecord {
    address from;             // Previous custodian (0x0 for creation)
    address to;               // New custodian
    uint256 timestamp;        // Block timestamp of transfer
}
```

### 3.3 CustodyTransferred Event (`CustodyTracker.sol`)
Emitted on batch creation and every subsequent custody transfer.
```solidity
event CustodyTransferred(
    bytes32 indexed batchId,  // Indexed batch ID
    address indexed from,     // Indexed previous custodian (0x0 on initial creation)
    address indexed to,       // Indexed recipient custodian
    uint256 timestamp         // Non-indexed block timestamp
);
```

### 3.4 BatchRegistered Event (`BatchRegistry.sol`)
```solidity
event BatchRegistered(
    bytes32 indexed batchId,
    string medicineName,
    address indexed manufacturer,
    uint256 createdAt
);
```

### 3.5 CustodyTrackerConfigured Event (`BatchRegistry.sol`)
```solidity
event CustodyTrackerConfigured(
    address indexed trackerAddress
);
```

### 3.6 RoleAssigned Event (`RoleManager.sol`)
```solidity
event RoleAssigned(
    address indexed account,
    Role indexed role
);
```

---

## 4. Contract Interfaces & Function Specifications

### 4.1 RoleManager (`RoleManager.sol`)

#### `registerRole(address account, Role role)`
- **Access:** Admin only (`msg.sender == admin`).
- **Parameters:**
  - `account` (`address`): Account receiving the role. Reverts with `InvalidAccount()` if `address(0)`.
  - `role` (`Role` enum): Cannot be `Role.Admin` (reverts with `CannotAssignAdminRole()`) or `Role.None` (reverts with `InvalidRole()`).
- **Returns:** None (`void`).
- **Emits:** `RoleAssigned(address indexed account, Role indexed role)`.
- **Reverts:** `UnauthorizedAdmin(address caller)`, `InvalidAccount()`, `CannotAssignAdminRole()`, `InvalidRole()`.

#### `getRole(address account)`
- **Access:** Public `view`.
- **Parameters:**
  - `account` (`address`): Target address.
- **Returns:** `Role` enum (`uint8`: 0 = None, 1 = Admin, 2 = Manufacturer, 3 = Distributor, 4 = Pharmacy, 5 = Patient).

#### `hasRole(address account, Role role)`
- **Access:** Public `view`.
- **Parameters:**
  - `account` (`address`): Target address.
  - `role` (`Role` enum): Role to check.
- **Returns:** `bool` (true if account has role, false otherwise).

#### `admin()`
- **Access:** Public `view`.
- **Returns:** `address` of the deployer administrator.

---

### 4.2 BatchRegistry (`BatchRegistry.sol`)

#### `registerBatch(bytes32 batchId, string calldata medicineName, string calldata batchMetadata)`
- **Access:** Registered `Manufacturer` only.
- **Preconditions:** `custodyTracker != address(0)`.
- **Parameters:**
  - `batchId` (`bytes32`): Non-zero 32-byte identifier hash.
  - `medicineName` (`string`): Non-empty medicine name.
  - `batchMetadata` (`string`): Batch metadata / lot details.
- **State Modifications:**
  - Saves `Batch` in `_batches[batchId]`.
  - Calls `ICustodyTracker(custodyTracker).initializeCustody(batchId, msg.sender)`.
- **Emits:** `BatchRegistered(batchId, medicineName, msg.sender, block.timestamp)`.
- **Reverts:**
  - `TrackerNotConfigured()`: If `custodyTracker` address is not yet set.
  - `UnauthorizedManufacturer(address caller)`: If caller lacks `Role.Manufacturer`.
  - `InvalidBatchId()`: If `batchId == bytes32(0)`.
  - `EmptyMedicineName()`: If `bytes(medicineName).length == 0`.
  - `DuplicateBatch(bytes32 batchId)`: If batch already exists.

#### `batchExists(bytes32 batchId)`
- **Access:** Public `view`.
- **Parameters:** `batchId` (`bytes32`).
- **Returns:** `bool` (true if registered and authentic, false otherwise).

#### `getBatch(bytes32 batchId)`
- **Access:** Public `view`.
- **Parameters:** `batchId` (`bytes32`).
- **Returns:** `Batch` struct tuple:
  - `batchId` (`bytes32`)
  - `medicineName` (`string`)
  - `batchMetadata` (`string`)
  - `manufacturer` (`address`)
  - `createdAt` (`uint256`)
  - `exists` (`bool`)

#### `setCustodyTracker(address _custodyTracker)`
- **Access:** Admin only (`msg.sender == admin`).
- **Restrictions:** Can only be called once.
- **Parameters:** `_custodyTracker` (`address`, non-zero).
- **Emits:** `CustodyTrackerConfigured(address indexed trackerAddress)`.
- **Reverts:** `OnlyAdmin(address caller)`, `TrackerAlreadyConfigured()`, `InvalidAccount()`.

---

### 4.3 CustodyTracker (`CustodyTracker.sol`)

#### `initializeCustody(bytes32 batchId, address manufacturer)`
- **Access:** Restricted to `batchRegistry` address only.
- **Parameters:**
  - `batchId` (`bytes32`): Registered batch ID.
  - `manufacturer` (`address`): Initial manufacturer custodian.
- **State Modifications:**
  - Sets `_currentCustodian[batchId] = manufacturer`.
  - Appends `CustodyRecord(from: address(0), to: manufacturer, timestamp: block.timestamp)` to `_custodyHistory[batchId]`.
- **Emits:** `CustodyTransferred(batchId, address(0), manufacturer, block.timestamp)`.
- **Reverts:** `OnlyRegistry(address caller)`.

#### `transferCustody(bytes32 batchId, address to)`
- **Access:** Active custodian only (`msg.sender == _currentCustodian[batchId]`).
- **Parameters:**
  - `batchId` (`bytes32`): Batch ID.
  - `to` (`address`): Recipient address (non-zero).
- **Enforced Role Transitions:**
  - `Manufacturer` → `Distributor`
  - `Distributor` → `Pharmacy`
  - `Pharmacy` → `Patient`
  - Disallowed jumps (e.g. `Manufacturer` → `Patient`) revert with `InvalidRoleTransition(msg.sender, to)`.
  - Terminal role: If `msg.sender` has `Role.Patient`, reverts with `TerminalRole(msg.sender)`.
- **State Modifications:**
  - Sets `_currentCustodian[batchId] = to`.
  - Appends `CustodyRecord(from: msg.sender, to: to, timestamp: block.timestamp)` to `_custodyHistory[batchId]`.
- **Emits:** `CustodyTransferred(batchId, msg.sender, to, block.timestamp)`.
- **Reverts:**
  - `UnknownBatch(bytes32 batchId)`: If batch does not exist in `BatchRegistry`.
  - `InvalidRecipient()`: If `to == address(0)`.
  - `UnauthorizedCustodian(address caller, address currentCustodian)`: If caller is not current custodian.
  - `TerminalRole(address account)`: If caller is Patient.
  - `InvalidRoleTransition(address from, address to)`: If transition does not match permitted sequence.

#### `getCustodyHistory(bytes32 batchId)`
- **Access:** Public `view`.
- **Parameters:** `batchId` (`bytes32`).
- **Returns:** Array of `CustodyRecord` tuples:
  - `from` (`address`)
  - `to` (`address`)
  - `timestamp` (`uint256`)
  - Returned in strict chronological order (oldest to newest).

#### `getCurrentCustodian(bytes32 batchId)`
- **Access:** Public `view`.
- **Parameters:** `batchId` (`bytes32`).
- **Returns:** `address` of the current custodian (or `address(0)` if uninitialized).

---

## 5. Deprecations & Removed Endpoints

| Old / Discarded Spec | Replacement | Rationale |
|---|---|---|
| String batch IDs in contract storage | `bytes32 batchId` | Conformance with integration guide frozen interface and gas optimization |
| Revert strings (`require(..., "string")`) | Solidity custom errors (`error Name(...)`) | Gas-efficient, deterministic error decoding via ethers v6 Interface |
| Open batch initialization | Restricted `initializeCustody(batchId, manufacturer)` callable solely by `BatchRegistry` | Eliminates arbitrary custodian forging and guarantees atomic registry linkage |
| Direct circular constructors | One-time admin setter `setCustodyTracker()` on `BatchRegistry` | Prevents circular constructor deployment deadlocks |
