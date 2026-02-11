import { Router } from 'express';
import { authenticateToken, loadUserContext, requirePermission } from '../middleware/auth.middleware';
import { PERM } from '../prisma/rbac.constants';
import * as countries from '../controllers/countries.controller';

const router = Router();
router.use(authenticateToken);
router.use(loadUserContext);

router.get('/', requirePermission(PERM.CATALOG_PRODUCTS), countries.getCountries);
router.post('/', requirePermission(PERM.CATALOG_PRODUCTS), countries.createCountry);
router.patch('/:id', requirePermission(PERM.CATALOG_PRODUCTS), countries.updateCountry);

export default router;
