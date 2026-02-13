import { Request, Response } from 'express';
import { prisma } from '../db';
import { Prisma } from '@prisma/client';

// ── helpers ────────────────────────────────────────────
const normalizeName = (raw: any): string =>
    String(raw ?? '').trim().replace(/\s+/g, ' ');

const normalizeKey = (raw: any): string =>
    normalizeName(raw).toLowerCase();

// ── GET /  (ADMIN) ─────────────────────────────────────
export async function getAllProductCategories(req: Request, res: Response) {
    try {
        const includeDeleted = req.query.includeDeleted === 'true';
        const includeInactive = req.query.includeInactive !== 'false';
        const search = normalizeKey(req.query.search);

        const where: any = {};
        if (!includeDeleted) where.deletedAt = null;
        if (!includeInactive) where.isActive = true;
        if (search) where.nameNormalized = { contains: search };

        const rows = await prisma.productCategory.findMany({
            where,
            orderBy: [{ isActive: 'desc' }, { name: 'asc' }],
        });
        res.json(rows);
    } catch (error: any) {
        console.error('getAllProductCategories error:', error);
        res.status(500).json({ error: 'INTERNAL' });
    }
}

// ── GET /active  (any with CATALOG_PRODUCTS) ───────────
export async function getActiveProductCategories(req: Request, res: Response) {
    try {
        const search = normalizeKey(req.query.search);
        const includeIdsRaw = String(req.query.includeIds ?? '').trim();
        const includeIds = includeIdsRaw
            ? includeIdsRaw
                .split(',')
                .map((x) => Number(x))
                .filter((n) => Number.isFinite(n) && n > 0)
            : [];

        if (includeIds.length > 50) {
            return res.status(400).json({ error: 'TOO_MANY_INCLUDE_IDS' });
        }

        const activeWhere: any = { isActive: true, deletedAt: null };
        if (search) activeWhere.nameNormalized = { contains: search };

        const active = await prisma.productCategory.findMany({
            where: activeWhere,
            select: { id: true, name: true, isActive: true },
            orderBy: { name: 'asc' },
        });

        if (!includeIds.length) return res.json(active);

        const extra = await prisma.productCategory.findMany({
            where: { id: { in: includeIds }, deletedAt: null },
            select: { id: true, name: true, isActive: true },
        });

        const byId = new Map<number, any>();
        for (const c of active) byId.set(c.id, c);
        for (const c of extra) if (!byId.has(c.id)) byId.set(c.id, c);

        res.json(Array.from(byId.values()));
    } catch (error: any) {
        console.error('getActiveProductCategories error:', error);
        res.status(500).json({ error: 'INTERNAL' });
    }
}

// ── POST /  (ADMIN) ────────────────────────────────────
export async function createProductCategory(req: Request, res: Response) {
    try {
        const name = normalizeName(req.body?.name);
        if (!name)
            return res
                .status(400)
                .json({ error: 'REQUIRED_FIELD_MISSING', field: 'name' });

        const nameNormalized = normalizeKey(name);

        const created = await prisma.productCategory.create({
            data: { name, nameNormalized, isActive: true },
        });
        res.status(201).json(created);
    } catch (e: any) {
        if (
            e instanceof Prisma.PrismaClientKnownRequestError &&
            e.code === 'P2002'
        ) {
            // Atomic restore: if a deleted category with same nameNormalized exists, resurrect it
            const nameNormalized = normalizeKey(req.body?.name);
            const deleted = await prisma.productCategory.findFirst({
                where: { nameNormalized, deletedAt: { not: null } },
            });
            if (deleted) {
                const restored = await prisma.productCategory.update({
                    where: { id: deleted.id },
                    data: {
                        name: normalizeName(req.body?.name),
                        isActive: true,
                        deletedAt: null,
                    },
                });
                return res.status(201).json(restored);
            }
            return res.status(409).json({ error: 'CATEGORY_ALREADY_EXISTS' });
        }
        console.error('createProductCategory error:', e);
        res.status(500).json({ error: 'INTERNAL' });
    }
}

// ── PUT /:id  (ADMIN) ──────────────────────────────────
export async function updateProductCategory(req: Request, res: Response) {
    try {
        const id = Number(req.params.id);
        const name = normalizeName(req.body?.name);
        if (!name)
            return res
                .status(400)
                .json({ error: 'REQUIRED_FIELD_MISSING', field: 'name' });

        const existing = await prisma.productCategory.findUnique({ where: { id } });
        if (!existing) return res.status(404).json({ error: 'CATEGORY_NOT_FOUND' });
        if (existing.deletedAt)
            return res.status(400).json({ error: 'CATEGORY_DELETED' });

        const nameNormalized = normalizeKey(name);

        const updated = await prisma.productCategory.update({
            where: { id },
            data: { name, nameNormalized },
        });
        res.json(updated);
    } catch (e: any) {
        if (
            e instanceof Prisma.PrismaClientKnownRequestError &&
            e.code === 'P2002'
        ) {
            return res.status(409).json({ error: 'CATEGORY_ALREADY_EXISTS' });
        }
        console.error('updateProductCategory error:', e);
        res.status(500).json({ error: 'INTERNAL' });
    }
}

// ── PATCH /:id/toggle  (ADMIN) ─────────────────────────
export async function toggleProductCategory(req: Request, res: Response) {
    try {
        const id = Number(req.params.id);
        const { isActive } = req.body;

        const existing = await prisma.productCategory.findUnique({ where: { id } });
        if (!existing) return res.status(404).json({ error: 'CATEGORY_NOT_FOUND' });
        if (existing.deletedAt)
            return res.status(400).json({ error: 'CATEGORY_DELETED' });

        const updated = await prisma.productCategory.update({
            where: { id },
            data: { isActive: Boolean(isActive) },
        });
        res.json(updated);
    } catch (error: any) {
        console.error('toggleProductCategory error:', error);
        res.status(500).json({ error: 'INTERNAL' });
    }
}

// ── DELETE /:id  (ADMIN, soft-delete, idempotent) ──────
export async function deleteProductCategory(req: Request, res: Response) {
    try {
        const id = Number(req.params.id);

        const existing = await prisma.productCategory.findUnique({ where: { id } });
        if (!existing) return res.status(404).json({ error: 'CATEGORY_NOT_FOUND' });

        // Idempotent: already deleted → return current state
        if (existing.deletedAt) return res.json(existing);

        const updated = await prisma.productCategory.update({
            where: { id },
            data: { deletedAt: new Date(), isActive: false },
        });
        res.json(updated);
    } catch (error: any) {
        console.error('deleteProductCategory error:', error);
        res.status(500).json({ error: 'INTERNAL' });
    }
}

// ── POST /bulk  (ADMIN) ───────────────────────────────
export async function bulkProductCategories(req: Request, res: Response) {
    try {
        const { ids, action } = req.body as {
            ids: number[];
            action: 'enable' | 'disable' | 'delete';
        };

        if (!Array.isArray(ids) || ids.length === 0)
            return res.status(400).json({ error: 'IDS_REQUIRED' });

        if (ids.length > 100)
            return res.status(400).json({ error: 'TOO_MANY_IDS', message: 'Максимум 100 элементов за раз.' });

        if (!['enable', 'disable', 'delete'].includes(action))
            return res.status(400).json({ error: 'INVALID_ACTION' });

        const data: any = {};
        if (action === 'enable') data.isActive = true;
        if (action === 'disable') data.isActive = false;
        if (action === 'delete') {
            data.deletedAt = new Date();
            data.isActive = false;
        }

        const result = await prisma.productCategory.updateMany({
            where: { id: { in: ids }, deletedAt: null },
            data,
        });
        res.json({ updated: result.count });
    } catch (error: any) {
        console.error('bulkProductCategories error:', error);
        res.status(500).json({ error: 'INTERNAL' });
    }
}
