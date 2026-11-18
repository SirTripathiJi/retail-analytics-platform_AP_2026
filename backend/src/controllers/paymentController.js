function createPaymentController(paymentService) {
  return {
    payInvoice: async (request, response) => response.status(201).json({ payment: await paymentService.payInvoice(
      request.params.id, request.body, request.get('Idempotency-Key'), request.auth.businessId,
    ) }),
    payCustomer: async (request, response) => response.status(201).json({ payment: await paymentService.payCustomer(
      request.params.id, request.body, request.get('Idempotency-Key'), request.auth.businessId,
    ) }),
    list: async (request, response) => response.status(200).json(await paymentService.listPayments(request.query, request.auth.businessId)),
    get: async (request, response) => response.status(200).json({ payment: await paymentService.getPayment(request.params.id, request.auth.businessId) }),
    summary: async (request, response) => response.status(200).json(await paymentService.summary(request.query, request.auth.businessId)),
    transactions: async (request, response) => response.status(200).json(await paymentService.listTransactions(request.query, request.auth.businessId)),
    transaction: async (request, response) => response.status(200).json({ transaction: await paymentService.getTransaction(request.params.id, request.auth.businessId) }),
  };
}
module.exports = { createPaymentController };
