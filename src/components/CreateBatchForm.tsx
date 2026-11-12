import React, { useState } from 'react';
import { Role, ROLE_LABELS } from '../lib/contracts';
import { WalletState, executeRegisterBatch } from '../lib/contractCalls';
import { PackagePlus, CheckCircle2, AlertCircle, Loader2, Sparkles } from 'lucide-react';

interface CreateBatchFormProps {
  wallet: WalletState;
  onBatchCreated: (batchId: string) => void;
}

export const CreateBatchForm: React.FC<CreateBatchFormProps> = ({
  wallet,
  onBatchCreated,
}) => {
  const [batchIdInput, setBatchIdInput] = useState('');
  const [medicineName, setMedicineName] = useState('');
  const [metadata, setMetadata] = useState('');

  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successInfo, setSuccessInfo] = useState<{
    txHash: string;
    batchId: string;
    medicineName: string;
  } | null>(null);

  const isManufacturer = wallet.role === Role.Manufacturer;

  const handleFillDemo = () => {
    const randomNum = Math.floor(100 + Math.random() * 900);
    setBatchIdInput(`BATCH-${randomNum}`);
    setMedicineName('Amoxicillin Trihydrate 500mg');
    setMetadata('Lot 8841-A | Exp: 2028-11 | Storage: 15-25°C Dry | 500 Capsules');
    setErrorMessage(null);
    setSuccessInfo(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    setSuccessInfo(null);

    // Validation
    const cleanId = batchIdInput.trim();
    const cleanName = medicineName.trim();
    if (!cleanId) {
      setErrorMessage('Batch Identifier is required.');
      return;
    }
    if (!cleanName) {
      setErrorMessage('Medicine Name is required.');
      return;
    }

    if (!isManufacturer) {
      setErrorMessage(
        `Action Restricted: Connected account holds '${ROLE_LABELS[wallet.role]}'. Only registered Manufacturers can create batches (BE-T06 / FE-T06).`
      );
      return;
    }

    try {
      setIsLoading(true);
      const result = await executeRegisterBatch(
        {
          batchId: cleanId,
          medicineName: cleanName,
          batchMetadata: metadata.trim(),
        },
        wallet
      );

      setSuccessInfo({
        txHash: result.txHash,
        batchId: cleanId,
        medicineName: cleanName,
      });

      // Clear form inputs upon confirmed success (FE-3 requirement)
      setBatchIdInput('');
      setMedicineName('');
      setMetadata('');

      // Notify parent to auto-populate verify section
      onBatchCreated(cleanId);
    } catch (err: any) {
      setErrorMessage(err.message || 'Failed to register batch.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <section aria-labelledby="create-batch-heading" className="rounded-xl border border-slate-200 bg-white p-6 shadow-xs">
      <div className="flex items-center justify-between border-b border-slate-100 pb-4">
        <div className="flex items-center gap-2.5">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-emerald-100 text-emerald-700">
            <PackagePlus className="h-5 w-5" />
          </div>
          <div>
            <h2 id="create-batch-heading" className="text-base font-semibold text-slate-900">
              1. Create Medicine Batch
            </h2>
            <p className="text-xs text-slate-500">
              Contract: <code className="text-[11px] font-mono text-slate-700">BatchRegistry.registerBatch()</code>
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={handleFillDemo}
          className="inline-flex items-center gap-1 rounded-md border border-slate-200 bg-slate-50 px-2.5 py-1 text-xs font-medium text-slate-600 hover:bg-slate-100 hover:text-slate-900"
          title="Fill sample batch data"
        >
          <Sparkles className="h-3.5 w-3.5 text-amber-500" />
          Fill Sample
        </button>
      </div>

      {/* Role permission status banner */}
      <div className="mt-4">
        {isManufacturer ? (
          <div className="flex items-center gap-2 rounded-lg bg-emerald-50 px-3 py-2 text-xs font-medium text-emerald-800 border border-emerald-200">
            <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600" />
            <span>Authorized: Connected wallet is registered as <strong>Manufacturer</strong>.</span>
          </div>
        ) : (
          <div className="flex items-center gap-2 rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-800 border border-amber-200">
            <AlertCircle className="h-4 w-4 shrink-0 text-amber-600" />
            <span>
              Active role is <strong>{ROLE_LABELS[wallet.role]}</strong>. Batch creation is restricted to registered <strong>Manufacturers</strong>.
            </span>
          </div>
        )}
      </div>

      <form onSubmit={handleSubmit} className="mt-5 space-y-4">
        <div>
          <label htmlFor="batch-id-input" className="block text-xs font-medium text-slate-700">
            Batch Identifier <span className="text-rose-500">*</span>
          </label>
          <div className="mt-1">
            <input
              id="batch-id-input"
              type="text"
              value={batchIdInput}
              onChange={(e) => setBatchIdInput(e.target.value)}
              placeholder="e.g. BATCH-001"
              disabled={isLoading}
              required
              className="block w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:border-emerald-500 focus:outline-hidden focus:ring-1 focus:ring-emerald-500 disabled:bg-slate-50"
            />
          </div>
          <p className="mt-1 text-[11px] text-slate-500">
            Encoded on-chain as a 32-byte hash via <code className="font-mono">ethers.id(batchId)</code>.
          </p>
        </div>

        <div>
          <label htmlFor="medicine-name-input" className="block text-xs font-medium text-slate-700">
            Medicine Name <span className="text-rose-500">*</span>
          </label>
          <div className="mt-1">
            <input
              id="medicine-name-input"
              type="text"
              value={medicineName}
              onChange={(e) => setMedicineName(e.target.value)}
              placeholder="e.g. Amoxicillin Trihydrate 500mg"
              disabled={isLoading}
              required
              className="block w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:border-emerald-500 focus:outline-hidden focus:ring-1 focus:ring-emerald-500 disabled:bg-slate-50"
            />
          </div>
        </div>

        <div>
          <label htmlFor="metadata-input" className="block text-xs font-medium text-slate-700">
            Batch Metadata / Lot Details
          </label>
          <div className="mt-1">
            <textarea
              id="metadata-input"
              rows={2}
              value={metadata}
              onChange={(e) => setMetadata(e.target.value)}
              placeholder="Dosage, packaging details, expiry, or manufacturing conditions"
              disabled={isLoading}
              className="block w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:border-emerald-500 focus:outline-hidden focus:ring-1 focus:ring-emerald-500 disabled:bg-slate-50"
            />
          </div>
        </div>

        {/* Error message */}
        {errorMessage && (
          <div className="rounded-lg bg-rose-50 p-3 text-xs text-rose-800 border border-rose-200 flex items-start gap-2">
            <AlertCircle className="h-4 w-4 shrink-0 text-rose-600 mt-0.5" />
            <div className="break-all font-mono text-[11px] leading-relaxed">{errorMessage}</div>
          </div>
        )}

        {/* Success confirmation */}
        {successInfo && (
          <div className="rounded-lg bg-emerald-50 p-3.5 text-xs text-emerald-900 border border-emerald-200 space-y-1.5">
            <div className="flex items-center gap-1.5 font-semibold text-emerald-800">
              <CheckCircle2 className="h-4 w-4 text-emerald-600" />
              <span>Batch Successfully Registered on Blockchain!</span>
            </div>
            <div className="text-[11px] text-emerald-700">
              Batch: <strong className="font-mono text-emerald-900">{successInfo.batchId}</strong> ({successInfo.medicineName})
            </div>
            <div className="text-[11px] font-mono break-all text-emerald-800 bg-white/70 p-2 rounded border border-emerald-200">
              Tx Hash: {successInfo.txHash}
            </div>
          </div>
        )}

        <button
          type="submit"
          disabled={isLoading}
          className="w-full inline-flex items-center justify-center gap-2 rounded-lg bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white shadow-xs hover:bg-emerald-700 focus:outline-hidden disabled:opacity-60 disabled:cursor-not-allowed transition-all"
        >
          {isLoading ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              <span>Confirming on Blockchain...</span>
            </>
          ) : (
            <>
              <PackagePlus className="h-4 w-4" />
              <span>Register Medicine Batch</span>
            </>
          )}
        </button>
      </form>
    </section>
  );
};
