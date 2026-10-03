"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/components/auth/auth-provider";

export function LoginForm() {
  const router = useRouter();
  const { login } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setIsSubmitting(true);

    try {
      await login({ email, password });
      router.replace("/portal");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Unable to sign in. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <main className="min-h-screen bg-[#f4f6f8] text-slate-900">
      <div className="grid min-h-screen lg:grid-cols-[1.1fr_0.9fr]">
        <section className="relative hidden overflow-hidden bg-[#10251f] p-12 text-white lg:flex lg:flex-col lg:justify-between">
          <div className="absolute -right-24 -top-24 h-96 w-96 rounded-full border border-white/10" />
          <div className="absolute -right-8 -top-8 h-64 w-64 rounded-full border border-white/10" />
          <div className="relative flex items-center gap-3">
            <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-emerald-400 font-bold text-emerald-950">D</span>
            <span className="font-semibold tracking-wide">FIELDNOTES <span className="font-normal text-emerald-300">/ DATA OPS</span></span>
          </div>
          <div className="relative max-w-xl pb-12">
            <p className="text-sm font-semibold uppercase tracking-[0.24em] text-emerald-300">Dataset Request Desk</p>
            <h1 className="mt-5 text-5xl font-semibold leading-tight tracking-tight">
              From robot recordings to ready-to-use data.
            </h1>
            <p className="mt-6 max-w-lg text-lg leading-8 text-slate-300">
              A shared workspace for requesting, curating, and delivering high-quality robotics datasets.
            </p>
            <div className="mt-12 grid grid-cols-3 gap-5 border-t border-white/15 pt-6 text-sm text-slate-300">
              <p><strong className="block text-2xl text-white">01</strong>Request</p>
              <p><strong className="block text-2xl text-white">02</strong>Curate</p>
              <p><strong className="block text-2xl text-white">03</strong>Deliver</p>
            </div>
          </div>
          <p className="relative text-xs text-slate-400">INTERNAL DATA OPERATIONS PLATFORM</p>
        </section>

        <section className="flex items-center justify-center px-5 py-12 sm:px-10">
          <div className="w-full max-w-md">
            <div className="mb-10 flex items-center gap-3 lg:hidden">
              <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-800 font-bold text-white">D</span>
              <span className="font-semibold tracking-wide">FIELDNOTES <span className="font-normal text-emerald-700">/ DATA OPS</span></span>
            </div>
            <p className="text-sm font-semibold uppercase tracking-[0.2em] text-emerald-800">Welcome back</p>
            <h2 className="mt-3 text-3xl font-semibold tracking-tight">Sign in to your workspace</h2>
            <p className="mt-3 text-sm leading-6 text-slate-500">
              Use your organization account to manage dataset requests.
            </p>

            {error ? (
              <div role="alert" className="mt-6 rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800">
                {error}
              </div>
            ) : null}

            <form onSubmit={handleSubmit} className="mt-8 space-y-5">
              <label className="block">
                <span className="mb-2 block text-sm font-medium text-slate-700">Email address</span>
                <input
                  autoComplete="username"
                  type="email"
                  required
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  placeholder="name@company.com"
                  className="w-full rounded-lg border border-slate-300 bg-white px-4 py-3 outline-none transition placeholder:text-slate-400 focus:border-emerald-700 focus:ring-2 focus:ring-emerald-700/15"
                />
              </label>
              <label className="block">
                <span className="mb-2 block text-sm font-medium text-slate-700">Password</span>
                <input
                  autoComplete="current-password"
                  type="password"
                  required
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  placeholder="Enter your password"
                  className="w-full rounded-lg border border-slate-300 bg-white px-4 py-3 outline-none transition placeholder:text-slate-400 focus:border-emerald-700 focus:ring-2 focus:ring-emerald-700/15"
                />
              </label>
              <button
                type="submit"
                disabled={isSubmitting}
                className="w-full rounded-lg bg-emerald-800 px-4 py-3 font-semibold text-white transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {isSubmitting ? "Signing in…" : "Sign in"}
              </button>
            </form>

            <p className="mt-8 border-t border-slate-200 pt-5 text-xs leading-5 text-slate-500">
              Access is managed by your platform administrator. Contact your team if you need an account.
            </p>
          </div>
        </section>
      </div>
    </main>
  );
}
