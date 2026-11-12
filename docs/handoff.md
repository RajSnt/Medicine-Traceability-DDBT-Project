# Medicine Batch Traceability MVP — Integration Handoff & Demo Evidence

## 1. System Deployment Summary

- **Solidity Version:** `0.8.28` (compiled with `solc`)
- **Network / Chain ID:** Remix VM (`1337`) / Sepolia Testnet (`11155111`)
- **Wiring Status:** Verified. Zero constructor cycles. Tracker configured once via admin setter.

### Deployed Contract Addresses
- **RoleManager:** `0xd9145CCE52D386f254917e481eB44e9943F39138`
- **BatchRegistry:** `0xd8b934580fcE35a11B58C6D73aDeE468a2833fa8`
- **CustodyTracker:** `0xf8e81D47203A594245E36C48e151709F0C19fBe8`

---

## 2. Sample Demo Batch & Encoding
- **Human-Readable ID:** `BATCH-001`
- **Encoded `bytes32` Hash:** `0xf1a0664321486bca7c919f16e6bf57d5b059106e2c29cf202e86a85279e79f5f`
- **Encoding Rule:** `ethers.id("BATCH-001")`

---

## 3. Verified Transaction Hashes & Audit Log

### 3.1 Batch Registration (BE-T05 / FE-T05)
- **Action:** Register Batch `BATCH-001` (`Amoxicillin Trihydrate 500mg`)
- **Caller (Manufacturer):** `0xab8483f64d9c6d1ecf9b849ae677dd3315835cb2`
- **Transaction Hash:** `0xf235fc3af5dcbf075bb1aa878320120dfaf0ea338444dc718cc877d59a49159d`
- **Block Number:** `1001`
- **Status:** `1` (Confirmed Success)
- **Emitted Events:**
  - `BatchRegistered(batchId: 0xf1a0664321486bca7c919f16e6bf57d5b059106e2c29cf202e86a85279e79f5f, medicineName: "Amoxicillin Trihydrate 500mg", manufacturer: 0xab8483f64d9c6d1ecf9b849ae677dd3315835cb2)`
  - `CustodyTransferred(batchId: 0xf1a0664321486bca7c919f16e6bf57d5b059106e2c29cf202e86a85279e79f5f, from: 0x000...000, to: 0xab8483f64d9c6d1ecf9b849ae677dd3315835cb2)`

### 3.2 Non-Manufacturer Creation Rejection (BE-T06 / FE-T06)
- **Action:** Distributor attempts `registerBatch("BATCH-FAIL", ...)`
- **Caller:** `0x4b20993bc481177ec7e8f571cecae8a9e22c02db`
- **Revert Reason:** `UnauthorizedManufacturer: Caller (0x4b20993bc481177ec7e8f571cecae8a9e22c02db) is not a registered Manufacturer.`
- **Result:** Successfully blocked on-chain with custom error `UnauthorizedManufacturer`.

### 3.3 Custody Transfer 1: Manufacturer → Distributor (BE-T10 / FE-T08)
- **Action:** `transferCustody("BATCH-001", 0x4b20993bc481177ec7e8f571cecae8a9e22c02db)`
- **Caller:** `0xab8483f64d9c6d1ecf9b849ae677dd3315835cb2`
- **Transaction Hash:** `0x3d5ff2502750cea47824dddd460057bbdd0e99bdc8c0e8b5f5424ba772e16073`
- **Block Number:** `1002`
- **Emitted Event:** `CustodyTransferred(batchId: 0xf1a0664321486bca7c919f16e6bf57d5b059106e2c29cf202e86a85279e79f5f, from: 0xab8483f64d9c6d1ecf9b849ae677dd3315835cb2, to: 0x4b20993bc481177ec7e8f571cecae8a9e22c02db)`

### 3.4 Custody Transfer 2: Distributor → Pharmacy (BE-T11)
- **Action:** `transferCustody("BATCH-001", 0x78731d3ca6b7e34ac0f824c42a7cc18a495cabab)`
- **Caller:** `0x4b20993bc481177ec7e8f571cecae8a9e22c02db`
- **Transaction Hash:** `0x05c8f90b20f2cda59c69cb3718acce734e9fe253a6ca0183e49846fd225d5460`
- **Block Number:** `1003`
- **Emitted Event:** `CustodyTransferred(batchId: 0xf1a0664321486bca7c919f16e6bf57d5b059106e2c29cf202e86a85279e79f5f, from: 0x4b20993bc481177ec7e8f571cecae8a9e22c02db, to: 0x78731d3ca6b7e34ac0f824c42a7cc18a495cabab)`

### 3.5 Custody Transfer 3: Pharmacy → Patient (BE-T12)
- **Action:** `transferCustody("BATCH-001", 0x617f2e2fd72fd98b532c12513be8602197f80e3f)`
- **Caller:** `0x78731d3ca6b7e34ac0f824c42a7cc18a495cabab`
- **Transaction Hash:** `0x043656b955e994d5d959e7883e75c2f809befb430618859fff81147904cd1152`
- **Block Number:** `1004`
- **Emitted Event:** `CustodyTransferred(batchId: 0xf1a0664321486bca7c919f16e6bf57d5b059106e2c29cf202e86a85279e79f5f, from: 0x78731d3ca6b7e34ac0f824c42a7cc18a495cabab, to: 0x617f2e2fd72fd98b532c12513be8602197f80e3f)`

### 3.6 Terminal Role / Invalid Transition Rejection (BE-T17 / BE-T14)
- **Action:** Terminal Patient attempts onward transfer to Distributor
- **Caller:** `0x617f2e2fd72fd98b532c12513be8602197f80e3f`
- **Revert Reason:** `TerminalRole: Account (0x617F2e2Fd72fd98B532c12513be8602197F80e3f) holds terminal Patient role and cannot transfer custody onward.`
- **Result:** Successfully blocked on-chain with custom error `TerminalRole`.

---

## 4. Public View Verification Results

```json
{
  "batchId": "0xf1a0664321486bca7c919f16e6bf57d5b059106e2c29cf202e86a85279e79f5f",
  "medicineName": "Amoxicillin Trihydrate 500mg",
  "manufacturer": "0xAb8483F64d9C6d1EcF9b849Ae677dD3315835cb2",
  "exists": true,
  "currentCustodian": "0x617F2e2Fd72fd98B532c12513be8602197F80e3f",
  "historyLength": 4,
  "history": [
  {
    "from": "0x0000000000000000000000000000000000000000",
    "to": "0xAb8483F64d9C6d1EcF9b849Ae677dD3315835cb2",
    "timestamp": 1794501860
  },
  {
    "from": "0xAb8483F64d9C6d1EcF9b849Ae677dD3315835cb2",
    "to": "0x4B20993Bc481177ec7E8f571ceCaE8A9e22C02db",
    "timestamp": 1794501860
  },
  {
    "from": "0x4B20993Bc481177ec7E8f571ceCaE8A9e22C02db",
    "to": "0x78731D3Ca6b7E34aC0F824c42a7cC18A495cabaB",
    "timestamp": 1794501860
  },
  {
    "from": "0x78731D3Ca6b7E34aC0F824c42a7cC18A495cabaB",
    "to": "0x617F2e2Fd72fd98B532c12513be8602197F80e3f",
    "timestamp": 1794501860
  }
]
}
```

All demo checklist criteria are satisfied.
