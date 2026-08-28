export default function DashboardLoading() {
  return (
    <div className="space-y-6 animate-pulse p-4 sm:p-8 max-w-7xl mx-auto">
      <div className="h-8 w-64 bg-stone-200 dark:bg-stone-800 rounded" />
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {[1, 2, 3, 4].map((n) => (
          <div key={n} className="bg-white dark:bg-stone-900 rounded-2xl p-5 border border-[#eee9e2] dark:border-stone-800 space-y-3">
            <div className="w-20 h-3 bg-stone-200 dark:bg-stone-800 rounded" />
            <div className="w-12 h-7 bg-stone-200 dark:bg-stone-800 rounded" />
          </div>
        ))}
      </div>
      <div className="bg-white dark:bg-stone-900 rounded-2xl p-6 border border-[#eee9e2] dark:border-stone-800 h-64" />
    </div>
  )
}
