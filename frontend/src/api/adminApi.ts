import client from './client';

export interface PageResult<T> {
  content: T[];
  totalElements: number;
  totalPages: number;
  number: number;  // 현재 페이지 (0-based)
  size: number;
}

// ─── Dashboard ──────────────────────────────────────────────────────────────

export interface DeptStat {
  dept: string;
  completionRate: number;
}
export interface LowProgress {
  userId: number;
  name: string;
  department: string;
  role: string;
  completionRate: number;
}
export interface DeadlineAlert {
  courseId: number;
  title: string;
  deadline: string;
  notCompletedCount: number;
}
export interface AdminDashboardResponse {
  totalEmployees: number;
  totalCourses: number;
  notCompletedCount: number;
  overallCompletionRate: number;
  deptStats: DeptStat[];
  lowProgressList: LowProgress[];
  deadlineAlerts: DeadlineAlert[];
}

export const getAdminDashboard = (): Promise<AdminDashboardResponse> =>
  client.get('/api/admin/dashboard').then((r) => r.data);

// ─── Employees ──────────────────────────────────────────────────────────────

export interface EmployeeResponse {
  userId: number;
  employeeNo: string;
  name: string;
  email: string;
  departmentId: number | null;
  departmentName: string | null;
  position: string;
  empType: number; // 0=사무직, 1=현장직
  phone: string;
  hireDate: string;
  role: string;
  active: boolean;
  createdAt: string;
}
export interface EmployeeRequest {
  employeeNo: string;
  name: string;
  email: string;
  departmentId: number;
  position: string;
  empType: number;
  phone?: string;
  hireDate: string;
  role: string;
}

export const getEmployees = (keyword?: string): Promise<EmployeeResponse[]> =>
  client.get('/api/admin/employees', { params: keyword ? { keyword } : {} }).then((r) => {
    const d = r.data;
    return Array.isArray(d) ? d : (d.content ?? []);
  });

export const getEmployeesPaged = (keyword?: string, page = 0, size = 20): Promise<PageResult<EmployeeResponse>> =>
  client.get('/api/admin/employees', { params: { ...(keyword ? { keyword } : {}), page, size } }).then((r) => r.data);

export const createEmployee = (req: EmployeeRequest): Promise<EmployeeResponse> =>
  client.post('/api/admin/employees', req).then((r) => r.data);

export const updateEmployee = (id: number, req: EmployeeRequest): Promise<EmployeeResponse> =>
  client.put(`/api/admin/employees/${id}`, req).then((r) => r.data);

export const deleteEmployee = (id: number): Promise<void> =>
  client.delete(`/api/admin/employees/${id}`).then(() => undefined);

export const exportEmployeesExcel = (keyword?: string): Promise<Blob> =>
  client
    .get('/api/admin/employees/export', {
      params: keyword ? { keyword } : {},
      responseType: 'blob',
    })
    .then((r) => r.data);

// ─── Departments ─────────────────────────────────────────────────────────────

export interface Department {
  departmentId: number;
  name: string;
}

export const getDepartments = (): Promise<Department[]> =>
  client.get('/api/admin/departments').then((r) => r.data);

export const createDepartment = (name: string): Promise<Department> =>
  client.post('/api/admin/departments', { name }).then((r) => r.data);

// ─── Courses ─────────────────────────────────────────────────────────────────

export interface AdminCourseResponse {
  courseId: number;
  title: string;
  description: string;
  category: string;
  targetRole: number; // 0=전체, 1=현장직, 2=사무직
  durationMin: number | null;
  thumbnailUrl: string | null;
  active: boolean;
  createdAt: string;
}
export interface AdminCourseRequest {
  title: string;
  description: string;
  category: string;
  targetRole: number;
  durationMin?: number;
  thumbnailUrl?: string;
}

export const getAdminCourses = (): Promise<AdminCourseResponse[]> =>
  client.get('/api/admin/courses').then((r) => {
    const d = r.data;
    return Array.isArray(d) ? d : (d.content ?? []);
  });

export const getAdminCoursesPaged = (page = 0, size = 10): Promise<PageResult<AdminCourseResponse>> =>
  client.get('/api/admin/courses', { params: { page, size } }).then((r) => r.data);

export const createCourse = (req: AdminCourseRequest): Promise<AdminCourseResponse> =>
  client.post('/api/admin/courses', req).then((r) => r.data);

export const updateCourse = (id: number, req: AdminCourseRequest): Promise<AdminCourseResponse> =>
  client.put(`/api/admin/courses/${id}`, req).then((r) => r.data);

export const deleteCourse = (id: number): Promise<void> =>
  client.delete(`/api/admin/courses/${id}`).then(() => undefined);

// ─── Course Rounds (차수) ─────────────────────────────────────────────────────

export interface CourseRoundResponse {
  roundId: number;
  courseId: number;
  courseTitle: string;
  roundNo: number;
  startDate: string; // LocalDate → "YYYY-MM-DD"
  endDate: string;
  open: boolean;
  createdAt: string;
}
export interface CourseRoundRequest {
  roundNo: number;
  startDate: string;
  endDate: string;
}

export const getCourseRounds = (courseId: number): Promise<CourseRoundResponse[]> =>
  client.get(`/api/admin/courses/${courseId}/rounds`).then((r) => r.data);

export const createCourseRound = (courseId: number, req: CourseRoundRequest): Promise<CourseRoundResponse> =>
  client.post(`/api/admin/courses/${courseId}/rounds`, req).then((r) => r.data);

export const updateCourseRound = (courseId: number, roundId: number, req: CourseRoundRequest): Promise<CourseRoundResponse> =>
  client.put(`/api/admin/courses/${courseId}/rounds/${roundId}`, req).then((r) => r.data);

export const deleteCourseRound = (courseId: number, roundId: number): Promise<void> =>
  client.delete(`/api/admin/courses/${courseId}/rounds/${roundId}`).then(() => undefined);

// ─── Lectures (단원) ─────────────────────────────────────────────────────────

export interface LectureResponse {
  lectureId: number;
  courseId: number;
  title: string;
  description: string;
  sortOrder: number;
  createdAt: string;
}
export interface LectureRequest {
  title: string;
  description: string;
  sortOrder: number;
}

export const getLectures = (courseId: number): Promise<LectureResponse[]> =>
  client.get(`/api/admin/courses/${courseId}/lectures`).then((r) => r.data);

export const createLecture = (courseId: number, req: LectureRequest): Promise<LectureResponse> =>
  client.post(`/api/admin/courses/${courseId}/lectures`, req).then((r) => r.data);

export const updateLecture = (courseId: number, lectureId: number, req: LectureRequest): Promise<LectureResponse> =>
  client.put(`/api/admin/courses/${courseId}/lectures/${lectureId}`, req).then((r) => r.data);

export const deleteLecture = (courseId: number, lectureId: number): Promise<void> =>
  client.delete(`/api/admin/courses/${courseId}/lectures/${lectureId}`).then(() => undefined);

// ─── Videos (영상) ───────────────────────────────────────────────────────────

export interface VideoResponse {
  videoId: number;
  lectureId: number;
  title: string;
  videoUrl: string;
  durationSec: number;
  sortOrder: number;
  createdAt: string;
}
export interface VideoRequest {
  title: string;
  videoUrl: string;
  durationSec: number;
  sortOrder: number;
}

export const getVideos = (lectureId: number): Promise<VideoResponse[]> =>
  client.get(`/api/admin/lectures/${lectureId}/videos`).then((r) => r.data);

export const createVideo = (lectureId: number, req: VideoRequest): Promise<VideoResponse> =>
  client.post(`/api/admin/lectures/${lectureId}/videos`, req).then((r) => r.data);

export const updateVideo = (lectureId: number, videoId: number, req: VideoRequest): Promise<VideoResponse> =>
  client.put(`/api/admin/lectures/${lectureId}/videos/${videoId}`, req).then((r) => r.data);

export const deleteVideo = (lectureId: number, videoId: number): Promise<void> =>
  client.delete(`/api/admin/lectures/${lectureId}/videos/${videoId}`).then(() => undefined);

export const uploadVideo = (
  lectureId: number,
  file: File,
  title: string,
  sortOrder: number,
  onProgress?: (pct: number) => void,
): Promise<VideoResponse> => {
  const form = new FormData();
  form.append('file', file);
  form.append('title', title);
  form.append('sortOrder', String(sortOrder));
  return client.post(`/api/admin/lectures/${lectureId}/videos/upload`, form, {
    headers: { 'Content-Type': 'multipart/form-data' },
    onUploadProgress: (e) => {
      if (onProgress && e.total) onProgress(Math.round((e.loaded * 100) / e.total));
    },
  }).then((r) => r.data);
};

// ─── Quiz (단원 퀴즈) ────────────────────────────────────────────────────────

export interface ChoiceItem {
  choiceId?: number;
  choiceText: string;
  correct: boolean;
  sortOrder: number;
}
export interface QuestionItem {
  questionId?: number;
  questionText: string;
  score: number;
  sortOrder: number;
  choices: ChoiceItem[];
}
export interface QuizResponse {
  quizId: number;
  lectureId: number;
  lectureTitle: string;
  title: string;
  passScore: number;
  questions: QuestionItem[];
  createdAt: string;
}
export interface QuizRequest { title: string; passScore: number; }

export const getQuiz = (lectureId: number): Promise<QuizResponse | null> =>
  client.get(`/api/admin/lectures/${lectureId}/quiz`).then((r) => r.data).catch(() => null);

export const createQuiz = (lectureId: number, req: QuizRequest): Promise<QuizResponse> =>
  client.post(`/api/admin/lectures/${lectureId}/quiz`, req).then((r) => r.data);

export const updateQuiz = (lectureId: number, req: QuizRequest): Promise<QuizResponse> =>
  client.put(`/api/admin/lectures/${lectureId}/quiz`, req).then((r) => r.data);

export const deleteQuiz = (lectureId: number): Promise<void> =>
  client.delete(`/api/admin/lectures/${lectureId}/quiz`).then(() => undefined);

export const addQuizQuestion = (lectureId: number, req: QuestionItem): Promise<QuizResponse> =>
  client.post(`/api/admin/lectures/${lectureId}/quiz/questions`, req).then((r) => r.data);

export const updateQuizQuestion = (lectureId: number, questionId: number, req: QuestionItem): Promise<QuizResponse> =>
  client.put(`/api/admin/lectures/${lectureId}/quiz/questions/${questionId}`, req).then((r) => r.data);

export const deleteQuizQuestion = (lectureId: number, questionId: number): Promise<QuizResponse> =>
  client.delete(`/api/admin/lectures/${lectureId}/quiz/questions/${questionId}`).then((r) => r.data);

// ─── Exam (강좌 시험) ────────────────────────────────────────────────────────

export interface ExamResponse {
  examId: number;
  courseId: number;
  courseTitle: string;
  title: string;
  passScore: number;
  questions: QuestionItem[];
  createdAt: string;
}
export interface ExamRequest { title: string; passScore: number; }

export const getExam = (courseId: number): Promise<ExamResponse | null> =>
  client.get(`/api/admin/courses/${courseId}/exam`).then((r) => r.data).catch(() => null);

export const createExam = (courseId: number, req: ExamRequest): Promise<ExamResponse> =>
  client.post(`/api/admin/courses/${courseId}/exam`, req).then((r) => r.data);

export const updateExam = (courseId: number, req: ExamRequest): Promise<ExamResponse> =>
  client.put(`/api/admin/courses/${courseId}/exam`, req).then((r) => r.data);

export const deleteExam = (courseId: number): Promise<void> =>
  client.delete(`/api/admin/courses/${courseId}/exam`).then(() => undefined);

export const addExamQuestion = (courseId: number, req: QuestionItem): Promise<ExamResponse> =>
  client.post(`/api/admin/courses/${courseId}/exam/questions`, req).then((r) => r.data);

export const updateExamQuestion = (courseId: number, questionId: number, req: QuestionItem): Promise<ExamResponse> =>
  client.put(`/api/admin/courses/${courseId}/exam/questions/${questionId}`, req).then((r) => r.data);

export const deleteExamQuestion = (courseId: number, questionId: number): Promise<ExamResponse> =>
  client.delete(`/api/admin/courses/${courseId}/exam/questions/${questionId}`).then((r) => r.data);

// ─── Enrollments (이수 현황) ─────────────────────────────────────────────────

export interface EnrollmentResponse {
  enrollmentId: number;
  userId: number;
  userName: string;
  department: string;
  courseId: number;
  courseTitle: string;
  roundId: number;
  roundNo: number;
  progress: number;
  approvalStatus: string; // PENDING | APPROVED | REJECTED
  status: string;         // IN_PROGRESS | COMPLETED | DROPPED
  enrolledAt: string;
  completedAt: string | null;
}

export interface EnrollmentFilter {
  filter?: string;
  dept?: string;
  category?: string;
  role?: number;
}

export const getEnrollments = (params?: EnrollmentFilter): Promise<EnrollmentResponse[]> =>
  client.get('/api/admin/enrollments', { params }).then((r) => {
    const d = r.data;
    return Array.isArray(d) ? d : (d.content ?? []);
  });

export const getEnrollmentsPaged = (params?: EnrollmentFilter, page = 0, size = 20): Promise<PageResult<EnrollmentResponse>> =>
  client.get('/api/admin/enrollments', { params: { ...params, page, size } }).then((r) => r.data);

export const getPendingEnrollments = (): Promise<EnrollmentResponse[]> =>
  client.get('/api/admin/enrollments/pending').then((r) => r.data);

export const approveEnrollment = (enrollmentId: number): Promise<EnrollmentResponse> =>
  client.put(`/api/admin/enrollments/${enrollmentId}/approve`).then((r) => r.data);

export const rejectEnrollment = (enrollmentId: number): Promise<EnrollmentResponse> =>
  client.put(`/api/admin/enrollments/${enrollmentId}/reject`).then((r) => r.data);

export const exportEnrollmentsExcel = (params?: EnrollmentFilter): Promise<Blob> =>
  client
    .get('/api/admin/enrollments/export', { params, responseType: 'blob' })
    .then((r) => r.data);

// ─── Notices ─────────────────────────────────────────────────────────────────

export interface NoticeResponse {
  noticeId: number;
  title: string;
  content: string;
  authorName: string;
  viewCount: number;
  createdAt: string;
  updatedAt: string;
}
export interface NoticeRequest {
  title: string;
  content: string;
}

export const getNotices = (): Promise<NoticeResponse[]> =>
  client.get('/api/admin/notices').then((r) => r.data);

export const getNotice = (id: number): Promise<NoticeResponse> =>
  client.get(`/api/admin/notices/${id}`).then((r) => r.data);

export const createNotice = (req: NoticeRequest): Promise<NoticeResponse> =>
  client.post('/api/admin/notices', req).then((r) => r.data);

export const updateNotice = (id: number, req: NoticeRequest): Promise<NoticeResponse> =>
  client.put(`/api/admin/notices/${id}`, req).then((r) => r.data);

export const deleteNotice = (id: number): Promise<void> =>
  client.delete(`/api/admin/notices/${id}`).then(() => undefined);

// ─── Q&A (질문 답변 관리) ──────────────────────────────────────────────────────

export interface QnaAnswerItem {
  answerId: number;
  questionId: number;
  authorId: number;
  authorName: string;
  content: string;
  createdAt: string;
  updatedAt: string;
}

export interface QnaQuestionItem {
  questionId: number;
  courseId: number;
  courseTitle: string;
  userId: number;
  userName: string;
  title: string;
  content: string;
  resolved: boolean;
  answerCount: number;
  answers: QnaAnswerItem[];
  createdAt: string;
  updatedAt: string;
}

export const getAdminQna = (unansweredOnly = false): Promise<QnaQuestionItem[]> =>
  client.get('/api/admin/qna', { params: { unansweredOnly } }).then((r) => r.data);

export const getAdminQnaOne = (questionId: number): Promise<QnaQuestionItem> =>
  client.get(`/api/admin/qna/${questionId}`).then((r) => r.data);

export const addQnaAnswer = (questionId: number, content: string): Promise<QnaAnswerItem> =>
  client.post(`/api/admin/qna/${questionId}/answer`, { content }).then((r) => r.data);

export const updateQnaAnswer = (answerId: number, content: string): Promise<QnaAnswerItem> =>
  client.put(`/api/admin/qna/answer/${answerId}`, { content }).then((r) => r.data);

export const deleteQnaAnswer = (answerId: number): Promise<void> =>
  client.delete(`/api/admin/qna/answer/${answerId}`).then(() => undefined);

export const resolveQnaQuestion = (questionId: number): Promise<QnaQuestionItem> =>
  client.put(`/api/admin/qna/${questionId}/resolve`).then((r) => r.data);

// ─── 시험 응시 현황 ───────────────────────────────────────────────────────────

import type { AdminAttemptItem, AdminExamStats, AdminCertificateItem, UserVideoProgress } from './types';

export const getExamAttempts = (courseId: number): Promise<AdminAttemptItem[]> =>
  client.get(`/api/admin/attempts/course/${courseId}/exam`).then((r) => r.data);

export const getExamStats = (courseId: number): Promise<AdminExamStats> =>
  client.get(`/api/admin/attempts/course/${courseId}/exam/stats`).then((r) => r.data);

export const getUserAttempts = (userId: number): Promise<AdminAttemptItem[]> =>
  client.get(`/api/admin/attempts/user/${userId}`).then((r) => r.data);

// ─── 이수증 관리 ─────────────────────────────────────────────────────────────

export const getAdminCertificates = (): Promise<AdminCertificateItem[]> =>
  client.get('/api/admin/certificates').then((r) => r.data);

export const generateCertificateManual = (userId: number, courseId: number): Promise<{ certificateId: number; message: string }> =>
  client.post('/api/admin/certificates/generate', { userId, courseId }).then((r) => r.data);

export const deleteAdminCertificate = (id: number): Promise<void> =>
  client.delete(`/api/admin/certificates/${id}`).then(() => undefined);

// ─── 알림 브로드캐스트 ────────────────────────────────────────────────────────

export const broadcastNotification = (message: string, userIds?: number[]): Promise<{ sentCount: number }> =>
  client.post('/api/admin/notifications/broadcast', { message, userIds }).then((r) => r.data);

export const getAdminNotifications = (type?: string): Promise<import('./types').NotificationItem[]> =>
  client.get('/api/admin/notifications', { params: type ? { type } : {} }).then((r) => r.data);

// ─── 영상 진도 상세 ───────────────────────────────────────────────────────────

export const getEnrollmentProgress = (enrollmentId: number): Promise<UserVideoProgress> =>
  client.get(`/api/admin/progress/enrollments/${enrollmentId}`).then((r) => r.data);

export const getUserProgress = (userId: number): Promise<UserVideoProgress[]> =>
  client.get(`/api/admin/progress/users/${userId}`).then((r) => r.data);

// ─── 이수 통계 ────────────────────────────────────────────────────────────────

export interface EnrollmentStatistics {
  total: number;
  notStarted: number;
  inProgress: number;
  completed: number;
}

export const getEnrollmentStatistics = (): Promise<EnrollmentStatistics> =>
  client.get('/api/admin/enrollments/statistics').then((r) => r.data);

// ─── 직원별 수강 현황 ──────────────────────────────────────────────────────────

export const getEnrollmentsByUser = (userId: number): Promise<EnrollmentResponse[]> =>
  client.get(`/api/admin/enrollments/user/${userId}`).then((r) => r.data);
