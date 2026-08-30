"use client";

import { useState } from "react";
import { supabase } from "@/lib/supabaseClient";

export default function LoginPage() {
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [businessName, setBusinessName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [checkEmail, setCheckEmail] = useState(false);

  async function handleSignIn(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    setLoading(false);
    if (error) setError(error.message);
  }

  async function handleSignUp(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!businessName.trim()) {
      setError("Enter your business name");
      return;
    }
    setLoading(true);
    // Business row + business_users membership are created by a Postgres
    // trigger on auth.users insert (see supabase/migrations/0003_signup.sql),
    // using the business_name passed in user metadata.
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: { data: { business_name: businessName.trim() } },
    });
    setLoading(false);
    if (error) {
      setError(error.message);
    } else {
      setCheckEmail(true);
    }
  }

  return (
    <div className="min-h-screen flex flex-col justify-center px-6">
      <div className="mb-8 text-center">
        <div className="text-3xl font-bold text-brand">BusinessOS</div>
        <p className="text-slate-500 mt-1">Run your business from your phone</p>
      </div>

      {checkEmail ? (
        <div className="card text-center">
          <p className="font-medium">Check your email</p>
          <p className="text-sm text-slate-500 mt-1">
            We sent a confirmation link to {email}. Confirm it, then sign in below.
          </p>
          <button className="btn-secondary w-full mt-4" onClick={() => { setCheckEmail(false); setMode("signin"); }}>
            Back to sign in
          </button>
        </div>
      ) : (
        <form onSubmit={mode === "signin" ? handleSignIn : handleSignUp} className="card space-y-4">
          <div className="flex rounded-xl bg-slate-100 p-1">
            <button
              type="button"
              className={`flex-1 py-2 rounded-lg text-sm font-medium ${mode === "signin" ? "bg-white shadow-sm" : "text-slate-500"}`}
              onClick={() => setMode("signin")}
            >
              Sign In
            </button>
            <button
              type="button"
              className={`flex-1 py-2 rounded-lg text-sm font-medium ${mode === "signup" ? "bg-white shadow-sm" : "text-slate-500"}`}
              onClick={() => setMode("signup")}
            >
              Create Business
            </button>
          </div>

          {mode === "signup" && (
            <div>
              <label className="label">Business Name</label>
              <input className="input" value={businessName} onChange={(e) => setBusinessName(e.target.value)} placeholder="e.g. Rahman Store" />
            </div>
          )}

          <div>
            <label className="label">Email</label>
            <input className="input" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
          </div>

          <div>
            <label className="label">Password</label>
            <input className="input" type="password" value={password} onChange={(e) => setPassword(e.target.value)} required minLength={6} />
          </div>

          {error && <p className="text-sm text-red-600">{error}</p>}

          <button type="submit" className="btn-primary w-full" disabled={loading}>
            {loading ? "Please wait..." : mode === "signin" ? "Sign In" : "Create Business Account"}
          </button>
        </form>
      )}
    </div>
  );
}
