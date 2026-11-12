import { ethers, Contract } from 'ethers';
import {
  Role,
  BatchData,
  CustodyRecordData,
  CONTRACT_CONFIG,
  ABIS,
  encodeBatchId,
  parseContractError,
} from './contracts';
import { globalTraceabilityEngine } from './contractEngine';

export interface WalletState {
  isConnected: boolean;
  address: string | null;
  chainId: number | null;
  role: Role;
  provider: ethers.BrowserProvider | null;
  signer: ethers.JsonRpcSigner | null;
  isSimulated: boolean;
  error: string | null;
}

/**
 * Checks if window.ethereum (MetaMask) is available in browser.
 */
export function isMetaMaskAvailable(): boolean {
  return typeof window !== 'undefined' && Boolean((window as any).ethereum);
}

/**
 * Connects to MetaMask and requests accounts.
 */
export async function connectMetaMask(): Promise<{
  address: string;
  chainId: number;
  provider: ethers.BrowserProvider;
  signer: ethers.JsonRpcSigner;
}> {
  if (!isMetaMaskAvailable()) {
    throw new Error('MetaMask is not detected. Please install or enable MetaMask.');
  }

  const provider = new ethers.BrowserProvider((window as any).ethereum);
  const accounts = await provider.send('eth_requestAccounts', []);
  if (!accounts || accounts.length === 0) {
    throw new Error('No accounts selected in MetaMask.');
  }

  const network = await provider.getNetwork();
  const signer = await provider.getSigner();

  return {
    address: accounts[0],
    chainId: Number(network.chainId),
    provider,
    signer,
  };
}

/**
 * Reads public role of an account.
 */
export async function fetchAccountRole(
  account: string,
  provider?: ethers.BrowserProvider | null,
  isSimulated = true
): Promise<Role> {
  if (!account) return Role.None;

  if (isSimulated || !provider) {
    return globalTraceabilityEngine.getRole(account);
  }

  try {
    const contract = new Contract(
      CONTRACT_CONFIG.addresses.roleManager,
      ABIS.roleManager,
      provider
    );
    const roleNum = await contract.getRole(account);
    return Number(roleNum) as Role;
  } catch {
    return globalTraceabilityEngine.getRole(account);
  }
}

/**
 * Submits batch registration to BatchRegistry.
 */
export async function executeRegisterBatch(
  params: {
    batchId: string;
    medicineName: string;
    batchMetadata: string;
  },
  wallet: WalletState
): Promise<{ txHash: string; batchId: string }> {
  const encodedId = encodeBatchId(params.batchId);

  if (wallet.isSimulated || !wallet.signer) {
    const caller = wallet.address || CONTRACT_CONFIG.demoAccounts.manufacturer;
    const receipt = globalTraceabilityEngine.registerBatch(
      caller,
      encodedId,
      params.medicineName,
      params.batchMetadata
    );
    return { txHash: receipt.transactionHash, batchId: encodedId };
  }

  try {
    const registryContract = new Contract(
      CONTRACT_CONFIG.addresses.batchRegistry,
      ABIS.batchRegistry,
      wallet.signer
    );
    const tx = await registryContract.registerBatch(
      encodedId,
      params.medicineName,
      params.batchMetadata
    );
    const receipt = await tx.wait();
    return { txHash: receipt.hash || tx.hash, batchId: encodedId };
  } catch (err: any) {
    throw new Error(parseContractError(err));
  }
}

/**
 * Submits custody transfer to CustodyTracker.
 */
export async function executeTransferCustody(
  params: {
    batchId: string;
    recipientAddress: string;
  },
  wallet: WalletState
): Promise<{ txHash: string; batchId: string }> {
  const encodedId = encodeBatchId(params.batchId);

  if (wallet.isSimulated || !wallet.signer) {
    const caller = wallet.address || CONTRACT_CONFIG.demoAccounts.manufacturer;
    const receipt = globalTraceabilityEngine.transferCustody(
      caller,
      encodedId,
      params.recipientAddress
    );
    return { txHash: receipt.transactionHash, batchId: encodedId };
  }

  try {
    const trackerContract = new Contract(
      CONTRACT_CONFIG.addresses.custodyTracker,
      ABIS.custodyTracker,
      wallet.signer
    );
    const tx = await trackerContract.transferCustody(encodedId, params.recipientAddress);
    const receipt = await tx.wait();
    return { txHash: receipt.hash || tx.hash, batchId: encodedId };
  } catch (err: any) {
    throw new Error(parseContractError(err));
  }
}

/**
 * Public read-only query to check batch authenticity and retrieve metadata.
 */
export async function queryBatchVerification(
  batchIdInput: string,
  provider?: ethers.BrowserProvider | null,
  isSimulated = true
): Promise<{
  exists: boolean;
  batch: BatchData | null;
  history: CustodyRecordData[];
  currentCustodian: string;
}> {
  const encodedId = encodeBatchId(batchIdInput);

  if (isSimulated || !provider) {
    const exists = globalTraceabilityEngine.batchExists(encodedId);
    if (!exists) {
      return {
        exists: false,
        batch: null,
        history: [],
        currentCustodian: ethers.ZeroAddress,
      };
    }

    const batch = globalTraceabilityEngine.getBatch(encodedId);
    const history = globalTraceabilityEngine.getCustodyHistory(encodedId);
    const currentCustodian = globalTraceabilityEngine.getCurrentCustodian(encodedId);

    return {
      exists: true,
      batch,
      history,
      currentCustodian,
    };
  }

  try {
    const registry = new Contract(
      CONTRACT_CONFIG.addresses.batchRegistry,
      ABIS.batchRegistry,
      provider
    );
    const tracker = new Contract(
      CONTRACT_CONFIG.addresses.custodyTracker,
      ABIS.custodyTracker,
      provider
    );

    const exists = await registry.batchExists(encodedId);
    if (!exists) {
      return {
        exists: false,
        batch: null,
        history: [],
        currentCustodian: ethers.ZeroAddress,
      };
    }

    const batchRaw = await registry.getBatch(encodedId);
    const historyRaw = await tracker.getCustodyHistory(encodedId);
    const currentCustodian = await tracker.getCurrentCustodian(encodedId);

    const batch: BatchData = {
      batchId: batchRaw.batchId,
      medicineName: batchRaw.medicineName,
      batchMetadata: batchRaw.batchMetadata,
      manufacturer: batchRaw.manufacturer,
      createdAt: Number(batchRaw.createdAt),
      exists: batchRaw.exists,
    };

    const history: CustodyRecordData[] = historyRaw.map((r: any) => ({
      from: r.from,
      to: r.to,
      timestamp: Number(r.timestamp),
    }));

    return {
      exists: true,
      batch,
      history,
      currentCustodian,
    };
  } catch (err: any) {
    // Fall back to engine if on-chain call fails
    const exists = globalTraceabilityEngine.batchExists(encodedId);
    return {
      exists,
      batch: exists ? globalTraceabilityEngine.getBatch(encodedId) : null,
      history: exists ? globalTraceabilityEngine.getCustodyHistory(encodedId) : [],
      currentCustodian: exists
        ? globalTraceabilityEngine.getCurrentCustodian(encodedId)
        : ethers.ZeroAddress,
    };
  }
}
