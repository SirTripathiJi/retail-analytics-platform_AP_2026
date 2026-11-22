const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const { randomUUID } = require('node:crypto');
const ApiError = require('../errors/ApiError');
const { validateLogin, validateRegistration } = require('../validators/authValidation');

const BCRYPT_ROUNDS = 12;

function toSafeUser(user) {
  return {
    id: String(user._id ?? user.id),
    fullName: user.fullName,
    email: user.email,
    businessName: user.businessName,
    businessId: user.businessId,
    createdAt: user.createdAt,
  };
}

function isDuplicateEmailError(error) {
  return error?.code === 11000 || error?.code === 'DUPLICATE_EMAIL';
}

function createAuthService({ userRepository, jwtSecret, jwtExpiresIn = '1h' }) {
  if (!userRepository
    || typeof userRepository.findByEmail !== 'function'
    || typeof userRepository.createUser !== 'function'
    || typeof userRepository.findById !== 'function'
    || typeof userRepository.findMembershipsByUserId !== 'function') {
    throw new TypeError('A user repository implementing findByEmail, createUser, and findById is required.');
  }

  return {
    async register(body) {
      const input = validateRegistration(body);
      if (await userRepository.findByEmail(input.email)) {
        throw new ApiError(409, 'An account with this email already exists.', 'EMAIL_ALREADY_EXISTS');
      }

      const now = new Date();
      const user = {
        fullName: input.fullName,
        email: input.email,
        passwordHash: await bcrypt.hash(input.password, BCRYPT_ROUNDS),
        businessName: input.businessName,
        businessId: randomUUID(),
        createdAt: now,
        updatedAt: now,
      };

      try {
        const created = await userRepository.createUser(user);
        return toSafeUser(created);
      } catch (error) {
        if (isDuplicateEmailError(error)) {
          throw new ApiError(409, 'An account with this email already exists.', 'EMAIL_ALREADY_EXISTS');
        }
        throw error;
      }
    },

    async login(body) {
      const input = validateLogin(body);
      const user = await userRepository.findByEmail(input.email);
      const passwordMatches = user?.passwordHash
        ? await bcrypt.compare(input.password, user.passwordHash)
        : false;

      if (!user || !passwordMatches) {
        throw new ApiError(401, 'Invalid email or password.', 'INVALID_CREDENTIALS');
      }
      const memberships = await userRepository.findMembershipsByUserId(user._id ?? user.id);
      if (!memberships.length) {
        throw new ApiError(403, 'No active business membership is available for this account.', 'BUSINESS_MEMBERSHIP_REQUIRED');
      }
      let membership;
      if (input.businessId) {
        membership = memberships.find((entry) => String(entry.businessId) === input.businessId);
        if (!membership) {
          throw new ApiError(403, 'The account does not have access to the requested business.', 'BUSINESS_MEMBERSHIP_REQUIRED');
        }
      } else if (memberships.length === 1) {
        [membership] = memberships;
      } else {
        throw new ApiError(400, 'Select a business to continue.', 'BUSINESS_SELECTION_REQUIRED');
      }
      if (!jwtSecret) {
        throw new ApiError(503, 'Authentication token signing is not configured.', 'AUTH_CONFIGURATION_UNAVAILABLE');
      }

      const token = jwt.sign(
        { email: user.email, businessId: String(membership.businessId) },
        jwtSecret,
        { subject: String(user._id ?? user.id), expiresIn: jwtExpiresIn },
      );

      return { user: toSafeUser(user), token };
    },
  };
}

module.exports = { createAuthService, toSafeUser };
