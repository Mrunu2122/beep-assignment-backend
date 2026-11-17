"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = handler;
const persistent_store_js_1 = require("../src/database/repositories/persistent-store.js");
async function handler(req, res) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    if (req.method === 'OPTIONS') {
        return res.status(204).end();
    }
    if (req.method !== 'GET') {
        return res.status(405).json({ error: 'Method Not Allowed' });
    }
    try {
        const latestRun = await persistent_store_js_1.persistentStore.getLatestRun();
        const recentRuns = await persistent_store_js_1.persistentStore.getRuns(10);
        return res.status(200).json({
            latestRun,
            recentRuns
        });
    }
    catch (err) {
        return res.status(500).json({ error: err?.message || 'Internal Server Error' });
    }
}
