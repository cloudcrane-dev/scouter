export const DEGREE_CODES = {
  B: { label: "Bachelor's", degree: "B.Tech", durationYears: 4 },
  M: { label: "Master's", degree: "M.Tech/M.Des/MSc", durationYears: 2 },
  P: { label: "PhD", degree: "PhD", durationYears: 5 },
} as const;

export const BRANCH_CODES = {
  CS: "Computer Science",
  EE: "Electrical Engineering",
  ME: "Mechanical Engineering",
  AI: "Artificial Intelligence",
  DE: "Data Engineering",
  DS: "Design",
  LDS: "Design",
  CE: "Civil Engineering",
  CH: "Chemical Engineering",
  MA: "Mathematics",
  PH: "Physics",
  MT: "Metallurgy & Materials",
  BS: "Bioscience",
} as const;

export type DegreeCode = keyof typeof DEGREE_CODES;
export type BranchCode = keyof typeof BRANCH_CODES;

export const ROLL_NUMBER_REGEX = /^([BMP])(\d{2})([A-Z]{2,3})(\d+)$/i;
export const PHD_ROLL_REGEX = /^PHD(\d{2})([A-Z]{2,3})(\d+)$/i;
const STUDENT_EMAIL_REGEX = /^(?:[bmp]\d{2}[a-z]{2,3}\d+|phd\d{2}[a-z]{2,3}\d+)@iitj\.ac\.in$/i;

export type ParsedRoll = {
  raw: string;
  degreeCode: string;
  degreeLabel: string;
  branchCode: string;
  branchLabel: string;
  batchYear: number;
  graduationYear: number;
  confidence: "full" | "partial" | "unknown";
};

export function parseRollNumber(roll: string | null | undefined): ParsedRoll | null {
  if (!roll || !roll.trim()) return null;

  const raw = roll.trim().toUpperCase();
  const match = raw.match(ROLL_NUMBER_REGEX);
  const phdMatch = !match ? raw.match(PHD_ROLL_REGEX) : null;

  if (!match && !phdMatch) {
    return {
      raw,
      degreeCode: "",
      degreeLabel: "Unknown",
      branchCode: "",
      branchLabel: "Unknown",
      batchYear: 0,
      graduationYear: 0,
      confidence: "unknown",
    };
  }

  let degreeChar: string;
  let yearStr: string;
  let branchStr: string;

  if (phdMatch) {
    degreeChar = "P";
    [, yearStr, branchStr] = phdMatch;
  } else {
    [, degreeChar, yearStr, branchStr] = match!;
  }

  const degreeInfo = DEGREE_CODES[degreeChar.toUpperCase() as DegreeCode];
  const branchName = BRANCH_CODES[branchStr.toUpperCase() as BranchCode];
  const batchYear = 2000 + parseInt(yearStr, 10);

  const hasDegree = !!degreeInfo;
  const hasBranch = !!branchName;

  return {
    raw,
    degreeCode: degreeChar.toUpperCase(),
    degreeLabel: degreeInfo?.degree ?? "Unknown",
    branchCode: branchStr.toUpperCase(),
    branchLabel: branchName ?? branchStr.toUpperCase(),
    batchYear,
    graduationYear: hasDegree ? batchYear + degreeInfo.durationYears : 0,
    confidence: hasDegree && hasBranch ? "full" : "partial",
  };
}

export type IITJPersonType = "student" | "faculty_or_staff" | "unknown";

export function classifyIITJEmail(email: string | null | undefined): IITJPersonType {
  if (!email || !email.trim()) return "unknown";
  const lower = email.trim().toLowerCase();
  if (!lower.endsWith("@iitj.ac.in")) return "unknown";
  if (STUDENT_EMAIL_REGEX.test(lower)) return "student";
  return "faculty_or_staff";
}

export function formatParsedRoll(parsed: ParsedRoll): string {
  if (parsed.confidence === "unknown") return parsed.raw;
  const parts = [parsed.degreeLabel];
  if (parsed.branchLabel !== parsed.branchCode || parsed.confidence === "full") {
    parts.push(parsed.branchLabel);
  }
  if (parsed.batchYear > 0) parts.push(String(parsed.batchYear));
  return parts.join(" · ");
}

export function buildAIContextBlock(
  rollNumber: string | null | undefined,
  email: string | null | undefined
): string {
  const parsed = parseRollNumber(rollNumber);
  const personType = classifyIITJEmail(email);

  const rollDecodesAsStudent = parsed && parsed.confidence !== "unknown";

  if (personType === "faculty_or_staff" && !rollDecodesAsStudent) {
    return `Person type: Faculty or Staff at IIT Jodhpur (email does not match student roll number pattern).
Analysis mode: Academic/professional profile review — focus on research output, publications, Google Scholar, ResearchGate, institutional page, teaching, and professional reputation. Skip internship/placement advice entirely. Do not assume they are a student.`;
  }

  if (!parsed || parsed.confidence === "unknown") {
    const rollInfo = rollNumber ? `Roll number: ${rollNumber}` : "Roll number: not provided";
    return `${rollInfo} | Format: unrecognized — give best-effort generic analysis for an IIT Jodhpur community member.`;
  }

  if (parsed.confidence === "partial") {
    const parts = [];
    if (parsed.degreeLabel !== "Unknown") {
      parts.push(`Program: ${parsed.degreeLabel}`);
    }
    parts.push(`Branch: ${parsed.branchLabel === parsed.branchCode ? `Unknown (code: ${parsed.branchCode})` : parsed.branchLabel}`);
    if (parsed.batchYear > 0) parts.push(`Batch: ${parsed.batchYear}`);
    parts.push("Note: some roll number fields could not be fully decoded — give generic advice where branch-specific info is missing");
    return parts.join(" | ");
  }

  return `Program: ${parsed.degreeLabel} ${parsed.branchLabel} | Batch: ${parsed.batchYear} | Expected graduation: ${parsed.graduationYear}`;
}
