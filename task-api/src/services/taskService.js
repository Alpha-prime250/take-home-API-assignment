const { v4: uuidv4 } = require('uuid');

let tasks = [];

// Fields a client may change through PUT. id, createdAt, completedAt and assignee
// are managed by the server / dedicated endpoints and must never be overwritten here.
const UPDATABLE_FIELDS = ['title', 'description', 'status', 'priority', 'dueDate'];

const getAll = () => [...tasks];

const findById = (id) => tasks.find((t) => t.id === id);

const getByStatus = (status) => tasks.filter((t) => t.status === status);

// page is 1-based. Optional status narrows the list before paging.
const getPaginated = (page, limit, status) => {
  const source = status ? getByStatus(status) : tasks;
  const offset = (page - 1) * limit;
  return source.slice(offset, offset + limit);
};

const getStats = () => {
  const now = new Date();
  const counts = { todo: 0, in_progress: 0, done: 0 };
  let overdue = 0;

  tasks.forEach((t) => {
    if (counts[t.status] !== undefined) counts[t.status]++;
    if (t.dueDate && t.status !== 'done' && new Date(t.dueDate) < now) {
      overdue++;
    }
  });

  return { ...counts, overdue };
};

const create = ({ title, description = '', status = 'todo', priority = 'medium', dueDate = null }) => {
  const task = {
    id: uuidv4(),
    title,
    description,
    status,
    priority,
    dueDate,
    assignee: null,
    completedAt: null,
    createdAt: new Date().toISOString(),
  };
  tasks.push(task);
  return task;
};

const update = (id, fields) => {
  const index = tasks.findIndex((t) => t.id === id);
  if (index === -1) return null;

  const current = tasks[index];
  const changes = {};
  UPDATABLE_FIELDS.forEach((key) => {
    if (fields[key] !== undefined) changes[key] = fields[key];
  });

  const updated = { ...current, ...changes };

  // Keep completedAt consistent with status when it is changed through PUT.
  if (updated.status === 'done' && current.status !== 'done') {
    updated.completedAt = new Date().toISOString();
  } else if (updated.status !== 'done' && current.status === 'done') {
    updated.completedAt = null;
  }

  tasks[index] = updated;
  return updated;
};

const remove = (id) => {
  const index = tasks.findIndex((t) => t.id === id);
  if (index === -1) return false;

  tasks.splice(index, 1);
  return true;
};

const completeTask = (id) => {
  const index = tasks.findIndex((t) => t.id === id);
  if (index === -1) return null;

  const task = tasks[index];
  const updated = {
    ...task,
    status: 'done',
    // Completing an already-completed task must not move the original timestamp.
    completedAt: task.status === 'done' && task.completedAt ? task.completedAt : new Date().toISOString(),
  };

  tasks[index] = updated;
  return updated;
};

const assignTask = (id, assignee) => {
  const index = tasks.findIndex((t) => t.id === id);
  if (index === -1) return null;

  const updated = { ...tasks[index], assignee: assignee.trim() };
  tasks[index] = updated;
  return updated;
};

const _reset = () => {
  tasks = [];
};

module.exports = {
  getAll,
  findById,
  getByStatus,
  getPaginated,
  getStats,
  create,
  update,
  remove,
  completeTask,
  assignTask,
  _reset,
};
