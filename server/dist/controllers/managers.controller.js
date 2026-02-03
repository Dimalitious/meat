"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.deleteManager = exports.updateManager = exports.createManager = exports.getManagers = void 0;
const db_1 = require("../db");
const getManagers = async (req, res) => {
    try {
        const items = await db_1.prisma.manager.findMany({ orderBy: { name: 'asc' } });
        res.json(items);
    }
    catch (error) {
        res.status(500).json({ error: 'Failed' });
    }
};
exports.getManagers = getManagers;
const createManager = async (req, res) => {
    try {
        const item = await db_1.prisma.manager.create({ data: req.body });
        res.status(201).json(item);
    }
    catch (error) {
        res.status(400).json({ error: 'Failed' });
    }
};
exports.createManager = createManager;
const updateManager = async (req, res) => {
    try {
        const { code } = req.params;
        const item = await db_1.prisma.manager.update({ where: { code }, data: req.body });
        res.json(item);
    }
    catch (error) {
        res.status(400).json({ error: 'Failed' });
    }
};
exports.updateManager = updateManager;
const deleteManager = async (req, res) => {
    try {
        const { code } = req.params;
        await db_1.prisma.manager.delete({ where: { code } });
        res.json({ message: 'Deleted' });
    }
    catch (error) {
        res.status(400).json({ error: 'Failed' });
    }
};
exports.deleteManager = deleteManager;
