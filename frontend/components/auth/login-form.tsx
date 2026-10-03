"use client";

import Image from "next/image";
import Link from "next/link";
import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, Eye, EyeOff, LockKeyhole, Mail } from "lucide-react";
import { useAuth } from "@/components/auth/auth-provider";

export function LoginForm() {
  const router = useRouter();
  const { login } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
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
    <main className="min-h-screen bg-surface text-brand-navy lg:h-screen lg:overflow-hidden">
      <div className="relative min-h-screen overflow-hidden bg-brand-navy lg:h-full">
        <div className="absolute inset-x-0 top-0 h-[42vh] overflow-hidden bg-brand-navy lg:inset-y-0 lg:right-auto lg:h-auto lg:w-[58%]">
          <Image
            src="/assets/images/login/login2.jpg"
            alt=""
            fill
            priority
            sizes="(max-width: 1024px) 100vw, 58vw"
            className="object-cover object-center"
          />
          <div className="absolute inset-0 bg-brand-navy/25" />
          <div className="absolute inset-0 bg-gradient-to-b from-brand-navy/35 via-brand-navy/20 to-brand-navy/75" />
        </div>

        <section className="relative z-10 flex min-h-[42vh] flex-col justify-between px-6 py-6 text-white sm:px-10 sm:py-8 lg:absolute lg:inset-y-0 lg:left-0 lg:min-h-0 lg:w-[58%] lg:px-12 lg:py-10">
          <Link
            href="/"
            className="inline-flex w-fit items-center gap-2 rounded-full bg-surface px-5 py-3 text-sm font-medium text-brand-navy shadow-sm transition hover:bg-brand-soft-blue"
          >
            <ArrowLeft aria-hidden="true" size={18} strokeWidth={2.25} />
            Back home
          </Link>

          <div className="mt-auto max-w-2xl pb-8 lg:pb-10">
            <h1 className="max-w-2xl text-5xl font-normal leading-[1.08] tracking-tight text-white sm:text-6xl lg:text-7xl">
              Robotics data.
              <br />
              Limitless insight.
            </h1>
          </div>
        </section>

        <section className="relative z-20 -mt-5 flex items-center justify-center rounded-t-[30px] bg-surface px-6 py-10 sm:px-10 lg:absolute lg:inset-y-0 lg:right-0 lg:mt-0 lg:w-[46%] lg:rounded-l-[44px] lg:rounded-tr-none lg:px-12 lg:py-12 xl:px-16">
          <div className="w-full max-w-[560px]">
            <div className="flex items-center gap-5 sm:gap-6">
              <Image
                src="/assets/images/logo.png"
                alt="Dataset Request Desk logo"
                width={1983}
                height={793}
                priority
                className="h-12 w-[112px] shrink-0 object-contain sm:h-14 sm:w-[132px]"
              />
              <div className="h-10 w-px bg-border" aria-hidden="true" />
              <h2 className="text-3xl font-medium tracking-tight sm:text-4xl xl:text-[44px]">
                Welcome back!
              </h2>
            </div>
            <p className="mt-6 text-base text-muted-text sm:text-lg">
              Sign in to your dataset workspace
            </p>

            {error ? (
              <div
                role="alert"
                className="mt-7 rounded-2xl border border-status-bad/25 bg-status-bad/5 px-5 py-3 text-sm text-status-bad"
              >
                {error}
              </div>
            ) : null}

            <form onSubmit={handleSubmit} className="mt-8 space-y-6 sm:mt-10">
              <label className="block">
                <span className="mb-3 block text-sm font-medium text-brand-navy sm:text-base">
                  Email address
                </span>
                <span className="flex h-[58px] items-center gap-4 rounded-full border border-border bg-surface px-5 transition focus-within:border-brand-blue focus-within:ring-4 focus-within:ring-brand-blue/10">
                  <Mail aria-hidden="true" size={21} className="shrink-0 text-muted-text" strokeWidth={1.6} />
                  <input
                    autoComplete="username"
                    type="email"
                    required
                    value={email}
                    onChange={(event) => setEmail(event.target.value)}
                    placeholder="Enter your email"
                    className="h-full min-w-0 flex-1 bg-transparent text-sm text-body-text outline-none placeholder:text-muted-text/75 sm:text-base"
                  />
                </span>
              </label>

              <label className="block">
                <span className="mb-3 block text-sm font-medium text-brand-navy sm:text-base">
                  Password
                </span>
                <span className="flex h-[58px] items-center gap-4 rounded-full border border-border bg-surface px-5 transition focus-within:border-brand-blue focus-within:ring-4 focus-within:ring-brand-blue/10">
                  <LockKeyhole aria-hidden="true" size={21} className="shrink-0 text-muted-text" strokeWidth={1.6} />
                  <input
                    autoComplete="current-password"
                    type={showPassword ? "text" : "password"}
                    required
                    value={password}
                    onChange={(event) => setPassword(event.target.value)}
                    placeholder="Enter your password"
                    className="h-full min-w-0 flex-1 bg-transparent text-sm text-body-text outline-none placeholder:text-muted-text/75 sm:text-base"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((visible) => !visible)}
                    aria-label={showPassword ? "Hide password" : "Show password"}
                    className="shrink-0 text-muted-text transition hover:text-brand-navy"
                  >
                    {showPassword ? (
                      <EyeOff aria-hidden="true" size={20} strokeWidth={1.8} />
                    ) : (
                      <Eye aria-hidden="true" size={20} strokeWidth={1.8} />
                    )}
                  </button>
                </span>
              </label>

              <button
                type="submit"
                disabled={isSubmitting}
                className="mt-2 h-[60px] w-full rounded-full bg-brand-blue px-5 text-base font-semibold text-white transition hover:bg-brand-blue-hover disabled:cursor-not-allowed disabled:opacity-60"
              >
                {isSubmitting ? "Signing in…" : "Sign in"}
              </button>
            </form>

            <p className="mt-8 border-t border-border pt-6 text-center text-sm leading-6 text-muted-text sm:mt-10">
              Access is limited to authorized users. Contact your platform administrator if you need an account.
            </p>
          </div>
        </section>
      </div>
    </main>
  );
}
