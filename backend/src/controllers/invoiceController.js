function createInvoiceController(invoiceService) {
  return {
    create: async (request, response) => response.status(201).json({ invoice: await invoiceService.create(
      request.body, request.get('Idempotency-Key'), request.auth.businessId, request.auth.userId,
    ) }),
    list: async (request, response) => response.status(200).json(await invoiceService.list(request.query, request.auth.businessId)),
    getById: async (request, response) => response.status(200).json({ invoice: await invoiceService.getById(request.params.id, request.auth.businessId) }),
    getByNumber: async (request, response) => response.status(200).json({ invoice: await invoiceService.getByNumber(request.params.invoiceNumber, request.auth.businessId) }),
    cancel: async (request, response) => response.status(200).json({ invoice: await invoiceService.cancel(
      request.params.id, request.body, request.auth.businessId, request.auth.userId,
    ) }),
  };
}
module.exports = { createInvoiceController };
