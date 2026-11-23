export type UserRole = 'lecturer' | 'student';

export interface UserProfile {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  department: string;
  studentCode: string | null;
  avatarInitials: string;
  title: string;
}

export interface Course {
  id: string;
  code: string;
  title: string;
  term: string;
  lecturerId: string;
  lecturerName: string;
  description: string;
}

export type AssignmentStatus = 'active' | 'modified' | 'canceled';

export interface Assignment {
  id: string;
  courseId: string;
  courseCode: string;
  courseTitle: string;
  title: string;
  description: string;
  instructions: string;
  originalDueAt: string;
  dueAt: string;
  effectiveDueAt?: string;
  status: AssignmentStatus;
  modificationNote: string | null;
  allowResubmission: boolean;
  createdAt: string;
  updatedAt: string;
}

export type SubmissionStatus =
  | 'submitted'
  | 'under_review'
  | 'confirmed'
  | 'revision_requested';

export interface Submission {
  id: string;
  assignmentId: string;
  studentId: string;
  studentName: string;
  studentCode: string | null;
  fileName: string;
  fileMime: string;
  fileSize: number;
  hasStoredFile: boolean;
  studentNote: string | null;
  contentText: string;
  wordCount: number;
  version: number;
  isLate: boolean;
  submittedAt: string;
  status: SubmissionStatus;
}

export type SentenceLabel = 'human' | 'ai_suspected' | 'ai_likely' | 'plagiarism_match';

export interface SentenceAnalysis {
  index: number;
  text: string;
  aiProbability: number;
  plagiarismScore: number;
  label: SentenceLabel;
  reason: string;
  matchedSource: string | null;
}

export interface CohortMatch {
  matchedSubmissionId: string;
  matchedStudentName: string;
  overlapPercent: number;
  sharedExcerpt: string;
}

export interface IntegrityReport {
  id: string;
  submissionId: string;
  submissionVersion: number;
  aiScore: number;
  plagiarismScore: number;
  riskLevel: 'low' | 'moderate' | 'high';
  summary: string;
  cohortMatches: CohortMatch[];
  sentences: SentenceAnalysis[];
  analyzedBy: string;
  analyzedAt: string;
}

export type ReviewStatus = 'confirmed' | 'revision_requested';

export interface SubmissionReview {
  id: string;
  submissionId: string;
  lecturerId: string;
  lecturerName: string;
  receiptConfirmed: boolean;
  reviewStatus: ReviewStatus;
  feedback: string;
  studentReply: string | null;
  studentReplyAt: string | null;
  confirmedAt: string;
  updatedAt: string;
}

export type ExtensionStatus = 'pending' | 'approved' | 'denied';

export interface ExtensionRequest {
  id: string;
  assignmentId: string;
  assignmentTitle: string;
  courseCode: string;
  studentId: string;
  studentName: string;
  studentCode: string | null;
  originalDueAt: string;
  requestedDueAt: string;
  reason: string;
  status: ExtensionStatus;
  lecturerNote: string | null;
  decidedBy: string | null;
  createdAt: string;
  decidedAt: string | null;
}

export interface PrivateMessage {
  id: string;
  courseId: string;
  assignmentId: string | null;
  assignmentTitle: string | null;
  senderId: string;
  senderName: string;
  senderRole: UserRole;
  recipientId: string;
  recipientName: string;
  body: string;
  isRead: boolean;
  createdAt: string;
}

export type NotificationType =
  | 'assignment_created'
  | 'assignment_modified'
  | 'assignment_canceled'
  | 'submission_received'
  | 'extension_requested'
  | 'extension_decision'
  | 'feedback_posted'
  | 'new_message';

export interface NotificationItem {
  id: string;
  userId: string;
  type: NotificationType;
  title: string;
  body: string;
  linkAssignmentId: string | null;
  isRead: boolean;
  createdAt: string;
}

export interface AuditLogEntry {
  id: string;
  actorId: string;
  actorName: string;
  actorRole: UserRole;
  action: string;
  targetType: string;
  targetId: string;
  details: string;
  createdAt: string;
}

export interface BootstrapPayload {
  currentUser: UserProfile;
  peers: UserProfile[];
  courses: Course[];
  assignments: Assignment[];
  submissions: Submission[];
  integrityReports: IntegrityReport[];
  reviews: SubmissionReview[];
  extensions: ExtensionRequest[];
  messages: PrivateMessage[];
  notifications: NotificationItem[];
  auditLogs: AuditLogEntry[];
}
