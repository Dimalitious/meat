"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const multer_1 = __importDefault(require("multer"));
const auth_middleware_1 = require("../middleware/auth.middleware");
const rbac_constants_1 = require("../prisma/rbac.constants");
const import_controller_1 = require("../controllers/import.controller");
const router = (0, express_1.Router)();
const upload = (0, multer_1.default)({ storage: multer_1.default.memoryStorage() });
router.post('/excel', auth_middleware_1.authenticateToken, auth_middleware_1.loadUserContext, (0, auth_middleware_1.requirePermission)(rbac_constants_1.PERM.IMPORT_EXECUTE), upload.single('file'), import_controller_1.importData);
exports.default = router;
