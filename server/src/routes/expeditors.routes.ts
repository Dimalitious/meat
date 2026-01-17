import { Router } from 'express';
import { getExpeditors, createExpeditor, updateExpeditor, deleteExpeditor } from '../controllers/expeditors.controller';

const router = Router();

router.get('/', getExpeditors);
router.post('/', createExpeditor);
router.put('/:id', updateExpeditor);
router.delete('/:id', deleteExpeditor);

export default router;
