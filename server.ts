import 'dotenv/config';
import crypto from 'node:crypto';
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import express from 'express';
import multer from 'multer';
import { WebSocket, WebSocketServer } from 'ws';
import { createServer as createViteServer } from 'vite';
import {
  analyzeSubmissionIntegrity,
  extractDocumentText,
} from './server/analyzer.ts';
import {
  getAllPublicUsers,
  getAssignmentsForUser,
  getAuditLogsForLecturer,
  getCoursesForUser,
  getExtensionsForUser,
  getIntegrityReportsForLecturer,
  getMessagesForUser,
  getNotificationsForUser,
  getReviewsForUser,
  getSubmissionsForUser,
  getUserAuthByEmailAndRole,
  getUserById,
  initDatabase,
} from './server/db.ts';
import {
  recordAuditLog,
  requireAuth,
  requireRole,
  resolveSafeUploadPath,
  sanitizeOriginalFilename,
  signSessionToken,
  verifyPassword,
  verifySessionToken,
  type AuthenticatedRequest,
} from './server/security.ts';
import type {
  BootstrapPayload,
  NotificationItem,
  NotificationType,
  UserRole,
} from './src/shared/types.ts';

const PORT = 3000;
const db = initDatabase();

const app = express();
app.use(express.json({ limit: '2mb' }));

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 12 * 1024 * 1024 },
});

const server = http.createServer(app);
const wss = new WebSocketServer({ server, path: '/ws' });
const socketsByUser = new Map<string, Set<WebSocket>>();

wss.on('connection', (socket, req) => {
  const url = new URL(req.url ?? '/', `http://${req.headers.host ?? 'localhost'}`);
  const token = url.searchParams.get('token');
  const session = verifySessionToken(token);
  if (!session) {
    socket.close(4001, 'Unauthorized');
    return;
  }

  let userSet = socketsByUser.get(session.userId);
  if (!userSet) {
    userSet = new Set();
    socketsByUser.set(session.userId, userSet);
  }
  userSet.add(socket);

  socket.send(JSON.stringify({ event: 'ws:connected', userId: session.userId }));

  socket.on('close', () => {
    const current = socketsByUser.get(session.userId);
    if (current) {
      current.delete(socket);
      if (current.size === 0) {
        socketsByUser.delete(session.userId);
      }
    }
  });
});

function pushToUser(userId: string, event: string, payload: unknown): void {
  const sockets = socketsByUser.get(userId);
  if (!sockets) return;
  const serialized = JSON.stringify({ event, payload });
  for (const ws of sockets) {
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(serialized);
    }
  }
}

function createAndPushNotification(params: {
  userId: string;
  type: NotificationType;
  title: string;
  body: string;
  linkAssignmentId?: string | null;
}): NotificationItem {
  const item: NotificationItem = {
    id: `notif-${crypto.randomUUID()}`,
    userId: params.userId,
    type: params.type,
    title: params.title,
    body: params.body,
    linkAssignmentId: params.linkAssignmentId ?? null,
    isRead: false,
    createdAt: new Date().toISOString(),
  };

  db.prepare(
    `INSERT INTO notifications (id, user_id, type, title, body, link_assignment_id, is_read, created_at)
     VALUES (?, ?, ?, ?, ?, ?, 0, ?)`
  ).run(
    item.id,
    item.userId,
    item.type,
    item.title,
    item.body,
    item.linkAssignmentId,
    item.createdAt
  );

  pushToUser(params.userId, 'notification:new', item);
  return item;
}

function getEnrolledStudentIds(courseId: string): string[] {
  const rows = db
    .prepare(`SELECT student_id FROM enrollments WHERE course_id = ?`)
    .all(courseId) as Array<{ student_id: string }>;
  return rows.map((r) => r.student_id);
}

// Public demo directory for Login Portal one-click demo fill
app.get('/api/demo-users', (_req, res) => {
  res.json({ users: getAllPublicUsers(db) });
});

// Separate Student & Lecturer Login endpoint
app.post('/api/auth/login', (req, res) => {
  const { email, passcode, role } = req.body as {
    email?: string;
    passcode?: string;
    role?: UserRole;
  };

  if (!email || !passcode || (role !== 'student' && role !== 'lecturer')) {
    res.status(400).json({ error: 'Email, passcode, and portal role are required.' });
    return;
  }

  const record = getUserAuthByEmailAndRole(db, email, role);
  if (!record || !verifyPassword(passcode, record.passwordHash)) {
    res.status(401).json({
      error: `Invalid ${role} credentials. Verify your email, passcode, and selected portal tab.`,
    });
    return;
  }

  const { passwordHash: _ignored, ...user } = record;
  const token = signSessionToken(user.id, user.role);

  recordAuditLog(db, {
    actorId: user.id,
    actorName: user.name,
    actorRole: user.role,
    action: 'PORTAL_SIGN_IN',
    targetType: 'user',
    targetId: user.id,
    details: `${user.name} signed into the ${user.role} dashboard.`,
  });

  res.json({ token, user });
});

// Role-scoped workspace bootstrap
app.get('/api/bootstrap', requireAuth, (req: AuthenticatedRequest, res) => {
  const user = getUserById(db, req.session!.userId);
  if (!user) {
    res.status(404).json({ error: 'User not found.' });
    return;
  }

  const allUsers = getAllPublicUsers(db);
  const peers =
    user.role === 'lecturer'
      ? allUsers.filter((u) => u.role === 'student')
      : allUsers.filter((u) => u.role === 'lecturer');

  const payload: BootstrapPayload = {
    currentUser: user,
    peers,
    courses: getCoursesForUser(db, user),
    assignments: getAssignmentsForUser(db, user),
    submissions: getSubmissionsForUser(db, user),
    integrityReports:
      user.role === 'lecturer' ? getIntegrityReportsForLecturer(db, user.id) : [],
    reviews: getReviewsForUser(db, user),
    extensions: getExtensionsForUser(db, user),
    messages: getMessagesForUser(db, user.id),
    notifications: getNotificationsForUser(db, user.id),
    auditLogs: user.role === 'lecturer' ? getAuditLogsForLecturer(db) : [],
  };

  res.json(payload);
});

// Lecturer: Create new assignment (NO grading / rubric fields)
app.post('/api/assignments', requireAuth, requireRole('lecturer'), (req: AuthenticatedRequest, res) => {
  const actor = getUserById(db, req.session!.userId)!;
  const body = req.body as {
    courseId?: string;
    title?: string;
    description?: string;
    instructions?: string;
    dueAt?: string;
    allowResubmission?: boolean;
  };

  if (!body.courseId || !body.title?.trim() || !body.instructions?.trim() || !body.dueAt) {
    res.status(400).json({ error: 'Course, title, instructions, and due date are required.' });
    return;
  }

  const course = db
    .prepare(`SELECT id, code, lecturer_id FROM courses WHERE id = ? AND lecturer_id = ?`)
    .get(body.courseId, actor.id) as { id: string; code: string; lecturer_id: string } | undefined;
  if (!course) {
    res.status(403).json({ error: 'Course not found or unauthorized.' });
    return;
  }

  const parsedDue = new Date(body.dueAt);
  if (Number.isNaN(parsedDue.getTime())) {
    res.status(400).json({ error: 'Invalid due date format.' });
    return;
  }

  const now = new Date().toISOString();
  const id = `assign-${crypto.randomUUID().slice(0, 8)}`;

  db.prepare(
    `INSERT INTO assignments (
      id, course_id, title, description, instructions, original_due_at, due_at,
      status, modification_note, allow_resubmission, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, 'active', NULL, ?, ?, ?)`
  ).run(
    id,
    course.id,
    body.title.trim(),
    (body.description ?? body.title).trim(),
    body.instructions.trim(),
    parsedDue.toISOString(),
    parsedDue.toISOString(),
    body.allowResubmission === false ? 0 : 1,
    now,
    now
  );

  recordAuditLog(db, {
    actorId: actor.id,
    actorName: actor.name,
    actorRole: actor.role,
    action: 'ASSIGNMENT_CREATED',
    targetType: 'assignment',
    targetId: id,
    details: `Published "${body.title.trim()}" in ${course.code} due ${parsedDue.toISOString()}.`,
  });

  const studentIds = getEnrolledStudentIds(course.id);
  for (const sid of studentIds) {
    createAndPushNotification({
      userId: sid,
      type: 'assignment_created',
      title: `New Assignment (${course.code}): ${body.title.trim()}`,
      body: `Due ${parsedDue.toLocaleString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}.`,
      linkAssignmentId: id,
    });
    pushToUser(sid, 'workspace:sync', { reason: 'assignment_created', assignmentId: id });
  }

  res.status(201).json({ id });
});

// Lecturer: Modify or cancel an assignment -> instant alert to all enrolled students
app.patch('/api/assignments/:id', requireAuth, requireRole('lecturer'), (req: AuthenticatedRequest, res) => {
  const actor = getUserById(db, req.session!.userId)!;
  const assignmentId = String(req.params.id);
  const existing = db
    .prepare(
      `SELECT a.*, c.code AS courseCode, c.lecturer_id AS lecturerId
       FROM assignments a
       JOIN courses c ON c.id = a.course_id
       WHERE a.id = ?`
    )
    .get(assignmentId) as (Record<string, unknown> & { courseCode: string; lecturerId: string }) | undefined;

  if (!existing || existing.lecturerId !== actor.id) {
    res.status(404).json({ error: 'Assignment not found or unauthorized.' });
    return;
  }

  const body = req.body as {
    title?: string;
    instructions?: string;
    dueAt?: string;
    status?: 'active' | 'modified' | 'canceled';
    modificationNote?: string;
  };

  const nextStatus = body.status ?? (existing.status === 'canceled' ? 'canceled' : 'modified');
  const nextTitle = body.title?.trim() || String(existing.title);
  const nextInstructions = body.instructions?.trim() || String(existing.instructions);
  const nextDueAt = body.dueAt ? new Date(body.dueAt).toISOString() : String(existing.due_at);
  const note =
    body.modificationNote?.trim() ||
    (nextStatus === 'canceled'
      ? 'Assignment canceled by instructor.'
      : 'Assignment requirements or deadline updated by instructor.');
  const now = new Date().toISOString();

  db.prepare(
    `UPDATE assignments
     SET title = ?, instructions = ?, due_at = ?, status = ?, modification_note = ?, updated_at = ?
     WHERE id = ?`
  ).run(nextTitle, nextInstructions, nextDueAt, nextStatus, note, now, assignmentId);

  const isCanceled = nextStatus === 'canceled';
  recordAuditLog(db, {
    actorId: actor.id,
    actorName: actor.name,
    actorRole: actor.role,
    action: isCanceled ? 'ASSIGNMENT_CANCELED' : 'ASSIGNMENT_MODIFIED',
    targetType: 'assignment',
    targetId: assignmentId,
    details: `${nextTitle}: ${note}`,
  });

  const studentIds = getEnrolledStudentIds(String(existing.course_id));
  for (const sid of studentIds) {
    createAndPushNotification({
      userId: sid,
      type: isCanceled ? 'assignment_canceled' : 'assignment_modified',
      title: isCanceled
        ? `Canceled (${existing.courseCode}): ${nextTitle}`
        : `Updated (${existing.courseCode}): ${nextTitle}`,
      body: note,
      linkAssignmentId: assignmentId,
    });
    pushToUser(sid, 'workspace:sync', {
      reason: isCanceled ? 'assignment_canceled' : 'assignment_modified',
      assignmentId,
    });
  }

  res.json({ ok: true, status: nextStatus });
});

// Student: File-primary submission from PC/laptop (.pdf, .doc, .docx, .txt) + optional note
app.post(
  '/api/submissions',
  requireAuth,
  requireRole('student'),
  upload.single('file'),
  async (req: AuthenticatedRequest, res) => {
    try {
      const student = getUserById(db, req.session!.userId)!;
      const assignmentId = String(req.body?.assignmentId ?? '').trim();
      const studentNote = String(req.body?.studentNote ?? '').trim() || null;
      const uploadedFile = req.file;

      if (!assignmentId) {
        res.status(400).json({ error: 'assignmentId is required.' });
        return;
      }

      if (!uploadedFile) {
        res.status(400).json({
          error: 'Please select a PDF, DOC, DOCX, or TXT file from your computer to submit.',
        });
        return;
      }

      const assignment = db
        .prepare(
          `SELECT a.*, c.code AS courseCode, c.lecturer_id AS lecturerId
           FROM assignments a
           JOIN courses c ON c.id = a.course_id
           JOIN enrollments e ON e.course_id = c.id
           WHERE a.id = ? AND e.student_id = ?`
        )
        .get(assignmentId, student.id) as
        | (Record<string, unknown> & { courseCode: string; lecturerId: string })
        | undefined;

      if (!assignment) {
        res.status(404).json({ error: 'Assignment not found or you are not enrolled.' });
        return;
      }

      if (assignment.status === 'canceled') {
        res.status(400).json({ error: 'This assignment has been canceled by the lecturer.' });
        return;
      }

      const approvedExt = db
        .prepare(
          `SELECT requested_due_at FROM extension_requests
           WHERE assignment_id = ? AND student_id = ? AND status = 'approved'
           ORDER BY decided_at DESC LIMIT 1`
        )
        .get(assignmentId, student.id) as { requested_due_at: string } | undefined;

      const effectiveDue = new Date(approvedExt?.requested_due_at ?? String(assignment.due_at));
      const now = new Date();
      if (now.getTime() > effectiveDue.getTime()) {
        res.status(400).json({
          error:
            'The submission deadline has passed. Please submit an extension request via the Extension Portal.',
        });
        return;
      }

      const existingSub = db
        .prepare(`SELECT id, version, status FROM submissions WHERE assignment_id = ? AND student_id = ?`)
        .get(assignmentId, student.id) as { id: string; version: number; status: string } | undefined;

      if (
        existingSub &&
        !assignment.allow_resubmission &&
        existingSub.status !== 'revision_requested'
      ) {
        res.status(400).json({ error: 'Resubmissions are disabled for this assignment.' });
        return;
      }

      const safeName = sanitizeOriginalFilename(uploadedFile.originalname);
      const extracted = await extractDocumentText(
        uploadedFile.buffer,
        uploadedFile.mimetype,
        safeName
      );
      if (!extracted || extracted.length < 10) {
        res.status(400).json({
          error: 'No readable text could be extracted from the uploaded file.',
        });
        return;
      }

      const uniqueStoredName = `${student.id}_${assignmentId}_${Date.now()}_${safeName}`;
      const safeTargetPath = resolveSafeUploadPath(uniqueStoredName);
      fs.writeFileSync(safeTargetPath, uploadedFile.buffer);

      const wordCount = extracted.split(/\s+/).filter(Boolean).length;
      const nowIso = now.toISOString();
      const isLate = now.getTime() > new Date(String(assignment.due_at)).getTime() ? 1 : 0;

      let submissionId: string;
      let version = 1;

      if (existingSub) {
        submissionId = existingSub.id;
        version = existingSub.version + 1;
        db.prepare(
          `UPDATE submissions
           SET file_name = ?, file_mime = ?, file_size = ?, stored_path = ?,
               student_note = ?, content_text = ?, word_count = ?, version = ?,
               is_late = ?, submitted_at = ?, status = 'submitted'
           WHERE id = ?`
        ).run(
          safeName,
          uploadedFile.mimetype || 'application/octet-stream',
          uploadedFile.size,
          uniqueStoredName,
          studentNote,
          extracted,
          wordCount,
          version,
          isLate,
          nowIso,
          submissionId
        );
        // Require a fresh AI check on the new file version before new feedback
        db.prepare(`DELETE FROM integrity_reports WHERE submission_id = ?`).run(submissionId);
      } else {
        submissionId = `sub-${crypto.randomUUID().slice(0, 8)}`;
        db.prepare(
          `INSERT INTO submissions (
            id, assignment_id, student_id, file_name, file_mime, file_size,
            stored_path, student_note, content_text, word_count, version, is_late, submitted_at, status
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'submitted')`
        ).run(
          submissionId,
          assignmentId,
          student.id,
          safeName,
          uploadedFile.mimetype || 'application/octet-stream',
          uploadedFile.size,
          uniqueStoredName,
          studentNote,
          extracted,
          wordCount,
          version,
          isLate,
          nowIso
        );
      }

      recordAuditLog(db, {
        actorId: student.id,
        actorName: student.name,
        actorRole: student.role,
        action: existingSub ? 'FILE_RESUBMITTED' : 'FILE_SUBMITTED',
        targetType: 'submission',
        targetId: submissionId,
        details: `${student.name} uploaded ${safeName} (v${version}, ${wordCount} words).`,
      });

      createAndPushNotification({
        userId: String(assignment.lecturerId),
        type: 'submission_received',
        title: `${existingSub ? 'Updated File' : 'New Submission'}: ${student.name}`,
        body: `${assignment.courseCode} · ${safeName} (${wordCount} words)`,
        linkAssignmentId: assignmentId,
      });
      pushToUser(String(assignment.lecturerId), 'workspace:sync', {
        reason: 'submission_received',
        submissionId,
      });

      res.status(201).json({ id: submissionId, version, wordCount, fileName: safeName });
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to process uploaded file.';
      res.status(400).json({ error: msg });
    }
  }
);

// Authenticated file viewer / downloader for Lecturer (and owning Student)
app.get('/api/submissions/:id/file', requireAuth, (req: AuthenticatedRequest, res) => {
  const session = req.session!;
  const submissionId = String(req.params.id);

  const row = db
    .prepare(
      `SELECT s.id, s.student_id, s.file_name, s.file_mime, s.stored_path,
              c.lecturer_id AS lecturerId
       FROM submissions s
       JOIN assignments a ON a.id = s.assignment_id
       JOIN courses c ON c.id = a.course_id
       WHERE s.id = ?`
    )
    .get(submissionId) as
    | {
        id: string;
        student_id: string;
        file_name: string;
        file_mime: string;
        stored_path: string;
        lecturerId: string;
      }
    | undefined;

  if (!row) {
    res.status(404).json({ error: 'Submission file not found.' });
    return;
  }

  const isAuthorized =
    (session.role === 'lecturer' && row.lecturerId === session.userId) ||
    (session.role === 'student' && row.student_id === session.userId);

  if (!isAuthorized) {
    res.status(403).json({ error: 'Access denied to this student file.' });
    return;
  }

  try {
    const filePath = resolveSafeUploadPath(row.stored_path);
    if (!fs.existsSync(filePath)) {
      res.status(404).json({ error: 'Stored file missing on server.' });
      return;
    }

    const download = req.query.download === '1';
    const safeName = sanitizeOriginalFilename(row.file_name);
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Content-Type', row.file_mime || 'application/octet-stream');
    res.setHeader(
      'Content-Disposition',
      `${download ? 'attachment' : 'inline'}; filename="${safeName}"`
    );
    res.sendFile(filePath);
  } catch {
    res.status(400).json({ error: 'Invalid file reference.' });
  }
});

// Lecturer: Run live AI Detection & Plagiarism Scan via Gemini + Cohort N-Gram Matcher
app.post(
  '/api/submissions/:id/analyze',
  requireAuth,
  requireRole('lecturer'),
  async (req: AuthenticatedRequest, res) => {
    try {
      const lecturer = getUserById(db, req.session!.userId)!;
      const submissionId = String(req.params.id);

      const subRow = db
        .prepare(
          `SELECT s.*, u.name AS studentName, a.title AS assignmentTitle,
                  a.instructions AS assignmentPrompt, c.lecturer_id AS lecturerId
           FROM submissions s
           JOIN users u ON u.id = s.student_id
           JOIN assignments a ON a.id = s.assignment_id
           JOIN courses c ON c.id = a.course_id
           WHERE s.id = ?`
        )
        .get(submissionId) as
        | (Record<string, unknown> & {
            studentName: string;
            assignmentTitle: string;
            assignmentPrompt: string;
            lecturerId: string;
          })
        | undefined;

      if (!subRow || subRow.lecturerId !== lecturer.id) {
        res.status(404).json({ error: 'Submission not found or unauthorized.' });
        return;
      }

      const peerRows = db
        .prepare(
          `SELECT s.id, u.name AS studentName, s.file_name AS fileName, s.content_text AS contentText
           FROM submissions s
           JOIN users u ON u.id = s.student_id
           WHERE s.assignment_id = ? AND s.id != ?`
        )
        .all(String(subRow.assignment_id), submissionId) as Array<{
        id: string;
        studentName: string;
        fileName: string | null;
        contentText: string;
      }>;

      const analysis = await analyzeSubmissionIntegrity({
        assignmentTitle: subRow.assignmentTitle,
        assignmentPrompt: subRow.assignmentPrompt,
        submissionText: String(subRow.content_text),
        peerSubmissions: peerRows,
      });

      const reportId = `rep-${crypto.randomUUID().slice(0, 8)}`;
      const analyzedAt = new Date().toISOString();
      const subVersion = Number(subRow.version);

      db.prepare(`DELETE FROM integrity_reports WHERE submission_id = ?`).run(submissionId);
      db.prepare(
        `INSERT INTO integrity_reports (
          id, submission_id, submission_version, ai_score, plagiarism_score, risk_level, summary,
          cohort_matches_json, sentences_json, analyzed_by, analyzed_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      ).run(
        reportId,
        submissionId,
        subVersion,
        analysis.aiScore,
        analysis.plagiarismScore,
        analysis.riskLevel,
        analysis.summary,
        JSON.stringify(analysis.cohortMatches),
        JSON.stringify(analysis.sentences),
        lecturer.name,
        analyzedAt
      );

      db.prepare(
        `UPDATE submissions SET status = CASE WHEN status = 'submitted' THEN 'under_review' ELSE status END WHERE id = ?`
      ).run(submissionId);

      recordAuditLog(db, {
        actorId: lecturer.id,
        actorName: lecturer.name,
        actorRole: lecturer.role,
        action: 'AI_INTEGRITY_SCAN_COMPLETED',
        targetType: 'submission',
        targetId: submissionId,
        details: `AI & Plagiarism scan for ${subRow.studentName} (v${subVersion}): AI ${analysis.aiScore}% · Similarity ${analysis.plagiarismScore}% (${analysis.riskLevel}).`,
      });

      res.json({
        report: {
          id: reportId,
          submissionId,
          submissionVersion: subVersion,
          aiScore: analysis.aiScore,
          plagiarismScore: analysis.plagiarismScore,
          riskLevel: analysis.riskLevel,
          summary: analysis.summary,
          cohortMatches: analysis.cohortMatches,
          sentences: analysis.sentences,
          analyzedBy: lecturer.name,
          analyzedAt,
        },
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Integrity analysis failed.';
      res.status(502).json({ error: msg });
    }
  }
);

// Lecturer: Confirm receipt & send written feedback (NO GRADES; gated by AI check completion)
app.post(
  '/api/submissions/:id/review',
  requireAuth,
  requireRole('lecturer'),
  (req: AuthenticatedRequest, res) => {
    const lecturer = getUserById(db, req.session!.userId)!;
    const submissionId = String(req.params.id);
    const body = req.body as {
      reviewStatus?: 'confirmed' | 'revision_requested';
      feedback?: string;
    };

    if (
      body.reviewStatus !== 'confirmed' &&
      body.reviewStatus !== 'revision_requested'
    ) {
      res.status(400).json({ error: 'Valid confirmation status is required.' });
      return;
    }

    const feedback = String(body.feedback ?? '').trim();
    if (!feedback) {
      res.status(400).json({ error: 'Please write qualitative feedback for the student.' });
      return;
    }

    const sub = db
      .prepare(
        `SELECT s.*, a.title AS assignmentTitle, c.lecturer_id AS lecturerId, u.name AS studentName
         FROM submissions s
         JOIN assignments a ON a.id = s.assignment_id
         JOIN courses c ON c.id = a.course_id
         JOIN users u ON u.id = s.student_id
         WHERE s.id = ?`
      )
      .get(submissionId) as
      | (Record<string, unknown> & {
          assignmentTitle: string;
          lecturerId: string;
          studentName: string;
        })
      | undefined;

    if (!sub || sub.lecturerId !== lecturer.id) {
      res.status(404).json({ error: 'Submission not found or unauthorized.' });
      return;
    }

    // Enforce AI Detection Check before sending feedback
    const report = db
      .prepare(
        `SELECT id, submission_version FROM integrity_reports WHERE submission_id = ?`
      )
      .get(submissionId) as { id: string; submission_version: number } | undefined;

    if (!report || report.submission_version !== Number(sub.version)) {
      res.status(400).json({
        error:
          'Please run the AI & Plagiarism Detection Check on this submission version before sending receipt confirmation and feedback.',
      });
      return;
    }

    const now = new Date().toISOString();
    const existingReview = db
      .prepare(`SELECT id FROM submission_reviews WHERE submission_id = ?`)
      .get(submissionId) as { id: string } | undefined;

    let reviewId: string;
    if (existingReview) {
      reviewId = existingReview.id;
      db.prepare(
        `UPDATE submission_reviews
         SET receipt_confirmed = 1, review_status = ?, feedback = ?, updated_at = ?
         WHERE id = ?`
      ).run(body.reviewStatus, feedback, now, reviewId);
    } else {
      reviewId = `rev-${crypto.randomUUID().slice(0, 8)}`;
      db.prepare(
        `INSERT INTO submission_reviews (
          id, submission_id, lecturer_id, receipt_confirmed, review_status, feedback,
          student_reply, student_reply_at, confirmed_at, updated_at
        ) VALUES (?, ?, ?, 1, ?, ?, NULL, NULL, ?, ?)`
      ).run(reviewId, submissionId, lecturer.id, body.reviewStatus, feedback, now, now);
    }

    db.prepare(`UPDATE submissions SET status = ? WHERE id = ?`).run(
      body.reviewStatus,
      submissionId
    );

    recordAuditLog(db, {
      actorId: lecturer.id,
      actorName: lecturer.name,
      actorRole: lecturer.role,
      action:
        body.reviewStatus === 'revision_requested'
          ? 'REVISION_REQUESTED_WITH_FEEDBACK'
          : 'RECEIPT_CONFIRMED_WITH_FEEDBACK',
      targetType: 'submission',
      targetId: submissionId,
      details: `${lecturer.name} confirmed receipt of ${String(sub.file_name)} from ${sub.studentName} (${body.reviewStatus}).`,
    });

    const studentId = String(sub.student_id);
    createAndPushNotification({
      userId: studentId,
      type: 'feedback_posted',
      title:
        body.reviewStatus === 'revision_requested'
          ? `Revision Requested: ${sub.assignmentTitle}`
          : `Submission Confirmed & Feedback: ${sub.assignmentTitle}`,
      body: feedback.slice(0, 130),
      linkAssignmentId: String(sub.assignment_id),
    });
    pushToUser(studentId, 'workspace:sync', { reason: 'feedback_posted', submissionId });

    res.json({ ok: true, reviewId, reviewStatus: body.reviewStatus });
  }
);

// Student: Acknowledge confirmation & reply to instructor feedback
app.post(
  '/api/submissions/:id/acknowledge',
  requireAuth,
  requireRole('student'),
  (req: AuthenticatedRequest, res) => {
    const student = getUserById(db, req.session!.userId)!;
    const submissionId = String(req.params.id);
    const note = String((req.body as { note?: string })?.note ?? '').trim();

    if (!note) {
      res.status(400).json({ error: 'Please write a short reply or acknowledgment.' });
      return;
    }

    const row = db
      .prepare(
        `SELECT sr.id AS reviewId, s.student_id, s.assignment_id, a.title AS assignmentTitle, c.lecturer_id AS lecturerId
         FROM submission_reviews sr
         JOIN submissions s ON s.id = sr.submission_id
         JOIN assignments a ON a.id = s.assignment_id
         JOIN courses c ON c.id = a.course_id
         WHERE s.id = ? AND s.student_id = ?`
      )
      .get(submissionId, student.id) as
      | { reviewId: string; student_id: string; assignment_id: string; assignmentTitle: string; lecturerId: string }
      | undefined;

    if (!row) {
      res.status(404).json({ error: 'Confirmed submission review not found.' });
      return;
    }

    const now = new Date().toISOString();
    db.prepare(
      `UPDATE submission_reviews SET student_reply = ?, student_reply_at = ? WHERE id = ?`
    ).run(note, now, row.reviewId);

    createAndPushNotification({
      userId: row.lecturerId,
      type: 'feedback_posted',
      title: `Feedback Reply from ${student.name}`,
      body: `Re: ${row.assignmentTitle} — "${note.slice(0, 110)}"`,
      linkAssignmentId: row.assignment_id,
    });
    pushToUser(row.lecturerId, 'workspace:sync', { reason: 'feedback_acknowledged', submissionId });

    res.json({ ok: true });
  }
);

// Student: Request deadline extension
app.post('/api/extensions', requireAuth, requireRole('student'), (req: AuthenticatedRequest, res) => {
  const student = getUserById(db, req.session!.userId)!;
  const body = req.body as {
    assignmentId?: string;
    requestedDueAt?: string;
    reason?: string;
  };

  if (!body.assignmentId || !body.requestedDueAt || !body.reason?.trim()) {
    res.status(400).json({ error: 'Assignment, proposed due date, and reason are required.' });
    return;
  }

  const assignment = db
    .prepare(
      `SELECT a.*, c.code AS courseCode, c.lecturer_id AS lecturerId
       FROM assignments a
       JOIN courses c ON c.id = a.course_id
       JOIN enrollments e ON e.course_id = c.id
       WHERE a.id = ? AND e.student_id = ?`
    )
    .get(body.assignmentId, student.id) as
    | (Record<string, unknown> & { courseCode: string; lecturerId: string })
    | undefined;

  if (!assignment) {
    res.status(404).json({ error: 'Assignment not found or unauthorized.' });
    return;
  }

  if (assignment.status === 'canceled') {
    res.status(400).json({ error: 'Cannot request an extension on a canceled assignment.' });
    return;
  }

  const requestedDate = new Date(body.requestedDueAt);
  if (Number.isNaN(requestedDate.getTime())) {
    res.status(400).json({ error: 'Invalid requested date.' });
    return;
  }

  const id = `ext-${crypto.randomUUID().slice(0, 8)}`;
  const now = new Date().toISOString();

  db.prepare(
    `INSERT INTO extension_requests (
      id, assignment_id, student_id, original_due_at, requested_due_at, reason,
      status, lecturer_note, decided_by, created_at, decided_at
    ) VALUES (?, ?, ?, ?, ?, ?, 'pending', NULL, NULL, ?, NULL)`
  ).run(
    id,
    body.assignmentId,
    student.id,
    String(assignment.due_at),
    requestedDate.toISOString(),
    body.reason.trim(),
    now
  );

  recordAuditLog(db, {
    actorId: student.id,
    actorName: student.name,
    actorRole: student.role,
    action: 'EXTENSION_REQUESTED',
    targetType: 'extension_request',
    targetId: id,
    details: `Requested extension to ${requestedDate.toISOString()} on ${String(assignment.title)}.`,
  });

  createAndPushNotification({
    userId: assignment.lecturerId,
    type: 'extension_requested',
    title: `Extension Request: ${student.name}`,
    body: `${assignment.courseCode} · ${String(assignment.title)}`,
    linkAssignmentId: body.assignmentId,
  });
  pushToUser(assignment.lecturerId, 'workspace:sync', { reason: 'extension_requested', id });

  res.status(201).json({ id });
});

// Lecturer: Approve or deny extension request
app.patch('/api/extensions/:id', requireAuth, requireRole('lecturer'), (req: AuthenticatedRequest, res) => {
  const lecturer = getUserById(db, req.session!.userId)!;
  const extId = String(req.params.id);
  const body = req.body as { status?: 'approved' | 'denied'; lecturerNote?: string };

  if (body.status !== 'approved' && body.status !== 'denied') {
    res.status(400).json({ error: 'Status must be approved or denied.' });
    return;
  }

  const ext = db
    .prepare(
      `SELECT er.*, a.title AS assignmentTitle, c.lecturer_id AS lecturerId, u.name AS studentName
       FROM extension_requests er
       JOIN assignments a ON a.id = er.assignment_id
       JOIN courses c ON c.id = a.course_id
       JOIN users u ON u.id = er.student_id
       WHERE er.id = ?`
    )
    .get(extId) as
    | (Record<string, unknown> & { assignmentTitle: string; lecturerId: string; studentName: string })
    | undefined;

  if (!ext || ext.lecturerId !== lecturer.id) {
    res.status(404).json({ error: 'Extension request not found or unauthorized.' });
    return;
  }

  const now = new Date().toISOString();
  const note =
    body.lecturerNote?.trim() ||
    (body.status === 'approved' ? 'Extension approved by instructor.' : 'Extension declined.');

  db.prepare(
    `UPDATE extension_requests
     SET status = ?, lecturer_note = ?, decided_by = ?, decided_at = ?
     WHERE id = ?`
  ).run(body.status, note, lecturer.id, now, extId);

  recordAuditLog(db, {
    actorId: lecturer.id,
    actorName: lecturer.name,
    actorRole: lecturer.role,
    action: body.status === 'approved' ? 'EXTENSION_APPROVED' : 'EXTENSION_DENIED',
    targetType: 'extension_request',
    targetId: extId,
    details: `${body.status.toUpperCase()} extension for ${ext.studentName} on ${ext.assignmentTitle}.`,
  });

  const studentId = String(ext.student_id);
  createAndPushNotification({
    userId: studentId,
    type: 'extension_decision',
    title: `Extension ${body.status === 'approved' ? 'Approved' : 'Declined'}: ${ext.assignmentTitle}`,
    body: note,
    linkAssignmentId: String(ext.assignment_id),
  });
  pushToUser(studentId, 'workspace:sync', { reason: 'extension_decision', id: extId });

  res.json({ ok: true });
});

// Authenticated 1:1 private messaging
app.post('/api/messages', requireAuth, (req: AuthenticatedRequest, res) => {
  const sender = getUserById(db, req.session!.userId)!;
  const body = req.body as {
    recipientId?: string;
    courseId?: string;
    assignmentId?: string | null;
    body?: string;
  };

  if (!body.recipientId || !body.courseId || !body.body?.trim()) {
    res.status(400).json({ error: 'Recipient, course, and message body are required.' });
    return;
  }

  const recipient = getUserById(db, body.recipientId);
  if (!recipient || recipient.id === sender.id) {
    res.status(400).json({ error: 'Invalid message recipient.' });
    return;
  }

  if (sender.role === recipient.role) {
    res.status(403).json({ error: 'Private messaging is scoped between students and instructors.' });
    return;
  }

  const msgId = `msg-${crypto.randomUUID().slice(0, 8)}`;
  const now = new Date().toISOString();

  db.prepare(
    `INSERT INTO messages (id, course_id, assignment_id, sender_id, recipient_id, body, is_read, created_at)
     VALUES (?, ?, ?, ?, ?, ?, 0, ?)`
  ).run(
    msgId,
    body.courseId,
    body.assignmentId || null,
    sender.id,
    recipient.id,
    body.body.trim(),
    now
  );

  const assignmentRow = body.assignmentId
    ? (db.prepare(`SELECT title FROM assignments WHERE id = ?`).get(body.assignmentId) as
        | { title: string }
        | undefined)
    : undefined;

  const messagePayload = {
    id: msgId,
    courseId: body.courseId,
    assignmentId: body.assignmentId || null,
    assignmentTitle: assignmentRow?.title ?? null,
    senderId: sender.id,
    senderName: sender.name,
    senderRole: sender.role,
    recipientId: recipient.id,
    recipientName: recipient.name,
    body: body.body.trim(),
    isRead: false,
    createdAt: now,
  };

  pushToUser(recipient.id, 'message:received', messagePayload);
  createAndPushNotification({
    userId: recipient.id,
    type: 'new_message',
    title: `New Message from ${sender.name}`,
    body: body.body.trim().slice(0, 110),
    linkAssignmentId: body.assignmentId || null,
  });

  res.status(201).json({ message: messagePayload });
});

app.patch('/api/notifications/read', requireAuth, (req: AuthenticatedRequest, res) => {
  const userId = req.session!.userId;
  const { notificationId } = (req.body ?? {}) as { notificationId?: string };

  if (notificationId) {
    db.prepare(`UPDATE notifications SET is_read = 1 WHERE id = ? AND user_id = ?`).run(
      notificationId,
      userId
    );
  } else {
    db.prepare(`UPDATE notifications SET is_read = 1 WHERE user_id = ?`).run(userId);
  }

  res.json({ ok: true });
});

app.patch('/api/messages/read', requireAuth, (req: AuthenticatedRequest, res) => {
  const userId = req.session!.userId;
  const { peerId } = (req.body ?? {}) as { peerId?: string };
  if (peerId) {
    db.prepare(
      `UPDATE messages SET is_read = 1 WHERE sender_id = ? AND recipient_id = ?`
    ).run(peerId, userId);
  }
  res.json({ ok: true });
});

async function startServer() {
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distDir = path.resolve(process.cwd(), 'dist');
    app.use(express.static(distDir));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distDir, 'index.html'));
    });
  }

  server.listen(PORT, '0.0.0.0', () => {
    console.log(`Verity Academic server listening on port ${PORT}`);
  });
}

startServer();
