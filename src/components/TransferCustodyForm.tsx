import React, { useState } from 'react';
import { ethers } from 'ethers';
import {
  Role,
  ROLE_LABELS,
  CONTRACT_CONFIG,
  formatAddress,
} from '../lib/contracts';
import { WalletState, executeTransferCustody } from '../lib/contractCalls';
import { ArrowRightLeft, CheckCircle2, AlertCircle, Loader2, UserCheck } from 'lucide-react';

interface TransferCustodyFormProps {
  wallet: WalletState;
  activeBatchId?: string;
  onCustodyTransferred: (batchId: string) => void;
}

export const TransferCustodyForm: React.FC<TransferCustodyFormProps> = ({
  wallet,
  activeBatchId = '',
  onCustodyTransferred,
}) => {
  const [batchIdInput, setBatchIdInput] = useState(activeBatchId);
  const [recipientAddress, setRecipientAddress] = useState('');

  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successInfo, setSuccessInfo] = useState<{
    txHash: string;
    batchId: string;
    to: string;
  } | null>(null);

  // Sync if activeBatchId changes from verify/create
  React.useEffect(() => {
    if (activeBatchId) {
      setBatchIdInput(activeBatchId);
    }
  }, [activeBatchId]);

  const handleSelectDemoRecipient = (address: string) => {
    setRecipientAddress(address);
    setErrorMessage(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    setSuccessInfo(null);

    const cleanId = batchIdInput.trim();
    const cleanRecipient = recipientAddress.trim();

    if (!cleanId) {
      setErrorMessage('Batch Identifier is required.');
      return;
    }
    if (!cleanRecipient) {
      setErrorMessage('Recipient Address is required.');
      return;
    }
    if (!ethers.isAddress(cleanRecipient)) {
      setErrorMessage('Invalid Recipient: Please enter a valid 20-byte Ethereum address (FE-T10).');
      return;
    }
    if (cleanRecipient === ethers.ZeroAddress) {
      setErrorMessage('Invalid Recipient: Recipient cannot be the zero address 0x000...000 (BE-T15).');
      return;
    }

    if (wallet.role === Role.Patient) {
      setErrorMessage(
        'Terminal Role: The connected wallet holds the Patient role. Patients cannot transfer custody onward (BE-T17).'
      );
      return;
    }

    try {
      setIsLoading(true);
      const result = await executeTransferCustody(
        {
          batchId: cleanId,
          recipientAddress: cleanRecipient,
        },
        wallet
      );

      setSuccessInfo({
        txHash: result.txHash,
        batchId: cleanId,
        to: cleanRecipient,
      });

      // Clear recipient input
      setRecipientAddress('');

      // Notify parent to refresh verification history
      onCustodyTransferred(cleanId);
    } catch (err: any) {
      setErrorMessage(err.message || 'Custody transfer failed.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <section aria-labelledby="transfer-custody-heading" className="rounded-xl border border-slate-200 bg-white p-6 shadow-xs">
      <div className="flex items-center justify-between border-b border-slate-100 pb-4">
        <div className="flex items-center gap-2.5">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-indigo-100 text-indigo-700">
            <ArrowRightLeft className="h-5 w-5" />
          </div>
          <div>
            <h2 id="transfer-custody-heading" className="text-base font-semibold text-slate-900">
              2. Transfer Custody
            </h2>
            <p className="text-xs text-slate-500">
              Contract: <code className="text-[11px] font-mono text-slate-700">CustodyTracker.transferCustody()</code>
            </p>
          </div>
        </div>

        <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-[11px] font-medium text-slate-700 border border-slate-200">
          Current Custodian Only
        </span>
      </div>

      {/* Allowed Sequence Reference */}
      <div className="mt-4 rounded-lg bg-slate-50 p-3 text-xs text-slate-700 border border-slate-200">
        <div className="font-semibold text-slate-900 mb-1 flex items-center gap-1.5">
          <UserCheck className="h-3.5 w-3.5 text-indigo-600" />
          <span>Enforced Transition Sequence:</span>
        </div>
        <div className="flex flex-wrap items-center gap-1 text-[11px] font-mono text-slate-600">
          <span className="rounded bg-emerald-100 text-emerald-800 px-1.5 py-0.5 font-medium">Manufacturer</span>
          <span>→</span>
          <span className="rounded bg-sky-100 text-sky-800 px-1.5 py-0.5 font-medium">Distributor</span>
          <span>→</span>
          <span className="rounded bg-indigo-100 text-indigo-800 px-1.5 py-0.5 font-medium">Pharmacy</span>
          <span>→</span>
          <span className="rounded bg-purple-100 text-purple-800 px-1.5 py-0.5 font-medium">Patient [Terminal]</span>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="mt-5 space-y-4">
        <div>
          <label htmlFor="transfer-batch-id" className="block text-xs font-medium text-slate-700">
            Batch Identifier <span className="text-rose-500">*</span>
          </label>
          <div className="mt-1">
            <input
              id="transfer-batch-id"
              type="text"
              value={batchIdInput}
              onChange={(e) => setBatchIdInput(e.target.value)}
              placeholder="e.g. BATCH-001"
              disabled={isLoading}
              required
              className="block w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:border-indigo-500 focus:outline-hidden focus:ring-1 focus:ring-indigo-500 disabled:bg-slate-50"
            />
          </div>
        </div>

        <div>
          <label htmlFor="recipient-address-input" className="block text-xs font-medium text-slate-700">
            Recipient Address <span className="text-rose-500">*</span>
          </label>
          <div className="mt-1">
            <input
              id="recipient-address-input"
              type="text"
              value={recipientAddress}
              onChange={(e) => setRecipientAddress(e.target.value)}
              placeholder="0x... (Must have next permitted role)"
              disabled={isLoading}
              required
              className="block w-full rounded-lg border border-slate-300 px-3 py-2 text-sm font-mono text-slate-900 placeholder:text-slate-400 focus:border-indigo-500 focus:outline-hidden focus:ring-1 focus:ring-indigo-500 disabled:bg-slate-50"
            />
          </div>

          {/* Quick Demo Recipient Buttons */}
          <div className="mt-2 flex flex-wrap items-center gap-1.5">
            <span className="text-[11px] text-slate-500">Quick Recipient:</span>
            <button
              type="button"
              onClick={() => handleSelectDemoRecipient(CONTRACT_CONFIG.demoAccounts.distributor)}
              className="rounded bg-slate-100 px-2 py-0.5 text-[11px] font-medium text-slate-700 hover:bg-slate-200"
            >
              Distributor
            </button>
            <button
              type="button"
              onClick={() => handleSelectDemoRecipient(CONTRACT_CONFIG.demoAccounts.pharmacy)}
              className="rounded bg-slate-100 px-2 py-0.5 text-[11px] font-medium text-slate-700 hover:bg-slate-200"
            >
              Pharmacy
            </button>
            <button
              type="button"
              onClick={() => handleSelectDemoRecipient(CONTRACT_CONFIG.demoAccounts.patient)}
              className="rounded bg-slate-100 px-2 py-0.5 text-[11px] font-medium text-slate-700 hover:bg-slate-200"
            >
              Patient
            </button>
          </div>
        </div>

        {/* Error Feedback */}
        {errorMessage && (
          <div className="rounded-lg bg-rose-50 p-3 text-xs text-rose-800 border border-rose-200 flex items-start gap-2">
            <AlertCircle className="h-4 w-4 shrink-0 text-rose-600 mt-0.5" />
            <div className="break-all font-mono text-[11px] leading-relaxed">{errorMessage}</div>
          </div>
        )}

        {/* Success Confirmation */}
        {successInfo && (
          <div className="rounded-lg bg-indigo-50 p-3.5 text-xs text-indigo-900 border border-indigo-200 space-y-1.5">
            <div className="flex items-center gap-1.5 font-semibold text-indigo-800">
              <CheckCircle2 className="h-4 w-4 text-indigo-600" />
              <span>Custody Transferred & Recorded on Blockchain!</span>
            </div>
            <div className="text-[11px] text-indigo-700">
              Batch: <strong className="font-mono text-indigo-900">{successInfo.batchId}</strong> transferred to{' '}
              <strong className="font-mono text-indigo-900">{formatAddress(successInfo.to)}</strong>
            </div>
            <div className="text-[11px] font-mono break-all text-indigo-800 bg-white/70 p-2 rounded border border-indigo-200">
              Tx Hash: {successInfo.txHash}
            </div>
          </div>
        )}

        <button
          type="submit"
          disabled={isLoading}
          className="w-full inline-flex items-center justify-center gap-2 rounded-lg bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white shadow-xs hover:bg-indigo-700 focus:outline-hidden disabled:opacity-60 disabled:cursor-not-allowed transition-all"
        >
          {isLoading ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              <span>Executing Custody Transfer...</span>
            </>
          ) : (
            <>
              <ArrowRightLeft className="h-4 w-4" />
              <span>Transfer Batch Custody</span>
            </>
          )}
        </button>
      </form>
    </section>
  );
};
