const request = require('supertest');
const app = require('../src/app');
const taskService = require('../src/services/taskService');

const createTask = async (body = {}) => {
  const res = await request(app)
    .post('/tasks')
    .send({ title: 'Task', ...body });
  return res.body;
};

beforeEach(() => {
  taskService._reset();
});

describe('GET /health', () => {
  it('returns ok', async () => {
    const res = await request(app).get('/health');
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ status: 'ok' });
  });
});

describe('POST /tasks', () => {
  it('creates a task with defaults', async () => {
    const res = await request(app).post('/tasks').send({ title: 'Write tests' });
    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({
      title: 'Write tests',
      status: 'todo',
      priority: 'medium',
      assignee: null,
      completedAt: null,
    });
    expect(res.body.id).toBeDefined();
  });

  it('creates a task with all fields', async () => {
    const res = await request(app)
      .post('/tasks')
      .send({ title: 'Full', description: 'desc', status: 'in_progress', priority: 'high', dueDate: '2030-01-01T00:00:00.000Z' });
    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({ description: 'desc', status: 'in_progress', priority: 'high' });
  });

  it('returns 400 when title is missing', async () => {
    const res = await request(app).post('/tasks').send({});
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/title/);
  });

  it('returns 400 for invalid status, priority and dueDate', async () => {
    expect((await request(app).post('/tasks').send({ title: 'a', status: 'pending' })).status).toBe(400);
    expect((await request(app).post('/tasks').send({ title: 'a', priority: 'urgent' })).status).toBe(400);
    expect((await request(app).post('/tasks').send({ title: 'a', dueDate: 'soon' })).status).toBe(400);
  });

  it('returns 400 (not 500) for malformed JSON', async () => {
    const res = await request(app).post('/tasks').set('Content-Type', 'application/json').send('{"title": ');
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/JSON/);
  });
});

describe('GET /tasks', () => {
  it('returns an empty list initially', async () => {
    const res = await request(app).get('/tasks');
    expect(res.status).toBe(200);
    expect(res.body).toEqual([]);
  });

  it('returns all tasks', async () => {
    await createTask({ title: 'A' });
    await createTask({ title: 'B' });
    const res = await request(app).get('/tasks');
    expect(res.body.map((t) => t.title)).toEqual(['A', 'B']);
  });

  it('filters by exact status', async () => {
    await createTask({ title: 'T', status: 'todo' });
    await createTask({ title: 'D', status: 'done' });
    const res = await request(app).get('/tasks?status=done');
    expect(res.status).toBe(200);
    expect(res.body.map((t) => t.title)).toEqual(['D']);
  });

  it('returns 400 for an unknown status filter', async () => {
    const res = await request(app).get('/tasks?status=o');
    expect(res.status).toBe(400);
  });

  it('paginates starting at page 1', async () => {
    for (let i = 1; i <= 5; i++) await createTask({ title: `Task ${i}` });
    const p1 = await request(app).get('/tasks?page=1&limit=2');
    const p3 = await request(app).get('/tasks?page=3&limit=2');
    expect(p1.body.map((t) => t.title)).toEqual(['Task 1', 'Task 2']);
    expect(p3.body.map((t) => t.title)).toEqual(['Task 5']);
  });

  it('uses defaults when only page or only limit is given', async () => {
    for (let i = 1; i <= 12; i++) await createTask({ title: `Task ${i}` });
    const onlyPage = await request(app).get('/tasks?page=2');
    const onlyLimit = await request(app).get('/tasks?limit=3');
    expect(onlyPage.body).toHaveLength(2);
    expect(onlyLimit.body).toHaveLength(3);
  });

  it('combines status filter with pagination', async () => {
    await createTask({ title: 'T1', status: 'todo' });
    await createTask({ title: 'D1', status: 'done' });
    await createTask({ title: 'D2', status: 'done' });
    const res = await request(app).get('/tasks?status=done&page=2&limit=1');
    expect(res.body.map((t) => t.title)).toEqual(['D2']);
  });

  it.each([['page=0'], ['page=-1'], ['page=abc'], ['limit=0'], ['limit=abc'], ['limit=1000']])(
    'returns 400 for invalid pagination (%s)',
    async (qs) => {
      const res = await request(app).get(`/tasks?${qs}`);
      expect(res.status).toBe(400);
    }
  );
});

describe('PUT /tasks/:id', () => {
  it('updates a task', async () => {
    const task = await createTask({ title: 'Old' });
    const res = await request(app).put(`/tasks/${task.id}`).send({ title: 'New', priority: 'high' });
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ id: task.id, title: 'New', priority: 'high' });
  });

  it('returns 404 for an unknown id', async () => {
    const res = await request(app).put('/tasks/nope').send({ title: 'x' });
    expect(res.status).toBe(404);
  });

  it('returns 400 for invalid data', async () => {
    const task = await createTask();
    const res = await request(app).put(`/tasks/${task.id}`).send({ status: 'nope' });
    expect(res.status).toBe(400);
  });

  it('cannot overwrite id or createdAt', async () => {
    const task = await createTask();
    const res = await request(app).put(`/tasks/${task.id}`).send({ id: 'hacked', createdAt: '2000-01-01T00:00:00.000Z' });
    expect(res.body.id).toBe(task.id);
    expect(res.body.createdAt).toBe(task.createdAt);
  });
});

describe('DELETE /tasks/:id', () => {
  it('deletes a task and returns 204', async () => {
    const task = await createTask();
    const res = await request(app).delete(`/tasks/${task.id}`);
    expect(res.status).toBe(204);
    expect((await request(app).get('/tasks')).body).toEqual([]);
  });

  it('returns 404 for an unknown id', async () => {
    const res = await request(app).delete('/tasks/nope');
    expect(res.status).toBe(404);
  });
});

describe('PATCH /tasks/:id/complete', () => {
  it('marks the task done and keeps its priority', async () => {
    const task = await createTask({ priority: 'high' });
    const res = await request(app).patch(`/tasks/${task.id}/complete`);
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('done');
    expect(res.body.completedAt).not.toBeNull();
    expect(res.body.priority).toBe('high');
  });

  it('returns 404 for an unknown id', async () => {
    const res = await request(app).patch('/tasks/nope/complete');
    expect(res.status).toBe(404);
  });
});

describe('GET /tasks/stats', () => {
  it('returns counts and overdue', async () => {
    await createTask({ status: 'todo', dueDate: '2000-01-01T00:00:00.000Z' });
    await createTask({ status: 'in_progress' });
    await createTask({ status: 'done', dueDate: '2000-01-01T00:00:00.000Z' });
    const res = await request(app).get('/tasks/stats');
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ todo: 1, in_progress: 1, done: 1, overdue: 1 });
  });
});

describe('PATCH /tasks/:id/assign', () => {
  it('assigns a task and returns it', async () => {
    const task = await createTask();
    const res = await request(app).patch(`/tasks/${task.id}/assign`).send({ assignee: 'Asha' });
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ id: task.id, assignee: 'Asha' });
    const list = await request(app).get('/tasks');
    expect(list.body[0].assignee).toBe('Asha');
  });

  it('trims whitespace around the name', async () => {
    const task = await createTask();
    const res = await request(app).patch(`/tasks/${task.id}/assign`).send({ assignee: '  Asha  ' });
    expect(res.body.assignee).toBe('Asha');
  });

  it('allows reassigning an already assigned task', async () => {
    const task = await createTask();
    await request(app).patch(`/tasks/${task.id}/assign`).send({ assignee: 'Asha' });
    const res = await request(app).patch(`/tasks/${task.id}/assign`).send({ assignee: 'Ravi' });
    expect(res.status).toBe(200);
    expect(res.body.assignee).toBe('Ravi');
  });

  it('returns 404 for an unknown task', async () => {
    const res = await request(app).patch('/tasks/nope/assign').send({ assignee: 'Asha' });
    expect(res.status).toBe(404);
  });

  it.each([[{}], [{ assignee: '' }], [{ assignee: '   ' }], [{ assignee: 42 }], [{ assignee: null }], [{ assignee: 'a'.repeat(101) }]])(
    'returns 400 for invalid body %j',
    async (body) => {
      const task = await createTask();
      const res = await request(app).patch(`/tasks/${task.id}/assign`).send(body);
      expect(res.status).toBe(400);
      expect(res.body.error).toMatch(/assignee/);
    }
  );

  it('does not change the assignee when validation fails', async () => {
    const task = await createTask();
    await request(app).patch(`/tasks/${task.id}/assign`).send({ assignee: 'Asha' });
    await request(app).patch(`/tasks/${task.id}/assign`).send({ assignee: '' });
    expect(taskService.findById(task.id).assignee).toBe('Asha');
  });
});

describe('unknown routes', () => {
  it('return a JSON 404', async () => {
    const res = await request(app).get('/nope');
    expect(res.status).toBe(404);
    expect(res.body.error).toBeDefined();
  });
});
