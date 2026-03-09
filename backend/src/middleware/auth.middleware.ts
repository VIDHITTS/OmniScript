import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';

// Extend Express Request object to include the authenticated user info
declare global {
  namespace Express {
    interface Request {
      user?: {
        userId: string;
        email: string;
      };
    }
  }
}

export const authenticateToken = (req: Request, res: Response, next: NextFunction): void => {
  try {
    const token = req.cookies.jwt;

    if (!token) {
      res.status(401).json({ message: 'Unauthorized: No token provided.' });
      return;
    }

    const secret = process.env.JWT_SECRET || 'fallback_super_secret_dev_key';
    const decoded = jwt.verify(token, secret) as { userId: string; email: string };

    req.user = decoded;
    next();
  } catch (error) {
    res.status(403).json({ message: 'Forbidden: Invalid or expired token.' });
  }
};
