import { Router } from 'express';
import { authenticateToken } from '../middleware/auth.middleware';
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
    getExpeditionJournalById
} from '../controllers/journals.controller';

const router = Router();

// Summary Orders Journal
router.get('/summary', authenticateToken, getSummaryJournals);
router.get('/summary/:id', authenticateToken, getSummaryJournalById);
router.post('/summary', authenticateToken, createSummaryJournal);
router.put('/summary/:id', authenticateToken, updateSummaryJournal);
router.post('/summary/:id/rework', authenticateToken, sendSummaryJournalToRework);

// Assembly Orders Journal
router.get('/assembly', authenticateToken, getAssemblyJournals);
router.get('/assembly/:id', authenticateToken, getAssemblyJournalById);
router.post('/assembly', authenticateToken, createAssemblyJournal);
router.put('/assembly/:id', authenticateToken, updateAssemblyJournal);
router.post('/assembly/:id/rework', authenticateToken, sendAssemblyJournalToRework);

// Expedition Journal
router.get('/expedition', authenticateToken, getExpeditionJournals);
router.get('/expedition/:id', authenticateToken, getExpeditionJournalById);
router.post('/expedition', authenticateToken, createExpeditionJournal);
router.put('/expedition/:id', authenticateToken, updateExpeditionJournal);

export default router;
