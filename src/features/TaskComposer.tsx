import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { apiGet, apiPost, errorMessage } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import type { EmployeeListItem, TaskStatusRef } from '@/types/api';
import { Button, Checkbox, Input, Modal, Select, Textarea } from '@/components/ui';

const PRIORITIES = ['LOW', 'MEDIUM', 'HIGH', 'URGENT'] as const;

/**
 * Task creation, used from the board, a project, a retainer cycle and the task
 * list. A task always belongs to exactly one of a project or a cycle, which the
 * caller decides by which id it passes.
 */
export function TaskComposer({
  onClose,
  projectId,
  retainerCycleId,
  statusId,
  stageId,
  statuses,
  parentTaskId,
}: {
  onClose: () => void;
  projectId?: string;
  retainerCycleId?: string;
  statusId?: string;
  stageId?: string;
  statuses: TaskStatusRef[];
  parentTaskId?: string;
}) {
  const queryClient = useQueryClient();
  const { can, user } = useAuth();

  const [form, setForm] = useState({
    title: '',
    description: '',
    statusId: statusId ?? statuses.find((status) => status.isDefault)?.id ?? statuses[0]?.id ?? '',
    assigneeId: can('tasks.assign') ? '' : (user?.employee?.id ?? ''),
    priority: 'MEDIUM',
    dueDate: '',
    estimateHours: '',
    visibleToClient: false,
  });
  const [checklist, setChecklist] = useState<string[]>([]);
  const [checklistDraft, setChecklistDraft] = useState('');

  const employees = useQuery({
    queryKey: ['options', 'employees'],
    queryFn: () => apiGet<EmployeeListItem[]>('/employees/options/all'),
    enabled: can('tasks.assign'),
  });

  const create = useMutation({
    mutationFn: () =>
      apiPost('/tasks', {
        title: form.title,
        description: form.description || undefined,
        projectId: projectId ?? null,
        retainerCycleId: retainerCycleId ?? null,
        stageId: stageId ?? null,
        statusId: form.statusId,
        assigneeId: form.assigneeId || null,
        parentTaskId: parentTaskId ?? null,
        priority: form.priority,
        dueDate: form.dueDate || null,
        estimateHours: form.estimateHours ? Number(form.estimateHours) : null,
        visibleToClient: form.visibleToClient,
        checklist,
      }),
    onSuccess: () => {
      toast.success('Task created');
      void queryClient.invalidateQueries({ queryKey: ['tasks'] });
      void queryClient.invalidateQueries({ queryKey: ['project', projectId] });
      void queryClient.invalidateQueries({ queryKey: ['retainer-cycle', retainerCycleId] });
      onClose();
    },
    onError: (caught) => toast.error(errorMessage(caught)),
  });

  const addChecklistItem = () => {
    const value = checklistDraft.trim();
    if (!value) return;
    setChecklist((current) => [...current, value]);
    setChecklistDraft('');
  };

  return (
    <Modal
      open
      onClose={onClose}
      title={parentTaskId ? 'Add subtask' : 'New task'}
      size="lg"
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button
            loading={create.isPending}
            disabled={form.title.trim().length < 2 || !form.statusId}
            onClick={() => create.mutate()}
          >
            Create task
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <Input
          label="What needs doing?"
          required
          value={form.title}
          onChange={(event) => setForm({ ...form, title: event.target.value })}
          placeholder="e.g. Design the homepage hero"
        />

        <Textarea
          label="Details"
          value={form.description}
          onChange={(event) => setForm({ ...form, description: event.target.value })}
          rows={3}
          placeholder="Context, links, references."
        />

        <div className="grid gap-4 sm:grid-cols-2">
          <Select
            label="Status"
            required
            value={form.statusId}
            onChange={(event) => setForm({ ...form, statusId: event.target.value })}
            options={statuses.map((status) => ({ value: status.id, label: status.name }))}
          />
          <Select
            label="Priority"
            value={form.priority}
            onChange={(event) => setForm({ ...form, priority: event.target.value })}
            options={PRIORITIES.map((value) => ({
              value,
              label: value.charAt(0) + value.slice(1).toLowerCase(),
            }))}
          />
        </div>

        <div className="grid gap-4 sm:grid-cols-3">
          {can('tasks.assign') ? (
            <Select
              label="Assignee"
              value={form.assigneeId}
              onChange={(event) => setForm({ ...form, assigneeId: event.target.value })}
              placeholder="Unassigned"
              options={(employees.data ?? []).map((employee) => ({
                value: employee.id,
                label: employee.user.name,
              }))}
            />
          ) : (
            <Input label="Assignee" value={user?.name ?? ''} disabled />
          )}
          <Input
            label="Due date"
            type="date"
            value={form.dueDate}
            onChange={(event) => setForm({ ...form, dueDate: event.target.value })}
          />
          <Input
            label="Estimate (hours)"
            type="number"
            min={0}
            step={0.5}
            value={form.estimateHours}
            onChange={(event) => setForm({ ...form, estimateHours: event.target.value })}
          />
        </div>

        <div>
          <span className="dd-label">Checklist</span>
          <div className="flex gap-2">
            <input
              value={checklistDraft}
              onChange={(event) => setChecklistDraft(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === 'Enter') {
                  event.preventDefault();
                  addChecklistItem();
                }
              }}
              placeholder="Add an item and press Enter"
              className="dd-input"
            />
            <Button variant="secondary" onClick={addChecklistItem} type="button">
              Add
            </Button>
          </div>
          {checklist.length > 0 && (
            <ul className="mt-2 space-y-1">
              {checklist.map((item, index) => (
                <li
                  key={`${item}-${index}`}
                  className="flex items-center gap-2 rounded-md bg-surface-2 px-2.5 py-1.5 text-sm text-fg"
                >
                  <span className="flex-1">{item}</span>
                  <button
                    type="button"
                    onClick={() => setChecklist((current) => current.filter((_, i) => i !== index))}
                    className="text-xs text-muted hover:text-danger"
                  >
                    Remove
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>

        <Checkbox
          checked={form.visibleToClient}
          onChange={(event) => setForm({ ...form, visibleToClient: event.target.checked })}
          label="Show this task in the client portal"
          description="Off by default — internal work stays internal."
        />
      </div>
    </Modal>
  );
}
