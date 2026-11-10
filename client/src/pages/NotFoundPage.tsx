
import { Link } from 'react-router-dom'

export default function NotFoundPage() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-cream px-5 text-center">
      <p className="text-sm font-bold uppercase tracking-widest text-brand-light">
        404 · Page not found
      </p>

      <h1 className="mt-5 font-display text-5xl text-brand">
        This page wandered off.
      </h1>

      <p className="mt-5 max-w-md text-brand/60">
        The page you're looking for doesn't exist.
      </p>

      <Link
        to="/"
        className="mt-8 rounded-full bg-brand px-8 py-4 text-sm font-bold text-white"
      >
        Return home
      </Link>
    </main>
  )
}
