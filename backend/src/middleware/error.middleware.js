export function notFound(req, res) {
  res.status(404).json({ success: false, message: `Route not found: ${req.method} ${req.originalUrl}` });
}

export function errorHandler(err, _req, res, _next) {
  if (err?.code === 11000) {
    return res.status(409).json({ success: false, message: "A record with that unique value already exists." });
  }
  if (err?.name === "ValidationError") {
    return res.status(400).json({ success: false, message: err.message });
  }
  if (err?.name === "MulterError") {
    return res.status(400).json({ success: false, message: err.message });
  }
  console.error(err);
  res.status(err.status || 500).json({
    success: false,
    message: err.status && err.status < 500 ? err.message : "Internal server error."
  });
}
