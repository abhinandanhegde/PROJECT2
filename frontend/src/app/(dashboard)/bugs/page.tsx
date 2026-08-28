import Link from 'next/link'
import { mockBugs, severityColors, priorityColors } from '@/lib/mockData'

export default function BugsPage() {
  return (
    <div>
      <div className="flex justify-between items-center mb-4">
        <h1 className="text-xl font-semibold">Bugs</h1>
        <Link href="/bugs/new" className="text-sm px-3 py-1.5 rounded bg-black text-white">
          + New Bug
        </Link>
      </div>
      <table className="w-full text-sm border-collapse">
        <thead>
          <tr className="text-left border-b">
            <th className="py-2">ID</th>
            <th>Title</th>
            <th>Severity</th>
            <th>Priority</th>
            <th>Status</th>
            <th>Assignee</th>
          </tr>
        </thead>
        <tbody>
          {mockBugs.map((bug) => (
            <tr key={bug.id} className="border-b hover:bg-gray-50">
              <td className="py-2 font-mono text-xs">
                <Link href={`/bugs/${bug.id}`} className="text-blue-600 hover:underline">
                  {bug.id.slice(0, 8)}
                </Link>
              </td>
              <td>
                <Link href={`/bugs/${bug.id}`} className="hover:underline">
                  {bug.title}
                </Link>
              </td>
              <td>
                <span className={`px-2 py-0.5 rounded text-xs ${severityColors[bug.severity]}`}>
                  {bug.severity}
                </span>
              </td>
              <td>
                <span className={`px-2 py-0.5 rounded text-xs ${priorityColors[bug.priority]}`}>
                  {bug.priority}
                </span>
              </td>
              <td>{bug.status}</td>
              <td>{bug.assignee_name ?? 'Unassigned'}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}