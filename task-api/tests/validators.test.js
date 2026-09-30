const {
  validateCreateTask,
  validateUpdateTask,
  validateStatusFilter,
  validatePagination,
  validateAssign,
} = require('../src/utils/validators');

describe('validateCreateTask', () => {
  it('accepts a minimal valid body', () => {
    expect(validateCreateTask({ title: 'ok' })).toBeNull();
  });

  it('accepts a fully populated body', () => {
    expect(
      validateCreateTask({
        title: 'ok',
        description: 'd',
        status: 'done',
        priority: 'low',
        dueDate: '2030-01-01T00:00:00.000Z',
      })
    ).toBeNull();
  });

  it.each([[undefined], [null], [''], ['   '], [123], [{}]])('rejects title %p', (title) => {
    expect(validateCreateTask({ title })).toMatch(/title/);
  });

  it('rejects a missing body', () => {
    expect(validateCreateTask(undefined)).toMatch(/title/);
  });

  it('rejects invalid status, including empty string (regression: falsy values skipped validation)', () => {
    expect(validateCreateTask({ title: 'a', status: 'pending' })).toMatch(/status/);
    expect(validateCreateTask({ title: 'a', status: '' })).toMatch(/status/);
  });

  it('rejects invalid priority, including empty string', () => {
    expect(validateCreateTask({ title: 'a', priority: 'urgent' })).toMatch(/priority/);
    expect(validateCreateTask({ title: 'a', priority: '' })).toMatch(/priority/);
  });

  it('rejects invalid dueDate values', () => {
    expect(validateCreateTask({ title: 'a', dueDate: 'not a date' })).toMatch(/dueDate/);
    expect(validateCreateTask({ title: 'a', dueDate: '' })).toMatch(/dueDate/);
    expect(validateCreateTask({ title: 'a', dueDate: 123 })).toMatch(/dueDate/);
  });

  it('accepts dueDate null', () => {
    expect(validateCreateTask({ title: 'a', dueDate: null })).toBeNull();
  });

  it('rejects non-string description', () => {
    expect(validateCreateTask({ title: 'a', description: 5 })).toMatch(/description/);
  });
});

describe('validateUpdateTask', () => {
  it('accepts an empty body and partial bodies', () => {
    expect(validateUpdateTask({})).toBeNull();
    expect(validateUpdateTask({ priority: 'high' })).toBeNull();
  });

  it('rejects an empty or non-string title when provided', () => {
    expect(validateUpdateTask({ title: '' })).toMatch(/title/);
    expect(validateUpdateTask({ title: 5 })).toMatch(/title/);
  });

  it('rejects invalid status, priority and dueDate', () => {
    expect(validateUpdateTask({ status: 'nope' })).toMatch(/status/);
    expect(validateUpdateTask({ priority: 'nope' })).toMatch(/priority/);
    expect(validateUpdateTask({ dueDate: 'nope' })).toMatch(/dueDate/);
  });
});

describe('validateStatusFilter', () => {
  it('accepts known statuses only', () => {
    expect(validateStatusFilter('todo')).toBeNull();
    expect(validateStatusFilter('in_progress')).toBeNull();
    expect(validateStatusFilter('done')).toBeNull();
    expect(validateStatusFilter('o')).toMatch(/status/);
    expect(validateStatusFilter(['todo', 'done'])).toMatch(/status/);
  });
});

describe('validatePagination', () => {
  it('applies defaults', () => {
    expect(validatePagination({})).toEqual({ page: 1, limit: 10 });
  });

  it('parses valid values', () => {
    expect(validatePagination({ page: '3', limit: '25' })).toEqual({ page: 3, limit: 25 });
  });

  it.each([['0'], ['-1'], ['abc'], ['1.5'], [''], [['1', '2']]])('rejects page %p', (page) => {
    expect(validatePagination({ page }).error).toMatch(/page/);
  });

  it.each([['0'], ['-5'], ['abc']])('rejects limit %p', (limit) => {
    expect(validatePagination({ limit }).error).toMatch(/limit/);
  });

  it('caps the limit', () => {
    expect(validatePagination({ limit: '100' })).toEqual({ page: 1, limit: 100 });
    expect(validatePagination({ limit: '101' }).error).toMatch(/limit/);
  });
});

describe('validateAssign', () => {
  it('accepts a normal name', () => {
    expect(validateAssign({ assignee: 'Asha' })).toBeNull();
  });

  it.each([[undefined], [null], [''], ['   '], [42], [['a']], [{}]])('rejects assignee %p', (assignee) => {
    expect(validateAssign({ assignee })).toMatch(/assignee/);
  });

  it('rejects a missing body', () => {
    expect(validateAssign(undefined)).toMatch(/assignee/);
  });

  it('rejects names over 100 characters', () => {
    expect(validateAssign({ assignee: 'a'.repeat(101) })).toMatch(/assignee/);
    expect(validateAssign({ assignee: 'a'.repeat(100) })).toBeNull();
  });
});
