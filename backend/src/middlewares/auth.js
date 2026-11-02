import jwt from 'jsonwebtoken';
import { User } from '../models/index.js';

export function requireAuth(request, response, next) {
  const header = request.headers.authorization;
  if (!header || !header.startsWith('Bearer ')) {
    return response.status(401).json({ message: 'Authentication required' });
  }
  try {
    const payload = jwt.verify(header.slice(7), process.env.JWT_SECRET);
    User.findById(payload.sub).then((user) => {
      if (!user || !user.isActive) return response.status(401).json({ message: 'Invalid account' });
      request.user = user;
      next();
    }).catch(next);
  } catch (error) {
    return response.status(401).json({ message: 'Invalid or expired token' });
  }
}

export function allowRoles(...roles) {
  return (request, response, next) => {
    if (!request.user || !roles.includes(request.user.role)) {
      return response.status(403).json({ message: 'Insufficient permissions' });
    }
    next();
  };
}
