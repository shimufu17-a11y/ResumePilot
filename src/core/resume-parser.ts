import mammoth from "mammoth";
import { GlobalWorkerOptions, getDocument } from "pdfjs-dist";
import pdfWorkerUrl from "pdfjs-dist/build/pdf.worker.min.mjs?url";
import type { ResumeCandidate } from "./model";

GlobalWorkerOptions.workerSrc = pdfWorkerUrl;

export async function extractResumeText(file: File): Promise<string> {
  const lowerName = file.name.toLocaleLowerCase();
  const data = await file.arrayBuffer();
  if (file.type === "application/pdf" || lowerName.endsWith(".pdf")) {
    const pdf = await getDocument({ data }).promise;
    const pages: string[] = [];
    for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber += 1) {
      const page = await pdf.getPage(pageNumber);
      const content = await page.getTextContent();
      const text = content.items.map((item) => ("str" in item ? item.str : "")).join(" ");
      pages.push(text);
    }
    return pages.join("\n");
  }
  if (
    file.type === "application/vnd.openxmlformats-officedocument.wordprocessingml.document" ||
    lowerName.endsWith(".docx")
  ) {
    const result = await mammoth.extractRawText({ arrayBuffer: data });
    return result.value;
  }
  throw new Error("仅支持可复制文本的 PDF 或 DOCX 简历");
}

function evidenceAround(text: string, index: number, length: number): string {
  const start = Math.max(0, index - 30);
  const end = Math.min(text.length, index + length + 40);
  return text.slice(start, end).replace(/\s+/g, " ").trim();
}

function addMatch(
  candidates: ResumeCandidate[],
  text: string,
  path: string,
  label: string,
  pattern: RegExp,
  confidence: number,
  valueGroup = 1
): void {
  const match = pattern.exec(text);
  const value = match?.[valueGroup]?.trim();
  if (!match || !value) return;
  candidates.push({
    path,
    label,
    value,
    confidence,
    evidence: evidenceAround(text, match.index, match[0].length)
  });
}

export function deriveResumeCandidates(rawText: string): ResumeCandidate[] {
  const text = rawText.replace(/\r/g, "").replace(/[\t ]+/g, " ");
  const candidates: ResumeCandidate[] = [];
  addMatch(
    candidates,
    text,
    "commonProfile.personal.email",
    "邮箱",
    /([\w.+-]+@[\w.-]+\.[A-Za-z]{2,})/i,
    0.99
  );
  addMatch(
    candidates,
    text,
    "commonProfile.personal.phone",
    "手机号",
    /(?<!\d)(1[3-9]\d{9})(?!\d)/,
    0.98
  );
  addMatch(
    candidates,
    text,
    "commonProfile.personal.politicalStatus",
    "政治面貌",
    /政治面貌[：:\s]*([^\n|｜]{2,12})/,
    0.86
  );
  addMatch(
    candidates,
    text,
    "commonProfile.education.0.gpa",
    "GPA",
    /(?:GPA|绩点)[：:\s]*([0-9.]+(?:\s*\/\s*[0-9.]+)?)/i,
    0.92
  );
  addMatch(
    candidates,
    text,
    "commonProfile.education.0.rank",
    "成绩排名",
    /(?:成绩|专业|班级)?排名[：:\s]*([^\n|｜]{1,24})/,
    0.82
  );

  const firstLines = text
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .slice(0, 8);
  const possibleName = firstLines.find((line) => /^[\u4e00-\u9fff·]{2,5}$/.test(line));
  if (possibleName) {
    candidates.unshift({
      path: "commonProfile.personal.fullNameZh",
      label: "中文姓名",
      value: possibleName,
      confidence: 0.72,
      evidence: possibleName
    });
  }

  const schoolLine = text
    .split("\n")
    .find((line) => /(?:大学|学院|University|Institute)/i.test(line));
  if (schoolLine) {
    const school = schoolLine.match(
      /([\u4e00-\u9fff]{2,20}(?:大学|学院)|[A-Za-z][A-Za-z\s]{2,40}(?:University|Institute))/i
    )?.[1];
    if (school) {
      candidates.push({
        path: "commonProfile.education.0.school",
        label: "学校",
        value: school.trim(),
        confidence: 0.75,
        evidence: schoolLine.trim()
      });
    }
    const degree = schoolLine.match(/(博士|硕士|本科|Ph\.?D\.?|Master|Bachelor)/i)?.[1];
    if (degree) {
      candidates.push({
        path: "commonProfile.education.0.degree",
        label: "学历/学位",
        value: degree,
        confidence: 0.72,
        evidence: schoolLine.trim()
      });
    }
  }
  return candidates;
}
