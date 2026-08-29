import Link from 'next/link'

export default function NotFound() {
  return (
    <div className="min-h-[60vh] flex flex-col items-center justify-center text-center px-4">
      <div className="w-16 h-16 rounded-2xl bg-orange-50 dark:bg-orange-950/50 text-orange-600 dark:text-orange-400 flex items-center justify-center mb-4">
        <span className="text-3xl">🔍</span>
      </div>
      <h2 className="text-xl font-bold text-stone-900 dark:text-white">Page not found</h2>
      <p className="text-sm text-stone-500 dark:text-stone-400 mt-2 max-w-sm">
        The page you&apos;re looking for doesn&apos;t exist or has been moved.
      </p>
      <Link
        href="/"
        className="mt-6 px-4 py-2 rounded-xl bg-[#ea580c] hover:bg-[#c2410c] text-white text-sm font-semibold transition-colors"
      >
        Go to Dashboard
      </Link>
    </div>
  )
}
