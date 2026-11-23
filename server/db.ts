import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import Database from 'better-sqlite3';
import { hashPassword, resolveSafeUploadPath } from './security.ts';
import type {
  Assignment,
  AuditLogEntry,
  CohortMatch,
  Course,
  ExtensionRequest,
  IntegrityReport,
  NotificationItem,
  PrivateMessage,
  SentenceAnalysis,
  Submission,
  SubmissionReview,
  UserProfile,
} from '../src/shared/types.ts';

const DATA_DIR = path.resolve(process.cwd(), 'data');
const DB_PATH = path.resolve(DATA_DIR, 'verity_v2.db');

export function initDatabase(): Database.Database {
  fs.mkdirSync(DATA_DIR, { recursive: true });
  const db = new Database(DB_PATH);
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');

  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      email TEXT NOT NULL UNIQUE,
      password_hash TEXT NOT NULL,
      role TEXT NOT NULL CHECK(role IN ('lecturer', 'student')),
      department TEXT NOT NULL,
      student_code TEXT,
      avatar_initials TEXT NOT NULL,
      title TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS courses (
      id TEXT PRIMARY KEY,
      code TEXT NOT NULL UNIQUE,
      title TEXT NOT NULL,
      term TEXT NOT NULL,
      lecturer_id TEXT NOT NULL REFERENCES users(id),
      description TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS enrollments (
      course_id TEXT NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
      student_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      PRIMARY KEY (course_id, student_id)
    );

    CREATE TABLE IF NOT EXISTS assignments (
      id TEXT PRIMARY KEY,
      course_id TEXT NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
      title TEXT NOT NULL,
      description TEXT NOT NULL,
      instructions TEXT NOT NULL,
      original_due_at TEXT NOT NULL,
      due_at TEXT NOT NULL,
      status TEXT NOT NULL CHECK(status IN ('active', 'modified', 'canceled')),
      modification_note TEXT,
      allow_resubmission INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS submissions (
      id TEXT PRIMARY KEY,
      assignment_id TEXT NOT NULL REFERENCES assignments(id) ON DELETE CASCADE,
      student_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      file_name TEXT NOT NULL,
      file_mime TEXT NOT NULL,
      file_size INTEGER NOT NULL,
      stored_path TEXT NOT NULL,
      student_note TEXT,
      content_text TEXT NOT NULL,
      word_count INTEGER NOT NULL,
      version INTEGER NOT NULL DEFAULT 1,
      is_late INTEGER NOT NULL DEFAULT 0,
      submitted_at TEXT NOT NULL,
      status TEXT NOT NULL CHECK(status IN ('submitted', 'under_review', 'confirmed', 'revision_requested')),
      UNIQUE(assignment_id, student_id)
    );

    CREATE TABLE IF NOT EXISTS integrity_reports (
      id TEXT PRIMARY KEY,
      submission_id TEXT NOT NULL UNIQUE REFERENCES submissions(id) ON DELETE CASCADE,
      submission_version INTEGER NOT NULL DEFAULT 1,
      ai_score INTEGER NOT NULL,
      plagiarism_score INTEGER NOT NULL,
      risk_level TEXT NOT NULL CHECK(risk_level IN ('low', 'moderate', 'high')),
      summary TEXT NOT NULL,
      cohort_matches_json TEXT NOT NULL,
      sentences_json TEXT NOT NULL,
      analyzed_by TEXT NOT NULL,
      analyzed_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS submission_reviews (
      id TEXT PRIMARY KEY,
      submission_id TEXT NOT NULL UNIQUE REFERENCES submissions(id) ON DELETE CASCADE,
      lecturer_id TEXT NOT NULL REFERENCES users(id),
      receipt_confirmed INTEGER NOT NULL DEFAULT 1,
      review_status TEXT NOT NULL CHECK(review_status IN ('confirmed', 'revision_requested')),
      feedback TEXT NOT NULL,
      student_reply TEXT,
      student_reply_at TEXT,
      confirmed_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS extension_requests (
      id TEXT PRIMARY KEY,
      assignment_id TEXT NOT NULL REFERENCES assignments(id) ON DELETE CASCADE,
      student_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      original_due_at TEXT NOT NULL,
      requested_due_at TEXT NOT NULL,
      reason TEXT NOT NULL,
      status TEXT NOT NULL CHECK(status IN ('pending', 'approved', 'denied')),
      lecturer_note TEXT,
      decided_by TEXT REFERENCES users(id),
      created_at TEXT NOT NULL,
      decided_at TEXT
    );

    CREATE TABLE IF NOT EXISTS messages (
      id TEXT PRIMARY KEY,
      course_id TEXT NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
      assignment_id TEXT REFERENCES assignments(id) ON DELETE SET NULL,
      sender_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      recipient_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      body TEXT NOT NULL,
      is_read INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS notifications (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      type TEXT NOT NULL,
      title TEXT NOT NULL,
      body TEXT NOT NULL,
      link_assignment_id TEXT REFERENCES assignments(id) ON DELETE SET NULL,
      is_read INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS audit_logs (
      id TEXT PRIMARY KEY,
      actor_id TEXT NOT NULL,
      actor_name TEXT NOT NULL,
      actor_role TEXT NOT NULL,
      action TEXT NOT NULL,
      target_type TEXT NOT NULL,
      target_id TEXT NOT NULL,
      details TEXT NOT NULL,
      created_at TEXT NOT NULL
    );
  `);

  seedInitialData(db);
  return db;
}

function hoursFromNow(hours: number): string {
  return new Date(Date.now() + hours * 60 * 60 * 1000).toISOString();
}

function escapePdfString(str: string): string {
  return str
    .replace(/[^\x20-\x7E]/g, ' ')
    .replace(/\\/g, '\\\\')
    .replace(/\(/g, '\\(')
    .replace(/\)/g, '\\)');
}

function wrapLine(text: string, maxChars = 78): string[] {
  const words = text.split(/\s+/);
  const lines: string[] = [];
  let current = '';
  for (const w of words) {
    if ((current + ' ' + w).trim().length > maxChars) {
      if (current) lines.push(current);
      current = w;
    } else {
      current = (current + ' ' + w).trim();
    }
  }
  if (current) lines.push(current);
  return lines;
}

function buildMinimalPdfBuffer(title: string, author: string, paragraphs: string[]): Buffer {
  const lines: string[] = [title, `Submitted by ${author}`, ''];
  for (const p of paragraphs) {
    lines.push(...wrapLine(p, 80), '');
  }

  const streamOps = ['BT', '/F1 12 Tf', '56 740 Td', '16 TL'];
  lines.slice(0, 42).forEach((line, idx) => {
    const safe = escapePdfString(line);
    if (idx === 0) {
      streamOps.push(`(${safe}) Tj`);
    } else {
      streamOps.push(`T* (${safe}) Tj`);
    }
  });
  streamOps.push('ET');
  const streamContent = streamOps.join('\n');

  const objects = [
    '1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n',
    '2 0 obj\n<< /Type /Pages /Kids [3 0 R] /Count 1 >>\nendobj\n',
    '3 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>\nendobj\n',
    `4 0 obj\n<< /Length ${Buffer.byteLength(streamContent, 'utf8')} >>\nstream\n${streamContent}\nendstream\nendobj\n`,
    '5 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>\nendobj\n',
  ];

  let pdf = '%PDF-1.4\n';
  const offsets: number[] = [0];
  for (const obj of objects) {
    offsets.push(Buffer.byteLength(pdf, 'utf8'));
    pdf += obj;
  }
  const xrefStart = Buffer.byteLength(pdf, 'utf8');
  pdf += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  for (let i = 1; i <= objects.length; i += 1) {
    pdf += `${String(offsets[i]).padStart(10, '0')} 00000 n \n`;
  }
  pdf += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefStart}\n%%EOF\n`;
  return Buffer.from(pdf, 'utf8');
}

function seedInitialData(db: Database.Database): void {
  const existingUsers = db.prepare('SELECT COUNT(*) AS count FROM users').get() as { count: number };
  if (existingUsers.count > 0) return;

  const tx = db.transaction(() => {
    const demoPassHash = hashPassword('verity2026');

    const insertUser = db.prepare(
      `INSERT INTO users (id, name, email, password_hash, role, department, student_code, avatar_initials, title)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
    );

    insertUser.run(
      'lecturer-vance',
      'Dr. Eleanor Vance',
      'e.vance@verity.edu',
      demoPassHash,
      'lecturer',
      'Computer Science & Humanities',
      null,
      'EV',
      'Associate Professor'
    );
    insertUser.run(
      'student-maya',
      'Maya Lin',
      'm.lin@verity.edu',
      demoPassHash,
      'student',
      'Computer Science',
      'ST-2026-0418',
      'ML',
      'B.S. Candidate, Year 3'
    );
    insertUser.run(
      'student-liam',
      "Liam O'Connor",
      'l.oconnor@verity.edu',
      demoPassHash,
      'student',
      'Computer Science & Philosophy',
      'ST-2026-0792',
      'LO',
      'B.A. Candidate, Year 4'
    );
    insertUser.run(
      'student-priya',
      'Priya Nair',
      'p.nair@verity.edu',
      demoPassHash,
      'student',
      'Data Science & Policy',
      'ST-2026-1104',
      'PN',
      'M.S. Candidate, Year 1'
    );

    const insertCourse = db.prepare(
      `INSERT INTO courses (id, code, title, term, lecturer_id, description)
       VALUES (?, ?, ?, ?, ?, ?)`
    );
    insertCourse.run(
      'course-cs412',
      'CS-412',
      'Algorithmic Ethics & Governance',
      'Autumn Semester 2026',
      'lecturer-vance',
      'Examines accountability frameworks, statistical fairness, and institutional governance for automated decision systems.'
    );
    insertCourse.run(
      'course-lit305',
      'LIT-305',
      'Computational Rhetoric & Research',
      'Autumn Semester 2026',
      'lecturer-vance',
      'Investigates epistemic authority, synthetic prose, and evidence synthesis in modern scholarly communication.'
    );

    const insertEnrollment = db.prepare(`INSERT INTO enrollments (course_id, student_id) VALUES (?, ?)`);
    for (const courseId of ['course-cs412', 'course-lit305']) {
      for (const studentId of ['student-maya', 'student-liam', 'student-priya']) {
        insertEnrollment.run(courseId, studentId);
      }
    }

    const insertAssignment = db.prepare(
      `INSERT INTO assignments (
        id, course_id, title, description, instructions, original_due_at, due_at,
        status, modification_note, allow_resubmission, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    );

    const assign1Due = hoursFromNow(36);
    insertAssignment.run(
      'assign-bias-audit',
      'course-cs412',
      'Algorithmic Bias Audit & Accountability Memo',
      'Evaluate a municipal hospital triage model across demographic subgroups and upload your audit memo.',
      'Upload a 600–1,000 word analytical memo as a PDF, DOC/DOCX, or TXT file from your computer. Compare false-negative rates across age cohorts, cite two empirical readings, and propose an override protocol.',
      assign1Due,
      assign1Due,
      'active',
      null,
      1,
      hoursFromNow(-120),
      hoursFromNow(-120)
    );

    const assign2Due = hoursFromNow(-48);
    insertAssignment.run(
      'assign-privacy-threat',
      'course-cs412',
      'Privacy Threat Modeling Case Study',
      'Conduct a structured threat model on student academic analytics pipelines and recommend access controls.',
      'Upload a PDF, DOCX, or TXT report analyzing re-identification risks in longitudinal student datasets and least-privilege access boundaries.',
      assign2Due,
      assign2Due,
      'active',
      null,
      1,
      hoursFromNow(-240),
      hoursFromNow(-240)
    );

    const assign3Original = hoursFromNow(72);
    const assign3Updated = hoursFromNow(120);
    insertAssignment.run(
      'assign-epistemic-trust',
      'course-lit305',
      'Epistemic Trust in Synthetic Media',
      'Critique how institutional attribution standards adapt when synthetic text enters peer review.',
      'Upload a PDF or DOCX essay contrasting two university disclosure policies and formulating an attribution standard for undergraduate seminars.',
      assign3Original,
      assign3Updated,
      'modified',
      'Extended deadline by 48 hours and added requirement to contrast two university disclosure policies.',
      1,
      hoursFromNow(-96),
      hoursFromNow(-4)
    );

    const assign4Due = hoursFromNow(168);
    insertAssignment.run(
      'assign-discourse-lab',
      'course-lit305',
      'Comparative Discourse Analysis',
      'Contrast primary archival policy letters against contemporary algorithmic summary prose.',
      'Upload an annotated PDF, DOCX, or TXT analysis highlighting syntactic compression and evidential hedging.',
      assign4Due,
      assign4Due,
      'active',
      null,
      1,
      hoursFromNow(-48),
      hoursFromNow(-48)
    );

    const mayaBiasParagraphs = [
      'During Tuesday’s clinic walkthrough, the triage model flagged 18% fewer elderly patients in Ward C than the physician baseline.',
      'When we inspected the calibration logs, the discrepancy stemmed from missing outpatient vital histories rather than overt demographic weighting.',
      'However, relying on historical billing frequency as a proxy for clinical urgency systematically underestimates uninsured residents.',
      'Furthermore, in the rapidly evolving landscape of modern healthcare, algorithmic systems hold transformative potential to optimize outcomes and streamline multifaceted operational workflows across diverse populations.',
      'It is important to note that balancing predictive efficiency with equitable care requires a holistic, multi-stakeholder governance framework that prioritizes transparency and ethical alignment.',
      'To mitigate these false negatives immediately, I recommend adding a mandatory nurse-triage override whenever vital history completeness drops below seventy percent.',
    ];
    const mayaBiasText = mayaBiasParagraphs.join(' ');
    const mayaBiasPdfName = 'seed_maya_bias_audit_memo.pdf';
    const mayaBiasPdfBuf = buildMinimalPdfBuffer(
      'CS-412: Algorithmic Bias Audit & Accountability Memo',
      'Maya Lin (ST-2026-0418)',
      mayaBiasParagraphs
    );
    fs.writeFileSync(resolveSafeUploadPath(mayaBiasPdfName), mayaBiasPdfBuf);

    const liamBiasParagraphs = [
      'Our municipal triage review demonstrates that proxy variables often reproduce structural disparities even when protected attributes are stripped from training tables.',
      'When we inspected the calibration logs, the discrepancy stemmed from missing outpatient vital histories rather than overt demographic weighting.',
      'However, relying on historical billing frequency as a proxy for clinical urgency systematically underestimates uninsured residents.',
      'In conclusion, organizations must leverage robust accountability mechanisms and comprehensive auditing protocols to ensure that artificial intelligence serves all stakeholders fairly and responsibly.',
      'By fostering cross-disciplinary collaboration and continuous monitoring, institutions can harness technological innovation while safeguarding fundamental human rights.',
    ];
    const liamBiasText = liamBiasParagraphs.join(' ');
    const liamBiasTxtName = 'seed_oconnor_bias_audit_memo.txt';
    const liamBiasTxtBuf = Buffer.from(liamBiasParagraphs.join('\n\n'), 'utf8');
    fs.writeFileSync(resolveSafeUploadPath(liamBiasTxtName), liamBiasTxtBuf);

    const mayaPrivacyParagraphs = [
      'Longitudinal grading repositories present acute linkage risks because timestamped submission metadata uniquely fingerprints individual students even after names are hashed.',
      'Applying strict role-based server middleware ensures students can query only their own evaluation records while preventing horizontal traversal across peer IDs.',
      'Adding append-only audit logs for every feedback confirmation creates clear institutional accountability.',
    ];
    const mayaPrivacyText = mayaPrivacyParagraphs.join(' ');
    const mayaPrivacyPdfName = 'seed_lin_privacy_threat_model.pdf';
    const mayaPrivacyPdfBuf = buildMinimalPdfBuffer(
      'CS-412: Privacy Threat Modeling Case Study',
      'Maya Lin (ST-2026-0418)',
      mayaPrivacyParagraphs
    );
    fs.writeFileSync(resolveSafeUploadPath(mayaPrivacyPdfName), mayaPrivacyPdfBuf);

    const insertSub = db.prepare(
      `INSERT INTO submissions (
        id, assignment_id, student_id, file_name, file_mime, file_size, stored_path,
        student_note, content_text, word_count, version, is_late, submitted_at, status
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    );

    insertSub.run(
      'sub-maya-bias',
      'assign-bias-audit',
      'student-maya',
      'lin_bias_audit_memo.pdf',
      'application/pdf',
      mayaBiasPdfBuf.length,
      mayaBiasPdfName,
      'Attached my finalized PDF memo with Ward C clinic observations.',
      mayaBiasText,
      mayaBiasText.split(/\s+/).length,
      1,
      0,
      hoursFromNow(-6),
      'under_review'
    );

    insertSub.run(
      'sub-liam-bias',
      'assign-bias-audit',
      'student-liam',
      'oconnor_bias_audit_memo.txt',
      'text/plain',
      liamBiasTxtBuf.length,
      liamBiasTxtName,
      'Submitted plain-text draft for early review.',
      liamBiasText,
      liamBiasText.split(/\s+/).length,
      1,
      0,
      hoursFromNow(-3),
      'submitted'
    );

    insertSub.run(
      'sub-maya-privacy',
      'assign-privacy-threat',
      'student-maya',
      'lin_privacy_threat_model.pdf',
      'application/pdf',
      mayaPrivacyPdfBuf.length,
      mayaPrivacyPdfName,
      'Final threat model PDF uploaded before deadline.',
      mayaPrivacyText,
      mayaPrivacyText.split(/\s+/).length,
      1,
      0,
      hoursFromNow(-54),
      'confirmed'
    );

    // Seed pre-analyzed integrity report on Maya's bias memo & privacy model
    const mayaSentences: SentenceAnalysis[] = [
      {
        index: 0,
        text: mayaBiasParagraphs[0],
        aiProbability: 8,
        plagiarismScore: 0,
        label: 'human',
        reason: 'Specific empirical observation with concrete ward detail and natural syntactic variation.',
        matchedSource: null,
      },
      {
        index: 1,
        text: mayaBiasParagraphs[1],
        aiProbability: 12,
        plagiarismScore: 86,
        label: 'plagiarism_match',
        reason: 'High verbatim lexical overlap detected with peer submission in CS-412.',
        matchedSource: "Cohort Submission: Liam O'Connor (oconnor_bias_audit_memo.txt)",
      },
      {
        index: 2,
        text: mayaBiasParagraphs[2],
        aiProbability: 15,
        plagiarismScore: 82,
        label: 'plagiarism_match',
        reason: 'High verbatim lexical overlap detected with peer submission in CS-412.',
        matchedSource: "Cohort Submission: Liam O'Connor (oconnor_bias_audit_memo.txt)",
      },
      {
        index: 3,
        text: mayaBiasParagraphs[3],
        aiProbability: 93,
        plagiarismScore: 10,
        label: 'ai_likely',
        reason: 'Formulaic LLM rhetorical cadence ("rapidly evolving landscape", "transformative potential", "multifaceted operational workflows").',
        matchedSource: null,
      },
      {
        index: 4,
        text: mayaBiasParagraphs[4],
        aiProbability: 89,
        plagiarismScore: 8,
        label: 'ai_likely',
        reason: 'Low perplexity boilerplate hedge ("It is important to note", "holistic, multi-stakeholder governance framework").',
        matchedSource: null,
      },
      {
        index: 5,
        text: mayaBiasParagraphs[5],
        aiProbability: 11,
        plagiarismScore: 0,
        label: 'human',
        reason: 'Actionable, domain-specific threshold recommendation grounded in the earlier clinic case.',
        matchedSource: null,
      },
    ];

    const mayaMatches: CohortMatch[] = [
      {
        matchedSubmissionId: 'sub-liam-bias',
        matchedStudentName: "Liam O'Connor",
        overlapPercent: 34,
        sharedExcerpt: mayaBiasParagraphs[1],
      },
    ];

    const insertReport = db.prepare(
      `INSERT INTO integrity_reports (
        id, submission_id, submission_version, ai_score, plagiarism_score, risk_level, summary,
        cohort_matches_json, sentences_json, analyzed_by, analyzed_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    );

    insertReport.run(
      'rep-maya-bias',
      'sub-maya-bias',
      1,
      38,
      34,
      'high',
      'Mixed authorship detected: concrete empirical opening and closing paragraphs contrast sharply with two synthetic boilerplate sentences and a two-sentence overlap with a peer memo.',
      JSON.stringify(mayaMatches),
      JSON.stringify(mayaSentences),
      'Dr. Eleanor Vance',
      hoursFromNow(-2)
    );

    insertReport.run(
      'rep-maya-privacy',
      'sub-maya-privacy',
      1,
      11,
      0,
      'low',
      'Consistent human scholarly authorship with zero cohort similarity overlap.',
      JSON.stringify([]),
      JSON.stringify(
        mayaPrivacyParagraphs.map((p, idx) => ({
          index: idx,
          text: p,
          aiProbability: 10 + idx,
          plagiarismScore: 0,
          label: 'human',
          reason: 'Specific technical threat-modeling prose aligned with lecture terminology.',
          matchedSource: null,
        }))
      ),
      'Dr. Eleanor Vance',
      hoursFromNow(-26)
    );

    // Seed confirmation & feedback (NO GRADES!)
    db.prepare(
      `INSERT INTO submission_reviews (
        id, submission_id, lecturer_id, receipt_confirmed, review_status, feedback,
        student_reply, student_reply_at, confirmed_at, updated_at
      ) VALUES (?, ?, ?, 1, 'confirmed', ?, ?, ?, ?, ?)`
    ).run(
      'rev-maya-privacy',
      'sub-maya-privacy',
      'lecturer-vance',
      'Submission confirmed received. Your separation of upload storage from public static roots and append-only audit design are thorough and well-reasoned.',
      'Thank you, Dr. Vance—I received your confirmation and will carry the same audit-trail pattern forward.',
      hoursFromNow(-18),
      hoursFromNow(-24),
      hoursFromNow(-24)
    );

    db.prepare(
      `INSERT INTO extension_requests (
        id, assignment_id, student_id, original_due_at, requested_due_at, reason,
        status, lecturer_note, decided_by, created_at, decided_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).run(
      'ext-priya-bias',
      'assign-bias-audit',
      'student-priya',
      assign1Due,
      hoursFromNow(72),
      'Representing the university data policy team at the regional symposium through tomorrow afternoon; requesting 36 additional hours to finalize subgroup calibration tables.',
      'pending',
      null,
      null,
      hoursFromNow(-5),
      null
    );

    const insertMsg = db.prepare(
      `INSERT INTO messages (id, course_id, assignment_id, sender_id, recipient_id, body, is_read, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
    );
    insertMsg.run(
      'msg-1',
      'course-cs412',
      'assign-bias-audit',
      'student-maya',
      'lecturer-vance',
      'Hello Dr. Vance, I uploaded my bias audit PDF earlier today. Could you confirm whether the Ward C table formatting came through clearly?',
      1,
      hoursFromNow(-5)
    );
    insertMsg.run(
      'msg-2',
      'course-cs412',
      'assign-bias-audit',
      'lecturer-vance',
      'student-maya',
      'Received cleanly, Maya. I am running the AI and source verification pass on the cohort memos this afternoon before sending written feedback.',
      0,
      hoursFromNow(-4)
    );
    insertMsg.run(
      'msg-3',
      'course-cs412',
      'assign-bias-audit',
      'student-priya',
      'lecturer-vance',
      'Hi Dr. Vance, I submitted an extension petition for the Algorithmic Bias Audit due to the symposium schedule.',
      0,
      hoursFromNow(-4.5)
    );

    const insertNotif = db.prepare(
      `INSERT INTO notifications (id, user_id, type, title, body, link_assignment_id, is_read, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
    );
    insertNotif.run(
      'notif-1',
      'student-maya',
      'assignment_modified',
      'Assignment Updated: Epistemic Trust in Synthetic Media',
      'Dr. Vance extended the deadline by 48 hours and updated disclosure comparison requirements.',
      'assign-epistemic-trust',
      0,
      hoursFromNow(-4)
    );
    insertNotif.run(
      'notif-2',
      'student-maya',
      'feedback_posted',
      'Receipt Confirmed & Feedback: Privacy Threat Modeling Case Study',
      'Dr. Vance confirmed your PDF submission and shared written feedback.',
      'assign-privacy-threat',
      0,
      hoursFromNow(-24)
    );
    insertNotif.run(
      'notif-3',
      'student-liam',
      'assignment_modified',
      'Assignment Updated: Epistemic Trust in Synthetic Media',
      'Dr. Vance extended the deadline by 48 hours and updated disclosure comparison requirements.',
      'assign-epistemic-trust',
      0,
      hoursFromNow(-4)
    );
    insertNotif.run(
      'notif-4',
      'student-priya',
      'assignment_modified',
      'Assignment Updated: Epistemic Trust in Synthetic Media',
      'Dr. Vance extended the deadline by 48 hours and updated disclosure comparison requirements.',
      'assign-epistemic-trust',
      0,
      hoursFromNow(-4)
    );
    insertNotif.run(
      'notif-5',
      'lecturer-vance',
      'extension_requested',
      'Extension Petition: Priya Nair',
      'Requested +36h extension on Algorithmic Bias Audit & Accountability Memo.',
      'assign-bias-audit',
      0,
      hoursFromNow(-5)
    );
    insertNotif.run(
      'notif-6',
      'lecturer-vance',
      'submission_received',
      "New File Submission: Liam O'Connor",
      'Uploaded oconnor_bias_audit_memo.txt for Algorithmic Bias Audit & Accountability Memo.',
      'assign-bias-audit',
      0,
      hoursFromNow(-3)
    );

    const insertAudit = db.prepare(
      `INSERT INTO audit_logs (id, actor_id, actor_name, actor_role, action, target_type, target_id, details, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
    );
    insertAudit.run(
      `aud-${crypto.randomUUID()}`,
      'lecturer-vance',
      'Dr. Eleanor Vance',
      'lecturer',
      'RECEIPT_AND_FEEDBACK_SENT',
      'submission',
      'sub-maya-privacy',
      'Confirmed receipt of lin_privacy_threat_model.pdf and sent written feedback to Maya Lin.',
      hoursFromNow(-24)
    );
    insertAudit.run(
      `aud-${crypto.randomUUID()}`,
      'lecturer-vance',
      'Dr. Eleanor Vance',
      'lecturer',
      'ASSIGNMENT_MODIFIED',
      'assignment',
      'assign-epistemic-trust',
      'Extended deadline by 48h and notified 3 enrolled students.',
      hoursFromNow(-4)
    );
    insertAudit.run(
      `aud-${crypto.randomUUID()}`,
      'lecturer-vance',
      'Dr. Eleanor Vance',
      'lecturer',
      'INTEGRITY_SCAN_COMPLETED',
      'submission',
      'sub-maya-bias',
      'AI Score: 38% · Cohort Plagiarism Overlap: 34% (High Risk Flag).',
      hoursFromNow(-2)
    );
  });

  tx();
}

export function getAllPublicUsers(db: Database.Database): UserProfile[] {
  return db
    .prepare(
      `SELECT id, name, email, role, department, student_code AS studentCode,
              avatar_initials AS avatarInitials, title
       FROM users ORDER BY CASE WHEN role = 'lecturer' THEN 0 ELSE 1 END, name ASC`
    )
    .all() as UserProfile[];
}

export function getUserById(db: Database.Database, userId: string): UserProfile | null {
  const row = db
    .prepare(
      `SELECT id, name, email, role, department, student_code AS studentCode,
              avatar_initials AS avatarInitials, title
       FROM users WHERE id = ?`
    )
    .get(userId) as UserProfile | undefined;
  return row ?? null;
}

export function getUserAuthByEmailAndRole(
  db: Database.Database,
  email: string,
  role: 'lecturer' | 'student'
): (UserProfile & { passwordHash: string }) | null {
  const row = db
    .prepare(
      `SELECT id, name, email, password_hash AS passwordHash, role, department,
              student_code AS studentCode, avatar_initials AS avatarInitials, title
       FROM users WHERE LOWER(email) = LOWER(?) AND role = ?`
    )
    .get(email.trim(), role) as (UserProfile & { passwordHash: string }) | undefined;
  return row ?? null;
}

export function getCoursesForUser(db: Database.Database, user: UserProfile): Course[] {
  if (user.role === 'lecturer') {
    return db
      .prepare(
        `SELECT c.id, c.code, c.title, c.term, c.lecturer_id AS lecturerId,
                u.name AS lecturerName, c.description
         FROM courses c
         JOIN users u ON u.id = c.lecturer_id
         WHERE c.lecturer_id = ?
         ORDER BY c.code ASC`
      )
      .all(user.id) as Course[];
  }
  return db
    .prepare(
      `SELECT c.id, c.code, c.title, c.term, c.lecturer_id AS lecturerId,
              u.name AS lecturerName, c.description
       FROM courses c
       JOIN enrollments e ON e.course_id = c.id
       JOIN users u ON u.id = c.lecturer_id
       WHERE e.student_id = ?
       ORDER BY c.code ASC`
    )
    .all(user.id) as Course[];
}

export function getAssignmentsForUser(db: Database.Database, user: UserProfile): Assignment[] {
  const rows =
    user.role === 'lecturer'
      ? (db
          .prepare(
            `SELECT a.*, c.code AS courseCode, c.title AS courseTitle
             FROM assignments a
             JOIN courses c ON c.id = a.course_id
             WHERE c.lecturer_id = ?
             ORDER BY a.due_at ASC`
          )
          .all(user.id) as Array<Record<string, unknown>>)
      : (db
          .prepare(
            `SELECT a.*, c.code AS courseCode, c.title AS courseTitle
             FROM assignments a
             JOIN courses c ON c.id = a.course_id
             JOIN enrollments e ON e.course_id = c.id
             WHERE e.student_id = ?
             ORDER BY a.due_at ASC`
          )
          .all(user.id) as Array<Record<string, unknown>>);

  const approvedExtRows =
    user.role === 'student'
      ? (db
          .prepare(
            `SELECT assignment_id, requested_due_at
             FROM extension_requests
             WHERE student_id = ? AND status = 'approved'
             ORDER BY decided_at DESC`
          )
          .all(user.id) as Array<{ assignment_id: string; requested_due_at: string }>)
      : [];

  const extMap = new Map<string, string>();
  for (const ext of approvedExtRows) {
    if (!extMap.has(ext.assignment_id)) {
      extMap.set(ext.assignment_id, ext.requested_due_at);
    }
  }

  return rows.map((r) => {
    const dueAt = String(r.due_at);
    const id = String(r.id);
    const effectiveDueAt = extMap.get(id) ?? dueAt;
    return {
      id,
      courseId: String(r.course_id),
      courseCode: String(r.courseCode),
      courseTitle: String(r.courseTitle),
      title: String(r.title),
      description: String(r.description),
      instructions: String(r.instructions),
      originalDueAt: String(r.original_due_at),
      dueAt,
      effectiveDueAt,
      status: String(r.status) as Assignment['status'],
      modificationNote: r.modification_note ? String(r.modification_note) : null,
      allowResubmission: Boolean(r.allow_resubmission),
      createdAt: String(r.created_at),
      updatedAt: String(r.updated_at),
    };
  });
}

export function getSubmissionsForUser(db: Database.Database, user: UserProfile): Submission[] {
  const rows =
    user.role === 'lecturer'
      ? (db
          .prepare(
            `SELECT s.*, u.name AS studentName, u.student_code AS studentCode
             FROM submissions s
             JOIN users u ON u.id = s.student_id
             JOIN assignments a ON a.id = s.assignment_id
             JOIN courses c ON c.id = a.course_id
             WHERE c.lecturer_id = ?
             ORDER BY s.submitted_at DESC`
          )
          .all(user.id) as Array<Record<string, unknown>>)
      : (db
          .prepare(
            `SELECT s.*, u.name AS studentName, u.student_code AS studentCode
             FROM submissions s
             JOIN users u ON u.id = s.student_id
             WHERE s.student_id = ?
             ORDER BY s.submitted_at DESC`
          )
          .all(user.id) as Array<Record<string, unknown>>);

  return rows.map((r) => ({
    id: String(r.id),
    assignmentId: String(r.assignment_id),
    studentId: String(r.student_id),
    studentName: String(r.studentName),
    studentCode: r.studentCode ? String(r.studentCode) : null,
    fileName: String(r.file_name),
    fileMime: String(r.file_mime),
    fileSize: Number(r.file_size),
    hasStoredFile: Boolean(r.stored_path),
    studentNote: r.student_note ? String(r.student_note) : null,
    contentText: String(r.content_text),
    wordCount: Number(r.word_count),
    version: Number(r.version),
    isLate: Boolean(r.is_late),
    submittedAt: String(r.submitted_at),
    status: String(r.status) as Submission['status'],
  }));
}

export function getIntegrityReportsForLecturer(
  db: Database.Database,
  lecturerId: string
): IntegrityReport[] {
  const rows = db
    .prepare(
      `SELECT ir.*
       FROM integrity_reports ir
       JOIN submissions s ON s.id = ir.submission_id
       JOIN assignments a ON a.id = s.assignment_id
       JOIN courses c ON c.id = a.course_id
       WHERE c.lecturer_id = ?
       ORDER BY ir.analyzed_at DESC`
    )
    .all(lecturerId) as Array<Record<string, unknown>>;

  return rows.map((r) => ({
    id: String(r.id),
    submissionId: String(r.submission_id),
    submissionVersion: Number(r.submission_version),
    aiScore: Number(r.ai_score),
    plagiarismScore: Number(r.plagiarism_score),
    riskLevel: String(r.risk_level) as IntegrityReport['riskLevel'],
    summary: String(r.summary),
    cohortMatches: JSON.parse(String(r.cohort_matches_json)) as CohortMatch[],
    sentences: JSON.parse(String(r.sentences_json)) as SentenceAnalysis[],
    analyzedBy: String(r.analyzed_by),
    analyzedAt: String(r.analyzed_at),
  }));
}

export function getReviewsForUser(db: Database.Database, user: UserProfile): SubmissionReview[] {
  const rows =
    user.role === 'lecturer'
      ? (db
          .prepare(
            `SELECT sr.*, u.name AS lecturerName
             FROM submission_reviews sr
             JOIN users u ON u.id = sr.lecturer_id
             WHERE sr.lecturer_id = ?
             ORDER BY sr.updated_at DESC`
          )
          .all(user.id) as Array<Record<string, unknown>>)
      : (db
          .prepare(
            `SELECT sr.*, u.name AS lecturerName
             FROM submission_reviews sr
             JOIN submissions s ON s.id = sr.submission_id
             JOIN users u ON u.id = sr.lecturer_id
             WHERE s.student_id = ?
             ORDER BY sr.updated_at DESC`
          )
          .all(user.id) as Array<Record<string, unknown>>);

  return rows.map((r) => ({
    id: String(r.id),
    submissionId: String(r.submission_id),
    lecturerId: String(r.lecturer_id),
    lecturerName: String(r.lecturerName),
    receiptConfirmed: Boolean(r.receipt_confirmed),
    reviewStatus: String(r.review_status) as SubmissionReview['reviewStatus'],
    feedback: String(r.feedback),
    studentReply: r.student_reply ? String(r.student_reply) : null,
    studentReplyAt: r.student_reply_at ? String(r.student_reply_at) : null,
    confirmedAt: String(r.confirmed_at),
    updatedAt: String(r.updated_at),
  }));
}

export function getExtensionsForUser(db: Database.Database, user: UserProfile): ExtensionRequest[] {
  const rows =
    user.role === 'lecturer'
      ? (db
          .prepare(
            `SELECT er.*, a.title AS assignmentTitle, c.code AS courseCode,
                    u.name AS studentName, u.student_code AS studentCode
             FROM extension_requests er
             JOIN assignments a ON a.id = er.assignment_id
             JOIN courses c ON c.id = a.course_id
             JOIN users u ON u.id = er.student_id
             WHERE c.lecturer_id = ?
             ORDER BY er.created_at DESC`
          )
          .all(user.id) as Array<Record<string, unknown>>)
      : (db
          .prepare(
            `SELECT er.*, a.title AS assignmentTitle, c.code AS courseCode,
                    u.name AS studentName, u.student_code AS studentCode
             FROM extension_requests er
             JOIN assignments a ON a.id = er.assignment_id
             JOIN courses c ON c.id = a.course_id
             JOIN users u ON u.id = er.student_id
             WHERE er.student_id = ?
             ORDER BY er.created_at DESC`
          )
          .all(user.id) as Array<Record<string, unknown>>);

  return rows.map((r) => ({
    id: String(r.id),
    assignmentId: String(r.assignment_id),
    assignmentTitle: String(r.assignmentTitle),
    courseCode: String(r.courseCode),
    studentId: String(r.student_id),
    studentName: String(r.studentName),
    studentCode: r.studentCode ? String(r.studentCode) : null,
    originalDueAt: String(r.original_due_at),
    requestedDueAt: String(r.requested_due_at),
    reason: String(r.reason),
    status: String(r.status) as ExtensionRequest['status'],
    lecturerNote: r.lecturer_note ? String(r.lecturer_note) : null,
    decidedBy: r.decided_by ? String(r.decided_by) : null,
    createdAt: String(r.created_at),
    decidedAt: r.decided_at ? String(r.decided_at) : null,
  }));
}

export function getMessagesForUser(db: Database.Database, userId: string): PrivateMessage[] {
  const rows = db
    .prepare(
      `SELECT m.*, a.title AS assignmentTitle,
              su.name AS senderName, su.role AS senderRole,
              ru.name AS recipientName
       FROM messages m
       LEFT JOIN assignments a ON a.id = m.assignment_id
       JOIN users su ON su.id = m.sender_id
       JOIN users ru ON ru.id = m.recipient_id
       WHERE m.sender_id = ? OR m.recipient_id = ?
       ORDER BY m.created_at ASC`
    )
    .all(userId, userId) as Array<Record<string, unknown>>;

  return rows.map((r) => ({
    id: String(r.id),
    courseId: String(r.course_id),
    assignmentId: r.assignment_id ? String(r.assignment_id) : null,
    assignmentTitle: r.assignmentTitle ? String(r.assignmentTitle) : null,
    senderId: String(r.sender_id),
    senderName: String(r.senderName),
    senderRole: String(r.senderRole) as PrivateMessage['senderRole'],
    recipientId: String(r.recipient_id),
    recipientName: String(r.recipientName),
    body: String(r.body),
    isRead: Boolean(r.is_read),
    createdAt: String(r.created_at),
  }));
}

export function getNotificationsForUser(db: Database.Database, userId: string): NotificationItem[] {
  const rows = db
    .prepare(
      `SELECT id, user_id AS userId, type, title, body,
              link_assignment_id AS linkAssignmentId, is_read AS isRead, created_at AS createdAt
       FROM notifications
       WHERE user_id = ?
       ORDER BY created_at DESC
       LIMIT 60`
    )
    .all(userId) as Array<Record<string, unknown>>;

  return rows.map((r) => ({
    id: String(r.id),
    userId: String(r.userId),
    type: String(r.type) as NotificationItem['type'],
    title: String(r.title),
    body: String(r.body),
    linkAssignmentId: r.linkAssignmentId ? String(r.linkAssignmentId) : null,
    isRead: Boolean(r.isRead),
    createdAt: String(r.createdAt),
  }));
}

export function getAuditLogsForLecturer(db: Database.Database): AuditLogEntry[] {
  return db
    .prepare(
      `SELECT id, actor_id AS actorId, actor_name AS actorName, actor_role AS actorRole,
              action, target_type AS targetType, target_id AS targetId, details,
              created_at AS createdAt
       FROM audit_logs
       ORDER BY created_at DESC
       LIMIT 100`
    )
    .all() as AuditLogEntry[];
}
