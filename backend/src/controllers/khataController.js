function createKhataController(khataService) {
  return {
    credit: async (request, response) => {
      const result = await khataService.recordCredit(
        request.body, request.params.id, request.auth.businessId,
      );
      response.status(201).json(result);
    },
    payment: async (request, response) => {
      const result = await khataService.recordPayment(
        request.body, request.params.id, request.auth.businessId,
      );
      response.status(201).json(result);
    },
    ledger: async (request, response) => {
      response.status(200).json(await khataService.getLedger(
        request.params.id, request.query, request.auth.businessId,
      ));
    },
    summary: async (request, response) => {
      response.status(200).json(await khataService.getSummary(
        request.params.id, request.auth.businessId,
      ));
    },
    outstanding: async (request, response) => {
      response.status(200).json(await khataService.listOutstanding(
        request.query, request.auth.businessId,
      ));
    },
  };
}

module.exports = { createKhataController };
