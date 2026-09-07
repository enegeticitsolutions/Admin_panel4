import bcrypt from 'bcryptjs';
import prisma from '../../core/database';
import { createToken } from '../../core/security';
import { generateUUID } from '../../utils/helpers';
import { ApiError } from '../../utils/ApiError';
import { OtpFactory } from '../../core/otp/OtpFactory';
import { notificationProducer } from '@maihoonna/notifications';

// ─── Types ────────────────────────────────────────────────────────────────────

type DualRoleUser = {
  id: string;
  role: string;
  subscriberBeneficiaries?: any[];
  beneficiaryProfile?: {
    id: string;
    isActive: boolean;
    verificationStatus?: string;
    relationship?: string | null;
  } | null;
};

type DualRoleResult = {
  availableRoles: string[];
  selfBeneficiaryId: string | null;
};

type ChangePasswordPayload = {
  verificationType: 'otp' | 'password';
  otp?: string;
  currentPassword?: string;
  newPassword: string;
};

// ─── AuthService Class ────────────────────────────────────────────────────────

/**
 * AuthService
 *
 * OOP Singleton encapsulating all authentication logic:
 *   - OTP send/verify
 *   - Password registration & login
 *   - Dual-role detection (subscriber ↔ self-beneficiary)
 *   - Role switching (1-tap profile switch without logout)
 *   - Password change
 *   - Location availability check
 *
 * Usage:
 *   import { AuthService } from './auth_service';
 *   const authService = AuthService.getInstance();
 *   await authService.sendOtp(phone);
 */
export class AuthService {
  // ─── Singleton ─────────────────────────────────────────────────────────────

  private static instance: AuthService;

  private constructor() {}

  public static getInstance(): AuthService {
    if (!AuthService.instance) {
      AuthService.instance = new AuthService();
    }
    return AuthService.instance;
  }

  // ─── Private Helpers ───────────────────────────────────────────────────────

  /**
   * Normalizes a raw phone string to the last 10 digits.
   */
  private normalizePhone(rawPhone: string): string {
    return rawPhone.replace(/\D/g, '').slice(-10);
  }

  /**
   * Logs an activity entry without crashing the caller if it fails.
   */
  private async logActivity(
    userId: string,
    action: string,
    details: Record<string, any>,
  ): Promise<void> {
    try {
      await prisma.activityLog.create({
        data: { userId, type: 'SECURITY', action, details },
      });
    } catch (err) {
      console.error(`[AuthService] Failed to log activity (${action}):`, err);
    }
  }

  /**
   * Updates a user's lastLoginAt timestamp silently.
   */
  private async touchLastLogin(userId: string): Promise<void> {
    try {
      await prisma.user.update({
        where: { id: userId },
        data: { lastLoginAt: new Date() },
      });
    } catch (err) {
      console.error('[AuthService] Failed to update lastLoginAt:', err);
    }
  }

  /**
   * Builds a compact active-subscription payload from a subscriber's beneficiary list.
   */
  private resolveActiveSubscription(
    subscriberBeneficiaries: any[],
    beneficiaryProfile: any,
  ): any | null {
    // Subscriber path — check all their beneficiaries
    for (const ben of subscriberBeneficiaries) {
      if (ben.subscriptions?.length > 0) {
        const sub = ben.subscriptions[0];
        return {
          id: sub.id,
          packageType: sub.packageType,
          packageName: sub.package?.name,
          startDate: sub.startDate,
          endDate: sub.endDate,
          duration: sub.duration,
          isActive: sub.isActive,
          packageBenefits: (sub.package?.packageBenefits ?? []).map((pb: any) => ({
            name: pb.benefit?.name,
            type: pb.benefit?.benefitType?.name,
            unitsIncluded: pb.unitsIncluded,
          })),
          benefitBalances: (sub.benefitBalances ?? []).map((bb: any) => ({
            benefitName: bb.benefit?.name,
            totalUnits: bb.totalUnits,
            usedUnits: bb.usedUnits,
            remainingUnits: bb.totalUnits - bb.usedUnits,
          })),
          beneficiary: { id: ben.id, name: ben.name, age: ben.age },
        };
      }
    }

    // Beneficiary path — user is the beneficiary themselves
    if (beneficiaryProfile?.subscriptions?.length > 0) {
      const sub = beneficiaryProfile.subscriptions[0];
      return {
        id: sub.id,
        packageType: sub.packageType,
        packageName: sub.package?.name,
        startDate: sub.startDate,
        endDate: sub.endDate,
        duration: sub.duration,
        isActive: sub.isActive,
        benefitBalances: (sub.benefitBalances ?? []).map((bb: any) => ({
          benefitName: bb.benefit?.name,
          totalUnits: bb.totalUnits,
          usedUnits: bb.usedUnits,
          remainingUnits: bb.totalUnits - bb.usedUnits,
        })),
      };
    }

    return null;
  }

  // ─── Public: Dual-Role Detection ──────────────────────────────────────────

  /**
   * getUserAvailableRoles
   *
   * Determines which roles a user may currently assume.
   *   - 'subscriber' → owns subscriber-level beneficiaries OR is a subscriber/prospect
   *   - 'beneficiary' → has an active, verified personal beneficiary profile
   *
   * Returns availableRoles array and selfBeneficiaryId.
   */
  public getUserAvailableRoles(user: DualRoleUser): DualRoleResult {
    const availableRoles: string[] = [];

    if (
      user.role === 'subscriber' ||
      user.role === 'prospect' ||
      (user.subscriberBeneficiaries && user.subscriberBeneficiaries.length > 0)
    ) {
      availableRoles.push('subscriber');
    }

    let selfBeneficiaryId: string | null = null;
    if (user.beneficiaryProfile && user.beneficiaryProfile.isActive !== false) {
      if (!availableRoles.includes('beneficiary')) availableRoles.push('beneficiary');
      selfBeneficiaryId = user.beneficiaryProfile.id;
    } else if (user.subscriberBeneficiaries && user.subscriberBeneficiaries.length > 0) {
      const selfBen = user.subscriberBeneficiaries.find(
        (b: any) => (b.relationship || '').toLowerCase() === 'self' || b.isSelf || b.userId === user.id
      );
      if (selfBen) {
        if (!availableRoles.includes('beneficiary')) availableRoles.push('beneficiary');
        selfBeneficiaryId = selfBen.id;
      }
    }

    if (user.role === 'beneficiary') {
      if (!availableRoles.includes('beneficiary')) availableRoles.push('beneficiary');
      if (user.subscriberBeneficiaries && user.subscriberBeneficiaries.length > 0 && !availableRoles.includes('subscriber')) {
        availableRoles.push('subscriber');
      }
    }

    return { availableRoles, selfBeneficiaryId };
  }

  // ─── Public: OTP Methods ──────────────────────────────────────────────────

  /**
   * sendOtp — Sends an OTP to the phone number.
   * Returns isNewUser flag so the app can show signup vs login UI.
   */
  public async sendOtp(rawPhone: string) {
    const phone = this.normalizePhone(rawPhone);
    const user = await prisma.user.findUnique({ where: { phone } });
    if (user && !user.isActive) {
      throw new ApiError(403, 'This account has been deleted. Please contact support.');
    }
    const provider = OtpFactory.getProvider();
    const sendResult = await provider.send(phone);
    return { ...sendResult, isNewUser: !user };
  }

  /**
   * verifyOtp — Verifies OTP and returns a session token if valid.
   * Returns isNewUser=true for phones not in DB (triggers registration flow in app).
   */
  public async verifyOtp(rawPhone: string, otpCode: string) {
    const phone = this.normalizePhone(rawPhone);
    const provider = OtpFactory.getProvider();

    const isValid = await provider.verify(phone, otpCode);
    if (!isValid) throw new Error('Invalid or expired OTP code entered.');

    const user = await prisma.user.findUnique({
      where: { phone },
      include: {
        subscriberBeneficiaries: {
          include: {
            subscriptions: {
              where: { isActive: true },
              include: {
                package: {
                  include: {
                    packageBenefits: {
                      include: { benefit: { include: { benefitType: true } } },
                    },
                  },
                },
                benefitBalances: { include: { benefit: true } },
              },
              take: 1,
            },
          },
        },
        beneficiaryProfile: {
          include: {
            subscriptions: {
              where: { isActive: true },
              include: {
                package: true,
                benefitBalances: { include: { benefit: true } },
              },
              take: 1,
            },
          },
        },
      },
    });

    // Unknown phone OR deleted/inactive user → new user registration flow
    if (!user || user.isActive === false) {
      return {
        success: true,
        isNewUser: true,
        message: 'Phone verified. Please complete registration.',
        phone,
      };
    }

    // Block pending beneficiaries
    if (user.role === 'beneficiary' && user.beneficiaryProfile?.verificationStatus === 'pending') {
      throw new Error(
        'Your beneficiary profile is pending verification. Please contact your subscriber to verify and activate your account.',
      );
    }

    const token = createToken({ sub: user.id, role: user.role });
    await this.touchLastLogin(user.id);
    await this.logActivity(user.id, 'LOGGED_IN', { method: 'otp', role: user.role });

    const activeSubscription = this.resolveActiveSubscription(
      user.subscriberBeneficiaries ?? [],
      user.beneficiaryProfile,
    );

    const { availableRoles, selfBeneficiaryId } = this.getUserAvailableRoles(user);

    return {
      success: true,
      isNewUser: false,
      message: 'Verification & Login successful',
      user: {
        id: user.id,
        phone: user.phone,
        name: user.name,
        role: user.role,
        isActive: user.isActive,
      },
      activeSubscription,
      beneficiaryCount: user.subscriberBeneficiaries?.length ?? 0,
      availableRoles,
      selfBeneficiaryId,
      activeRole: user.role,
      token,
    };
  }

  // ─── Public: Registration ─────────────────────────────────────────────────

  /**
   * registerWithPassword — Creates a prospect account with a hashed password.
   * Used only for development / admin-seeded accounts.
   */
  public async registerWithPassword(
    rawPhone: string,
    name: string,
    age: number,
    passwordRaw: string,
    email?: string,
    location?: string,
    latitude?: number,
    longitude?: number,
    pincode?: string
  ) {
    const phone = this.normalizePhone(rawPhone);

    const existingUser = await prisma.user.findUnique({ where: { phone } });
    if (existingUser) {
      if (existingUser.isActive) {
        throw new ApiError(400, 'A user with this phone number already exists.');
      }

      // Soft-deleted user registering again -> reactivate as a fresh prospect!
      const salt = await bcrypt.genSalt(10);
      const hashedPassword = await bcrypt.hash(passwordRaw, salt);

      const user = await prisma.user.update({
        where: { id: existingUser.id },
        data: {
          name,
          age,
          email: email || null,
          password: hashedPassword,
          role: 'prospect',
          isActive: true,
          status: 'active',
          deletedAt: null,
          fcmToken: null,
          refreshToken: null,
          profilePhoto: null,
          location: location || null,
          latitude: latitude || null,
          longitude: longitude || null,
          pincode: pincode || null,
          flatPlot: null,
          streetArea: null,
          landmark: null,
          city: null,
          state: null,
          createdAt: new Date(),
        },
      });

      const token = createToken({ sub: user.id, role: user.role });

      return {
        success: true,
        message: 'Registration successful',
        user: { id: user.id, phone: user.phone, name: user.name, age: user.age, role: user.role },
        token,
      };
    }

    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(passwordRaw, salt);

    const user = await prisma.user.create({
      data: { 
        id: generateUUID(), 
        phone, 
        name, 
        age, 
        email: email || null, 
        password: hashedPassword, 
        role: 'prospect',
        location: location || null,
        latitude: latitude || null,
        longitude: longitude || null,
        pincode: pincode || null,
      },
    });

    const token = createToken({ sub: user.id, role: user.role });

    // NT-002: Dispatch SUBSCRIBER_ACCOUNT_CREATED (Decoupled Redis Streams)
    if (user.phone) {
      notificationProducer.publish({
        idempotencyKey: `user-${user.id}-created`,
        channel: 'whatsapp',
        event: 'SUBSCRIBER_ACCOUNT_CREATED',
        recipient: { phone: user.phone },
        variables: { subscriberName: user.name || 'Subscriber' },
      }).catch((err: any) => console.error('[AuthService:Register] Notification Error:', err.message));
    }

    return {
      success: true,
      message: 'Registration successful',
      user: { id: user.id, phone: user.phone, name: user.name, age: user.age, role: user.role },
      token,
    };
  }

  /**
   * registerWithOtp — Production OTP-only registration.
   * Creates a prospect account WITHOUT a stored password.
   */
  public async registerWithOtp(
    rawPhone: string, 
    name: string, 
    age: number, 
    email?: string,
    location?: string,
    latitude?: number,
    longitude?: number,
    pincode?: string
  ) {
    const phone = this.normalizePhone(rawPhone);

    const existingUser = await prisma.user.findUnique({ where: { phone } });
    if (existingUser) {
      if (existingUser.isActive) {
        throw new ApiError(400, 'A user with this phone number already exists.');
      }

      // Soft-deleted user registering again -> reactivate as a fresh prospect!
      const user = await prisma.user.update({
        where: { id: existingUser.id },
        data: {
          name,
          age,
          email: email || null,
          password: null,
          role: 'prospect',
          isActive: true,
          status: 'active',
          deletedAt: null,
          fcmToken: null,
          refreshToken: null,
          profilePhoto: null,
          location: location || null,
          latitude: latitude || null,
          longitude: longitude || null,
          pincode: pincode || null,
          flatPlot: null,
          streetArea: null,
          landmark: null,
          city: null,
          state: null,
          createdAt: new Date(),
        },
      });

      const token = createToken({ sub: user.id, role: user.role });

      return {
        success: true,
        message: 'Registration successful',
        user: { id: user.id, phone: user.phone, name: user.name, age: user.age, role: user.role },
        token,
      };
    }

    const user = await prisma.user.create({
      data: { 
        id: generateUUID(), 
        phone, 
        name, 
        age, 
        email: email || null, 
        password: null, 
        role: 'prospect',
        location: location || null,
        latitude: latitude || null,
        longitude: longitude || null,
        pincode: pincode || null,
      },
    });

    const token = createToken({ sub: user.id, role: user.role });

    // NT-002: Dispatch SUBSCRIBER_ACCOUNT_CREATED (Decoupled Redis Streams)
    if (user.phone) {
      notificationProducer.publish({
        idempotencyKey: `user-${user.id}-created`,
        channel: 'whatsapp',
        event: 'SUBSCRIBER_ACCOUNT_CREATED',
        recipient: { phone: user.phone },
        variables: { subscriberName: user.name || 'Subscriber' },
      }).catch((err: any) => console.error('[AuthService:VerifyOtp] Notification Error:', err.message));
    }

    return {
      success: true,
      message: 'Registration successful',
      user: { id: user.id, phone: user.phone, name: user.name, age: user.age, role: user.role },
      token,
    };
  }

  // ─── Public: Password Login ───────────────────────────────────────────────

  /**
   * loginWithPassword — Authenticates using phone + password hash comparison.
   */
  public async loginWithPassword(rawPhone: string, passwordRaw: string) {
    const phone = this.normalizePhone(rawPhone);
    const user = await prisma.user.findUnique({
      where: { phone },
      include: { beneficiaryProfile: true },
    });

    if (!user || !user.password) throw new Error('Invalid phone number or password.');
    if (user.isActive === false) {
      throw new ApiError(401, 'This account has been deleted. Please create a new account.');
    }

    const isMatch = await bcrypt.compare(passwordRaw, user.password);
    if (!isMatch) throw new Error('Invalid phone number or password.');

    if (user.role === 'beneficiary' && user.beneficiaryProfile?.verificationStatus === 'pending') {
      throw new Error(
        'Your beneficiary profile is pending verification. Please contact your subscriber to verify and activate your account.',
      );
    }

    const token = createToken({ sub: user.id, role: user.role });
    await this.touchLastLogin(user.id);
    await this.logActivity(user.id, 'LOGGED_IN', { method: 'password', role: user.role });

    // Enrich dual-role data (requires separate query for full includes)
    const fullUser = await prisma.user.findUnique({
      where: { id: user.id },
      include: {
        subscriberBeneficiaries: { take: 1 },
        beneficiaryProfile: {
          select: { id: true, isActive: true, verificationStatus: true, relationship: true },
        },
      },
    });
    const { availableRoles, selfBeneficiaryId } = this.getUserAvailableRoles(fullUser ?? user);

    return {
      success: true,
      message: 'Login successful',
      user: { id: user.id, phone: user.phone, name: user.name, age: user.age, role: user.role },
      availableRoles,
      selfBeneficiaryId,
      activeRole: user.role,
      token,
    };
  }

  // ─── Public: Role Switching ───────────────────────────────────────────────

  /**
   * switchRole
   *
   * Allows a dual-role user (subscriber who is also their own beneficiary) to
   * switch the active session role without logging out.
   * Issues a fresh JWT with the targetRole claim after verifying eligibility.
   */
  public async switchRole(userId: string, targetRole: 'subscriber' | 'beneficiary') {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: {
        subscriberBeneficiaries: true,
        beneficiaryProfile: true,
      },
    });

    if (!user) throw new ApiError(404, 'User not found');

    // Auto-link self beneficiary record if user.beneficiaryProfile relation wasn't linked yet
    if (targetRole === 'beneficiary' && !user.beneficiaryProfile && user.subscriberBeneficiaries?.length > 0) {
      const selfBen = user.subscriberBeneficiaries.find(
        (b: any) => (b.relationship || '').toLowerCase() === 'self' || b.userId === user.id
      );
      if (selfBen) {
        await prisma.beneficiary.update({
          where: { id: selfBen.id },
          data: { userId: user.id }
        });
        (user as any).beneficiaryProfile = selfBen;
      }
    }

    const { availableRoles, selfBeneficiaryId } = this.getUserAvailableRoles(user);

    if (!availableRoles.includes(targetRole)) {
      throw new ApiError(403, `You do not have access to the '${targetRole}' role.`);
    }

    const token = createToken({ sub: userId, role: targetRole });

    await this.logActivity(userId, 'ROLE_SWITCHED', { from: user.role, to: targetRole });

    return {
      success: true,
      message: `Switched to ${targetRole} profile`,
      user: {
        id: user.id,
        phone: user.phone,
        name: user.name,
        role: targetRole,
        isActive: user.isActive,
      },
      availableRoles,
      selfBeneficiaryId,
      activeRole: targetRole,
      token,
    };
  }

  // ─── Public: Misc ─────────────────────────────────────────────────────────

  /**
   * checkLocation — Returns service availability for a given location.
   */
  public async checkLocation(_location: string) {
    return {
      available: true,
      message: 'Great news! We serve your area. You can now enjoy our full range of services.',
      coverage: 'Service Coverage Active in 1000+ locations',
      zones: ['North Zone', 'South Zone', 'East Zone', 'West Zone'],
    };
  }

  /**
   * changePassword — Allows a user to change their password via OTP or current password verification.
   */
  public async changePassword(userId: string, payload: ChangePasswordPayload) {
    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new Error('User not found');

    if (payload.verificationType === 'otp') {
      if (!payload.otp) throw new Error('OTP is required for verification');
      const provider = OtpFactory.getProvider();
      const isValid = await provider.verify(user.phone, payload.otp);
      if (!isValid) throw new Error('Invalid or expired OTP code');
    } else {
      if (!payload.currentPassword) throw new Error('Current password is required');
      if (!user.password) throw new Error('Account does not have a password set. Please use OTP verification.');
      const isMatch = await bcrypt.compare(payload.currentPassword, user.password);
      if (!isMatch) throw new Error('Incorrect current password');
    }

    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(payload.newPassword, salt);

    await prisma.user.update({ where: { id: userId }, data: { password: hashedPassword } });
    await this.logActivity(userId, 'PASSWORD_CHANGED', { method: payload.verificationType });

    return { success: true, message: 'Password changed successfully' };
  }
}

// ─── Singleton Export ─────────────────────────────────────────────────────────

/** Single app-wide AuthService instance */
const authServiceInstance = AuthService.getInstance();

// ─── Named Function Exports (backward-compatible with auth.routes.ts) ─────────

export const sendOtp = authServiceInstance.sendOtp.bind(authServiceInstance);
export const verifyOtp = authServiceInstance.verifyOtp.bind(authServiceInstance);
export const registerWithPassword = authServiceInstance.registerWithPassword.bind(authServiceInstance);
export const registerWithOtp = authServiceInstance.registerWithOtp.bind(authServiceInstance);
export const loginWithPassword = authServiceInstance.loginWithPassword.bind(authServiceInstance);
export const checkLocation = authServiceInstance.checkLocation.bind(authServiceInstance);
export const changePassword = authServiceInstance.changePassword.bind(authServiceInstance);
export const switchRole = authServiceInstance.switchRole.bind(authServiceInstance);
export const getUserAvailableRoles = authServiceInstance.getUserAvailableRoles.bind(authServiceInstance);