import type { ParsedResult } from '../../types'

interface Props {
  result: ParsedResult
  onApprove: () => void
  onReject: () => void
}

const badge = 'inline-block px-2 py-0.5 rounded text-xs font-medium'

export default function ParseResultCard({ result, onApprove, onReject }: Props) {
  const hasEvents = result.events?.length > 0
  const hasTodos = result.todos?.length > 0
  const hasClients = result.clients?.length > 0
  const hasProjects = result.projects?.length > 0
  const hasContacts = result.contacts?.length > 0
  const isEmpty = !hasEvents && !hasTodos && !hasClients && !hasProjects && !hasContacts

  return (
    <div className="bg-white rounded-xl border border-indigo-200 shadow-sm overflow-hidden">
      <div className="bg-indigo-50 px-5 py-3 border-b border-indigo-100 flex items-center justify-between">
        <span className="text-sm font-semibold text-indigo-800">실행 결과</span>
        <span className="text-xs text-indigo-500">확인 후 승인하면 저장됩니다</span>
      </div>

      <div className="p-5 space-y-4">
        {isEmpty && (
          <p className="text-sm text-gray-400">추출된 항목이 없습니다.</p>
        )}

        {hasEvents && (
          <Section title="일정">
            {result.events.map((event, index) => (
              <Row key={index}>
                <span className="font-medium">{event.title}</span>
                {event.date && <Tag color="blue">{event.date}{event.time ? ` ${event.time}` : ''}</Tag>}
                {event.location && <Tag color="gray">{event.location}</Tag>}
                {event.client_name && <Tag color="green">{event.client_name}</Tag>}
              </Row>
            ))}
          </Section>
        )}

        {hasTodos && (
          <Section title="할 일">
            {result.todos.map((todo, index) => (
              <Row key={index}>
                <span className="font-medium">{todo.title}</span>
                {todo.due_date && <Tag color="orange">마감 {todo.due_date}</Tag>}
                {todo.priority && (
                  <Tag color={todo.priority === 'high' ? 'red' : todo.priority === 'medium' ? 'yellow' : 'gray'}>
                    {todo.priority === 'high' ? '높음' : todo.priority === 'medium' ? '보통' : '낮음'}
                  </Tag>
                )}
                {todo.assignee && <Tag color="gray">{todo.assignee}</Tag>}
              </Row>
            ))}
          </Section>
        )}

        {hasClients && (
          <Section title="거래처">
            {result.clients.map((client, index) => (
              <Row key={index}>
                <span className="font-medium">{client.name}</span>
                {client.is_new && <Tag color="purple">신규</Tag>}
                {client.action && <span className="text-xs text-gray-500">{client.action}</span>}
              </Row>
            ))}
          </Section>
        )}

        {hasProjects && (
          <Section title="프로젝트">
            {result.projects.map((project, index) => (
              <Row key={index}>
                <span className="font-medium">{project.name}</span>
                {project.client_name && <Tag color="green">{project.client_name}</Tag>}
                {project.milestone && <span className="text-xs text-gray-500">마일스톤: {project.milestone}</span>}
              </Row>
            ))}
          </Section>
        )}

        {hasContacts && (
          <Section title="연락처">
            {result.contacts.map((contact, index) => (
              <Row key={index}>
                <span className="font-medium">{contact.name}</span>
                {contact.company && <Tag color="gray">{contact.company}</Tag>}
                {contact.title && <span className="text-xs text-gray-500">{contact.title}</span>}
              </Row>
            ))}
          </Section>
        )}
      </div>

      <div className="px-5 py-3 border-t border-gray-100 flex gap-2 justify-end">
        <button
          onClick={onReject}
          className="px-4 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
        >
          거부
        </button>
        <button
          onClick={onApprove}
          className="px-4 py-2 text-sm bg-indigo-600 hover:bg-indigo-700 text-white font-medium rounded-lg transition-colors"
        >
          승인 · 저장
        </button>
      </div>
    </div>
  )
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">{title}</p>
      <div className="space-y-1.5">{children}</div>
    </div>
  )
}

function Row({ children }: { children: React.ReactNode }) {
  return <div className="flex items-center flex-wrap gap-2 text-sm text-gray-800">{children}</div>
}

function Tag({ color, children }: { color: string; children: React.ReactNode }) {
  const colors: Record<string, string> = {
    blue: 'bg-blue-100 text-blue-700',
    green: 'bg-green-100 text-green-700',
    orange: 'bg-orange-100 text-orange-700',
    purple: 'bg-purple-100 text-purple-700',
    red: 'bg-red-100 text-red-700',
    yellow: 'bg-yellow-100 text-yellow-700',
    gray: 'bg-gray-100 text-gray-600',
  }
  return <span className={`${badge} ${colors[color] ?? colors.gray}`}>{children}</span>
}
