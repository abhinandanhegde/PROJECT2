export default function Header() {
    return (
      <header className="h-14 border-b flex items-center px-6 justify-between">
        <div className="text-sm text-gray-500">Search bugs...</div>
        <div className="flex items-center gap-3">
          <button className="text-sm px-3 py-1.5 rounded border">Logout</button>
        </div>
      </header>
    )
  }