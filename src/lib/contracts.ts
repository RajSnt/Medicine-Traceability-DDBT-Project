import { ethers, Interface } from 'ethers';
import roleManagerAbi from '../abi/RoleManager.json';
import batchRegistryAbi from '../abi/BatchRegistry.json';
import custodyTrackerAbi from '../abi/CustodyTracker.json';

export enum Role {
  None = 0,
  Admin = 1,
  Manufacturer = 2,
  Distributor = 3,
  Pharmacy = 4,
  Patient = 5,
}

export const ROLE_LABELS: Record<Role, string> = {
  [Role.None]: 'Unregistered',
  [Role.Admin]: 'System Admin',
  [Role.Manufacturer]: 'Manufacturer',
  [Role.Distributor]: 'Distributor',
  [Role.Pharmacy]: 'Pharmacy',
  [Role.Patient]: 'Patient (Terminal)',
};

export const CONTRACT_CONFIG = {
  // Target network: Remix VM default chainId (1337 or 31337), or Sepolia (11155111)
  targetChainId: 1337,
  targetChainName: 'Remix VM (Local) / In-Browser EVM',
  sepoliaChainId: 11155111,
  
  // Deployed addresses on Remix VM
  addresses: {
    roleManager: '0xd9145CCE52D386f254917e481eB44e9943F39138',
    batchRegistry: '0xd8b934580fcE35a11B58C6D73aDeE468a2833fa8',
    custodyTracker: '0xf8e81D47203A594245E36C48e151709F0C19fBe8',
  },

  // Standard demo accounts
  demoAccounts: {
    admin: '0x5b38da6a701c568545dcfcb03fcb875f56beddc4',
    manufacturer: '0xab8483f64d9c6d1ecf9b849ae677dd3315835cb2',
    distributor: '0x4b20993bc481177ec7e8f571cecae8a9e22c02db',
    pharmacy: '0x78731d3ca6b7e34ac0f824c42a7cc18a495cabab',
    patient: '0x617f2e2fd72fd98b532c12513be8602197f80e3f',
  },
};

export const ABIS = {
  roleManager: roleManagerAbi,
  batchRegistry: batchRegistryAbi,
  custodyTracker: custodyTrackerAbi,
};

export const INTERFACES = {
  roleManager: new Interface(roleManagerAbi),
  batchRegistry: new Interface(batchRegistryAbi),
  custodyTracker: new Interface(custodyTrackerAbi),
};

export interface BatchData {
  batchId: string;
  medicineName: string;
  batchMetadata: string;
  manufacturer: string;
  createdAt: number;
  exists: boolean;
}

export interface CustodyRecordData {
  from: string;
  to: string;
  timestamp: number;
}

/**
 * Encodes a human-readable batch string (e.g. "BATCH-001") into a 32-byte hash using ethers.id(),
 * or returns the hex string directly if already a valid 32-byte hex.
 */
export function encodeBatchId(input: string): string {
  const trimmed = input.trim();
  if (trimmed.startsWith('0x') && trimmed.length === 66) {
    return trimmed.toLowerCase();
  }
  return ethers.id(trimmed);
}

/**
 * Shortens an Ethereum address for clean UI display.
 */
export function formatAddress(address: string): string {
  if (!address || address === ethers.ZeroAddress) return '0x000...000 (Origin / Unassigned)';
  if (address.length < 12) return address;
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
}

/**
 * Formats a UNIX timestamp into a human-readable UTC/local string.
 */
export function formatTimestamp(seconds: number): string {
  if (!seconds || seconds <= 0) return 'Pending / Unknown';
  return new Date(seconds * 1000).toLocaleString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
}

/**
 * Parses contract custom errors or standard reverts into clear user-facing messages.
 */
export function parseContractError(error: any): string {
  if (!error) return 'Unknown error occurred.';

  // Check if error has data for custom error decoding
  const data = error.data || error.info?.error?.data || error.error?.data;
  if (data && typeof data === 'string') {
    for (const iface of Object.values(INTERFACES)) {
      try {
        const decoded = iface.parseError(data);
        if (decoded) {
          switch (decoded.name) {
            case 'UnauthorizedAdmin':
              return `Authorization Error: Caller (${decoded.args[0]}) is not the system administrator.`;
            case 'UnauthorizedManufacturer':
              return `Authorization Error: Account (${decoded.args[0]}) is not a registered Manufacturer. Only registered manufacturers can create batches.`;
            case 'UnauthorizedCustodian':
              return `Custody Error: Caller (${decoded.args[0]}) is not the current custodian. Active custodian is (${decoded.args[1]}).`;
            case 'DuplicateBatch':
              return `Batch Error: Batch ID (${decoded.args[0]}) has already been registered. Duplicate batch IDs are rejected.`;
            case 'InvalidBatchId':
              return 'Validation Error: Batch ID cannot be bytes32(0).';
            case 'EmptyMedicineName':
              return 'Validation Error: Medicine name is required and cannot be empty.';
            case 'InvalidRecipient':
              return 'Validation Error: Recipient cannot be the zero address (0x0).';
            case 'InvalidAccount':
              return 'Validation Error: Provided account address is invalid or zero address.';
            case 'InvalidRoleTransition':
              return `Transition Error: Invalid role transition from ${decoded.args[0]} to ${decoded.args[1]}. Allowed flow is Manufacturer → Distributor → Pharmacy → Patient.`;
            case 'TerminalRole':
              return `Transition Error: Account (${decoded.args[0]}) holds the terminal Patient role. Patients cannot transfer custody onward.`;
            case 'UnknownBatch':
              return `Batch Error: Batch ID (${decoded.args[0]}) does not exist in BatchRegistry.`;
            case 'TrackerNotConfigured':
              return 'System Error: CustodyTracker is not yet configured on BatchRegistry.';
            case 'TrackerAlreadyConfigured':
              return 'System Error: CustodyTracker is already configured and cannot be modified.';
            case 'CannotAssignAdminRole':
              return 'Role Error: Cannot assign Admin role. Deployer is the sole administrator.';
            case 'InvalidRole':
              return 'Role Error: Cannot assign Role.None. Select a valid supply-chain role.';
            default:
              return `Contract reverted with custom error: ${decoded.name}`;
          }
        }
      } catch {
        // Continue trying other interfaces
      }
    }
  }

  // Check standard error messages
  const msg = error.reason || error.shortMessage || error.message || String(error);
  if (msg.includes('user rejected') || msg.includes('ACTION_REJECTED')) {
    return 'Transaction rejected by user in MetaMask.';
  }
  if (msg.includes('insufficient funds')) {
    return 'Transaction failed: Insufficient funds for gas.';
  }

  return msg;
}
