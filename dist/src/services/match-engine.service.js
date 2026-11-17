"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.DEFAULT_SCORING_WEIGHTS = void 0;
exports.evaluateSkillEvidence = evaluateSkillEvidence;
exports.calculateMatchCompatibility = calculateMatchCompatibility;
// Standard configurable weights conforming to prompt specifications
exports.DEFAULT_SCORING_WEIGHTS = {
    requiredSkills: 0.35, // 35%
    relevantExperienceProjects: 0.25, // 25%
    roleAlignment: 0.15, // 15%
    educationEligibility: 0.10, // 10%
    keywords: 0.10, // 10%
    evidenceQuality: 0.05 // 5%
};
// Skill synonym dictionaries to avoid penalizing exact phrasing
const SKILL_SYNONYMS = {
    'typescript': ['ts', 'typescript'],
    'javascript': ['js', 'javascript', 'es6', 'ecmascript'],
    'react': ['react', 'react.js', 'reactjs'],
    'next.js': ['nextjs', 'next.js', 'next'],
    'node.js': ['node', 'nodejs', 'node.js'],
    'python': ['python', 'py', 'python3'],
    'c++': ['c++', 'cpp'],
    'golang': ['go', 'golang'],
    'docker': ['docker', 'containerization', 'containers'],
    'kubernetes': ['k8s', 'kubernetes'],
    'aws': ['amazon web services', 'aws', 's3', 'ec2', 'lambda'],
    'sql': ['relational databases', 'sql', 'postgresql', 'postgres', 'mysql', 'sqlite'],
    'mongodb': ['mongo', 'mongodb', 'nosql', 'documentdb'],
    'rest': ['restful', 'rest api', 'rest apis', 'restful apis', 'http apis'],
    'ci/cd': ['continuous integration', 'ci/cd', 'github actions', 'jenkins', 'gitlab ci']
};
/**
 * Searches for evidence of a target skill in resume text, project descriptions, and skill lists.
 */
function evaluateSkillEvidence(targetSkill, resume, fullResumeText) {
    const normTarget = targetSkill.toLowerCase().trim();
    const synonyms = SKILL_SYNONYMS[normTarget] || [normTarget];
    // 1. Check Projects for DEMONSTRATED evidence (highest value: score = 1.0)
    for (const proj of resume.projects) {
        const projContent = `${proj.title} ${proj.description} ${proj.technologies.join(' ')}`.toLowerCase();
        for (const syn of synonyms) {
            if (projContent.includes(syn)) {
                return {
                    level: 'DEMONSTRATED',
                    score: 1.0,
                    snippet: `Demonstrated in project "${proj.title}": ${proj.description.slice(0, 140)}...`,
                    reasoning: `Candidate applied ${targetSkill} directly in practical project work.`
                };
            }
        }
    }
    // 2. Check Work Experience or Internships (DEMONSTRATED: score = 1.0)
    for (const exp of [...resume.workExperience, ...resume.internships]) {
        const expContent = `${exp.role} ${exp.company} ${exp.responsibilities.join(' ')}`.toLowerCase();
        for (const syn of synonyms) {
            if (expContent.includes(syn)) {
                return {
                    level: 'DEMONSTRATED',
                    score: 1.0,
                    snippet: `Utilized during tenure at ${exp.company} (${exp.role}).`,
                    reasoning: `Direct professional or internship application of ${targetSkill}.`
                };
            }
        }
    }
    // 3. Check explicitly listed skills (MENTIONED: score = 0.70)
    const resumeSkillsLower = resume.skills.map(s => s.toLowerCase());
    for (const syn of synonyms) {
        if (resumeSkillsLower.includes(syn)) {
            return {
                level: 'MENTIONED',
                score: 0.70,
                snippet: `Listed under Technical Skills: ${targetSkill}`,
                reasoning: `Directly declared in candidate skill profile, but not linked to a specific project description.`
            };
        }
    }
    // 4. Check full text for PARTIAL or contextual mention (PARTIAL: score = 0.40)
    const fullLower = fullResumeText.toLowerCase();
    for (const syn of synonyms) {
        const idx = fullLower.indexOf(syn);
        if (idx !== -1) {
            const snippet = fullResumeText.slice(Math.max(0, idx - 40), Math.min(fullResumeText.length, idx + 80)).replace(/\s+/g, ' ');
            return {
                level: 'PARTIAL',
                score: 0.40,
                snippet: `Contextual mention: "...${snippet}..."`,
                reasoning: `Found related keyword mention in document context.`
            };
        }
    }
    // 5. Not found in resume text (NOT_FOUND: score = 0.0)
    return {
        level: 'NOT_FOUND',
        score: 0.0,
        reasoning: `No direct or contextual mention of "${targetSkill}" found in the provided resume document.`
    };
}
/**
 * Deterministic Matching Engine
 * Computes transparent, mathematical scores based on verified criteria and configurable weights.
 * Never allows the LLM to hallucinate random scores.
 */
function calculateMatchCompatibility(jobReqs, resume, fullResumeText, weights = exports.DEFAULT_SCORING_WEIGHTS) {
    const skillAnalysis = [];
    // Evaluate Required (Mandatory) Skills
    let reqSkillPointsEarned = 0;
    let reqSkillPointsTotal = Math.max(1, jobReqs.requiredSkills.length);
    let reqMatchedCount = 0;
    const missingMandatory = [];
    jobReqs.requiredSkills.forEach(reqSkill => {
        const evalResult = evaluateSkillEvidence(reqSkill, resume, fullResumeText);
        skillAnalysis.push({
            skillName: reqSkill,
            isMandatory: true,
            evidenceLevel: evalResult.level,
            scoreContribution: evalResult.score,
            evidenceSnippet: evalResult.snippet,
            reasoning: evalResult.reasoning
        });
        reqSkillPointsEarned += evalResult.score;
        if (evalResult.score >= 0.7) {
            reqMatchedCount++;
        }
        else if (evalResult.level === 'NOT_FOUND') {
            missingMandatory.push(reqSkill);
        }
    });
    // Evaluate Preferred (Optional) Skills
    let prefMatchedCount = 0;
    jobReqs.preferredSkills.forEach(prefSkill => {
        const evalResult = evaluateSkillEvidence(prefSkill, resume, fullResumeText);
        skillAnalysis.push({
            skillName: prefSkill,
            isMandatory: false,
            evidenceLevel: evalResult.level,
            scoreContribution: evalResult.score,
            evidenceSnippet: evalResult.snippet,
            reasoning: evalResult.reasoning
        });
        if (evalResult.score >= 0.7) {
            prefMatchedCount++;
        }
    });
    // 1. Required Skills Score (Weight: 35)
    const reqSkillsScore = (reqSkillPointsEarned / reqSkillPointsTotal) * (weights.requiredSkills * 100);
    // 2. Experience / Projects Score (Weight: 25)
    // Higher score for relevant projects using required tech stack
    const projectCount = resume.projects.length;
    const projectsScoreRatio = Math.min(1, (projectCount >= 2 ? 0.8 : projectCount * 0.4) + (resume.internships.length > 0 ? 0.2 : 0));
    const expProjectsScore = projectsScoreRatio * (weights.relevantExperienceProjects * 100);
    // 3. Role Alignment Score (Weight: 15)
    // Checks alignment with job title keywords
    const titleWords = jobReqs.jobTitle.toLowerCase().split(/[\s,/]+/).filter(w => w.length > 3);
    let titleMatches = 0;
    const resumeTextLower = fullResumeText.toLowerCase();
    titleWords.forEach(w => {
        if (resumeTextLower.includes(w))
            titleMatches++;
    });
    const roleAlignmentRatio = titleWords.length > 0 ? Math.min(1, titleMatches / titleWords.length) : 0.8;
    const roleScore = roleAlignmentRatio * (weights.roleAlignment * 100);
    // 4. Education / Eligibility Score (Weight: 10)
    const hasDegree = resume.education.length > 0;
    const educationScore = (hasDegree ? 1.0 : 0.6) * (weights.educationEligibility * 100);
    // 5. Keyword Density Score (Weight: 10)
    let foundKeywords = 0;
    const allKeywords = [...jobReqs.requiredSkills, ...jobReqs.preferredSkills];
    allKeywords.forEach(k => {
        if (resumeTextLower.includes(k.toLowerCase()))
            foundKeywords++;
    });
    const keywordRatio = allKeywords.length > 0 ? Math.min(1, foundKeywords / allKeywords.length) : 0.7;
    const keywordScore = keywordRatio * (weights.keywords * 100);
    // 6. Evidence Quality Score (Weight: 5)
    // Rewarded if candidate has demonstrated evidence rather than just listing buzzwords
    const demonstratedCount = skillAnalysis.filter(s => s.evidenceLevel === 'DEMONSTRATED').length;
    const evidenceQualityRatio = Math.min(1, demonstratedCount >= 2 ? 1.0 : demonstratedCount * 0.5);
    const evidenceScore = evidenceQualityRatio * (weights.evidenceQuality * 100);
    // Overall Mathematical Sum (Bounded 0 - 100)
    const rawSum = reqSkillsScore + expProjectsScore + roleScore + educationScore + keywordScore + evidenceScore;
    const overallScore = Math.min(100, Math.max(0, Math.round(rawSum)));
    const scoreCategory = overallScore >= 75 ? 'HIGH' : overallScore >= 50 ? 'MODERATE' : 'GROWTH_OPPORTUNITY';
    // Actionable recommendations based on gaps
    const actionableRecommendations = [];
    if (missingMandatory.length > 0) {
        actionableRecommendations.push({
            priority: 'HIGH',
            category: 'Core Skill Gaps',
            advice: `Add demonstrable evidence for critical requirements: ${missingMandatory.slice(0, 3).join(', ')}.`,
            concreteExample: `Build a mini full-stack demo showcasing ${missingMandatory[0]} with a live deployed URL on GitHub.`
        });
    }
    const mentionedOnly = skillAnalysis.filter(s => s.evidenceLevel === 'MENTIONED');
    if (mentionedOnly.length > 0) {
        actionableRecommendations.push({
            priority: 'MEDIUM',
            category: 'Evidence Depth',
            advice: `You mentioned ${mentionedOnly.slice(0, 2).map(s => s.skillName).join(' & ')} in your skills section, but there are no corresponding project bullet points.`,
            concreteExample: `Under your latest project, add: "Implemented backend API handling authentication using ${mentionedOnly[0].skillName}."`
        });
    }
    actionableRecommendations.push({
        priority: 'LOW',
        category: 'Targeted Summary',
        advice: `Tailor your professional summary to explicitly reference ${jobReqs.jobTitle} competencies.`,
        concreteExample: `Include 2-3 key metrics (e.g., "Reduced response latency by 25%" or "Built 5+ REST endpoints").`
    });
    return {
        matchId: `match-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
        jobId: jobReqs.jobId,
        jobTitle: jobReqs.jobTitle,
        company: jobReqs.company,
        overallScore,
        scoreCategory,
        scoringBreakdown: {
            requiredSkillsScore: Math.round(reqSkillsScore * 10) / 10,
            experienceProjectsScore: Math.round(expProjectsScore * 10) / 10,
            roleAlignmentScore: Math.round(roleScore * 10) / 10,
            educationScore: Math.round(educationScore * 10) / 10,
            keywordDensityScore: Math.round(keywordScore * 10) / 10,
            evidenceQualityScore: Math.round(evidenceScore * 10) / 10
        },
        weightsUsed: weights,
        skillAnalysis,
        requiredSkillsMatchedCount: reqMatchedCount,
        requiredSkillsTotalCount: jobReqs.requiredSkills.length,
        preferredSkillsMatchedCount: prefMatchedCount,
        preferredSkillsTotalCount: jobReqs.preferredSkills.length,
        missingMandatoryRequirements: missingMandatory,
        strongestProjectEvidence: resume.projects.slice(0, 3).map(p => ({
            projectTitle: p.title,
            alignmentReason: `Demonstrates applied development using ${p.technologies.join(', ') || 'modern libraries'}`,
            relevantTechnologies: p.technologies
        })),
        experienceAlignmentAssessment: resume.workExperience.length > 0 || resume.internships.length > 0
            ? `Candidate possesses verified internship/work exposure aligned with early-career engineering.`
            : `Candidate demonstrates project-based learning suitable for fresher / 0-experience requisitions.`,
        educationAlignmentAssessment: hasDegree
            ? `Meets minimum undergraduate degree requirements for technical fresher hiring.`
            : `Degree details unconfirmed; check candidate education credentials.`,
        actionableRecommendations,
        disclaimer: `Launchpad Match Intelligence provides algorithmic alignment analysis based on visible document text. This is not an official ATS vendor proprietary score and does not guarantee interview invitations.`,
        analyzedAt: new Date().toISOString()
    };
}
