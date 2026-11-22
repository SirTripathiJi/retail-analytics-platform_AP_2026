const { ObjectId } = require('mongodb');
const ApiError = require('../errors/ApiError');

/** Create the central account repository from the connected central Db. */
function createMongoUserRepository(database) {
  if (!database || typeof database.collection !== 'function' || !database.client) {
    throw new TypeError('A connected MongoDB database handle is required.');
  }

  const users = database.collection('users');
  const memberships = database.collection('businessMemberships');
  const tenantConnections = database.collection('tenantConnections');

  return {
    findByEmail(email) {
      return users.findOne({ email: String(email).trim().toLowerCase() });
    },

    async createUser(user) {
      const userId = new ObjectId();
      const businessId = user.businessId;
      const session = database.client.startSession();
      try {
        await session.withTransaction(async () => {
          await users.insertOne({ ...user, _id: userId }, { session });
          await memberships.insertOne({
            userId,
            businessId,
            role: 'owner',
            status: 'active',
            createdAt: user.createdAt,
          }, { session });
          await tenantConnections.insertOne({
            businessId,
            databaseName: `business_${businessId}`,
            secretRef: 'CENTRAL',
            createdAt: user.createdAt,
            updatedAt: user.createdAt,
          }, { session });
        });
        return { ...user, _id: userId };
      } catch (error) {
        if (error?.code === 11000) throw error;
        if (/transaction numbers are only allowed|transactions are not supported|replica set|mongos/i.test(error?.message || '')) {
          throw new ApiError(503, 'Registration requires MongoDB transaction support.', 'REGISTRATION_TRANSACTION_UNAVAILABLE');
        }
        throw error;
      } finally {
        await session.endSession();
      }
    },

    findById(id) {
      if (!ObjectId.isValid(id)) return Promise.resolve(null);
      return users.findOne({ _id: new ObjectId(id) });
    },

    async findMembershipsByUserId(id) {
      if (!ObjectId.isValid(id)) return [];
      return memberships.find({ userId: new ObjectId(id), status: 'active' }).toArray();
    },
  };
}

module.exports = { createMongoUserRepository };
