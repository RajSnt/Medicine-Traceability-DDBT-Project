import React, { useState } from 'react';
import { CONTRACT_CONFIG, formatAddress } from '../lib/contracts';
import { Copy, Check, ChevronDown, ChevronUp, Layers, Key } from 'lucide-react';

export const ContractReference: React.FC = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  const copyToClipboard = (text: string, key: string) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(null), 2000);
  };

  return (
    <div className="rounded-xl border border-slate-200 bg-slate-50 text-xs text-slate-700 overflow-hidden shadow-2xs">
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex items-center justify-between px-4 py-3 bg-slate-100 hover:bg-slate-200/70 transition-colors font-medium text-slate-800"
      >
        <div className="flex items-center gap-2">
          <Layers className="h-4 w-4 text-slate-600" />
          <span>Deployed Contracts & Demo Accounts (Remix VM / Local EVM)</span>
        </div>
        <div className="flex items-center gap-1 text-slate-500">
          <span>{isOpen ? 'Hide Details' : 'View Addresses & Roles'}</span>
          {isOpen ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
        </div>
      </button>

      {isOpen && (
        <div className="p-4 space-y-4 border-t border-slate-200 bg-white">
          {/* Contracts */}
          <div>
            <h4 className="font-semibold text-slate-900 mb-2 flex items-center gap-1">
              <Layers className="h-3.5 w-3.5 text-indigo-600" />
              Contract Addresses:
            </h4>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
              {Object.entries(CONTRACT_CONFIG.addresses).map(([name, addr]) => (
                <div key={name} className="rounded-lg border border-slate-200 bg-slate-50 p-2.5">
                  <span className="text-[11px] font-semibold text-slate-700 capitalize block">
                    {name.replace(/([A-Z])/g, ' $1')}
                  </span>
                  <div className="mt-1 flex items-center justify-between">
                    <span className="font-mono text-[11px] text-slate-600 truncate" title={addr}>
                      {formatAddress(addr)}
                    </span>
                    <button
                      type="button"
                      onClick={() => copyToClipboard(addr, name)}
                      className="ml-1 p-1 hover:bg-slate-200 rounded text-slate-500"
                      title="Copy Address"
                    >
                      {copiedKey === name ? (
                        <Check className="h-3.5 w-3.5 text-emerald-600" />
                      ) : (
                        <Copy className="h-3.5 w-3.5" />
                      )}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Demo Accounts */}
          <div>
            <h4 className="font-semibold text-slate-900 mb-2 flex items-center gap-1">
              <Key className="h-3.5 w-3.5 text-emerald-600" />
              Demo Roles & Accounts (Pre-configured):
            </h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-5 gap-2">
              {Object.entries(CONTRACT_CONFIG.demoAccounts).map(([roleName, addr]) => (
                <div key={roleName} className="rounded-lg border border-slate-200 bg-slate-50 p-2">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 block">
                    {roleName}
                  </span>
                  <div className="mt-1 flex items-center justify-between">
                    <span className="font-mono text-[11px] text-slate-800 truncate" title={addr}>
                      {formatAddress(addr)}
                    </span>
                    <button
                      type="button"
                      onClick={() => copyToClipboard(addr, roleName)}
                      className="ml-1 p-1 hover:bg-slate-200 rounded text-slate-500"
                      title="Copy Address"
                    >
                      {copiedKey === roleName ? (
                        <Check className="h-3 w-3 text-emerald-600" />
                      ) : (
                        <Copy className="h-3 w-3" />
                      )}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded bg-slate-50 p-2 text-[11px] text-slate-600 border border-slate-200">
            <strong>Wiring Rule (Zero Constructor Cycles):</strong> Deploy <code className="font-mono">RoleManager</code> → Deploy <code className="font-mono">BatchRegistry(RoleManager)</code> → Deploy <code className="font-mono">CustodyTracker(RoleManager, BatchRegistry)</code> → Admin calls <code className="font-mono">BatchRegistry.setCustodyTracker(CustodyTracker)</code> once. Registration is disabled until configured.
          </div>
        </div>
      )}
    </div>
  );
};
