"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getAllowedCustomerIds = getAllowedCustomerIds;
exports.assertCustomerAccess = assertCustomerAccess;
const rbac_constants_1 = require("../prisma/rbac.constants");
/**
 * Get IDs of customers actively assigned to this sales manager.
 */
async function getAllowedCustomerIds(prisma, userId) {
    const rows = await prisma.customerSalesManager.findMany({
        where: { userId, unassignedAt: null },
        select: { customerId: true },
    });
    return rows.map((r) => r.customerId);
}
/**
 * Assert that the given user has access to the customer.
 * ADMIN bypasses. SALES_MANAGER must have active CustomerSalesManager record.
 * Throws an object { status, error } on failure.
 */
async function assertCustomerAccess(prisma, user, customerId) {
    // ADMIN bypass
    if (user.roles.includes(rbac_constants_1.ROLE_CODES.ADMIN))
        return;
    const link = await prisma.customerSalesManager.findFirst({
        where: {
            userId: user.userId,
            customerId,
            unassignedAt: null,
        },
    });
    if (!link) {
        throw { status: 403, error: 'Нет доступа к этому клиенту' };
    }
}
