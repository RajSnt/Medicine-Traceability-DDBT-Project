import React, { useState } from 'react';
import {
  BatchData,
  CustodyRecordData,
  formatAddress,
  formatTimestamp,
  encodeBatchId,
} from '../lib/contracts';
import { WalletState, queryBatchVerification } from '../lib/contractCalls';
import {
  ShieldCheck,
  ShieldAlert,
  Search,
  History,
  Clock,
  Building,
  User,
  ArrowDown,
  RefreshCw,
  Loader2,
  CheckCircle2,
} from 'lucide-react';

interface VerifyBatchProps {
  wallet: WalletState;
  activeBatchId: string;
  onSelectBatch: (batchId: string) => void;
}

export const VerifyBatch: React.FC<VerifyBatchProps> = ({
  wallet,
  activeBatchId,
  onSelectBatch,
}) => {
  const [searchInput, setSearchInput] = useState(activeBatchId || 'BATCH-001');
  const [isLoading, setIsLoading] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);

  const [verificationResult, setVerificationResult] = useState<{
    exists: boolean;
    batch: BatchData | null;
    history: CustodyRecordData[];
    currentCustodian: string;
  } | null>(null);

  const [errorText, setErrorText] = useState<string | null>(null);

  const performVerification = async (targetId: string) => {
    const cleanId = targetId.trim();
    if (!cleanId) return;

    setErrorText(null);
    setIsLoading(true);
    setHasSearched(true);

    try {
      const res = await queryBatchVerification(
        cleanId,
        wallet.provider,
        wallet.isSimulated
      );
      setVerificationResult(res);
      onSelectBatch(cleanId);
    } catch (err: any) {
      setErrorText(err.message || 'Verification lookup failed.');
      setVerificationResult(null);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    performVerification(searchInput);
  };

  // Re-verify when activeBatchId changes externally (e.g. after a custody transfer or new batch created)
  React.useEffect(() => {
    if (activeBatchId && activeBatchId !== searchInput) {
      setSearchInput(activeBatchId);
      performVerification(activeBatchId);
    }
  }, [activeBatchId]);

  return (
    <section aria-labelledby="verify-batch-heading" className="rounded-xl border border-slate-200 bg-white p-6 shadow-xs">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between border-b border-slate-100 pb-4">
        <div className="flex items-center gap-2.5">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-teal-100 text-teal-700">
            <ShieldCheck className="h-5 w-5" />
          </div>
          <div>
            <h2 id="verify-batch-heading" className="text-base font-semibold text-slate-900">
              3. Verify Batch Authenticity & Provenance
            </h2>
            <p className="text-xs text-slate-500">
              Public verification: <code className="text-[11px] font-mono text-slate-700">BatchRegistry.getBatch()</code> + <code className="text-[11px] font-mono text-slate-700">CustodyTracker.getCustodyHistory()</code>
            </p>
          </div>
        </div>

        <span className="inline-flex items-center gap-1 text-[11px] font-medium text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded-full border border-emerald-200 self-start sm:self-auto">
          <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />
          Open Public Read (No Wallet Required)
        </span>
      </div>

      {/* Search Input Bar */}
      <form onSubmit={handleSearchSubmit} className="mt-5">
        <label htmlFor="verify-search-input" className="block text-xs font-medium text-slate-700">
          Enter Medicine Batch Identifier
        </label>
        <div className="mt-1 flex gap-2">
          <div className="relative flex-1">
            <input
              id="verify-search-input"
              type="text"
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              placeholder="e.g. BATCH-001 or 0x..."
              disabled={isLoading}
              className="block w-full rounded-lg border border-slate-300 py-2.5 pl-3 pr-10 text-sm text-slate-900 placeholder:text-slate-400 focus:border-teal-500 focus:outline-hidden focus:ring-1 focus:ring-teal-500"
            />
          </div>
          <button
            type="submit"
            disabled={isLoading || !searchInput.trim()}
            className="inline-flex items-center gap-2 rounded-lg bg-teal-600 px-5 py-2.5 text-sm font-semibold text-white shadow-xs hover:bg-teal-700 focus:outline-hidden disabled:opacity-50 transition-colors"
          >
            {isLoading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Search className="h-4 w-4" />
            )}
            <span>Verify</span>
          </button>
        </div>
      </form>

      {/* Error state */}
      {errorText && (
        <div className="mt-4 rounded-lg bg-rose-50 p-3 text-xs text-rose-800 border border-rose-200">
          {errorText}
        </div>
      )}

      {/* Results View */}
      {hasSearched && verificationResult && (
        <div className="mt-6 space-y-6">
          {!verificationResult.exists ? (
            /* Not Found State (FE-T12) */
            <div className="rounded-xl border border-rose-200 bg-rose-50/60 p-5 text-center">
              <div className="mx-auto flex h-11 w-11 items-center justify-center rounded-full bg-rose-100 text-rose-600">
                <ShieldAlert className="h-6 w-6" />
              </div>
              <h3 className="mt-2 text-sm font-bold text-rose-900">
                Not Found / Not Verified
              </h3>
              <p className="mt-1 text-xs text-rose-700 max-w-md mx-auto">
                No matching batch was found in the authorized <strong>BatchRegistry</strong>.
                This medicine batch is unverified, counterfeit, or has not been registered by a licensed manufacturer.
              </p>
              <div className="mt-3 text-[11px] font-mono text-slate-500">
                Queried ID: {searchInput}
              </div>
            </div>
          ) : (
            /* Verified Authentic Batch State (FE-T11, FE-T13) */
            <div className="space-y-6">
              {/* Authenticity Header Card */}
              <div className="rounded-xl border border-emerald-200 bg-emerald-50/70 p-4">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-emerald-500 text-white shadow-xs">
                      <ShieldCheck className="h-6 w-6" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-bold uppercase tracking-wider text-emerald-800">
                          Authentic & Verified Batch
                        </span>
                        <span className="rounded-full bg-emerald-200 px-2 py-0.5 text-[10px] font-bold text-emerald-900">
                          On-Chain Confirmed
                        </span>
                      </div>
                      <h3 className="text-lg font-bold text-slate-900">
                        {verificationResult.batch?.medicineName}
                      </h3>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => performVerification(searchInput)}
                    className="inline-flex items-center gap-1.5 self-start sm:self-auto rounded-lg border border-emerald-300 bg-white px-3 py-1.5 text-xs font-medium text-emerald-800 hover:bg-emerald-50 shadow-2xs"
                    title="Refresh on-chain history"
                  >
                    <RefreshCw className="h-3.5 w-3.5 text-emerald-600" />
                    Refresh Record
                  </button>
                </div>

                {/* Batch Attributes Grid */}
                <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 border-t border-emerald-200/60 pt-3 text-xs">
                  <div>
                    <span className="text-[11px] text-slate-500 block">Batch Identifier:</span>
                    <strong className="font-semibold text-slate-900">{searchInput}</strong>
                  </div>
                  <div>
                    <span className="text-[11px] text-slate-500 block">Manufacturer (Origin):</span>
                    <strong className="font-mono text-slate-800 block truncate" title={verificationResult.batch?.manufacturer}>
                      {formatAddress(verificationResult.batch?.manufacturer || '')}
                    </strong>
                  </div>
                  <div>
                    <span className="text-[11px] text-slate-500 block">Registered At:</span>
                    <strong className="text-slate-800">
                      {formatTimestamp(verificationResult.batch?.createdAt || 0)}
                    </strong>
                  </div>
                  <div>
                    <span className="text-[11px] text-slate-500 block">Active Custodian:</span>
                    <strong className="font-mono text-emerald-800 block truncate" title={verificationResult.currentCustodian}>
                      {formatAddress(verificationResult.currentCustodian)}
                    </strong>
                  </div>
                </div>

                {/* Metadata note */}
                {verificationResult.batch?.batchMetadata && (
                  <div className="mt-3 rounded bg-white/80 p-2.5 text-xs text-slate-700 border border-emerald-200/60">
                    <span className="font-semibold text-slate-800">Batch Lot Details: </span>
                    <span>{verificationResult.batch.batchMetadata}</span>
                  </div>
                )}
              </div>

              {/* Chronological Custody History Timeline (FE-5, FE-T13, BE-T19) */}
              <div className="rounded-xl border border-slate-200 bg-white p-5">
                <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                  <div className="flex items-center gap-2">
                    <History className="h-4 w-4 text-slate-600" />
                    <h4 className="text-sm font-semibold text-slate-900">
                      Chronological Custody Timeline (Audit Trail)
                    </h4>
                  </div>
                  <span className="text-xs font-mono text-slate-500">
                    {verificationResult.history.length} Event{verificationResult.history.length === 1 ? '' : 's'} Logged
                  </span>
                </div>

                <div className="mt-4 relative pl-6 before:absolute before:left-2.5 before:top-3 before:bottom-3 before:w-0.5 before:bg-slate-200 space-y-6">
                  {verificationResult.history.map((record, idx) => {
                    const isCreation = record.from === '0x0000000000000000000000000000000000000000' || !record.from;
                    const isCurrent = idx === verificationResult.history.length - 1;

                    return (
                      <div key={idx} className="relative group">
                        {/* Bullet Marker */}
                        <div
                          className={`absolute -left-6 top-1 flex h-5 w-5 items-center justify-center rounded-full border-2 text-[10px] font-bold ${
                            isCurrent
                              ? 'bg-emerald-600 border-white text-white ring-2 ring-emerald-400'
                              : isCreation
                              ? 'bg-blue-600 border-white text-white'
                              : 'bg-slate-400 border-white text-white'
                          }`}
                        >
                          {idx + 1}
                        </div>

                        {/* Event Card */}
                        <div
                          className={`rounded-lg border p-3.5 transition-shadow ${
                            isCurrent
                              ? 'border-emerald-300 bg-emerald-50/40 shadow-xs'
                              : 'border-slate-200 bg-slate-50/50'
                          }`}
                        >
                          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1 text-xs">
                            <span className="font-semibold text-slate-900">
                              {isCreation
                                ? 'Stage 1: Batch Creation & Initial Custody'
                                : `Stage ${idx + 1}: Custody Transfer`}
                            </span>
                            <span className="inline-flex items-center gap-1 text-[11px] text-slate-500 font-mono">
                              <Clock className="h-3 w-3" />
                              {formatTimestamp(record.timestamp)}
                            </span>
                          </div>

                          <div className="mt-2 grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                            <div className="rounded bg-white p-2 border border-slate-200">
                              <span className="text-[10px] uppercase font-bold text-slate-400 block">
                                Transferred From:
                              </span>
                              <span className="font-mono text-slate-700 block truncate" title={record.from}>
                                {isCreation ? '0x000...000 (Origin / Batch Creation)' : formatAddress(record.from)}
                              </span>
                            </div>
                            <div className="rounded bg-white p-2 border border-slate-200">
                              <span className="text-[10px] uppercase font-bold text-slate-400 block">
                                Transferred To (Custodian):
                              </span>
                              <span className="font-mono font-medium text-emerald-800 block truncate" title={record.to}>
                                {formatAddress(record.to)}
                              </span>
                            </div>
                          </div>

                          {isCurrent && (
                            <div className="mt-2 text-right">
                              <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-700 bg-emerald-100/70 px-2 py-0.5 rounded">
                                <CheckCircle2 className="h-3 w-3" />
                                Current Legal Custodian
                              </span>
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </section>
  );
};
