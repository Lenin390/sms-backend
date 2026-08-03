function validateRequest(req, res, schema) {
  const parsed = schema.safeParse(req.body);
  if (parsed.success) {
    return parsed.data;
  }

  const errors = parsed.error.issues.map((issue) => ({
    field: issue.path.join("."),
    message: issue.message,
  }));

  res.status(400).json({
    success: false,
    message: "Validation failed",
    errors,
  });

  return null;
}

module.exports = { validateRequest };
