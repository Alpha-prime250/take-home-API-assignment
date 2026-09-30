const VALID_STATUSES = ['todo', 'in_progress', 'done'];
const VALID_PRIORITIES = ['low', 'medium', 'high'];
const MAX_LIMIT = 100;
const MAX_ASSIGNEE_LENGTH = 100;

const isValidDateString = (value) => typeof value === 'string' && !isNaN(Date.parse(value));

// Shared field checks. A field is only validated when it is present (!== undefined),
// so falsy-but-invalid values such as '' or 0 are rejected instead of silently passing.
const validateOptionalFields = (body) => {
  if (body.description !== undefined && typeof body.description !== 'string') {
    return 'description must be a string';
  }
  if (body.status !== undefined && !VALID_STATUSES.includes(body.status)) {
    return `status must be one of: ${VALID_STATUSES.join(', ')}`;
  }
  if (body.priority !== undefined && !VALID_PRIORITIES.includes(body.priority)) {
    return `priority must be one of: ${VALID_PRIORITIES.join(', ')}`;
  }
  if (body.dueDate !== undefined && body.dueDate !== null && !isValidDateString(body.dueDate)) {
    return 'dueDate must be a valid ISO date string';
  }
  return null;
};

const validateCreateTask = (body) => {
  body = body || {};
  if (!body.title || typeof body.title !== 'string' || body.title.trim() === '') {
    return 'title is required and must be a non-empty string';
  }
  return validateOptionalFields(body);
};

const validateUpdateTask = (body) => {
  body = body || {};
  if (body.title !== undefined && (typeof body.title !== 'string' || body.title.trim() === '')) {
    return 'title must be a non-empty string';
  }
  return validateOptionalFields(body);
};

const validateStatusFilter = (status) => {
  if (typeof status !== 'string' || !VALID_STATUSES.includes(status)) {
    return `status must be one of: ${VALID_STATUSES.join(', ')}`;
  }
  return null;
};

const parsePositiveInt = (value, fallback) => {
  if (value === undefined) return { value: fallback };
  if (typeof value !== 'string' || !/^\d+$/.test(value) || parseInt(value, 10) < 1) {
    return { invalid: true };
  }
  return { value: parseInt(value, 10) };
};

// Returns { page, limit } on success or { error } on failure.
const validatePagination = ({ page, limit }) => {
  const p = parsePositiveInt(page, 1);
  if (p.invalid) return { error: 'page must be a positive integer' };

  const l = parsePositiveInt(limit, 10);
  if (l.invalid) return { error: 'limit must be a positive integer' };
  if (l.value > MAX_LIMIT) return { error: `limit must not exceed ${MAX_LIMIT}` };

  return { page: p.value, limit: l.value };
};

const validateAssign = (body) => {
  const assignee = body && body.assignee;
  if (typeof assignee !== 'string' || assignee.trim() === '') {
    return 'assignee is required and must be a non-empty string';
  }
  if (assignee.trim().length > MAX_ASSIGNEE_LENGTH) {
    return `assignee must be at most ${MAX_ASSIGNEE_LENGTH} characters`;
  }
  return null;
};

module.exports = {
  VALID_STATUSES,
  VALID_PRIORITIES,
  MAX_LIMIT,
  MAX_ASSIGNEE_LENGTH,
  validateCreateTask,
  validateUpdateTask,
  validateStatusFilter,
  validatePagination,
  validateAssign,
};
