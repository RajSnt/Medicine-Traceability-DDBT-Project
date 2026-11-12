import React from 'react';
import {
  Role,
  ROLE_LABELS,
  CONTRACT_CONFIG,
  formatAddress,
} from '../lib/contracts';
import { WalletState } from '../lib/contractCalls';
import { Wallet, ShieldCheck, RefreshCw, AlertTriangle, CheckCircle, Radio } from 'lucide-react';

interface WalletConnectProps {
  wallet: WalletState;
  onConnectMetaMask: () => void;
  onDisconnect: () => void;
  onSwitchSimulatedAccount: (address: string) => void;
  onToggleMode: (isSimulated: boolean) => void;
}

export const WalletConnect: React.FC<WalletConnectProps> = ({
  wallet,
  onConnectMetaMask,
  onDisconnect,
  onSwitchSimulatedAccount,
  onToggleMode,
}) => {
  const isWrongNetwork =
    !wallet.isSimulated &&
    wallet.chainId !== null &&
    wallet.chainId !== CONTRACT_CONFIG.targetChainId &&
    wallet.chainId !== CONTRACT_CONFIG.sepoliaChainId;

  return (
    <header className="border-b border-slate-200 bg-white shadow-xs">
      <div className="mx-auto max-w-7xl px-4 py-4 sm:px-6 lg:px-8">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <div className="flex items-center gap-2">
              <span className="inline-flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-600 text-white font-bold text-sm shadow-xs">
                Rx
              </span>
              <h1 className="text-xl font-bold tracking-tight text-slate-900">
                Medicine Batch Traceability
              </h1>
              <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-medium text-slate-700 border border-slate-300">
                Blockchain MVP
              </span>
            </div>
            <p className="mt-1 text-xs text-slate-500">
              Supply-chain provenance, custody transfer integrity, and public authenticity verification.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2 sm:gap-3">
            {/* Mode Toggle */}
            <div className="inline-flex rounded-lg border border-slate-300 bg-slate-50 p-0.5 text-xs">
              <button
                type="button"
                onClick={() => onToggleMode(true)}
                className={`rounded-md px-2.5 py-1.5 font-medium transition-colors ${
                  wallet.isSimulated
                    ? 'bg-white text-emerald-800 shadow-xs font-semibold'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
                title="Use in-browser Remix VM / EVM Simulator with instant role switching"
              >
                <Radio className="inline mr-1 h-3.5 w-3.5 text-emerald-600" />
                Remix VM / Demo
              </button>
              <button
                type="button"
                onClick={() => onToggleMode(false)}
                className={`rounded-md px-2.5 py-1.5 font-medium transition-colors ${
                  !wallet.isSimulated
                    ? 'bg-white text-indigo-800 shadow-xs font-semibold'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
                title="Connect via MetaMask Browser Extension"
              >
                <Wallet className="inline mr-1 h-3.5 w-3.5 text-indigo-600" />
                MetaMask Web3
              </button>
            </div>

            {/* Wallet State Display */}
            {wallet.isSimulated ? (
              <div className="flex items-center gap-2 bg-emerald-50 border border-emerald-200 rounded-lg px-3 py-1.5">
                <div className="text-left">
                  <div className="flex items-center gap-1.5 text-xs font-semibold text-emerald-900">
                    <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse"></span>
                    <span>{ROLE_LABELS[wallet.role]}</span>
                  </div>
                  <div className="text-[11px] font-mono text-emerald-700">
                    {formatAddress(wallet.address || '')}
                  </div>
                </div>

                {/* Quick Account Switcher for Demo */}
                <select
                  aria-label="Switch active demo account"
                  value={wallet.address || ''}
                  onChange={(e) => onSwitchSimulatedAccount(e.target.value)}
                  className="ml-1 rounded border border-emerald-300 bg-white py-1 px-2 text-xs font-medium text-slate-800 shadow-2xs hover:border-emerald-400 focus:outline-hidden"
                >
                  <option value={CONTRACT_CONFIG.demoAccounts.manufacturer}>Manufacturer (Batch Creator)</option>
                  <option value={CONTRACT_CONFIG.demoAccounts.distributor}>Distributor (Custody Holder)</option>
                  <option value={CONTRACT_CONFIG.demoAccounts.pharmacy}>Pharmacy (Custody Holder)</option>
                  <option value={CONTRACT_CONFIG.demoAccounts.patient}>Patient (Terminal Recipient)</option>
                  <option value={CONTRACT_CONFIG.demoAccounts.admin}>System Admin (Role Manager)</option>
                </select>
              </div>
            ) : wallet.isConnected && wallet.address ? (
              <div className="flex items-center gap-2 bg-slate-50 border border-slate-200 rounded-lg px-3 py-1.5">
                <div className="text-left">
                  <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-900">
                    <span className="h-2 w-2 rounded-full bg-emerald-500"></span>
                    <span>{ROLE_LABELS[wallet.role]}</span>
                    <span className="text-slate-400 text-[10px]">
                      (Chain {wallet.chainId || 'Unknown'})
                    </span>
                  </div>
                  <div className="text-[11px] font-mono text-slate-600">
                    {formatAddress(wallet.address)}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={onDisconnect}
                  className="rounded border border-slate-300 bg-white px-2 py-1 text-xs text-slate-600 hover:bg-slate-100"
                >
                  Disconnect
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={onConnectMetaMask}
                className="inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2 text-xs font-semibold text-white shadow-xs hover:bg-indigo-700 focus:outline-hidden"
              >
                <Wallet className="h-4 w-4" />
                Connect MetaMask
              </button>
            )}
          </div>
        </div>

        {/* Network Warning */}
        {isWrongNetwork && (
          <div className="mt-3 flex items-center gap-2 rounded-md bg-amber-50 p-2.5 text-xs text-amber-800 border border-amber-200">
            <AlertTriangle className="h-4 w-4 shrink-0 text-amber-600" />
            <span>
              Connected to Chain ID <strong>{wallet.chainId}</strong>. Expected Remix VM (1337) or Sepolia (11155111).
              Write operations may be rejected on untracked networks.
            </span>
          </div>
        )}

        {/* User error notice */}
        {wallet.error && (
          <div className="mt-3 flex items-center gap-2 rounded-md bg-rose-50 p-2.5 text-xs text-rose-800 border border-rose-200">
            <AlertTriangle className="h-4 w-4 shrink-0 text-rose-600" />
            <span>{wallet.error}</span>
          </div>
        )}
      </div>
    </header>
  );
};
