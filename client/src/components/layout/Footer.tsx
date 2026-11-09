
export default function Footer() {
  return (
    <footer className="bg-brand px-5 py-12 text-white lg:px-8">
      <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-6">
        <div>
          <p className="text-2xl font-extrabold">
            loyce.
          </p>

          <p className="mt-2 text-sm text-white/60">
            Fresh dairy for everyday living.
          </p>
        </div>

        <p className="text-xs text-white/60">
          © {new Date().getFullYear()} Loyce Dairies · Mbarara, Uganda
        </p>
      </div>
    </footer>
  )
}
