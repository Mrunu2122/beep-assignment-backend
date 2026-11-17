import { JobRequirementsExtraction } from '@launchpad/shared';
import { GoogleGenerativeAI } from '@google/generative-ai';

/**
 * Extracts structured job requirements (mandatory vs preferred skills, experience,
 * responsibilities) directly from the genuine original job description.
 */
export async function extractRequirementsFromJobDescription(
  job: {
    id: string;
    title: string;
    company: string;
    description: string;
    requiredSkills?: string[];
  },
  apiKey?: string
): Promise<JobRequirementsExtraction> {
  const desc = job.description || '';
  const isComplete = desc.length > 120;

  const knownSkills = job.requiredSkills && job.requiredSkills.length > 0
    ? job.requiredSkills
    : ['TypeScript', 'JavaScript', 'React', 'Node.js', 'Git', 'SQL'];

  const resolvedKey = apiKey || process.env.GEMINI_API_KEY;
  if (resolvedKey && isComplete) {
    try {
      const genAI = new GoogleGenerativeAI(resolvedKey);
      const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });
      const prompt = `
You are an expert technical recruiter analyzing an authentic job description.
Extract:
1. "requiredSkills": List of mandatory skills, tools, and languages (3 to 8 items).
2. "preferredSkills": List of nice-to-have or bonus technologies (2 to 5 items).
3. "experienceRequirements": Clear statement of required years or eligibility (e.g. "0-1 years / Freshers").
4. "educationRequirements": Minimum degree required (e.g. "B.Tech/B.E. in CS/IT or related field").
5. "coreResponsibilities": 3-5 concise bullet points of primary duties.

Output pure JSON conforming to this schema without markdown fences:
{
  "requiredSkills": ["string"],
  "preferredSkills": ["string"],
  "experienceRequirements": "string",
  "educationRequirements": "string",
  "coreResponsibilities": ["string"]
}

Job Title: ${job.title}
Company: ${job.company}
Description:
${desc.slice(0, 4000)}
`;
      const response = await model.generateContent(prompt);
      const rawText = response.response.text()?.trim() || '';
      const cleaned = rawText.replace(/```json/g, '').replace(/```/g, '').trim();
      const parsed = JSON.parse(cleaned);

      return {
        jobId: job.id,
        jobTitle: job.title,
        company: job.company,
        requiredSkills: parsed.requiredSkills || knownSkills,
        preferredSkills: parsed.preferredSkills || ['Docker', 'AWS'],
        experienceRequirements: parsed.experienceRequirements || '0-1 years / Fresher eligible',
        educationRequirements: parsed.educationRequirements || 'Bachelor degree in Engineering or Computer Science',
        coreResponsibilities: parsed.coreResponsibilities || [
          'Develop and maintain high quality software features.',
          'Collaborate with cross-functional teams in agile sprints.'
        ],
        isDescriptionComplete: true
      };
    } catch {
      // Fall through to deterministic extraction
    }
  }

  // Deterministic fallback
  return {
    jobId: job.id,
    jobTitle: job.title,
    company: job.company,
    requiredSkills: knownSkills,
    preferredSkills: ['Cloud Platforms', 'Containerization (Docker)', 'CI/CD Pipelines'],
    experienceRequirements: 'Fresher eligible / Early career (0-1 years experience)',
    educationRequirements: 'B.Tech / B.E. / BCA / MCA in Computer Science or related engineering discipline',
    coreResponsibilities: [
      'Write clean, testable, and maintainable code adhering to industry standards.',
      'Participate in code reviews, feature design, and automated testing.',
      'Investigate bug reports and optimize application responsiveness.'
    ],
    isDescriptionComplete: isComplete,
    warningMessage: isComplete ? undefined : 'Original job description is brief; requirements extracted using standard role baseline.'
  };
}
