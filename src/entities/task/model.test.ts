import { describe, expect, it } from 'vitest';
import { availableTransitions, type Task } from './model';

const task: Task = {
  id: 'task',
  title: '',
  description: '',
  object_id: 'object',
  assignee_id: 'alice',
  author_id: 'manager',
  status: 'new',
  created_at: '',
  version: 1,
};
describe('available task actions', () => {
  it('never shows actions to an unassigned executor', () => {
    expect(availableTransitions(task, 'executor', 'bob')).toEqual([]);
  });
  it('shows acceptance and rework only when submitted for review', () => {
    expect(
      availableTransitions({ ...task, status: 'review' }, 'manager', 'manager'),
    ).toEqual(['accepted', 'rework']);
    expect(availableTransitions(task, 'manager', 'manager')).toEqual([]);
  });
  it('allows the assigned executor to start and resubmit, never accept', () => {
    expect(availableTransitions(task, 'executor', 'alice')).toEqual([
      'in_progress',
    ]);
    expect(
      availableTransitions({ ...task, status: 'rework' }, 'executor', 'alice'),
    ).toEqual(['in_progress']);
    expect(
      availableTransitions(
        { ...task, status: 'in_progress' },
        'executor',
        'alice',
      ),
    ).toEqual(['review']);
    expect(
      availableTransitions({ ...task, status: 'review' }, 'executor', 'alice'),
    ).toEqual([]);
    expect(
      availableTransitions(
        { ...task, status: 'accepted' },
        'executor',
        'alice',
      ),
    ).toEqual([]);
  });
});
