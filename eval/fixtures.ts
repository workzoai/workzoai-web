import type { Fixture } from "./checks";

/**
 * Built-in fixtures covering the failure modes we fixed PLUS ordinary cases,
 * across layouts and languages. These are generic stand-ins — drop your own real
 * CVs into eval/cvs/ (*.txt = raw CV text, *.json = a structured profile) and
 * they are evaluated with the same generic invariants.
 */
export const FIXTURES: Fixture[] = [
  {
    name: "letter-spaced-header (Haritha-style)",
    kind: "text",
    role: "IT Specialist",
    expect: { name: "Haritha Vijayakumar", minExperience: 2, everyJobHasBullets: true, minEducation: 2, skills: ["TensorFlow", "LangChain"] },
    text: `H A R I T H A   V I J A Y A K U M A R
I T   S U P P O R T   S P E C I A L I S T   /   D A T A   A N A L Y S T
haritha@example.com | +49 176 0000000 | Zweierweg 15, 97094 Würzburg

PROFESSIONAL SUMMARY
Detail-oriented IT Support Specialist and aspiring Data Analyst with over 4 years of experience.

CORE SKILLS
Python, SQL, Tableau, TensorFlow, LangChain, GCP, Web Scraping, API integration

PROFESSIONAL EXPERIENCE
Technical Support Engineer | Zoho Corp | 2018 - 2020
- Resolved 90% of customer issues using ITIL/ITSM best practices.
- Automated processes with Python, cutting resolution times by 15%.
Application Engineer | CSS Corp | 2016 - 2018
- Delivered technical support for Belkin and Linksys network products.
- Resolved complex issues with routers, switches, and wireless access points.

EDUCATION
Data Science Bootcamp | WBS Coding School | 2024
Bachelors in Science (Computer Science) | SRM Arts & Science College | 2012 - 2015`,
  },

  {
    name: "two-column-flattened + address (Surender-style)",
    kind: "text",
    role: "Product Design Engineer",
    expect: { name: "Surender Dillibabu", minExperience: 1, minEducation: 3, noDuplicateEducation: true },
    text: `Surender Dillibabu
PRODUCT DESIGN ENGINEER
surender@example.com · +49 176 0000000 · Zwergerweg 15, 97074 Würzburg, Germany
PROFESSIONAL SUMMARY
Motivated Product Design Technician with over 6 years of experience in CAD design.
CORE SKILLS
CREO, SolidWorks, Catia V5, Inventor, Windchill
PROFESSIONAL EXPERIENCE
Product Design Engineer AUG 2022 - HEUTE
Cummins Deutschland GmbH · Würzburg, Germany
Responsible for creating detailed CAD models and technical drawings.
Support product design and engineering change management processes.
EDUCATION
Master's Degree in Space Science and Technology 2013 – 2016
University of Würzburg, Germany
Master's Degree in Space Science and Technology 2013 – 2016
Luleå University of Technology, Sweden
Bachelor's Degree in Aeronautical Engineering 2008 – 2012
P.B. College of Engineering, India
Master's Degree in Space Science and Technology 2014
Luleå University of Technology · Sweden`,
  },

  {
    name: "title-above-company + en-dash dates",
    kind: "text",
    role: "Software Engineer",
    expect: { name: "Jane Marie Smith", minExperience: 2, everyJobHasBullets: true },
    text: `Jane Marie Smith
Senior Software Engineer
jane@example.com

EXPERIENCE
Senior Software Engineer  Jan 2020 – Present
Acme Technologies GmbH
Built scalable microservices handling millions of requests daily.
Led a team of five engineers across two product lines.
Software Engineer  Jun 2017 – Dec 2019
Globex Solutions
Developed customer-facing dashboards used by thousands of clients.

EDUCATION
Bachelor of Science in Computer Science  2013 – 2017
State University`,
  },

  {
    name: "camelCase-skills preserved",
    kind: "profile",
    role: "ML Engineer",
    expect: { skills: ["TensorFlow", "LangChain", "PyTorch", "PostgreSQL", "GraphQL", "JavaScript", "TypeScript", "Node.js", "NumPy", "DevOps"] },
    profile: {
      basics: { name: "Alex Chen", headline: "Machine Learning Engineer" },
      summary: "Machine learning engineer with a broad modern stack and shipping experience.",
      skills: ["TensorFlow", "LangChain", "PyTorch", "PostgreSQL", "GraphQL", "JavaScript", "TypeScript", "Node.js", "NumPy", "DevOps", "Python", "SQL"],
      experience: [{ title: "ML Engineer", company: "Neuronix GmbH", dates: "2021 - 2024", bullets: ["Shipped models to production serving real traffic daily."] }],
      projects: [], education: [{ degree: "M.Sc. Computer Science", institution: "TU Munich", dates: "2018 - 2020" }], languages: ["English"],
    },
  },

  {
    name: "German CV (Lebenslauf)",
    kind: "text",
    role: "Softwareentwickler",
    expect: { name: "Max Müller", minExperience: 1, minEducation: 1 },
    text: `Max Müller
Softwareentwickler
max@example.de · +49 170 0000000 · München, Deutschland
BERUFSERFAHRUNG
Softwareentwickler  Jan 2019 – Heute
Beispiel GmbH · München
Entwicklung skalierbarer Backend-Dienste in Java und Kotlin.
Betreuung von CI/CD-Pipelines und Code-Reviews.
AUSBILDUNG
Master of Science Informatik  2016 – 2018
Technische Universität München`,
  },

  {
    name: "single-word surname name edge",
    kind: "text",
    role: "Analyst",
    // A one-word "name" should never be rejected AND must not be replaced by a skill.
    expect: { name: "Prince", minExperience: 1 },
    text: `Prince
Data Analyst
prince@example.com

CORE SKILLS
Team Collaboration
SQL

EXPERIENCE
Data Analyst | Initech | 2021 - 2023
Analyzed large datasets to surface actionable business insights.`,
  },

  {
    name: "duplicate education with mixed date formats",
    kind: "profile",
    role: "Researcher",
    expect: { minEducation: 1, noDuplicateEducation: true },
    profile: {
      basics: { name: "Ravi Kumar", headline: "Researcher" },
      summary: "Researcher with duplicated education rows that must collapse to one each.",
      skills: ["Python"],
      experience: [{ title: "Researcher", company: "Institute of Tech", dates: "2019 - 2022", bullets: ["Published findings."] }],
      projects: [],
      education: [
        { degree: "Master's Degree in Physics", institution: "University of Oxford", dates: "2015 - 2017" },
        { degree: "Master's Degree in Physics", institution: "University of Oxford", dates: "2017" },
        { degree: "Bachelor's Degree in Physics", institution: "University of Delhi", dates: "2011 - 2014" },
      ],
      languages: ["English"],
    },
  },
  {
    name: "education degree-alias + location-suffix dedupe",
    kind: "profile",
    expect: { minEducation: 1, noDuplicateEducation: true },
    profile: {
      basics: { name: "Sam Taylor", headline: "Engineer" },
      summary: "Engineer whose education was captured with alias degree names and location suffixes.",
      skills: ["Python"],
      experience: [{ title: "Engineer", company: "Acme GmbH", dates: "2019 - 2022", bullets: ["Shipped features."] }],
      projects: [],
      education: [
        { degree: "Master of Science in Space Science", institution: "University of Würzburg, Germany", dates: "2013 - 2016" },
        { degree: "M.Sc. Space Science", institution: "University of Würzburg", dates: "2013 - 2016" },
        { degree: "Bachelor of Engineering, Aeronautical", institution: "P.B. College of Engineering, India", dates: "2008 - 2012" },
        { degree: "B.Eng Aeronautical Engineering", institution: "P.B. College of Engineering", dates: "2008 - 2012" },
      ],
      languages: ["English"],
    },
  },
  {
    name: "experience bullets kept verbatim",
    kind: "profile",
    expect: { minExperience: 2, everyJobHasBullets: true, verbatimExperience: true } as any,
    profile: {
      basics: { name: "Dana Lee", headline: "Support Engineer" },
      summary: "Support engineer with exact-match experience expectations.",
      skills: ["SQL", "Python"],
      experience: [
        { title: "Support Engineer", company: "Zoho Corp", dates: "2018 - 2020", bullets: ["Resolved 90% of issues using ITIL best practices.", "Automated processes with Python."] },
        { title: "Application Engineer", company: "CSS Corp", dates: "2016 - 2018", bullets: ["Delivered support for Belkin and Linksys products.", "Resolved router and switch issues."] },
      ],
      projects: [],
      education: [{ degree: "B.Sc. Computer Science", institution: "SRM", dates: "2012 - 2015" }],
      languages: ["English"],
    },
  },
  {
    name: "render must not re-introduce raw duplicate education",
    kind: "profile",
    expect: { minEducation: 3, noDuplicateEducation: true },
    profile: {
      basics: { name: "Surender Dillibabu", headline: "Product Design Engineer" },
      summary: "Clean structured profile whose rawText still contains 5 duplicate education rows.",
      skills: ["CREO", "SolidWorks"],
      experience: [{ title: "Product Design Engineer", company: "Cummins Deutschland GmbH", dates: "2022 - Present", bullets: ["Created CAD models."] }],
      projects: [],
      education: [
        { degree: "Master's Degree in Space Science and Technology", institution: "Luleå University of Technology", location: "Sweden", dates: "2014" },
        { degree: "Master's Degree in Space Science and Technology", institution: "University of Würzburg", location: "Germany", dates: "2013 - 2016" },
        { degree: "Bachelor's Degree in Aeronautical Engineering", institution: "P.B. College of Engineering", location: "India", dates: "2008 - 2012" },
      ],
      languages: ["German - B2", "English - C1"],
      rawText: [
        "EDUCATION",
        "Master's Degree in Space Science and Technology 2013 – 2016",
        "University of Würzburg, Germany",
        "Master's Degree in Space Science and Technology 2013 – 2016",
        "Luleå University of Technology, Sweden",
        "Bachelor's Degree in Aeronautical Engineering 2014 – 2014",
        "P.B. College of Engineering, India",
        "Master's Degree in Space Science and Technology 2014",
        "Luleå University of Technology · Sweden",
        "Master's Degree in Space Science and Technology 2013 – 2016",
        "University of Würzburg · Germany",
      ].join("\n"),
    },
  },
  {
    name: "bloated skills + duplicated education location",
    kind: "profile",
    expect: { minEducation: 2, noDuplicateEducation: true },
    profile: {
      basics: { name: "Surender Dillibabu", headline: "Product Design Engineer" },
      summary: "Profile whose skills are keyword-stuffed and whose education carries a redundant location.",
      skills: ["Engineering Change Management", "Change Management", "Windchill", "Windchill", "Team collaboration", "Cross-functional Team Collaboration", "CREO", "SolidWorks"],
      experience: [{ title: "Product Design Engineer", company: "Cummins Deutschland GmbH", dates: "2022 - Present", bullets: ["Created CAD models."] }],
      projects: [],
      education: [
        { degree: "Master's Degree in Space Science and Technology", institution: "University of Würzburg, Germany", location: "Germany", dates: "2013 - 2016" },
        { degree: "Bachelor's Degree in Aeronautical Engineering", institution: "P.B. College of Engineering, India", location: "India", dates: "2008 - 2012" },
      ],
      languages: ["German - B2", "English - C1"],
    },
  },
];