"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.deleteDistrict = exports.updateDistrict = exports.createDistrict = exports.getDistricts = void 0;
const db_1 = require("../db");
const getDistricts = async (req, res) => {
    try {
        const items = await db_1.prisma.district.findMany({ orderBy: { name: 'asc' } });
        res.json(items);
    }
    catch (error) {
        res.status(500).json({ error: 'Failed' });
    }
};
exports.getDistricts = getDistricts;
const createDistrict = async (req, res) => {
    try {
        const item = await db_1.prisma.district.create({ data: req.body });
        res.status(201).json(item);
    }
    catch (error) {
        res.status(400).json({ error: 'Failed' });
    }
};
exports.createDistrict = createDistrict;
const updateDistrict = async (req, res) => {
    try {
        const { code } = req.params;
        const item = await db_1.prisma.district.update({ where: { code }, data: req.body });
        res.json(item);
    }
    catch (error) {
        res.status(400).json({ error: 'Failed' });
    }
};
exports.updateDistrict = updateDistrict;
const deleteDistrict = async (req, res) => {
    try {
        const { code } = req.params;
        await db_1.prisma.district.delete({ where: { code } });
        res.json({ message: 'Deleted' });
    }
    catch (error) {
        res.status(400).json({ error: 'Failed' });
    }
};
exports.deleteDistrict = deleteDistrict;
