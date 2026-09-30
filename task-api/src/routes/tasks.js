const express = require('express');
const router = express.Router();
const taskService = require('../services/taskService');
const {
  validateCreateTask,
  validateUpdateTask,
  validateStatusFilter,
  validatePagination,
  validateAssign,
} = require('../utils/validators');

router.get('/stats', (req, res) => {
  const stats = taskService.getStats();
  res.json(stats);
});

router.get('/', (req, res) => {
  const { status, page, limit } = req.query;
  const hasStatus = status !== undefined && status !== '';
  const hasPaging = page !== undefined || limit !== undefined;

  if (hasStatus) {
    const statusError = validateStatusFilter(status);
    if (statusError) return res.status(400).json({ error: statusError });
  }

  if (hasPaging) {
    const paging = validatePagination({ page, limit });
    if (paging.error) return res.status(400).json({ error: paging.error });
    return res.json(taskService.getPaginated(paging.page, paging.limit, hasStatus ? status : undefined));
  }

  if (hasStatus) {
    return res.json(taskService.getByStatus(status));
  }

  res.json(taskService.getAll());
});

router.post('/', (req, res) => {
  const error = validateCreateTask(req.body);
  if (error) {
    return res.status(400).json({ error });
  }

  const task = taskService.create(req.body);
  res.status(201).json(task);
});

router.put('/:id', (req, res) => {
  const error = validateUpdateTask(req.body);
  if (error) {
    return res.status(400).json({ error });
  }

  const task = taskService.update(req.params.id, req.body);
  if (!task) {
    return res.status(404).json({ error: 'Task not found' });
  }

  res.json(task);
});

router.delete('/:id', (req, res) => {
  const deleted = taskService.remove(req.params.id);
  if (!deleted) {
    return res.status(404).json({ error: 'Task not found' });
  }

  res.status(204).send();
});

router.patch('/:id/complete', (req, res) => {
  const task = taskService.completeTask(req.params.id);
  if (!task) {
    return res.status(404).json({ error: 'Task not found' });
  }

  res.json(task);
});

router.patch('/:id/assign', (req, res) => {
  // 404 is checked before body validation so a missing task is always reported as missing.
  if (!taskService.findById(req.params.id)) {
    return res.status(404).json({ error: 'Task not found' });
  }

  const error = validateAssign(req.body);
  if (error) {
    return res.status(400).json({ error });
  }

  const task = taskService.assignTask(req.params.id, req.body.assignee);
  res.json(task);
});

module.exports = router;
