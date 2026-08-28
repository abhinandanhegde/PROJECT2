import Link from 'next/link'

export default function Sidebar() {
  return (
    <aside className="w-60 shrink-0 border-r h-screen flex flex-col p-4">
      <div className="font-semibold text-lg mb-6">T2 Bug Tracker</div>
      <nav className="flex flex-col gap-2">
        <Link href="/" className="px-3 py-2 rounded hover:bg-gray-100">
          Dashboard
        </Link>
        <Link href="/bugs" className="px-3 py-2 rounded hover:bg-gray-100">
          Bugs
        </Link>
        <Link href="/projects" className="px-3 py-2 rounded hover:bg-gray-100">
          Projects
        </Link>
      </nav>
    </aside>
  )
}