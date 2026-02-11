"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const auth_middleware_1 = require("../middleware/auth.middleware");
const rbac_constants_1 = require("../prisma/rbac.constants");
const journals_controller_1 = require("../controllers/journals.controller");
const router = (0, express_1.Router)();
router.use(auth_middleware_1.authenticateToken);
router.use(auth_middleware_1.loadUserContext);
// Summary Orders Journal
router.get('/summary', (0, auth_middleware_1.requirePermission)(rbac_constants_1.PERM.JOURNALS_READ), journals_controller_1.getSummaryJournals);
router.get('/summary/:id', (0, auth_middleware_1.requirePermission)(rbac_constants_1.PERM.JOURNALS_READ), journals_controller_1.getSummaryJournalById);
router.post('/summary', (0, auth_middleware_1.requirePermission)(rbac_constants_1.PERM.JOURNALS_MANAGE), journals_controller_1.createSummaryJournal);
router.put('/summary/:id', (0, auth_middleware_1.requirePermission)(rbac_constants_1.PERM.JOURNALS_MANAGE), journals_controller_1.updateSummaryJournal);
router.post('/summary/:id/rework', (0, auth_middleware_1.requirePermission)(rbac_constants_1.PERM.JOURNALS_MANAGE), journals_controller_1.sendSummaryJournalToRework);
// Assembly Orders Journal
router.get('/assembly', (0, auth_middleware_1.requirePermission)(rbac_constants_1.PERM.JOURNALS_READ), journals_controller_1.getAssemblyJournals);
router.get('/assembly/:id', (0, auth_middleware_1.requirePermission)(rbac_constants_1.PERM.JOURNALS_READ), journals_controller_1.getAssemblyJournalById);
router.post('/assembly', (0, auth_middleware_1.requirePermission)(rbac_constants_1.PERM.JOURNALS_MANAGE), journals_controller_1.createAssemblyJournal);
router.put('/assembly/:id', (0, auth_middleware_1.requirePermission)(rbac_constants_1.PERM.JOURNALS_MANAGE), journals_controller_1.updateAssemblyJournal);
router.post('/assembly/:id/rework', (0, auth_middleware_1.requirePermission)(rbac_constants_1.PERM.JOURNALS_MANAGE), journals_controller_1.sendAssemblyJournalToRework);
// Expedition Journal
router.get('/expedition', (0, auth_middleware_1.requirePermission)(rbac_constants_1.PERM.JOURNALS_READ), journals_controller_1.getExpeditionJournals);
router.get('/expedition/:id', (0, auth_middleware_1.requirePermission)(rbac_constants_1.PERM.JOURNALS_READ), journals_controller_1.getExpeditionJournalById);
router.post('/expedition', (0, auth_middleware_1.requirePermission)(rbac_constants_1.PERM.JOURNALS_MANAGE), journals_controller_1.createExpeditionJournal);
router.put('/expedition/:id', (0, auth_middleware_1.requirePermission)(rbac_constants_1.PERM.JOURNALS_MANAGE), journals_controller_1.updateExpeditionJournal);
// Distribution Journal
router.get('/distribution', (0, auth_middleware_1.requirePermission)(rbac_constants_1.PERM.JOURNALS_READ), journals_controller_1.getDistributionJournals);
router.get('/distribution/:id', (0, auth_middleware_1.requirePermission)(rbac_constants_1.PERM.JOURNALS_READ), journals_controller_1.getDistributionJournalById);
router.post('/distribution', (0, auth_middleware_1.requirePermission)(rbac_constants_1.PERM.JOURNALS_MANAGE), journals_controller_1.createDistributionJournal);
router.put('/distribution/:id', (0, auth_middleware_1.requirePermission)(rbac_constants_1.PERM.JOURNALS_MANAGE), journals_controller_1.updateDistributionJournal);
exports.default = router;
