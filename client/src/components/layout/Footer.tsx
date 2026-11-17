import { Link } from 'react-router-dom'

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

        <div className="flex flex-col gap-2 text-sm">
          <Link
            to="/account-deletion"
            className="font-semibold text-white/90 underline underline-offset-4 hover:text-white"
          >
            Request account deletion
          </Link>
          <p className="text-xs text-white/60">
            © {new Date().getFullYear()} Loyce Dairies · Mbarara, Uganda
          </p>
        </div>
      </div>
    </footer>
  )
}
