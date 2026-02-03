"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const auth_middleware_1 = require("../middleware/auth.middleware");
const journals_controller_1 = require("../controllers/journals.controller");
const router = (0, express_1.Router)();
// Summary Orders Journal
router.get('/summary', auth_middleware_1.authenticateToken, journals_controller_1.getSummaryJournals);
router.get('/summary/:id', auth_middleware_1.authenticateToken, journals_controller_1.getSummaryJournalById);
router.post('/summary', auth_middleware_1.authenticateToken, journals_controller_1.createSummaryJournal);
router.put('/summary/:id', auth_middleware_1.authenticateToken, journals_controller_1.updateSummaryJournal);
router.post('/summary/:id/rework', auth_middleware_1.authenticateToken, journals_controller_1.sendSummaryJournalToRework);
// Assembly Orders Journal
router.get('/assembly', auth_middleware_1.authenticateToken, journals_controller_1.getAssemblyJournals);
router.get('/assembly/:id', auth_middleware_1.authenticateToken, journals_controller_1.getAssemblyJournalById);
router.post('/assembly', auth_middleware_1.authenticateToken, journals_controller_1.createAssemblyJournal);
router.put('/assembly/:id', auth_middleware_1.authenticateToken, journals_controller_1.updateAssemblyJournal);
router.post('/assembly/:id/rework', auth_middleware_1.authenticateToken, journals_controller_1.sendAssemblyJournalToRework);
// Expedition Journal
router.get('/expedition', auth_middleware_1.authenticateToken, journals_controller_1.getExpeditionJournals);
router.get('/expedition/:id', auth_middleware_1.authenticateToken, journals_controller_1.getExpeditionJournalById);
router.post('/expedition', auth_middleware_1.authenticateToken, journals_controller_1.createExpeditionJournal);
router.put('/expedition/:id', auth_middleware_1.authenticateToken, journals_controller_1.updateExpeditionJournal);
// Distribution Journal
router.get('/distribution', auth_middleware_1.authenticateToken, journals_controller_1.getDistributionJournals);
router.get('/distribution/:id', auth_middleware_1.authenticateToken, journals_controller_1.getDistributionJournalById);
router.post('/distribution', auth_middleware_1.authenticateToken, journals_controller_1.createDistributionJournal);
router.put('/distribution/:id', auth_middleware_1.authenticateToken, journals_controller_1.updateDistributionJournal);
exports.default = router;
