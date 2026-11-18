import { Response, NextFunction } from 'express';
import { AuthRequest } from '../api/shared/deps';
import {
  getProfileAccess,
  satisfiesLevel,
  RequiredAccessLevel,
  ResolvedProfileAccess,
} from '../services/access/profile_access_service';

export interface ProfileAccessRequest extends AuthRequest {
  profileAccess?: ResolvedProfileAccess;
}

/**
 * Single-query authorization middleware for any route operating on a Care Profile (Beneficiary).
 * Attaches `req.profileAccess` so controllers never repeat redundant DB lookups.
 */
export function requireProfileAccess(level: RequiredAccessLevel, paramName = 'beneficiaryId') {
  return async (req: ProfileAccessRequest, res: Response, next: NextFunction) => {
    try {
      const beneficiaryId =
        (req.params[paramName] as string) ||
        (req.body?.[paramName] as string) ||
        (req.query?.[paramName] as string);

      if (!beneficiaryId) {
        return res.status(400).json({ success: false, message: `Missing ${paramName}` });
      }

      const access = await getProfileAccess(req.userId, beneficiaryId, req.userRole);
      if (!satisfiesLevel(access, level)) {
        const message =
          level === 'EDIT' && access.canView
            ? 'Access denied: You have View-Only access to this care profile.'
            : level === 'MANAGE'
            ? 'Access denied: Only the profile owner or a Care Manager can perform this action.'
            : 'Access denied: You do not have permission to access this care profile.';
        return res.status(403).json({ success: false, message });
      }

      req.profileAccess = access;
      return next();
    } catch (error: any) {
      return res.status(500).json({ success: false, message: error.message || 'Authorization check failed' });
    }
  };
}
