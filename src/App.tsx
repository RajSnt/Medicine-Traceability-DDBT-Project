/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import {
  Role,
  CONTRACT_CONFIG,
} from './lib/contracts';
import {
  WalletState,
  connectMetaMask,
  fetchAccountRole,
  isMetaMaskAvailable,
} from './lib/contractCalls';
import { globalTraceabilityEngine } from './lib/contractEngine';
import { WalletConnect } from './components/WalletConnect';
import { CreateBatchForm } from './components/CreateBatchForm';
import { TransferCustodyForm } from './components/TransferCustodyForm';
import { VerifyBatch } from './components/VerifyBatch';
import { ContractReference } from './components/ContractReference';

export default function App() {
  const [wallet, setWallet] = useState<WalletState>({
    isConnected: true,
    address: CONTRACT_CONFIG.demoAccounts.manufacturer,
    chainId: CONTRACT_CONFIG.targetChainId,
    role: Role.Manufacturer,
    provider: null,
    signer: null,
    isSimulated: true, // Default to in-browser Remix VM / EVM Simulator for instant zero-dependency testing
    error: null,
  });

  const [activeBatchId, setActiveBatchId] = useState<string>('BATCH-001');

  // Seed initial sample batch on startup if not present
  useEffect(() => {
    if (!globalTraceabilityEngine.batchExists('BATCH-001')) {
      try {
        globalTraceabilityEngine.registerBatch(
          CONTRACT_CONFIG.demoAccounts.manufacturer,
          'BATCH-001',
          'Amoxicillin Trihydrate 500mg',
          'Lot 8841-A | Exp: 2028-11 | Storage: 15-25°C Dry | 500 Capsules'
        );
        // Transfer to distributor to demonstrate custody timeline
        globalTraceabilityEngine.transferCustody(
          CONTRACT_CONFIG.demoAccounts.manufacturer,
          'BATCH-001',
          CONTRACT_CONFIG.demoAccounts.distributor
        );
      } catch (err) {
        console.error('Initialization error:', err);
      }
    }
  }, []);

  // Listen to MetaMask account / chain changes if connected
  useEffect(() => {
    if (wallet.isSimulated || typeof window === 'undefined' || !(window as any).ethereum) {
      return;
    }

    const ethereum = (window as any).ethereum;

    const handleAccountsChanged = async (accounts: string[]) => {
      if (!accounts || accounts.length === 0) {
        setWallet((prev) => ({
          ...prev,
          isConnected: false,
          address: null,
          role: Role.None,
          signer: null,
        }));
      } else {
        const address = accounts[0];
        const role = await fetchAccountRole(address, wallet.provider, false);
        setWallet((prev) => ({
          ...prev,
          address,
          role,
        }));
      }
    };

    const handleChainChanged = (chainIdHex: string) => {
      const chainId = parseInt(chainIdHex, 16);
      setWallet((prev) => ({
        ...prev,
        chainId,
      }));
    };

    ethereum.on('accountsChanged', handleAccountsChanged);
    ethereum.on('chainChanged', handleChainChanged);

    return () => {
      ethereum.removeListener('accountsChanged', handleAccountsChanged);
      ethereum.removeListener('chainChanged', handleChainChanged);
    };
  }, [wallet.isSimulated, wallet.provider]);

  const handleConnectMetaMask = async () => {
    if (!isMetaMaskAvailable()) {
      setWallet((prev) => ({
        ...prev,
        error:
          'MetaMask is not detected. Please install the MetaMask browser extension to use Web3 provider.',
      }));
      return;
    }

    try {
      setWallet((prev) => ({ ...prev, error: null }));
      const { address, chainId, provider, signer } = await connectMetaMask();
      const role = await fetchAccountRole(address, provider, false);

      setWallet({
        isConnected: true,
        address,
        chainId,
        role,
        provider,
        signer,
        isSimulated: false,
        error: null,
      });
    } catch (err: any) {
      setWallet((prev) => ({
        ...prev,
        error: err.message || 'Failed to connect MetaMask.',
      }));
    }
  };

  const handleDisconnect = () => {
    setWallet((prev) => ({
      ...prev,
      isConnected: false,
      address: null,
      role: Role.None,
      signer: null,
      provider: null,
      error: null,
    }));
  };

  const handleSwitchSimulatedAccount = (newAddress: string) => {
    const role = globalTraceabilityEngine.getRole(newAddress);
    setWallet((prev) => ({
      ...prev,
      isConnected: true,
      address: newAddress,
      role,
      error: null,
    }));
  };

  const handleToggleMode = (isSimulated: boolean) => {
    if (isSimulated) {
      const defaultAccount = CONTRACT_CONFIG.demoAccounts.manufacturer;
      setWallet({
        isConnected: true,
        address: defaultAccount,
        chainId: CONTRACT_CONFIG.targetChainId,
        role: globalTraceabilityEngine.getRole(defaultAccount),
        provider: null,
        signer: null,
        isSimulated: true,
        error: null,
      });
    } else {
      handleConnectMetaMask();
    }
  };

  const handleBatchCreated = (newBatchId: string) => {
    setActiveBatchId(newBatchId);
  };

  const handleCustodyTransferred = (batchId: string) => {
    setActiveBatchId(batchId);
  };

  return (
    <div className="min-h-screen bg-slate-100/70 text-slate-900">
      {/* Wallet Connection & Header */}
      <WalletConnect
        wallet={wallet}
        onConnectMetaMask={handleConnectMetaMask}
        onDisconnect={handleDisconnect}
        onSwitchSimulatedAccount={handleSwitchSimulatedAccount}
        onToggleMode={handleToggleMode}
      />

      <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8 space-y-8">
        {/* Architecture & Deployed Contracts Information */}
        <ContractReference />

        {/* Core 3-Function Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Function 1: Create Batch */}
          <CreateBatchForm
            wallet={wallet}
            onBatchCreated={handleBatchCreated}
          />

          {/* Function 2: Transfer Custody */}
          <TransferCustodyForm
            wallet={wallet}
            activeBatchId={activeBatchId}
            onCustodyTransferred={handleCustodyTransferred}
          />
        </div>

        {/* Function 3: Public Verification & History */}
        <VerifyBatch
          wallet={wallet}
          activeBatchId={activeBatchId}
          onSelectBatch={setActiveBatchId}
        />
      </main>

      <footer className="mt-16 border-t border-slate-200 bg-white py-6 text-center text-xs text-slate-500">
        <div className="mx-auto max-w-7xl px-4">
          <p>
            Medicine Batch Traceability MVP — RoleManager · BatchRegistry · CustodyTracker
          </p>
          <p className="mt-1 text-[11px] text-slate-400">
            Solidly 0.8.28 · ethers.js v6 · SHA-256 / Keccak-256 Batch Identifiers · Remix VM & Sepolia Ready
          </p>
        </div>
      </footer>
    </div>
  );
}
