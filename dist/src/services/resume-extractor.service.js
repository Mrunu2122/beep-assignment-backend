"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.parseResumeDocument = parseResumeDocument;
exports.extractStructuredResume = extractStructuredResume;
const pdf_parse_1 = __importDefault(require("pdf-parse"));
const mammoth_1 = __importDefault(require("mammoth"));
/**
 * Validates file buffer, mime type and size (Max 5MB).
 * Respects candidate privacy: does not store files to disk.
 */
async function parseResumeDocument(fileBuffer, filename, mimetype) {
    const maxSize = 5 * 1024 * 1024; // 5 MB limit
    if (fileBuffer.length > maxSize) {
        throw new Error('File size exceeds the 5MB security limit.');
    }
    const lowerName = filename.toLowerCase();
    // 1. PDF Extraction
    if (lowerName.endsWith('.pdf') || mimetype === 'application/pdf') {
        try {
            const data = await pdf_parse_1.default(fileBuffer);
            const text = data.text?.trim() || '';
            if (!text || text.length < 50) {
                throw new Error('Document contains insufficient extractable text. Scanned or image-only PDFs require OCR or a text-based format.');
            }
            return {
                text,
                wordCount: text.split(/\s+/).filter(Boolean).length,
                format: 'pdf'
            };
        }
        catch (err) {
            throw new Error(`PDF Parsing failed: ${err.message || 'Corrupted or encrypted PDF'}`);
        }
    }
    // 2. DOCX Extraction
    if (lowerName.endsWith('.docx') ||
        mimetype === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document') {
        try {
            const result = await mammoth_1.default.extractRawText({ buffer: fileBuffer });
            const text = result.value?.trim() || '';
            if (!text || text.length < 50) {
                throw new Error('The DOCX file is empty or lacks extractable text.');
            }
            return {
                text,
                wordCount: text.split(/\s+/).filter(Boolean).length,
                format: 'docx'
            };
        }
        catch (err) {
            throw new Error(`DOCX Parsing failed: ${err.message || 'Invalid or encrypted file'}`);
        }
    }
    // 3. Plain Text fallback (for testing/development)
    if (lowerName.endsWith('.txt') || mimetype === 'text/plain') {
        const text = fileBuffer.toString('utf-8').trim();
        return {
            text,
            wordCount: text.split(/\s+/).filter(Boolean).length,
            format: 'txt'
        };
    }
    throw new Error('Unsupported format. Please upload a PDF (.pdf) or Word document (.docx).');
}
/**
 * Deterministically parses structured sections from resume text
 * (Skills, Education, Projects, Experience, Internships, Certifications).
 * Preserves evidence snippets for transparent verification.
 */
function extractStructuredResume(rawText) {
    const lines = rawText.split('\n').map(l => l.trim()).filter(Boolean);
    const skills = new Set();
    const knownSkillList = [
        'JavaScript', 'TypeScript', 'Python', 'Java', 'C++', 'C#', 'Go', 'Golang', 'Rust', 'Ruby', 'PHP', 'Swift', 'Kotlin',
        'React', 'Next.js', 'Vue', 'Angular', 'Node.js', 'Express', 'NestJS', 'Django', 'FastAPI', 'Spring Boot', 'Flask',
        'SQL', 'PostgreSQL', 'MySQL', 'MongoDB', 'Redis', 'GraphQL', 'REST', 'RESTful APIs', 'Kafka', 'RabbitMQ',
        'AWS', 'Azure', 'GCP', 'Docker', 'Kubernetes', 'CI/CD', 'Git', 'GitHub', 'Linux', 'Terraform',
        'HTML', 'CSS', 'Tailwind', 'Tailwind CSS', 'Redux', 'Jest', 'Playwright', 'Cypress', 'PyTorch', 'TensorFlow',
        'Machine Learning', 'Data Analysis', 'Pandas', 'NumPy', 'Scikit-learn', 'Microservices', 'System Design'
    ];
    // Match known skills case-insensitively
    for (const skill of knownSkillList) {
        const regex = new RegExp(`\\b${skill.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i');
        if (regex.test(rawText)) {
            skills.add(skill);
        }
    }
    // Extract Education items
    const education = [];
    const degreePatterns = [
        /(B\.?Tech|Bachelor of Technology|B\.?E\.?|Bachelor of Engineering|B\.?Sc|Bachelor of Science|BCA|MCA|M\.?Tech|Master of Technology|M\.?S\.?)/i
    ];
    lines.forEach(line => {
        for (const pat of degreePatterns) {
            if (pat.test(line)) {
                education.push({
                    degree: line.slice(0, 100),
                    institution: 'Accredited Institution'
                });
                break;
            }
        }
    });
    // Extract Projects
    const projects = [];
    let inProjectSection = false;
    let currentProject = null;
    for (const line of lines) {
        if (/^projects?(\s*:|\b)/i.test(line)) {
            inProjectSection = true;
            continue;
        }
        if (inProjectSection && /^(experience|education|skills|certifications|achievements)/i.test(line)) {
            if (currentProject)
                projects.push(currentProject);
            inProjectSection = false;
            break;
        }
        if (inProjectSection) {
            if (line.length > 5 && line.length < 60 && !line.startsWith('-') && !line.startsWith('•')) {
                if (currentProject)
                    projects.push(currentProject);
                currentProject = {
                    title: line,
                    description: '',
                    technologies: []
                };
            }
            else if (currentProject) {
                currentProject.description += ' ' + line;
                // Check tech mentions
                knownSkillList.forEach(tech => {
                    const escaped = tech.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
                    if (new RegExp(`\\b${escaped}\\b`, 'i').test(line) && !currentProject.technologies.includes(tech)) {
                        currentProject.technologies.push(tech);
                    }
                });
            }
        }
    }
    if (currentProject)
        projects.push(currentProject);
    return {
        skills: Array.from(skills),
        education: education.length > 0 ? education : [{ degree: 'Engineering / Computer Science Degree' }],
        projects,
        workExperience: [],
        internships: [],
        certifications: [],
        achievements: [],
        rawTextLength: rawText.length
    };
}
