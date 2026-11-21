function createAuthController(authService) {
  return {
    register: async (request, response) => {
      const user = await authService.register(request.body);
      response.status(201).json({ user });
    },

    login: async (request, response) => {
      const result = await authService.login(request.body);
      response.status(200).json(result);
    },
  };
}

module.exports = { createAuthController };
