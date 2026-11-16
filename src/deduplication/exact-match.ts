export function normalizeCompanyName(company: string): string {
  return company
    .toLowerCase()
    .trim()
    .replace(/\b(inc|corp|corporation|ltd|llc|private limited|pvt ltd|technologies|solutions|labs)\b/gi, '')
    .replace(/[^\w\s]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

export function areLocationsCompatible(locA: string, locB: string): boolean {
  const normA = locA.toLowerCase();
  const normB = locB.toLowerCase();

  if (normA === normB) return true;
  if (normA.includes('remote') || normB.includes('remote')) return true;

  // Major metro equivalence checks
  if ((normA.includes('bengaluru') || normA.includes('bangalore')) &&
      (normB.includes('bengaluru') || normB.includes('bangalore'))) {
    return true;
  }
  if ((normA.includes('gurgaon') || normA.includes('gurugram') || normA.includes('noida') || normA.includes('delhi')) &&
      (normB.includes('gurgaon') || normB.includes('gurugram') || normB.includes('noida') || normB.includes('delhi'))) {
    return true;
  }
  if ((normA.includes('hyderabad') || normA.includes('secunderabad')) &&
      (normB.includes('hyderabad') || normB.includes('secunderabad'))) {
    return true;
  }

  return false;
}
