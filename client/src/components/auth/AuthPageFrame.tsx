
import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import {
  ArrowLeft,
  Leaf,
  Milk,
  ShieldCheck,
  Truck,
} from 'lucide-react'

type AuthPageFrameProps = {
  eyebrow: string
  title: string
  description: string
  children: ReactNode
}

export default function AuthPageFrame({
  eyebrow,
  title,
  description,
  children,
}: AuthPageFrameProps) {
  return (
    <main className="min-h-screen bg-cream">
      <div className="mx-auto grid max-w-7xl gap-10 px-5 py-12 lg:grid-cols-2 lg:items-stretch lg:gap-16 lg:px-8 lg:py-20">
        {/* Authentication content */}
        <section className="mx-auto w-full max-w-lg py-5">
          <Link
            to="/"
            className="inline-flex items-center gap-2 text-sm font-semibold text-brand/65 transition-colors hover:text-brand"
          >
            <ArrowLeft size={17} aria-hidden="true" />
            Back to home
          </Link>

          <div className="mt-12">
            <div className="mb-6 inline-flex items-center gap-2 rounded-full bg-sage px-4 py-2 text-xs font-bold uppercase tracking-wider text-brand">
              <Leaf size={15} aria-hidden="true" />
              {eyebrow}
            </div>

            <h1 className="font-display text-4xl leading-tight text-brand sm:text-5xl">
              {title}
            </h1>

            <p className="mt-5 max-w-md text-sm leading-7 text-brand/65 sm:text-base">
              {description}
            </p>
          </div>

          <div className="mt-9 rounded-[2rem] border border-brand/10 bg-white p-6 shadow-sm sm:p-9">
            {children}
          </div>
        </section>

        {/* Brand panel */}
        <aside className="relative hidden min-h-[650px] flex-col justify-between overflow-hidden rounded-[2.5rem] bg-brand p-12 text-white lg:flex">
          <div className="absolute -right-24 -top-24 h-80 w-80 rounded-full bg-white/5" />
          <div className="absolute -bottom-28 -left-28 h-96 w-96 rounded-full bg-sage/10" />

          <div className="relative z-10">
            <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-white/15">
              <Milk size={32} strokeWidth={1.6} />
            </div>

            <p className="mt-7 text-sm font-extrabold uppercase tracking-[0.25em] text-white/60">
              LOYCE DAIRIES
            </p>
          </div>

          <div className="relative z-10">
            <h2 className="max-w-md font-display text-5xl leading-tight">
              A little fresh.
              <br />
              A lot of{' '}
              <span className="italic text-gold">good.</span>
            </h2>

            <p className="mt-7 max-w-sm text-base leading-8 text-white/70">
              Your favourite dairy essentials, all in one
              convenient place. Browse, choose and enjoy a
              simpler shopping experience.
            </p>

            <div className="mt-12 space-y-5">
              <div className="flex items-center gap-4">
                <Leaf size={21} className="text-gold" />
                <span className="text-sm font-semibold">
                  Everyday dairy favourites
                </span>
              </div>

              <div className="flex items-center gap-4">
                <Truck size={21} className="text-gold" />
                <span className="text-sm font-semibold">
                  Designed for local delivery in Mbarara
                </span>
              </div>

              <div className="flex items-center gap-4">
                <ShieldCheck
                  size={21}
                  className="text-gold"
                />
                <span className="text-sm font-semibold">
                  Account-based shopping
                </span>
              </div>
            </div>
          </div>

          <p className="relative z-10 mt-12 text-xs text-white/50">
            Fresh dairy for everyday living.
          </p>
        </aside>
      </div>
    </main>
  )
}
