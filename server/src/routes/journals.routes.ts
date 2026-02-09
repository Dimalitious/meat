import { Router } from 'express';
import { authenticateToken, loadUserContext, requirePermission } from '../middleware/auth.middleware';
import { PERM } from '../prisma/rbac.constants';
import {
    getSummaryJournals,
    createSummaryJournal,
    updateSummaryJournal,
    getSummaryJournalById,
    sendSummaryJournalToRework,
    getAssemblyJournals,
    createAssemblyJournal,
    updateAssemblyJournal,
    getAssemblyJournalById,
    sendAssemblyJournalToRework,
    getExpeditionJournals,
    createExpeditionJournal,
    updateExpeditionJournal,
    getExpeditionJournalById,
    getDistributionJournals,
    createDistributionJournal,
    updateDistributionJournal,
    getDistributionJournalById
} from '../controllers/journals.controller';

const router = Router();
router.use(authenticateToken);
router.use(loadUserContext);

// Summary Orders Journal
router.get('/summary', requirePermission(PERM.JOURNALS_READ), getSummaryJournals);
router.get('/summary/:id', requirePermission(PERM.JOURNALS_READ), getSummaryJournalById);
router.post('/summary', requirePermission(PERM.JOURNALS_MANAGE), createSummaryJournal);
router.put('/summary/:id', requirePermission(PERM.JOURNALS_MANAGE), updateSummaryJournal);
router.post('/summary/:id/rework', requirePermission(PERM.JOURNALS_MANAGE), sendSummaryJournalToRework);

// Assembly Orders Journal
router.get('/assembly', requirePermission(PERM.JOURNALS_READ), getAssemblyJournals);
router.get('/assembly/:id', requirePermission(PERM.JOURNALS_READ), getAssemblyJournalById);
router.post('/assembly', requirePermission(PERM.JOURNALS_MANAGE), createAssemblyJournal);
router.put('/assembly/:id', requirePermission(PERM.JOURNALS_MANAGE), updateAssemblyJournal);
router.post('/assembly/:id/rework', requirePermission(PERM.JOURNALS_MANAGE), sendAssemblyJournalToRework);

// Expedition Journal
router.get('/expedition', requirePermission(PERM.JOURNALS_READ), getExpeditionJournals);
router.get('/expedition/:id', requirePermission(PERM.JOURNALS_READ), getExpeditionJournalById);
router.post('/expedition', requirePermission(PERM.JOURNALS_MANAGE), createExpeditionJournal);
router.put('/expedition/:id', requirePermission(PERM.JOURNALS_MANAGE), updateExpeditionJournal);

// Distribution Journal
router.get('/distribution', requirePermission(PERM.JOURNALS_READ), getDistributionJournals);
router.get('/distribution/:id', requirePermission(PERM.JOURNALS_READ), getDistributionJournalById);
router.post('/distribution', requirePermission(PERM.JOURNALS_MANAGE), createDistributionJournal);
router.put('/distribution/:id', requirePermission(PERM.JOURNALS_MANAGE), updateDistributionJournal);

export default router;
