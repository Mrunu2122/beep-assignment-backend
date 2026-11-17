import test from 'node:test';
import assert from 'node:assert/strict';
import {
  calculateMatchCompatibility,
  evaluateSkillEvidence,
  DEFAULT_SCORING_WEIGHTS
} from '../../backend/src/services/match-engine.service';
import { extractStructuredResume } from '../../backend/src/services/resume-extractor.service';
import { JobRequirementsExtraction, ExtractedResume } from '@launchpad/shared';

test('evaluateSkillEvidence: identifies DEMONSTRATED skill with project evidence', () => {
  const resume: ExtractedResume = {
    skills: ['TypeScript', 'React'],
    education: [{ degree: 'B.Tech CS' }],
    projects: [
      {
        title: 'E-commerce API',
        description: 'Built scalable backend using Node.js and PostgreSQL with Docker containers.',
        technologies: ['Node.js', 'PostgreSQL', 'Docker']
      }
    ],
    workExperience: [],
    internships: [],
    certifications: [],
    achievements: [],
    rawTextLength: 300
  };

  const fullText = 'E-commerce API using Node.js, PostgreSQL and Docker containerization.';

  // 1. Skill in project description
  const nodeEval = evaluateSkillEvidence('Node.js', resume, fullText);
  assert.equal(nodeEval.level, 'DEMONSTRATED');
  assert.equal(nodeEval.score, 1.0);
  assert.ok(nodeEval.snippet?.includes('E-commerce API'));

  // 2. Skill listed in skills array only
  const tsEval = evaluateSkillEvidence('TypeScript', resume, fullText);
  assert.equal(tsEval.level, 'MENTIONED');
  assert.equal(tsEval.score, 0.70);

  // 3. Synonym matching (PostgreSQL for SQL)
  const sqlEval = evaluateSkillEvidence('SQL', resume, fullText);
  assert.equal(sqlEval.level, 'DEMONSTRATED');
  assert.equal(sqlEval.score, 1.0);

  // 4. Missing skill
  const rustEval = evaluateSkillEvidence('Rust', resume, fullText);
  assert.equal(rustEval.level, 'NOT_FOUND');
  assert.equal(rustEval.score, 0.0);
});

test('calculateMatchCompatibility: calculates deterministic, weighted score without hallucination', () => {
  const jobReqs: JobRequirementsExtraction = {
    jobId: 'job-canonical-test',
    jobTitle: 'Junior Backend Engineer',
    company: 'Canonical',
    requiredSkills: ['Node.js', 'TypeScript', 'SQL', 'Docker'],
    preferredSkills: ['Kubernetes', 'Redis'],
    experienceRequirements: '0-1 years',
    educationRequirements: 'B.Tech in Computer Science',
    coreResponsibilities: ['Build robust microservices'],
    isDescriptionComplete: true
  };

  const resume: ExtractedResume = {
    skills: ['TypeScript', 'Node.js', 'SQL', 'Docker'],
    education: [{ degree: 'B.Tech in Computer Science' }],
    projects: [
      {
        title: 'Microservices Backend',
        description: 'Developed backend microservice with Node.js and Docker.',
        technologies: ['Node.js', 'Docker']
      }
    ],
    workExperience: [],
    internships: [],
    certifications: [],
    achievements: [],
    rawTextLength: 450
  };

  const fullText = 'Junior Backend Engineer candidate with B.Tech in Computer Science. Built Microservices Backend using Node.js and Docker.';

  const result = calculateMatchCompatibility(jobReqs, resume, fullText, DEFAULT_SCORING_WEIGHTS);

  // Score must be between 0 and 100
  assert.ok(result.overallScore > 0 && result.overallScore <= 100);
  assert.ok(result.scoringBreakdown.requiredSkillsScore > 0);
  assert.ok(result.scoringBreakdown.educationScore > 0);

  // Missing requirements list must be accurate
  assert.equal(result.missingMandatoryRequirements.length, 0);

  // Actionable recommendations generated
  assert.ok(result.actionableRecommendations.length > 0);
  assert.ok(result.disclaimer.includes('not an official ATS vendor proprietary score'));
});

test('extractStructuredResume: parses skills, education, and projects from raw text', () => {
  const sampleText = `
    Jane Doe
    jane@example.com

    Education:
    Bachelor of Technology in Computer Science, 2024

    Skills:
    Python, Django, React, PostgreSQL, Git, AWS

    Projects:
    Healthcare Analytics Portal
    Created a web platform using React and Python Django to visualize patient metrics.
  `;

  const extracted = extractStructuredResume(sampleText);
  assert.ok(extracted.skills.includes('Python'));
  assert.ok(extracted.skills.includes('React'));
  assert.ok(extracted.skills.includes('PostgreSQL'));
  assert.ok(extracted.education.length > 0);
  assert.ok(extracted.projects.length > 0);
  assert.equal(extracted.projects[0].title, 'Healthcare Analytics Portal');
});
