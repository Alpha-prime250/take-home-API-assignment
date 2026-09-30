const taskService = require('../src/services/taskService');

const daysFromNow = (n) => new Date(Date.now() + n * 24 * 60 * 60 * 1000).toISOString();

beforeEach(() => {
  taskService._reset();
});

describe('create', () => {
  it('applies defaults', () => {
    const task = taskService.create({ title: 'A' });
    expect(task).toMatchObject({
      title: 'A',
      description: '',
      status: 'todo',
      priority: 'medium',
      dueDate: null,
      assignee: null,
      completedAt: null,
    });
    expect(typeof task.id).toBe('string');
    expect(Number.isNaN(Date.parse(task.createdAt))).toBe(false);
  });

  it('keeps provided values and generates unique ids', () => {
    const a = taskService.create({ title: 'A', status: 'in_progress', priority: 'high', dueDate: daysFromNow(1) });
    const b = taskService.create({ title: 'B' });
    expect(a.status).toBe('in_progress');
    expect(a.priority).toBe('high');
    expect(a.id).not.toBe(b.id);
  });
});

describe('getAll / findById', () => {
  it('getAll returns a copy so callers cannot mutate the store', () => {
    taskService.create({ title: 'A' });
    const list = taskService.getAll();
    list.pop();
    expect(taskService.getAll()).toHaveLength(1);
  });

  it('findById returns the task or undefined', () => {
    const t = taskService.create({ title: 'A' });
    expect(taskService.findById(t.id)).toEqual(t);
    expect(taskService.findById('nope')).toBeUndefined();
  });
});

describe('getByStatus', () => {
  beforeEach(() => {
    taskService.create({ title: 'T', status: 'todo' });
    taskService.create({ title: 'P', status: 'in_progress' });
    taskService.create({ title: 'D', status: 'done' });
  });

  it('returns only exact status matches', () => {
    expect(taskService.getByStatus('todo').map((t) => t.title)).toEqual(['T']);
    expect(taskService.getByStatus('done').map((t) => t.title)).toEqual(['D']);
  });

  it('does not do substring matching (regression: "o" used to match todo and done)', () => {
    expect(taskService.getByStatus('o')).toEqual([]);
    expect(taskService.getByStatus('progress')).toEqual([]);
  });
});

describe('getPaginated', () => {
  beforeEach(() => {
    for (let i = 1; i <= 5; i++) taskService.create({ title: `Task ${i}` });
  });

  it('page 1 starts at the first task (regression: was skipping the first page)', () => {
    expect(taskService.getPaginated(1, 2).map((t) => t.title)).toEqual(['Task 1', 'Task 2']);
  });

  it('returns following pages and a short last page', () => {
    expect(taskService.getPaginated(2, 2).map((t) => t.title)).toEqual(['Task 3', 'Task 4']);
    expect(taskService.getPaginated(3, 2).map((t) => t.title)).toEqual(['Task 5']);
  });

  it('returns an empty list past the last page', () => {
    expect(taskService.getPaginated(4, 2)).toEqual([]);
  });

  it('can filter by status before paging', () => {
    taskService.create({ title: 'Done 1', status: 'done' });
    taskService.create({ title: 'Done 2', status: 'done' });
    taskService.create({ title: 'Done 3', status: 'done' });
    expect(taskService.getPaginated(1, 2, 'done').map((t) => t.title)).toEqual(['Done 1', 'Done 2']);
    expect(taskService.getPaginated(2, 2, 'done').map((t) => t.title)).toEqual(['Done 3']);
  });
});

describe('getStats', () => {
  it('returns zeros when empty', () => {
    expect(taskService.getStats()).toEqual({ todo: 0, in_progress: 0, done: 0, overdue: 0 });
  });

  it('counts by status', () => {
    taskService.create({ title: 'a', status: 'todo' });
    taskService.create({ title: 'b', status: 'todo' });
    taskService.create({ title: 'c', status: 'in_progress' });
    taskService.create({ title: 'd', status: 'done' });
    expect(taskService.getStats()).toEqual({ todo: 2, in_progress: 1, done: 1, overdue: 0 });
  });

  it('counts overdue only for unfinished tasks with a past due date', () => {
    taskService.create({ title: 'past todo', dueDate: daysFromNow(-2) });
    taskService.create({ title: 'past in progress', status: 'in_progress', dueDate: daysFromNow(-1) });
    taskService.create({ title: 'past done', status: 'done', dueDate: daysFromNow(-3) });
    taskService.create({ title: 'future', dueDate: daysFromNow(5) });
    taskService.create({ title: 'no due date' });
    expect(taskService.getStats().overdue).toBe(2);
  });
});

describe('update', () => {
  it('updates allowed fields and keeps the rest', () => {
    const t = taskService.create({ title: 'Old', priority: 'low' });
    const updated = taskService.update(t.id, { title: 'New', priority: 'high' });
    expect(updated.title).toBe('New');
    expect(updated.priority).toBe('high');
    expect(updated.id).toBe(t.id);
    expect(taskService.findById(t.id)).toEqual(updated);
  });

  it('returns null for an unknown id', () => {
    expect(taskService.update('nope', { title: 'x' })).toBeNull();
  });

  it('ignores protected and unknown fields (regression: id/createdAt could be overwritten)', () => {
    const t = taskService.create({ title: 'A' });
    const updated = taskService.update(t.id, {
      id: 'hacked',
      createdAt: '2000-01-01T00:00:00.000Z',
      completedAt: '2000-01-01T00:00:00.000Z',
      assignee: 'Mallory',
      isAdmin: true,
      title: 'B',
    });
    expect(updated.id).toBe(t.id);
    expect(updated.createdAt).toBe(t.createdAt);
    expect(updated.completedAt).toBeNull();
    expect(updated.assignee).toBeNull();
    expect(updated.isAdmin).toBeUndefined();
    expect(updated.title).toBe('B');
  });

  it('can clear dueDate with null', () => {
    const t = taskService.create({ title: 'A', dueDate: daysFromNow(1) });
    expect(taskService.update(t.id, { dueDate: null }).dueDate).toBeNull();
  });

  it('sets completedAt when moved to done and clears it when moved back', () => {
    const t = taskService.create({ title: 'A' });
    const done = taskService.update(t.id, { status: 'done' });
    expect(done.completedAt).not.toBeNull();
    const reopened = taskService.update(t.id, { status: 'todo' });
    expect(reopened.completedAt).toBeNull();
  });
});

describe('remove', () => {
  it('removes an existing task', () => {
    const t = taskService.create({ title: 'A' });
    expect(taskService.remove(t.id)).toBe(true);
    expect(taskService.getAll()).toHaveLength(0);
  });

  it('returns false for an unknown id', () => {
    expect(taskService.remove('nope')).toBe(false);
  });
});

describe('completeTask', () => {
  it('marks the task done and sets completedAt', () => {
    const t = taskService.create({ title: 'A' });
    const done = taskService.completeTask(t.id);
    expect(done.status).toBe('done');
    expect(Number.isNaN(Date.parse(done.completedAt))).toBe(false);
  });

  it('keeps the existing priority (regression: priority was reset to medium)', () => {
    const high = taskService.create({ title: 'H', priority: 'high' });
    const low = taskService.create({ title: 'L', priority: 'low' });
    expect(taskService.completeTask(high.id).priority).toBe('high');
    expect(taskService.completeTask(low.id).priority).toBe('low');
  });

  it('does not move completedAt when completing twice', () => {
    const t = taskService.create({ title: 'A' });
    const first = taskService.completeTask(t.id);
    const second = taskService.completeTask(t.id);
    expect(second.completedAt).toBe(first.completedAt);
  });

  it('returns null for an unknown id', () => {
    expect(taskService.completeTask('nope')).toBeNull();
  });
});

describe('assignTask', () => {
  it('stores the trimmed assignee', () => {
    const t = taskService.create({ title: 'A' });
    const updated = taskService.assignTask(t.id, '  Asha  ');
    expect(updated.assignee).toBe('Asha');
    expect(taskService.findById(t.id).assignee).toBe('Asha');
  });

  it('allows reassignment', () => {
    const t = taskService.create({ title: 'A' });
    taskService.assignTask(t.id, 'Asha');
    expect(taskService.assignTask(t.id, 'Ravi').assignee).toBe('Ravi');
  });

  it('returns null for an unknown id', () => {
    expect(taskService.assignTask('nope', 'Asha')).toBeNull();
  });
});
