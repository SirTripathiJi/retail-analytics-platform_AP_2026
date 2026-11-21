const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const ApiError = require('../errors/ApiError');
const { validateLogin, validateRegistration } = require('../validators/authValidation');

const BCRYPT_ROUNDS = 12;

function toSafeUser(user) {
  return {
    id: String(user._id ?? user.id),
    fullName: user.fullName,
    email: user.email,
    businessName: user.businessName,
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
    || typeof userRepository.findById !== 'function') {
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
      if (!jwtSecret) {
        throw new ApiError(503, 'Authentication token signing is not configured.', 'AUTH_CONFIGURATION_UNAVAILABLE');
      }

      const token = jwt.sign(
        { email: user.email, businessId: String(user.businessId ?? user._id ?? user.id) },
        jwtSecret,
        { subject: String(user._id ?? user.id), expiresIn: jwtExpiresIn },
      );

      return { user: toSafeUser(user), token };
    },
  };
}

module.exports = { createAuthService, toSafeUser };
