"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ProductionJobClassifier = void 0;
const generative_ai_1 = require("@google/generative-ai");
const index_js_1 = require("../config/index.js");
const logger_js_1 = require("../monitoring/logger.js");
const shared_1 = require("@launchpad/shared");
class ProductionJobClassifier {
    genAI = null;
    promptVersion = 'v2.0.0-production';
    constructor() {
        if (index_js_1.config.gemini.apiKey) {
            this.genAI = new generative_ai_1.GoogleGenerativeAI(index_js_1.config.gemini.apiKey);
        }
    }
    async classify(title, company, rawLocation, rawDescription) {
        const startTime = Date.now();
        let retryCount = 0;
        const maxRetries = 2;
        // If no key or local mock mode, use conservative deterministic classification
        if (!this.genAI || !index_js_1.config.gemini.apiKey) {
            const fallbackResult = this.conservativeRuleFallback(title, company, rawLocation, rawDescription);
            return {
                result: fallbackResult,
                telemetry: {
                    modelName: 'deterministic_rule_engine',
                    promptVersion: this.promptVersion,
                    inputTokens: 0,
                    outputTokens: 0,
                    estimatedCostUsd: 0,
                    processingTimeMs: Date.now() - startTime,
                    success: true,
                    retryCount: 0,
                },
            };
        }
        const snippet = rawDescription.slice(0, 1400);
        const systemPrompt = `
You are an expert recruitment data intelligence engine classifying technical and early-career job listings in India.
Classify the opportunity into strict structured JSON matching this schema:

Fixed Role Categories allowed:
${shared_1.FIXED_ROLE_CATEGORIES.map(c => `- "${c}"`).join('\n')}

Role Subcategories:
${Object.entries(shared_1.ROLE_SUBCATEGORIES).map(([cat, subs]) => `${cat}: ${subs.join(', ')}`).join('\n')}

Rules:
1. roleCategory: Choose strictly from the fixed taxonomy above.
2. roleSubcategory: Choose the closest matching subcategory or specify.
3. normalizedCity: Conservative classification. If completely remote across India, return 'Remote (India)'. If indeterminate or outside major Indian hubs, return 'Unknown'.
4. isGenuinelyFresher: true ONLY IF 0-1 years of experience, campus graduate 2024/2025/2026, apprentice, or intern. If 2+ years required, set false.
5. confidenceScore: Float from 0.0 to 1.0.
6. reasoningBrief: Max 200 characters explaining the choice.

Job Data:
Title: ${title}
Company: ${company}
Location: ${rawLocation}
Description Snippet:
${snippet}

Respond ONLY with valid JSON.
`;
        while (retryCount <= maxRetries) {
            try {
                const model = this.genAI.getGenerativeModel({
                    model: index_js_1.config.gemini.model,
                    generationConfig: {
                        responseMimeType: 'application/json',
                        temperature: 0.1,
                    },
                });
                const apiRes = await model.generateContent(systemPrompt);
                const text = apiRes.response.text();
                const parsedJson = JSON.parse(text);
                const validated = shared_1.AIClassificationResultSchema.parse(parsedJson);
                const usage = apiRes.response.usageMetadata;
                const inTokens = usage?.promptTokenCount || 450;
                const outTokens = usage?.candidatesTokenCount || 85;
                // Pricing: $0.075/1M input, $0.30/1M output
                const costUsd = (inTokens / 1_000_000) * 0.075 + (outTokens / 1_000_000) * 0.30;
                return {
                    result: validated,
                    telemetry: {
                        modelName: index_js_1.config.gemini.model,
                        promptVersion: this.promptVersion,
                        inputTokens: inTokens,
                        outputTokens: outTokens,
                        estimatedCostUsd: Number(costUsd.toFixed(6)),
                        processingTimeMs: Date.now() - startTime,
                        success: true,
                        retryCount,
                    },
                };
            }
            catch (err) {
                retryCount++;
                if (retryCount > maxRetries) {
                    logger_js_1.logger.warn('Gemini classification failed after retries, applying fallback', {
                        error: err instanceof Error ? err.message : String(err),
                    });
                    break;
                }
                // exponential backoff with jitter
                await new Promise(r => setTimeout(r, 1000 * retryCount + Math.random() * 200));
            }
        }
        // Fallback if LLM unavailable
        const fallbackResult = this.conservativeRuleFallback(title, company, rawLocation, rawDescription);
        return {
            result: fallbackResult,
            telemetry: {
                modelName: 'deterministic_rule_fallback',
                promptVersion: this.promptVersion,
                inputTokens: 0,
                outputTokens: 0,
                estimatedCostUsd: 0,
                processingTimeMs: Date.now() - startTime,
                success: false,
                retryCount,
                error: 'Exceeded max retries with Gemini API',
            },
        };
    }
    conservativeRuleFallback(title, company, rawLocation, description) {
        const combined = `${title} ${description}`.toLowerCase();
        const loc = `${rawLocation} ${description}`.toLowerCase();
        // 1. Role category & subcategory
        let roleCategory = 'Software Engineering';
        let roleSubcategory = 'Full Stack Engineering';
        if (combined.includes('data engineer') || combined.includes('etl') || combined.includes('spark')) {
            roleCategory = 'Data & Analytics';
            roleSubcategory = 'Data Engineering';
        }
        else if (combined.includes('machine learning') || combined.includes('ai') || combined.includes('llm')) {
            roleCategory = 'AI & Machine Learning';
            roleSubcategory = 'Machine Learning Engineering';
        }
        else if (combined.includes('product manager') || combined.includes('apm')) {
            roleCategory = 'Product';
            roleSubcategory = 'Associate Product Manager';
        }
        else if (combined.includes('ui/ux') || combined.includes('designer') || combined.includes('figma')) {
            roleCategory = 'Design';
            roleSubcategory = 'UI/UX Design';
        }
        else if (combined.includes('devops') || combined.includes('cloud') || combined.includes('sre')) {
            roleCategory = 'Software Engineering';
            roleSubcategory = 'DevOps / Cloud / SRE';
        }
        else if (combined.includes('qa') || combined.includes('test') || combined.includes('sdet')) {
            roleCategory = 'Software Engineering';
            roleSubcategory = 'QA / Software Testing / SDET';
        }
        else if (combined.includes('frontend') || combined.includes('react')) {
            roleCategory = 'Software Engineering';
            roleSubcategory = 'Frontend Engineering';
        }
        else if (combined.includes('backend') || combined.includes('golang') || combined.includes('java')) {
            roleCategory = 'Software Engineering';
            roleSubcategory = 'Backend Engineering';
        }
        // 2. Conservative City Normalization
        let normalizedCity = 'Unknown';
        if (loc.includes('remote') || loc.includes('anywhere')) {
            normalizedCity = 'Remote (India)';
        }
        else if (loc.includes('bengaluru') || loc.includes('bangalore')) {
            normalizedCity = 'Bengaluru';
        }
        else if (loc.includes('hyderabad')) {
            normalizedCity = 'Hyderabad';
        }
        else if (loc.includes('pune')) {
            normalizedCity = 'Pune';
        }
        else if (loc.includes('delhi') || loc.includes('gurgaon') || loc.includes('gurugram') || loc.includes('noida')) {
            normalizedCity = 'Delhi NCR';
        }
        else if (loc.includes('mumbai')) {
            normalizedCity = 'Mumbai';
        }
        else if (loc.includes('chennai')) {
            normalizedCity = 'Chennai';
        }
        const normalizedState = shared_1.INDIAN_STATES[normalizedCity] || 'Unknown';
        // 3. Fresher eligibility
        const isIntern = combined.includes('intern') || combined.includes('trainee') || combined.includes('campus');
        const isGenuinelyFresher = isIntern || !combined.includes('2+ years') && !combined.includes('3+ years');
        return {
            roleCategory,
            roleSubcategory,
            normalizedCity,
            normalizedState,
            country: 'India',
            employmentType: isIntern ? 'internship' : 'full_time',
            experienceLevel: isIntern ? 'Internship' : 'Fresher / Entry Level',
            isGenuinelyFresher,
            skills: ['Problem Solving', 'Data Structures', 'Git'],
            confidenceScore: 0.90,
            reasoningBrief: 'Rule-based deterministic extraction on verified ATS fields.',
        };
    }
}
exports.ProductionJobClassifier = ProductionJobClassifier;
