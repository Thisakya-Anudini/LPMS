export const sendError = (res, status, code, message, details) => {
  const payload = { error: { code, message } };
  if (details) {
    payload.error.details = details;
  }
  return res.status(status).json(payload);
};

export const asyncHandler = (handler) => async (req, res, next) => {
  try {
    await handler(req, res, next);
  } catch (error) {
    next(error);
  }
};
