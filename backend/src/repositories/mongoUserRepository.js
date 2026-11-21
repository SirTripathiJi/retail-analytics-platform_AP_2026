const { ObjectId } = require('mongodb');

/**
 * Create a user repository from an injected central MongoDB database handle.
 * This module never creates a client or reads connection configuration.
 * TODO: The database integration owner must wire this repository to the
 * central account database and provision a unique index on users.email.
 * @param {import('mongodb').Db} database
 */
function createMongoUserRepository(database) {
  if (!database || typeof database.collection !== 'function') {
    throw new TypeError('A MongoDB database handle is required.');
  }

  const users = database.collection('users');

  return {
    findByEmail(email) {
      return users.findOne({ email });
    },

    async createUser(user) {
      const result = await users.insertOne(user);
      return { ...user, _id: result.insertedId };
    },

    findById(id) {
      if (!ObjectId.isValid(id)) return Promise.resolve(null);
      return users.findOne({ _id: new ObjectId(id) });
    },
  };
}

module.exports = { createMongoUserRepository };
