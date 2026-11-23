import { GoogleGenAI, Type } from '@google/genai';
import mammoth from 'mammoth';
import { PDFParse } from 'pdf-parse';
import type { CohortMatch, SentenceAnalysis, SentenceLabel } from '../src/shared/types.ts';

export async function extractDocumentText(
  buffer: Buffer,
  mimeType: string,
  originalName: string
): Promise<string> {
  const lower = originalName.toLowerCase();

  if (mimeType === 'application/pdf' || lower.endsWith('.pdf')) {
    const parser = new PDFParse({ data: buffer });
    try {
      const result = await parser.getText();
      return normalizeExtractedText(result.text ?? '');
    } finally {
      await parser.destroy();
    }
  }

  if (
    mimeType === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' ||
    lower.endsWith('.docx')
  ) {
    const result = await mammoth.extractRawText({ buffer });
    return normalizeExtractedText(result.value ?? '');
  }

  if (mimeType === 'application/msword' || lower.endsWith('.doc')) {
    // Attempt mammoth first in case it's a renamed OOXML file; otherwise extract printable runs
    try {
      const result = await mammoth.extractRawText({ buffer });
      if (result.value && result.value.trim().length > 10) {
        return normalizeExtractedText(result.value);
      }
    } catch {
      // Fall through to readable text extraction for legacy binary .doc files
    }
    const asciiRuns = buffer
      .toString('latin1')
      .replace(/[^\x20-\x7E\n\r\t]/g, ' ')
      .replace(/[ \t]{2,}/g, ' ')
      .trim();
    if (asciiRuns.length >= 20) {
      return normalizeExtractedText(asciiRuns);
    }
    throw new Error('Could not extract readable prose from this .doc file. Please save as .docx, .pdf, or .txt.');
  }

  if (mimeType.startsWith('text/') || lower.endsWith('.txt')) {
    return normalizeExtractedText(buffer.toString('utf8'));
  }

  throw new Error('Unsupported file type. Please upload a PDF, DOC, DOCX, or TXT document.');
}

function normalizeExtractedText(raw: string): string {
  return raw
    .replace(/\r\n/g, '\n')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

export function splitIntoSentences(text: string): string[] {
  const cleaned = text.replace(/\s+/g, ' ').trim();
  if (!cleaned) return [];
  const rawParts = cleaned.split(/(?<=[.!?])\s+(?=[A-Z0-9"“'(\[])/);
  const sentences: string[] = [];
  for (const part of rawParts) {
    const trimmed = part.trim();
    if (trimmed.length > 0) {
      sentences.push(trimmed);
    }
  }
  return sentences.slice(0, 60);
}

function tokenizeWords(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter((w) => w.length > 1);
}

function buildShingles(words: string[], size = 5): Set<string> {
  const shingles = new Set<string>();
  if (words.length < size) {
    if (words.length >= 3) shingles.add(words.join(' '));
    return shingles;
  }
  for (let i = 0; i <= words.length - size; i += 1) {
    shingles.add(words.slice(i, i + size).join(' '));
  }
  return shingles;
}

export interface PeerSubmissionInput {
  id: string;
  studentName: string;
  fileName: string | null;
  contentText: string;
}

export interface CohortSentenceOverlap {
  sentenceIndex: number;
  overlapPercent: number;
  matchedSource: string | null;
}

export function computeCohortPlagiarism(
  targetSentences: string[],
  peerSubmissions: PeerSubmissionInput[]
): {
  cohortMatches: CohortMatch[];
  sentenceOverlaps: Map<number, CohortSentenceOverlap>;
  overallCohortScore: number;
} {
  const sentenceOverlaps = new Map<number, CohortSentenceOverlap>();
  const peerMatchCounts = new Map<
    string,
    { studentName: string; fileName: string | null; matchedSentences: number; sampleExcerpt: string }
  >();

  const peerSentenceShingles = peerSubmissions.map((peer) => {
    const docShingles = buildShingles(tokenizeWords(peer.contentText), 5);
    return { peer, docShingles };
  });

  let totalSentenceOverlap = 0;

  targetSentences.forEach((sentence, idx) => {
    const words = tokenizeWords(sentence);
    const sShingles = buildShingles(words, 5);
    if (sShingles.size === 0) return;

    let bestScore = 0;
    let bestPeer: PeerSubmissionInput | null = null;

    for (const candidate of peerSentenceShingles) {
      let hitCount = 0;
      for (const sh of sShingles) {
        if (candidate.docShingles.has(sh)) {
          hitCount += 1;
        }
      }
      const ratio = Math.round((hitCount / sShingles.size) * 100);
      if (ratio > bestScore) {
        bestScore = ratio;
        bestPeer = candidate.peer;
      }
    }

    if (bestScore >= 35 && bestPeer) {
      const sourceLabel = `Cohort Submission: ${bestPeer.studentName}${
        bestPeer.fileName ? ` (${bestPeer.fileName})` : ''
      }`;
      sentenceOverlaps.set(idx, {
        sentenceIndex: idx,
        overlapPercent: Math.min(100, bestScore),
        matchedSource: sourceLabel,
      });
      totalSentenceOverlap += bestScore;

      const existing = peerMatchCounts.get(bestPeer.id);
      if (existing) {
        existing.matchedSentences += 1;
      } else {
        peerMatchCounts.set(bestPeer.id, {
          studentName: bestPeer.studentName,
          fileName: bestPeer.fileName,
          matchedSentences: 1,
          sampleExcerpt: sentence,
        });
      }
    }
  });

  const cohortMatches: CohortMatch[] = Array.from(peerMatchCounts.entries()).map(([id, info]) => ({
    matchedSubmissionId: id,
    matchedStudentName: info.studentName,
    overlapPercent: Math.min(
      100,
      Math.round((info.matchedSentences / Math.max(1, targetSentences.length)) * 100)
    ),
    sharedExcerpt: info.sampleExcerpt,
  }));

  const overallCohortScore =
    targetSentences.length > 0
      ? Math.min(100, Math.round(totalSentenceOverlap / targetSentences.length))
      : 0;

  return { cohortMatches, sentenceOverlaps, overallCohortScore };
}

interface GeminiSentenceEvaluation {
  index: number;
  aiProbability: number;
  plagiarismRisk: number;
  label: SentenceLabel;
  reason: string;
  suspectedSourceNote?: string;
}

interface GeminiIntegrityPayload {
  overallAiScore: number;
  overallPlagiarismScore: number;
  summary: string;
  sentences: GeminiSentenceEvaluation[];
}

export async function analyzeSubmissionIntegrity(params: {
  assignmentTitle: string;
  assignmentPrompt: string;
  submissionText: string;
  peerSubmissions: PeerSubmissionInput[];
}): Promise<{
  aiScore: number;
  plagiarismScore: number;
  riskLevel: 'low' | 'moderate' | 'high';
  summary: string;
  cohortMatches: CohortMatch[];
  sentences: SentenceAnalysis[];
}> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error(
      'GEMINI_API_KEY is not configured on the server. Add your Gemini API key in Settings > Secrets to run live AI & plagiarism diagnostics.'
    );
  }

  const sentences = splitIntoSentences(params.submissionText);
  if (sentences.length === 0) {
    throw new Error('Submission text is empty and cannot be analyzed.');
  }

  const { cohortMatches, sentenceOverlaps, overallCohortScore } = computeCohortPlagiarism(
    sentences,
    params.peerSubmissions
  );

  const ai = new GoogleGenAI({
    apiKey,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      },
    },
  });

  const numberedSentences = sentences.map((s, idx) => {
    const cohort = sentenceOverlaps.get(idx);
    const cohortHint = cohort
      ? ` [COHORT OVERLAP SIGNAL: ${cohort.overlapPercent}% overlap with ${cohort.matchedSource}]`
      : '';
    return `[${idx}] ${s}${cohortHint}`;
  });

  const prompt = `Analyze the following university student submission for AI-generated writing signals and potential plagiarism/unattributed source patterns.

Assignment Title: ${params.assignmentTitle}
Assignment Prompt: ${params.assignmentPrompt}

Sentences to evaluate (preserve exact index 0..${sentences.length - 1}):
${numberedSentences.join('\n')}

Evaluation criteria:
1. aiProbability (0-100): Assess stylometric uniformity, low burstiness, generic LLM boilerplate transitions ("in the rapidly evolving landscape", "it is important to note", "multifaceted", "holistic framework"), vs. concrete human empirical observations and idiosyncratic voice.
2. plagiarismRisk (0-100): Incorporate any COHORT OVERLAP SIGNAL provided above plus unattributed textbook/reference phrasing or sudden voice shifts.
3. label: Choose one of 'human', 'ai_suspected' (45-74% AI), 'ai_likely' (>=75% AI), or 'plagiarism_match' (when cohort overlap or unattributed copying is the primary concern).
4. reason: Provide a concise, evidence-based 1-sentence academic explanation suitable for a university lecturer.`;

  const response = await ai.models.generateContent({
    model: 'gemini-4-hydrogen',
    contents: prompt,
    config: {
      systemInstruction:
        'You are a rigorous academic integrity analyst assisting university lecturers. Return strictly valid JSON matching the schema, evaluating every sentence index.',
      responseMimeType: 'application/json',
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          overallAiScore: { type: Type.INTEGER },
          overallPlagiarismScore: { type: Type.INTEGER },
          summary: { type: Type.STRING },
          sentences: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                index: { type: Type.INTEGER },
                aiProbability: { type: Type.INTEGER },
                plagiarismRisk: { type: Type.INTEGER },
                label: { type: Type.STRING },
                reason: { type: Type.STRING },
                suspectedSourceNote: { type: Type.STRING },
              },
              required: ['index', 'aiProbability', 'plagiarismRisk', 'label', 'reason'],
            },
          },
        },
        required: ['overallAiScore', 'overallPlagiarismScore', 'summary', 'sentences'],
      },
    },
  });

  const rawText = (response.text ?? '').trim();
  if (!rawText) {
    throw new Error('Gemini returned an empty integrity response.');
  }

  let parsed: GeminiIntegrityPayload;
  try {
    parsed = JSON.parse(rawText) as GeminiIntegrityPayload;
  } catch {
    throw new Error('Failed to parse structured integrity diagnostics from Gemini.');
  }

  const evalMap = new Map<number, GeminiSentenceEvaluation>();
  for (const item of parsed.sentences ?? []) {
    evalMap.set(item.index, item);
  }

  const mergedSentences: SentenceAnalysis[] = sentences.map((text, idx) => {
    const g = evalMap.get(idx);
    const cohort = sentenceOverlaps.get(idx);
    const aiProb = Math.max(0, Math.min(100, Math.round(g?.aiProbability ?? 15)));
    const plagScore = Math.max(
      cohort?.overlapPercent ?? 0,
      Math.max(0, Math.min(100, Math.round(g?.plagiarismRisk ?? 0)))
    );

    let label: SentenceLabel = 'human';
    if (plagScore >= 45 || cohort) {
      label = 'plagiarism_match';
    } else if (aiProb >= 75) {
      label = 'ai_likely';
    } else if (aiProb >= 45) {
      label = 'ai_suspected';
    } else if (
      g?.label === 'ai_likely' ||
      g?.label === 'ai_suspected' ||
      g?.label === 'plagiarism_match'
    ) {
      label = g.label;
    }

    return {
      index: idx,
      text,
      aiProbability: aiProb,
      plagiarismScore: plagScore,
      label,
      reason:
        g?.reason ??
        (cohort
          ? `Detected ${cohort.overlapPercent}% lexical overlap with ${cohort.matchedSource}.`
          : 'Sentence structure aligns with natural student authorship.'),
      matchedSource: cohort?.matchedSource ?? g?.suspectedSourceNote ?? null,
    };
  });

  const avgAi = Math.round(
    mergedSentences.reduce((sum, s) => sum + s.aiProbability, 0) / mergedSentences.length
  );
  const aiScore = Math.max(0, Math.min(100, Math.round((parsed.overallAiScore + avgAi) / 2)));
  const plagiarismScore = Math.max(
    overallCohortScore,
    Math.max(0, Math.min(100, Math.round(parsed.overallPlagiarismScore ?? 0)))
  );

  const peakRisk = Math.max(aiScore, plagiarismScore);
  const riskLevel: 'low' | 'moderate' | 'high' =
    peakRisk >= 55 ? 'high' : peakRisk >= 28 ? 'moderate' : 'low';

  return {
    aiScore,
    plagiarismScore,
    riskLevel,
    summary: parsed.summary,
    cohortMatches,
    sentences: mergedSentences,
  };
}
