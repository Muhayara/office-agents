import React from 'react';
import type { AgentView, Lang, Task, TaskStatus } from '@office/shared';
import { TASK_STATUS_LABELS } from '../lib/i18n';

interface WorkOrderBoardProps {
  tasks: Task[];
  agents: AgentView[];
  language: Lang;
  selectedTaskId?: string;
  onSelectTask: (taskId: string) => void;
  onMoveTask: (taskId: string, status: TaskStatus) => void;
}

const COLUMNS: TaskStatus[] = ['todo', 'in_progress', 'review', 'done', 'blocked'];

export const WorkOrderBoard: React.FC<WorkOrderBoardProps> = ({
  tasks,
  agents,
  language,
  selectedTaskId,
  onSelectTask,
  onMoveTask,
}) => {
  const agentMap = new Map(agents.map((a) => [a.id, a]));

  return (
    <section className="workorder-strip" aria-label="Papan Tugas 5 Kolom">
      {COLUMNS.map((col) => {
        const colTasks = tasks.filter((t) => t.status === col);
        const colColor =
          col === 'done'
            ? 'var(--ok)'
            : col === 'blocked'
              ? 'var(--danger)'
              : col === 'in_progress'
                ? 'var(--data)'
                : col === 'review'
                  ? 'var(--warn)'
                  : 'var(--text-muted)';

        return (
          <div key={col} className="kanban-col">
            <div className="kanban-col-head">
              <span style={{ color: colColor }}>{TASK_STATUS_LABELS[language][col]}</span>
              <span className="mono">{colTasks.length}</span>
            </div>

            {colTasks.length === 0 ? (
              <div
                className="mono"
                style={{ fontSize: 11, color: 'var(--text-faint)', padding: '6px 2px' }}
              >
                —
              </div>
            ) : (
              colTasks.map((task) => {
                const assignee = agentMap.get(task.assignee);
                const selected = task.id === selectedTaskId;
                return (
                  <div
                    key={task.id}
                    className={`task-card ${selected ? 'selected' : ''}`}
                    style={{
                      borderLeftWidth: 2,
                      borderLeftColor: assignee?.color ?? 'var(--line-strong)',
                    }}
                    onClick={() => onSelectTask(task.id)}
                  >
                    <div className="task-card-title">{task.title}</div>
                    <div className="task-card-meta">
                      <span style={{ color: assignee?.color ?? 'var(--text-muted)' }}>
                        @{task.assignee}
                      </span>
                      <select
                        aria-label={`Ubah status ${task.title}`}
                        value={task.status}
                        onClick={(e) => e.stopPropagation()}
                        onChange={(e) => {
                          e.stopPropagation();
                          onMoveTask(task.id, e.target.value as TaskStatus);
                        }}
                        style={{
                          background: 'var(--bg-0)',
                          color: 'var(--text-muted)',
                          border: '1px solid var(--line)',
                          borderRadius: 2,
                          fontSize: 10,
                          fontFamily: 'var(--font-mono)',
                          padding: '1px 3px',
                        }}
                      >
                        {COLUMNS.map((s) => (
                          <option key={s} value={s}>
                            {s}
                          </option>
                        ))}
                      </select>
                    </div>
                    {task.blockedReason && (
                      <div
                        className="mono"
                        style={{ fontSize: 10, color: 'var(--danger)', marginTop: 3 }}
                      >
                        ! {task.blockedReason}
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>
        );
      })}
    </section>
  );
};
