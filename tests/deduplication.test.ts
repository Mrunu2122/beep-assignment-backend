import test from 'node:test';
import assert from 'node:assert/strict';
import { generateCanonicalHash } from '../src/deduplication/canonicalize.js';
import { areJobsFuzzyDuplicates } from '../src/deduplication/fuzzy-match.js';
import { normalizeCompanyName, areLocationsCompatible } from '../src/deduplication/exact-match.js';
import { cleanUrl } from '../src/normalization/normalize-job.js';

test('1. Exact canonical hashing matches identical job postings regardless of UTM tags', () => {
  const hash1 = generateCanonicalHash('Swiggy', 'SDE 1 Frontend', 'https://swiggy.com/jobs/1?utm_source=linkedin');
  const hash2 = generateCanonicalHash('Swiggy', 'SDE 1 Frontend', 'https://swiggy.com/jobs/1?utm_campaign=campus');
  assert.equal(hash1, hash2, 'Canonical hashes must match when only tracking parameters differ');
});

test('2. Guardrail: Identical job titles from DIFFERENT companies must never merge', () => {
  const normA = normalizeCompanyName('Swiggy Private Limited');
  const normB = normalizeCompanyName('Zomato Media Pvt Ltd');
  assert.notEqual(normA, normB, 'Different company entities must never be treated as equivalent');
});

test('3. Fuzzy matching detects high similarity within same company', () => {
  const titleA = 'Software Development Engineer 1 (Frontend)';
  const descA = 'Looking for passionate React and TypeScript developers with data structures skills';
  const titleB = 'Software Development Engineer - Frontend (React)';
  const descB = 'Passionate React and TypeScript developer needed with good understanding of data structures';

  const check = areJobsFuzzyDuplicates(titleA, descA, titleB, descB, 0.65);
  assert.equal(check.isDuplicate, true, 'Slightly reworded postings for same role must match fuzzy threshold');
});

test('4. Location compatibility correctly matches equivalent metro naming', () => {
  assert.equal(areLocationsCompatible('Bengaluru, Karnataka', 'Bangalore, India'), true);
  assert.equal(areLocationsCompatible('Gurgaon, Haryana', 'Delhi NCR'), true);
  assert.equal(areLocationsCompatible('Remote, India', 'Pune, India'), true); // Remote compatible
  assert.equal(areLocationsCompatible('Mumbai', 'Chennai'), false);
});

test('5. URL cleaner strips extraneous parameters cleanly', () => {
  const cleaned = cleanUrl('https://boards.greenhouse.io/swiggy/jobs/12345?gh_jid=12345&utm_source=telegram/');
  assert.equal(cleaned.includes('utm_source'), false);
  assert.equal(cleaned.includes('gh_jid'), false);
});
