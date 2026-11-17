"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.EMPLOYMENT_TYPES = exports.EXPERIENCE_LEVELS = exports.INDIAN_STATES = exports.INDIAN_TECH_CITIES = exports.ROLE_SUBCATEGORIES = exports.FIXED_ROLE_CATEGORIES = exports.FRESHER_ELIGIBILITY_STATUSES = exports.APPLICATION_LINK_STATUSES = exports.LISTING_STATUSES = void 0;
exports.LISTING_STATUSES = [
    'ACTIVE',
    'POSSIBLY_EXPIRED',
    'EXPIRED',
    'REMOVED',
    'UNVERIFIED',
    'SOURCE_UNAVAILABLE'
];
exports.APPLICATION_LINK_STATUSES = [
    'VERIFIED',
    'REDIRECTED',
    'UNVERIFIED',
    'TEMPORARILY_UNAVAILABLE',
    'EXPIRED',
    'INVALID'
];
exports.FRESHER_ELIGIBILITY_STATUSES = [
    'Fresher eligible',
    'Internship',
    'Experience required',
    'Experience not specified',
    'Eligibility uncertain'
];
exports.FIXED_ROLE_CATEGORIES = [
    'Software Engineering',
    'Data & Analytics',
    'AI & Machine Learning',
    'Product',
    'Design',
    'Marketing',
    'Sales',
    'Finance',
    'Operations',
    'HR',
    'Customer Support',
    'Other'
];
exports.ROLE_SUBCATEGORIES = {
    'Software Engineering': [
        'Frontend Engineering',
        'Backend Engineering',
        'Full Stack Engineering',
        'Mobile Engineering (iOS / Android)',
        'DevOps / Cloud / SRE',
        'QA / Software Testing / SDET',
        'Systems / Embedded'
    ],
    'Data & Analytics': [
        'Data Engineering',
        'Data Analyst',
        'Business Intelligence',
        'Data Science'
    ],
    'AI & Machine Learning': [
        'Machine Learning Engineering',
        'Generative AI / LLM Engineer',
        'Computer Vision / NLP',
        'AI Research'
    ],
    'Product': [
        'Associate Product Manager',
        'Product Operations',
        'Technical Product Manager'
    ],
    'Design': [
        'UI/UX Design',
        'Product Design',
        'Graphic / Visual Design'
    ],
    'Marketing': [
        'Growth Marketing',
        'Content / Social Media',
        'Performance Marketing',
        'SEO / Product Marketing'
    ],
    'Sales': [
        'Business Development Associate',
        'Inside Sales',
        'Enterprise Sales'
    ],
    'Finance': [
        'Financial Analyst',
        'Accounting / Audit',
        'FinTech Operations'
    ],
    'Operations': [
        'Business Operations',
        'Supply Chain / Logistics',
        'Program Associate'
    ],
    'HR': [
        'Technical Recruiting',
        'People Operations',
        'Talent Acquisition'
    ],
    'Customer Support': [
        'Customer Success',
        'Technical Support Engineer',
        'Support Operations'
    ],
    'Other': ['General']
};
exports.INDIAN_TECH_CITIES = [
    'Bengaluru',
    'Hyderabad',
    'Pune',
    'Delhi NCR',
    'Mumbai',
    'Chennai',
    'Kolkata',
    'Ahmedabad',
    'Remote (India)',
    'Unknown'
];
exports.INDIAN_STATES = {
    'Bengaluru': 'Karnataka',
    'Hyderabad': 'Telangana',
    'Pune': 'Maharashtra',
    'Mumbai': 'Maharashtra',
    'Delhi NCR': 'Delhi / Haryana / UP',
    'Chennai': 'Tamil Nadu',
    'Kolkata': 'West Bengal',
    'Ahmedabad': 'Gujarat',
    'Remote (India)': 'All India',
    'Unknown': 'Unknown'
};
exports.EXPERIENCE_LEVELS = [
    'Fresher / Entry Level',
    'Internship',
    'Associate (0-1 yrs)',
    'Mid-Level (2-4 yrs)',
    'Senior (5+ yrs)'
];
exports.EMPLOYMENT_TYPES = [
    'full_time',
    'internship',
    'contract',
    'part_time'
];
