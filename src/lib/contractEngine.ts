import { ethers } from 'ethers';
import {
  Role,
  BatchData,
  CustodyRecordData,
  CONTRACT_CONFIG,
  encodeBatchId,
} from './contracts';

export interface SimulatedEvent {
  name: string;
  signature: string;
  args: Record<string, any>;
  transactionHash: string;
  blockNumber: number;
  timestamp: number;
}

export interface SimulatedTransactionReceipt {
  transactionHash: string;
  blockNumber: number;
  from: string;
  to: string;
  status: number; // 1 = success, 0 = reverted
  events: SimulatedEvent[];
}

function toCheckAddress(addr: string): string {
  if (!addr || addr === ethers.ZeroAddress) return ethers.ZeroAddress;
  return ethers.getAddress(addr.toLowerCase());
}

/**
 * Deterministic In-Memory EVM Engine mirroring the Solidity contracts:
 * - RoleManager.sol
 * - BatchRegistry.sol
 * - CustodyTracker.sol
 *
 * Implements the exact same rules, custom error conditions, role transitions,
 * and event signatures defined in the frozen interface.
 */
export class MedicineTraceabilityEngine {
  public admin: string;
  public roleManagerAddress: string;
  public batchRegistryAddress: string;
  public custodyTrackerAddress: string;

  private _roles: Map<string, Role> = new Map();
  private _batches: Map<string, BatchData> = new Map();
  private _custodyHistory: Map<string, CustodyRecordData[]> = new Map();
  private _currentCustodian: Map<string, string> = new Map();
  private _configuredCustodyTracker: string | null = null;

  public blockNumber: number = 1000;
  public receipts: SimulatedTransactionReceipt[] = [];
  public events: SimulatedEvent[] = [];

  constructor() {
    this.admin = toCheckAddress(CONTRACT_CONFIG.demoAccounts.admin);
    this.roleManagerAddress = toCheckAddress(CONTRACT_CONFIG.addresses.roleManager);
    this.batchRegistryAddress = toCheckAddress(CONTRACT_CONFIG.addresses.batchRegistry);
    this.custodyTrackerAddress = toCheckAddress(CONTRACT_CONFIG.addresses.custodyTracker);

    // Deployer is the sole admin
    this._roles.set(this.admin, Role.Admin);

    // Auto-wire tracker to registry by admin (simulates step 4 of deployment guide)
    this._configuredCustodyTracker = this.custodyTrackerAddress;

    // Seed the standard demo roles for quick evaluation
    this._roles.set(toCheckAddress(CONTRACT_CONFIG.demoAccounts.manufacturer), Role.Manufacturer);
    this._roles.set(toCheckAddress(CONTRACT_CONFIG.demoAccounts.distributor), Role.Distributor);
    this._roles.set(toCheckAddress(CONTRACT_CONFIG.demoAccounts.pharmacy), Role.Pharmacy);
    this._roles.set(toCheckAddress(CONTRACT_CONFIG.demoAccounts.patient), Role.Patient);
  }

  private _generateTxHash(): string {
    this.blockNumber += 1;
    return ethers.keccak256(
      ethers.toUtf8Bytes(`tx-${this.blockNumber}-${Date.now()}-${Math.random()}`)
    );
  }

  private _now(): number {
    return Math.floor(Date.now() / 1000);
  }

  // --- RoleManager Methods ---

  public getRole(account: string): Role {
    const formatted = toCheckAddress(account);
    return this._roles.get(formatted) || Role.None;
  }

  public hasRole(account: string, role: Role): boolean {
    return this.getRole(account) === role;
  }

  public registerRole(caller: string, account: string, role: Role): SimulatedTransactionReceipt {
    const formattedCaller = toCheckAddress(caller);
    if (formattedCaller !== this.admin) {
      throw new Error(`UnauthorizedAdmin: Caller (${caller}) is not the system administrator.`);
    }

    if (!account || account === ethers.ZeroAddress) {
      throw new Error('InvalidAccount: Cannot assign role to zero address.');
    }

    const formattedAccount = toCheckAddress(account);
    if (role === Role.Admin) {
      throw new Error('CannotAssignAdminRole: Deployer is the sole admin.');
    }
    if (role === Role.None) {
      throw new Error('InvalidRole: Cannot assign Role.None.');
    }

    this._roles.set(formattedAccount, role);

    const txHash = this._generateTxHash();
    const event: SimulatedEvent = {
      name: 'RoleAssigned',
      signature: 'RoleAssigned(address,uint8)',
      args: { account: formattedAccount, role },
      transactionHash: txHash,
      blockNumber: this.blockNumber,
      timestamp: this._now(),
    };
    this.events.push(event);

    const receipt: SimulatedTransactionReceipt = {
      transactionHash: txHash,
      blockNumber: this.blockNumber,
      from: formattedCaller,
      to: this.roleManagerAddress,
      status: 1,
      events: [event],
    };
    this.receipts.push(receipt);
    return receipt;
  }

  // --- BatchRegistry Methods ---

  public setCustodyTracker(caller: string, trackerAddress: string): SimulatedTransactionReceipt {
    const formattedCaller = toCheckAddress(caller);
    if (formattedCaller !== this.admin) {
      throw new Error(`OnlyAdmin: Caller (${caller}) is not the system administrator.`);
    }
    if (this._configuredCustodyTracker !== null) {
      throw new Error('TrackerAlreadyConfigured: CustodyTracker address can only be set once.');
    }
    if (!trackerAddress || trackerAddress === ethers.ZeroAddress) {
      throw new Error('InvalidAccount: Tracker address cannot be zero address.');
    }

    this._configuredCustodyTracker = toCheckAddress(trackerAddress);
    const txHash = this._generateTxHash();
    const event: SimulatedEvent = {
      name: 'CustodyTrackerConfigured',
      signature: 'CustodyTrackerConfigured(address)',
      args: { trackerAddress: this._configuredCustodyTracker },
      transactionHash: txHash,
      blockNumber: this.blockNumber,
      timestamp: this._now(),
    };
    this.events.push(event);

    const receipt: SimulatedTransactionReceipt = {
      transactionHash: txHash,
      blockNumber: this.blockNumber,
      from: formattedCaller,
      to: this.batchRegistryAddress,
      status: 1,
      events: [event],
    };
    this.receipts.push(receipt);
    return receipt;
  }

  public registerBatch(
    caller: string,
    rawBatchId: string,
    medicineName: string,
    batchMetadata: string
  ): SimulatedTransactionReceipt {
    const formattedCaller = toCheckAddress(caller);

    if (!this._configuredCustodyTracker) {
      throw new Error('TrackerNotConfigured: Batch registration is disabled until CustodyTracker is set.');
    }

    if (!this.hasRole(formattedCaller, Role.Manufacturer)) {
      throw new Error(
        `UnauthorizedManufacturer: Caller (${caller}) is not a registered Manufacturer.`
      );
    }

    const batchId = encodeBatchId(rawBatchId);
    if (batchId === ethers.ZeroHash) {
      throw new Error('InvalidBatchId: Batch ID cannot be bytes32(0).');
    }

    if (!medicineName || medicineName.trim().length === 0) {
      throw new Error('EmptyMedicineName: Medicine name is required and cannot be empty.');
    }

    if (this._batches.has(batchId)) {
      throw new Error(`DuplicateBatch: Batch ID (${batchId}) already exists.`);
    }

    const now = this._now();
    const batch: BatchData = {
      batchId,
      medicineName: medicineName.trim(),
      batchMetadata: batchMetadata ? batchMetadata.trim() : '',
      manufacturer: formattedCaller,
      createdAt: now,
      exists: true,
    };

    this._batches.set(batchId, batch);

    // Initialize Custody
    this._currentCustodian.set(batchId, formattedCaller);
    const initialRecord: CustodyRecordData = {
      from: ethers.ZeroAddress,
      to: formattedCaller,
      timestamp: now,
    };
    this._custodyHistory.set(batchId, [initialRecord]);

    const txHash = this._generateTxHash();
    const regEvent: SimulatedEvent = {
      name: 'BatchRegistered',
      signature: 'BatchRegistered(bytes32,string,address,uint256)',
      args: {
        batchId,
        medicineName: batch.medicineName,
        manufacturer: formattedCaller,
        createdAt: now,
      },
      transactionHash: txHash,
      blockNumber: this.blockNumber,
      timestamp: now,
    };

    const custodyEvent: SimulatedEvent = {
      name: 'CustodyTransferred',
      signature: 'CustodyTransferred(bytes32,address,address,uint256)',
      args: {
        batchId,
        from: ethers.ZeroAddress,
        to: formattedCaller,
        timestamp: now,
      },
      transactionHash: txHash,
      blockNumber: this.blockNumber,
      timestamp: now,
    };

    this.events.push(regEvent, custodyEvent);

    const receipt: SimulatedTransactionReceipt = {
      transactionHash: txHash,
      blockNumber: this.blockNumber,
      from: formattedCaller,
      to: this.batchRegistryAddress,
      status: 1,
      events: [regEvent, custodyEvent],
    };
    this.receipts.push(receipt);
    return receipt;
  }

  public batchExists(rawBatchId: string): boolean {
    const batchId = encodeBatchId(rawBatchId);
    return this._batches.has(batchId);
  }

  public getBatch(rawBatchId: string): BatchData {
    const batchId = encodeBatchId(rawBatchId);
    const batch = this._batches.get(batchId);
    if (!batch) {
      return {
        batchId: ethers.ZeroHash,
        medicineName: '',
        batchMetadata: '',
        manufacturer: ethers.ZeroAddress,
        createdAt: 0,
        exists: false,
      };
    }
    return { ...batch };
  }

  // --- CustodyTracker Methods ---

  public transferCustody(caller: string, rawBatchId: string, to: string): SimulatedTransactionReceipt {
    const formattedCaller = toCheckAddress(caller);

    if (!to || to === ethers.ZeroAddress) {
      throw new Error('InvalidRecipient: Recipient cannot be the zero address.');
    }
    const formattedTo = toCheckAddress(to);

    const batchId = encodeBatchId(rawBatchId);
    if (!this.batchExists(batchId)) {
      throw new Error(`UnknownBatch: Batch ID (${batchId}) is not registered in BatchRegistry.`);
    }

    const current = this._currentCustodian.get(batchId);
    if (!current || formattedCaller !== current) {
      throw new Error(
        `UnauthorizedCustodian: Caller (${caller}) is not the active custodian. Active custodian is (${current || 'none'}).`
      );
    }

    const senderRole = this.getRole(formattedCaller);
    const recipientRole = this.getRole(formattedTo);

    if (senderRole === Role.Patient) {
      throw new Error(
        `TerminalRole: Account (${formattedCaller}) holds terminal Patient role and cannot transfer custody onward.`
      );
    }

    let validTransition = false;
    if (senderRole === Role.Manufacturer && recipientRole === Role.Distributor) {
      validTransition = true;
    } else if (senderRole === Role.Distributor && recipientRole === Role.Pharmacy) {
      validTransition = true;
    } else if (senderRole === Role.Pharmacy && recipientRole === Role.Patient) {
      validTransition = true;
    }

    if (!validTransition) {
      throw new Error(
        `InvalidRoleTransition: Disallowed role transition from ${formattedCaller} (${Role[senderRole]}) to ${formattedTo} (${Role[recipientRole]}). Sequence must be Manufacturer → Distributor → Pharmacy → Patient.`
      );
    }

    const now = this._now();
    this._currentCustodian.set(batchId, formattedTo);

    const history = this._custodyHistory.get(batchId) || [];
    history.push({
      from: formattedCaller,
      to: formattedTo,
      timestamp: now,
    });
    this._custodyHistory.set(batchId, history);

    const txHash = this._generateTxHash();
    const event: SimulatedEvent = {
      name: 'CustodyTransferred',
      signature: 'CustodyTransferred(bytes32,address,address,uint256)',
      args: {
        batchId,
        from: formattedCaller,
        to: formattedTo,
        timestamp: now,
      },
      transactionHash: txHash,
      blockNumber: this.blockNumber,
      timestamp: now,
    };
    this.events.push(event);

    const receipt: SimulatedTransactionReceipt = {
      transactionHash: txHash,
      blockNumber: this.blockNumber,
      from: formattedCaller,
      to: this.custodyTrackerAddress,
      status: 1,
      events: [event],
    };
    this.receipts.push(receipt);
    return receipt;
  }

  public getCustodyHistory(rawBatchId: string): CustodyRecordData[] {
    const batchId = encodeBatchId(rawBatchId);
    const history = this._custodyHistory.get(batchId);
    if (!history) return [];
    return history.map((record) => ({ ...record }));
  }

  public getCurrentCustodian(rawBatchId: string): string {
    const batchId = encodeBatchId(rawBatchId);
    return this._currentCustodian.get(batchId) || ethers.ZeroAddress;
  }
}

// Global singleton instance for the applet
export const globalTraceabilityEngine = new MedicineTraceabilityEngine();
