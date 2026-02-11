import { ROLE_CODES } from '../prisma/rbac.constants';

/**
 * Get IDs of customers actively assigned to this sales manager.
 */
export async function getAllowedCustomerIds(
    prisma: any,
    userId: number,
): Promise<number[]> {
    const rows = await prisma.customerSalesManager.findMany({
        where: { userId, unassignedAt: null },
        select: { customerId: true },
    });
    return rows.map((r: any) => r.customerId);
}

/**
 * Assert that the given user has access to the customer.
 * ADMIN bypasses. SALES_MANAGER must have active CustomerSalesManager record.
 * Throws an object { status, error } on failure.
 */
export async function assertCustomerAccess(
    prisma: any,
    user: { userId: number; roles: string[] },
    customerId: number,
): Promise<void> {
    // ADMIN bypass
    if (user.roles.includes(ROLE_CODES.ADMIN)) return;

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
