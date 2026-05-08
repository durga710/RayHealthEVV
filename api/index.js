module.exports = (req, res) => {
  res.setHeader('content-type', 'application/json');
  res.status(200).json({
    ok: true,
    url: req.url,
    method: req.method,
    node: process.version
  });
};
