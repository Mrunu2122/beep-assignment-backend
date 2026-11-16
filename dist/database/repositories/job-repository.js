"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ingestionStore = exports.IngestionStore = void 0;
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
class IngestionStore {
    jobs = new Map();
    runs = [];
    dataPath = path_1.default.resolve(process.cwd(), '../data/seed-jobs.json');
    constructor() {
        this.loadFromDisk();
    }
    loadFromDisk() {
        try {
            if (fs_1.default.existsSync(this.dataPath)) {
                const raw = fs_1.default.readFileSync(this.dataPath, 'utf-8');
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
                    });
                }
            }
        }
        catch {
            // Graceful fallback to empty
        }
    }
    getAllJobs() {
        return Array.from(this.jobs.values());
    }
    getJobById(id) {
        return this.jobs.get(id);
    }
    getJobBySlug(slug) {
        return Array.from(this.jobs.values()).find(j => j.slug === slug);
    }
    upsertJob(job) {
        this.jobs.set(job.id, job);
    }
    recordRun(run) {
        this.runs.unshift(run);
        if (this.runs.length > 50)
            this.runs.pop();
    }
    getLatestRun() {
        return this.runs[0];
    }
    getRuns() {
        return this.runs;
    }
}
exports.IngestionStore = IngestionStore;
exports.ingestionStore = new IngestionStore();
