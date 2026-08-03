function errorHandler(err, req, res, next) {
  console.error(err);

  if (err.code === "P2002") {
    const field = err.meta?.target?.[0] || "email";
    return res.status(409).json({ success: false, message: `User is already registered with this ${field}` });
  }

  const status = err.status || 500;
  const message = err.message || "Something went wrong";
  res.status(status).json({ success: false, message });
}

function asyncHandler(fn) {
  return (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);
}

module.exports = { errorHandler, asyncHandler };
