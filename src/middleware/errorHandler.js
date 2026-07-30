function errorHandler(err, req, res, next) {
  console.error(err);

  if (err.code === "P2002") {
    const field = err.meta?.target?.[0] || "field";
    return res.status(409).json({ error: `That ${field} is already in use` });
  }

  const status = err.status || 500;
  const message = err.message || "Something went wrong";
  res.status(status).json({ error: message });
}

function asyncHandler(fn) {
  return (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);
}

module.exports = { errorHandler, asyncHandler };
