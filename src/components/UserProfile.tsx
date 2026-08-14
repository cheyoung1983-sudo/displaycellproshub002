import React from 'react';
import { useSafeAuth0 } from './Auth0ProviderWithConfig.tsx';
import { User, Mail, ShieldCheck, LogIn, Loader2, Sparkles, Key } from 'lucide-react';
import { motion } from 'motion/react';

export default function UserProfile() {
  const { user, isLoading, isAuthenticated, isConfigured, loginWithRedirect } = useSafeAuth0();

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-8 text-slate-400 gap-3">
        <Loader2 className="w-5 h-5 animate-spin text-blue-500" />
        <span className="font-mono text-xs">Authenticating user session...</span>
      </div>
    );
  }

  if (!isAuthenticated || !user) {
    return (
      <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 text-center max-w-md mx-auto space-y-4 text-white">
        <div className="w-12 h-12 bg-slate-800 rounded-2xl flex items-center justify-center mx-auto text-slate-400">
          <User className="w-6 h-6" />
        </div>
        <div>
          <h3 className="font-playfair font-black text-lg">Not Logged In</h3>
          <p className="text-xs text-slate-400 mt-1">
            Sign in with Auth0 to access certified technician telemetry, repair tickets, and lab privileges.
          </p>
        </div>
        <button
          onClick={() => loginWithRedirect()}
          className="px-5 py-2.5 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-xs font-bold transition-all shadow-lg shadow-blue-600/30 flex items-center justify-center gap-2 mx-auto"
        >
          <LogIn className="w-4 h-4" />
          <span>Sign In with Auth0</span>
        </button>
      </div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-slate-900 border border-slate-800 rounded-3xl p-6 sm:p-8 max-w-lg mx-auto text-white shadow-2xl space-y-6"
    >
      <div className="flex items-center gap-4 border-b border-slate-800 pb-5">
        {user.picture ? (
          <img
            src={user.picture}
            alt={user.name || 'User Profile'}
            referrerPolicy="no-referrer"
            className="w-16 h-16 rounded-2xl object-cover border-2 border-blue-500/40 shadow-md"
          />
        ) : (
          <div className="w-16 h-16 rounded-2xl bg-blue-600 flex items-center justify-center text-white text-2xl font-black shadow-md">
            {(user.name || user.email || 'U')[0].toUpperCase()}
          </div>
        )}
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <h2 className="text-xl font-playfair font-black truncate">{user.name || 'Lab Engineer'}</h2>
            <span className="px-2 py-0.5 bg-emerald-500/20 text-emerald-400 font-mono text-[10px] font-bold rounded-md border border-emerald-500/30">
              Active
            </span>
          </div>
          <p className="text-xs text-slate-400 flex items-center gap-1.5 mt-1 truncate">
            <Mail className="w-3.5 h-3.5 text-slate-500 shrink-0" />
            <span className="truncate">{user.email}</span>
          </p>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 text-xs">
        <div className="bg-slate-950 p-3 rounded-2xl border border-slate-800/80 space-y-1">
          <span className="text-[10px] font-mono text-slate-500 uppercase block">Auth Platform</span>
          <span className="text-blue-400 font-bold font-mono">Auth0 Universal Login</span>
        </div>
        <div className="bg-slate-950 p-3 rounded-2xl border border-slate-800/80 space-y-1">
          <span className="text-[10px] font-mono text-slate-500 uppercase block">Security Protocol</span>
          <span className="text-emerald-400 font-bold font-mono flex items-center gap-1">
            <ShieldCheck className="w-3.5 h-3.5" />
            OIDC / PKCE
          </span>
        </div>
      </div>

      {user.sub && (
        <div className="bg-slate-950 p-3 rounded-2xl border border-slate-800/80 space-y-1 text-xs">
          <span className="text-[10px] font-mono text-slate-500 uppercase block">Subject Identifier (sub)</span>
          <code className="text-slate-300 font-mono text-[11px] break-all block">{user.sub}</code>
        </div>
      )}
    </motion.div>
  );
}
