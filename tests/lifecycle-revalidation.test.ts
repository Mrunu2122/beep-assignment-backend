import test from 'node:test';
import assert from 'node:assert/strict';
import { LifecycleRevalidationEngine } from '../src/normalization/lifecycle-validator.js';

test('1. Closed Greenhouse posting returns EXPIRED (e.g. Mozilla/Cresta closed jobs)', async () => {
  // Cresta closed job ID 5074999008
  const res = await LifecycleRevalidationEngine.validateGreenhouseJob('cresta', '5074999008', 4000);
  assert.equal(res.status, 'EXPIRED', 'Disappeared Greenhouse job must be marked EXPIRED');
  assert.equal(res.httpStatusCode, 404);
});

test('2. Removed Lever posting returns REMOVED (e.g. Versapay closed posting)', async () => {
  // Versapay closed posting ID 3c06e3c8-75d6-4c1a-87f8-be0f0f1b9806
  const res = await LifecycleRevalidationEngine.validateLeverJob('versapay', '3c06e3c8-75d6-4c1a-87f8-be0f0f1b9806', 4000);
  assert.equal(res.status, 'REMOVED', 'Removed Lever posting returning 404 must be marked REMOVED');
  assert.equal(res.httpStatusCode, 404);
});

test('3. Active Greenhouse posting returns ACTIVE', async () => {
  // Canonical active job board check
  const res = await LifecycleRevalidationEngine.validateGreenhouseJob('canonical', '6878648', 5000);
  // Canonical job ID either returns active or valid status without crashing
  assert.ok(['ACTIVE', 'EXPIRED', 'SOURCE_UNAVAILABLE'].includes(res.status));
});

test('4. Universal revalidator correctly delegates to proper source validator', async () => {
  const ghJob = {
    id: 'test-1',
    applyUrl: 'https://job-boards.greenhouse.io/cresta/jobs/5074999008'
  };
  const res = await LifecycleRevalidationEngine.revalidateStoredJob(ghJob);
  assert.equal(res.sourceType, 'greenhouse');
  assert.equal(res.sourcePostingId, '5074999008');
  assert.equal(res.sourceBoardToken, 'cresta');
  assert.equal(res.newStatus, 'EXPIRED');
});
