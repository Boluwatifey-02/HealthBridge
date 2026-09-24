const jwt = require("jsonwebtoken");

// Verifies the JWT sent in the Authorization header and attaches
// the decoded staff info (id, role, branch) to req.user.
function authenticate(req, res, next) {
  const header = req.headers.authorization;
  if (!header || !header.startsWith("Bearer ")) {
    return res.status(401).json({ error: "Missing or malformed Authorization header." });
  }
  const token = header.split(" ")[1];
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = decoded; // { staffId, role, branchId }
    next();
  } catch (err) {
    return res.status(401).json({ error: "Invalid or expired session. Please log in again." });
  }
}

module.exports = { authenticate };
