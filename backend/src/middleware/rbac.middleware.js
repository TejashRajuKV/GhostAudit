// Role-Based Access Control middleware.
// Roles: admin > reviewer > auditor
//   admin    — full access incl. deletes, user mgmt, settings
//   reviewer — workflow transitions, verdicts, analyzers, uploads
//   auditor  — read-only access to everything
const ORDER = { auditor: 1, reviewer: 2, admin: 3 };

function requireRole(...roles) {
  return (req, res, next) => {
    const role = req.user?.role;
    if (!role) return res.status(401).json({ error: 'Authentication required' });
    if (!roles.includes(role)) {
      return res.status(403).json({ error: `Forbidden: requires role ${roles.join(' or ')}` });
    }
    next();
  };
}

// Require at least the given privilege level (admin >= reviewer >= auditor)
function requireLevel(minRole) {
  return (req, res, next) => {
    const role = req.user?.role;
    if (!role) return res.status(401).json({ error: 'Authentication required' });
    if ((ORDER[role] || 0) < (ORDER[minRole] || 99)) {
      return res.status(403).json({ error: `Forbidden: requires ${minRole} or higher` });
    }
    next();
  };
}

module.exports = { requireRole, requireLevel };
