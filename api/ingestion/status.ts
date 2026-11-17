import { VercelRequest, VercelResponse } from '@vercel/node';
import { persistentStore } from '../../src/database/repositories/persistent-store.js';

export default async function handler(req: VercelRequest, res: VercelResponse) {
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
    const latestRun = await persistentStore.getLatestRun();
    const recentRuns = await persistentStore.getRuns(10);

    return res.status(200).json({
      latestRun,
      recentRuns
    });
  } catch (err: any) {
    return res.status(500).json({ error: err?.message || 'Internal Server Error' });
  }
}
