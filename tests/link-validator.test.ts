import test from 'node:test';
import assert from 'node:assert/strict';
import { ApplicationLinkValidator } from '../src/normalization/link-validator.js';

test('1. Malformed and localhost URLs are marked as INVALID', async () => {
  const res1 = await ApplicationLinkValidator.validateUrl('http://localhost:3000/apply');
  assert.equal(res1.status, 'INVALID', 'Localhost URLs must be rejected in production');

  const res2 = await ApplicationLinkValidator.validateUrl('not-a-valid-url');
  assert.equal(res2.status, 'INVALID', 'Malformed URLs must be rejected');

  const res3 = await ApplicationLinkValidator.validateUrl('ftp://example.com/jobs');
  assert.equal(res3.status, 'INVALID', 'Non-HTTP(S) schemes must be rejected');
});

test('2. Valid HTTPS URLs resolve without crashing', async () => {
  const res = await ApplicationLinkValidator.validateUrl('https://example.com', 4000);
  assert.ok(['VERIFIED', 'REDIRECTED', 'UNVERIFIED', 'TEMPORARILY_UNAVAILABLE'].includes(res.status));
});
