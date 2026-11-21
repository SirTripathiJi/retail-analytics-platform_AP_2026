// Test-only repository fixture. Production app uses unavailableUserRepository
// until the central MongoDB adapter is wired in.
function createInMemoryUserRepository(seed = []) {
  const users = new Map(seed.map((user) => [user.email, { ...user }]));
  let nextId = 1;

  return {
    async findByEmail(email) {
      const user = users.get(email);
      return user ? { ...user } : null;
    },

    async createUser(user) {
      if (users.has(user.email)) {
        const error = new Error('Duplicate email');
        error.code = 11000;
        throw error;
      }
      const created = { ...user, _id: `test-user-${nextId++}` };
      users.set(created.email, created);
      return { ...created };
    },

    async findById(id) {
      const user = [...users.values()].find((item) => String(item._id ?? item.id) === id);
      return user ? { ...user } : null;
    },
  };
}

module.exports = { createInMemoryUserRepository };
