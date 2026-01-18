import { Router } from 'express';
import { authenticateToken } from '../middleware/auth.middleware';
import {
    getSummaryJournals,
    createSummaryJournal,
    updateSummaryJournal,
    getSummaryJournalById,
    getAssemblyJournals,
    createAssemblyJournal,
    updateAssemblyJournal,
    getAssemblyJournalById
} from '../controllers/journals.controller';

const router = Router();

// Summary Orders Journal
router.get('/summary', authenticateToken, getSummaryJournals);
router.get('/summary/:id', authenticateToken, getSummaryJournalById);
router.post('/summary', authenticateToken, createSummaryJournal);
router.put('/summary/:id', authenticateToken, updateSummaryJournal);

// Assembly Orders Journal
router.get('/assembly', authenticateToken, getAssemblyJournals);
router.get('/assembly/:id', authenticateToken, getAssemblyJournalById);
router.post('/assembly', authenticateToken, createAssemblyJournal);
router.put('/assembly/:id', authenticateToken, updateAssemblyJournal);

export default router;
