import { CanonicalJob, IngestionRunSummary } from '@launchpad/shared';
import fs from 'fs';
import path from 'path';

export class IngestionStore {
  private jobs: Map<string, CanonicalJob> = new Map();
  private runs: IngestionRunSummary[] = [];
  private readonly dataPath = path.resolve(process.cwd(), '../data/seed-jobs.json');

  constructor() {
    this.loadFromDisk();
  }

  private loadFromDisk() {
    try {
      if (fs.existsSync(this.dataPath)) {
        const raw = fs.readFileSync(this.dataPath, 'utf-8');
        const list = JSON.parse(raw);
        for (const item of list) {
          // Adapt seed structure to canonical structure
          this.jobs.set(item.id, {
            ...item,
            externalId: item.id,
            originalUrl: item.applyUrl,
            applicationUrl: item.applyUrl,
            rawLocation: item.normalizedCity || '',
            normalizedState: 'Karnataka',
            country: 'India',
            experienceLevel: item.employmentType === 'internship' ? 'Internship' : 'Fresher / Entry Level',
            roleCategory: 'Software Engineering',
            roleSubcategory: item.standardRole || 'Engineering',
            skills: item.requiredSkills || ['Problem Solving', 'Data Structures'],
            salaryInformation: { currency: 'INR' },
            lastSeenAt: new Date().toISOString(),
            status: 'active',
            classificationConfidence: item.aiConfidence || 0.95,
            classificationModel: 'gemini-1.5-flash',
            classificationPromptVersion: 'v2.0.0',
            isGenuinelyFresher: true,
          } as CanonicalJob);
        }
      }
    } catch {
      // Graceful fallback to empty
    }
  }

  getAllJobs(): CanonicalJob[] {
    return Array.from(this.jobs.values());
  }

  getJobById(id: string): CanonicalJob | undefined {
    return this.jobs.get(id);
  }

  getJobBySlug(slug: string): CanonicalJob | undefined {
    return Array.from(this.jobs.values()).find(j => j.slug === slug);
  }

  upsertJob(job: CanonicalJob): void {
    this.jobs.set(job.id, job);
  }

  recordRun(run: IngestionRunSummary): void {
    this.runs.unshift(run);
    if (this.runs.length > 50) this.runs.pop();
  }

  getLatestRun(): IngestionRunSummary | undefined {
    return this.runs[0];
  }

  getRuns(): IngestionRunSummary[] {
    return this.runs;
  }
}

export const ingestionStore = new IngestionStore();
