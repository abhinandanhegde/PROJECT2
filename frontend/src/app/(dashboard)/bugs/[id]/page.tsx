import { notFound } from 'next/navigation'
import { mockBugs, mockComments, severityColors, priorityColors, statusColors } from '@/lib/mockData'

export default async function BugDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const bug = mockBugs.find((b) => b.id === id)

  if (!bug) return notFound()

  const comments = mockComments[bug.id] ?? []

  return (
    <div className="max-w-3xl">
      <div className="flex items-center gap-2 mb-1">
        <span className="font-mono text-xs text-gray-500">{bug.id.slice(0, 8)}</span>
        <span className={`px-2 py-0.5 rounded text-xs ${statusColors[bug.status]}`}>
          {bug.status}
        </span>
      </div>
      <h1 className="text-2xl font-semibold mb-4">{bug.title}</h1>

      <div className="flex gap-2 mb-6">
        <span className={`px-2 py-0.5 rounded text-xs ${severityColors[bug.severity]}`}>
          {bug.severity}
        </span>
        <span className={`px-2 py-0.5 rounded text-xs ${priorityColors[bug.priority]}`}>
          {bug.priority}
        </span>
      </div>

      <div className="grid grid-cols-2 gap-4 text-sm mb-6 p-4 border rounded">
        <div>
          <div className="text-gray-500">Reporter</div>
          <div>{bug.reporter_name ?? 'Unknown'}</div>
        </div>
        <div>
          <div className="text-gray-500">Assignee</div>
          <div>{bug.assignee_name ?? 'Unassigned'}</div>
        </div>
        <div>
          <div className="text-gray-500">Created</div>
          <div>{new Date(bug.created_at).toLocaleString()}</div>
        </div>
        <div>
          <div className="text-gray-500">Updated</div>
          <div>{new Date(bug.updated_at).toLocaleString()}</div>
        </div>
      </div>

      <div className="mb-6">
        <h2 className="font-semibold mb-2">Description</h2>
        <p className="text-sm text-gray-700">{bug.description}</p>
      </div>

      <div>
        <h2 className="font-semibold mb-2">Comments ({comments.length})</h2>
        <div className="space-y-3">
          {comments.length === 0 && (
            <p className="text-sm text-gray-500">No comments yet.</p>
          )}
          {comments.map((c) => (
            <div key={c.id} className="p-3 border rounded text-sm">
              <div className="font-medium mb-1">{c.author_name}</div>
              <div className="text-gray-700">{c.body}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}