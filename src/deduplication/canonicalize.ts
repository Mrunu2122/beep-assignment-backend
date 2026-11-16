import crypto from 'crypto';
import { slugify, cleanUrl } from '../normalization/normalize-job.js';

export function generateCanonicalHash(company: string, title: string, applyUrl: string): string {
  const normCompany = slugify(company);
  const normTitle = slugify(title);
  const cleanedUrl = cleanUrl(applyUrl);
  
  let hostAndPath = '';
  try {
    const parsed = new URL(cleanedUrl);
    hostAndPath = `${parsed.hostname}${parsed.pathname}`;
  } catch {
    hostAndPath = cleanedUrl;
  }

  const rawKey = `${normCompany}::${normTitle}::${hostAndPath}`.toLowerCase();
  return crypto.createHash('sha256').update(rawKey).digest('hex').substring(0, 32);
}

export function generateClusterId(company: string, title: string): string {
  const normCompany = slugify(company);
  // Remove common noise words like 'trainee', 'intern', 'graduate' for clustering
  const baseTitle = slugify(title)
    .replace(/(intern|trainee|fresher|associate|junior|campus|batch-2024|batch-2025|batch-2026)/g, '')
    .replace(/-+/g, '-')
    .replace(/^-+|-+$/g, '');
  
  return crypto.createHash('sha256').update(`${normCompany}::${baseTitle}`).digest('hex').substring(0, 16);
}
