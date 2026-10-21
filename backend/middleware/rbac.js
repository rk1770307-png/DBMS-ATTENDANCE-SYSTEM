/**
 * Role-Based Access Control (RBAC) Middleware
 * Supports 5 distinct roles:
 *  1. STUDENT
 *  2. COURSE_TEACHER
 *  3. TG (Teacher Guardian)
 *  4. CLASS_TEACHER
 *  5. HOD (Head of Department)
 */

const ALL_FACULTY_ROLES = ['FACULTY', 'COURSE_TEACHER', 'TG', 'CLASS_TEACHER', 'HOD'];

function enforceRBAC(allowedRoles = []) {
  return (req, res, next) => {
    // Roles can be passed via headers `x-user-role` and `x-user-id`
    // Default to STUDENT if not provided to guarantee security
    const userRole = (req.headers['x-user-role'] || 'STUDENT').toUpperCase();
    const userId = parseInt(req.headers['x-user-id'], 10) || 1;

    req.user = {
      role: userRole,
      id: userId
    };

    // If no roles specified, allow
    if (allowedRoles.length === 0) {
      return next();
    }

    // HOD has universal administrative access
    if (userRole === 'HOD') {
      return next();
    }

    // Check if allowedRoles has 'FACULTY' and user is any faculty member
    const isAllowedFaculty = allowedRoles.includes('FACULTY') && ALL_FACULTY_ROLES.includes(userRole);
    const isDirectlyAllowed = allowedRoles.includes(userRole);

    if (isAllowedFaculty || isDirectlyAllowed) {
      return next();
    }

    if (userRole === 'STUDENT') {
      return res.status(403).json({
        error: 'Forbidden: Insufficient RBAC Permissions',
        message: 'Students have view-only access to their personal academic data. Data modification, deletion, and SQL workbench access are strictly restricted to faculty members.',
        role: userRole
      });
    }

    return res.status(403).json({
      error: 'Forbidden: Insufficient RBAC Permissions',
      message: `Role '${userRole}' is not authorized to access this resource. Required roles: ${allowedRoles.join(', ')}`,
      role: userRole
    });
  };
}

module.exports = {
  enforceRBAC,
  ALL_FACULTY_ROLES
};
