"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.MatchAnalysisResultSchema = exports.ScoringWeightsSchema = exports.JobRequirementsExtractionSchema = exports.ExtractedResumeSchema = exports.SkillMatchItemSchema = exports.SkillEvidenceLevelSchema = void 0;
const zod_1 = require("zod");
exports.SkillEvidenceLevelSchema = zod_1.z.enum([
    'DEMONSTRATED', // Applied in a project or work experience with quantifiable impact
    'MENTIONED', // Listed in skills list or summary without deep context
    'PARTIAL', // Related tool/framework or conceptual mention
    'NOT_FOUND', // No evidence found in resume text
    'NOT_ASSESSABLE' // Ambiguous or cannot be evaluated
]);
exports.SkillMatchItemSchema = zod_1.z.object({
    skillName: zod_1.z.string(),
    isMandatory: zod_1.z.boolean(),
    evidenceLevel: exports.SkillEvidenceLevelSchema,
    scoreContribution: zod_1.z.number().min(0).max(1), // 0 to 1
    evidenceSnippet: zod_1.z.string().optional(),
    reasoning: zod_1.z.string()
});
exports.ExtractedResumeSchema = zod_1.z.object({
    candidateName: zod_1.z.string().optional(),
    email: zod_1.z.string().optional(), // Redacted / omitted in logs
    phone: zod_1.z.string().optional(),
    skills: zod_1.z.array(zod_1.z.string()),
    education: zod_1.z.array(zod_1.z.object({
        degree: zod_1.z.string(),
        institution: zod_1.z.string().optional(),
        yearOfGraduation: zod_1.z.string().optional(),
        fieldOfStudy: zod_1.z.string().optional()
    })),
    projects: zod_1.z.array(zod_1.z.object({
        title: zod_1.z.string(),
        description: zod_1.z.string(),
        technologies: zod_1.z.array(zod_1.z.string()),
        highlights: zod_1.z.array(zod_1.z.string()).optional()
    })),
    workExperience: zod_1.z.array(zod_1.z.object({
        role: zod_1.z.string(),
        company: zod_1.z.string(),
        duration: zod_1.z.string().optional(),
        responsibilities: zod_1.z.array(zod_1.z.string())
    })),
    internships: zod_1.z.array(zod_1.z.object({
        role: zod_1.z.string(),
        company: zod_1.z.string(),
        duration: zod_1.z.string().optional(),
        responsibilities: zod_1.z.array(zod_1.z.string())
    })),
    certifications: zod_1.z.array(zod_1.z.string()),
    achievements: zod_1.z.array(zod_1.z.string()),
    rawTextLength: zod_1.z.number()
});
exports.JobRequirementsExtractionSchema = zod_1.z.object({
    jobId: zod_1.z.string(),
    jobTitle: zod_1.z.string(),
    company: zod_1.z.string(),
    requiredSkills: zod_1.z.array(zod_1.z.string()),
    preferredSkills: zod_1.z.array(zod_1.z.string()),
    experienceRequirements: zod_1.z.string(),
    educationRequirements: zod_1.z.string(),
    coreResponsibilities: zod_1.z.array(zod_1.z.string()),
    isDescriptionComplete: zod_1.z.boolean(),
    warningMessage: zod_1.z.string().optional()
});
exports.ScoringWeightsSchema = zod_1.z.object({
    requiredSkills: zod_1.z.number().default(0.35),
    relevantExperienceProjects: zod_1.z.number().default(0.25),
    roleAlignment: zod_1.z.number().default(0.15),
    educationEligibility: zod_1.z.number().default(0.10),
    keywords: zod_1.z.number().default(0.10),
    evidenceQuality: zod_1.z.number().default(0.05)
});
exports.MatchAnalysisResultSchema = zod_1.z.object({
    matchId: zod_1.z.string(),
    jobId: zod_1.z.string(),
    jobTitle: zod_1.z.string(),
    company: zod_1.z.string(),
    overallScore: zod_1.z.number().min(0).max(100),
    scoreCategory: zod_1.z.enum(['HIGH', 'MODERATE', 'GROWTH_OPPORTUNITY']),
    scoringBreakdown: zod_1.z.object({
        requiredSkillsScore: zod_1.z.number(), // 0 - 35
        experienceProjectsScore: zod_1.z.number(), // 0 - 25
        roleAlignmentScore: zod_1.z.number(), // 0 - 15
        educationScore: zod_1.z.number(), // 0 - 10
        keywordDensityScore: zod_1.z.number(), // 0 - 10
        evidenceQualityScore: zod_1.z.number() // 0 - 5
    }),
    weightsUsed: exports.ScoringWeightsSchema,
    skillAnalysis: zod_1.z.array(exports.SkillMatchItemSchema),
    requiredSkillsMatchedCount: zod_1.z.number(),
    requiredSkillsTotalCount: zod_1.z.number(),
    preferredSkillsMatchedCount: zod_1.z.number(),
    preferredSkillsTotalCount: zod_1.z.number(),
    missingMandatoryRequirements: zod_1.z.array(zod_1.z.string()),
    strongestProjectEvidence: zod_1.z.array(zod_1.z.object({
        projectTitle: zod_1.z.string(),
        alignmentReason: zod_1.z.string(),
        relevantTechnologies: zod_1.z.array(zod_1.z.string())
    })),
    experienceAlignmentAssessment: zod_1.z.string(),
    educationAlignmentAssessment: zod_1.z.string(),
    actionableRecommendations: zod_1.z.array(zod_1.z.object({
        priority: zod_1.z.enum(['HIGH', 'MEDIUM', 'LOW']),
        category: zod_1.z.string(),
        advice: zod_1.z.string(),
        concreteExample: zod_1.z.string()
    })),
    disclaimer: zod_1.z.string(),
    analyzedAt: zod_1.z.string()
});
