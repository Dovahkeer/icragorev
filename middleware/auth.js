function requireAuth(req, res, next) {
  if (!req.session.userId) {
    return res.redirect('/login');
  }
  next();
}

function requireRole(...roles) {
  return (req, res, next) => {
    console.log('requireRole check:', {
      path: req.path,
      session: req.session,
      userId: req.session?.userId,
      userRole: req.session?.userRole,
      requiredRoles: roles
    });
    if (!req.session.userId) {
      console.log('Redirecting to login due to missing userId');
      return res.redirect('/login');
    }
    if (!roles.includes(req.session.userRole)) {
      console.log('403 Forbidden: Role mismatch');
      return res.status(403).send('Yetkiniz yok');
    }
    next();
  };
}

module.exports = { requireAuth, requireRole };
