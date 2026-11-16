"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.tokenize = tokenize;
exports.jaccardSimilarity = jaccardSimilarity;
exports.areJobsFuzzyDuplicates = areJobsFuzzyDuplicates;
function tokenize(str) {
    const words = str
        .toLowerCase()
        .replace(/[^\w\s]/g, ' ')
        .split(/\s+/)
        .filter(w => w.length > 2); // filter single/double letter noise
    return new Set(words);
}
function jaccardSimilarity(setA, setB) {
    if (setA.size === 0 && setB.size === 0)
        return 1.0;
    if (setA.size === 0 || setB.size === 0)
        return 0.0;
    let intersectionCount = 0;
    for (const item of setA) {
        if (setB.has(item)) {
            intersectionCount++;
        }
    }
    const unionCount = setA.size + setB.size - intersectionCount;
    return unionCount === 0 ? 0 : intersectionCount / unionCount;
}
function areJobsFuzzyDuplicates(titleA, descSnippetA, titleB, descSnippetB, threshold = 0.65) {
    const titleTokensA = tokenize(titleA);
    const titleTokensB = tokenize(titleB);
    const titleSim = jaccardSimilarity(titleTokensA, titleTokensB);
    // If titles share less than 35% tokens, unlikely to be duplicates
    if (titleSim < 0.35) {
        return { isDuplicate: false, score: titleSim };
    }
    const descTokensA = tokenize(descSnippetA);
    const descTokensB = tokenize(descSnippetB);
    const descSim = jaccardSimilarity(descTokensA, descTokensB);
    // 60% title similarity + 40% description snippet similarity
    const compositeScore = (titleSim * 0.6) + (descSim * 0.4);
    return {
        isDuplicate: compositeScore >= threshold,
        score: compositeScore
    };
}
