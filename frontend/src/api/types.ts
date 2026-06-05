// 공통 응답 래퍼
export interface CommonResponse<T> {
  success: boolean;
  message: string;
  data: T;
}

// 페이지네이션
export interface Page<T> {
  content: T[];
  totalElements: number;
  totalPages: number;
  number: number; // 현재 페이지 (0-based)
  size: number;
  last: boolean;
}

// 대시보드
export interface DashboardCourseItem {
  courseId: number;
  title: string;
  thumbnailURL: string | null;
  progress: number;
  status: string;
  deadline: string | null;
}

export interface DashboardNoticeItem {
  noticeId: number;
  title: string;
  contentPreview: string;
  isPinned: boolean;
}

export interface DashboardResponse {
  userName: string;
  currentCoursesCount: number;
  completedCoursesCount: number;
  overallCompletionRate: number;
  inProgressCourses: DashboardCourseItem[];
  mandatoryCoursesStatus: DashboardCourseItem[];
  recentNotices: DashboardNoticeItem[];
  unreadNotificationsCount: number;
}

// 강좌
export interface CourseListItem {
  courseId: number;
  title: string;
  description: string;
  category: string;
  thumbnailUrl: string | null;
  durationMin: number | null;
  roundId: number | null;
  roundNo: number | null;
  startDate: string | null;
  endDate: string | null;
  enrollmentStatus: string | null; // NOT_ENROLLED | NOT_STARTED | IN_PROGRESS | DONE
}

export interface CourseVideoItem {
  videoId: number;
  title: string;
  videoURL: string;
  durationSec: number;
  sortOrder: number;
}

export interface CourseDetailResponse {
  courseId: number;
  title: string;
  description: string;
  category: string;
  targetRole: string;
  durationMin: number;
  thumbnailURL: string | null;
  deadline: string | null;
  isActive: boolean;
  myEnrollmentStatus: {
    enrollmentId: number;
    progress: number;
    status: string;
    userId: number;
  } | null;
  videos: CourseVideoItem[];
}

// 내 강좌
export interface MyCourseResponse {
  enrollmentId: number;
  courseId: number;
  courseTitle: string;
  courseThumbnailUrl: string | null;
  progress: number;
  status: string;
  deadline: string | null;
  enrolledAt: string;
  completedAt: string | null;
}

export interface MyCourseVideoStatus {
  videoId: number;
  lectureId: number;   // 단원 퀴즈 조회용
  title: string;
  videoURL: string;
  durationSec: number;
  sortOrder: number;
  watchedSec: number;
  isCompleted: boolean;
}

export interface MyCourseDetailResponse {
  enrollmentId: number;
  courseId: number;
  courseTitle: string;
  courseDescription: string;
  courseCategory: string;
  courseThumbnailUrl: string | null;
  currentProgress: number;
  currentStatus: string;
  courseDeadline: string | null;
  enrolledAt: string;
  completedAt: string | null;
  videos: MyCourseVideoStatus[];
}

// 영상
export interface VideoListResponse {
  courseId: number;
  courseTitle: string;
  videos: VideoItem[];
}

export interface VideoItem {
  videoId: number;
  title: string;
  videoURL: string;
  durationSec: number;
  sortOrder: number;
  watchedSec: number;
  isCompleted: boolean;
}

// 퀴즈/시험
export interface ChoiceItem {
  choiceId: number;
  choiceText: string;
  sortOrder: number;
}

export interface QuestionItem {
  questionId: number;
  questionText: string;
  score: number;
  sortOrder: number;
  choices: ChoiceItem[];
}

export interface AssessmentResponse {
  id: number;
  type: string;
  title: string;
  passScore: number;
  questions: QuestionItem[];
}

export interface AttemptResponse {
  attemptId: number;
  type: string;
  targetId: number;
  score: number;
  passed: boolean;
  attemptedAt: string;
}

// 마이페이지
export interface MypageCertificateItem {
  certificateId: number;
  courseTitle: string;
  fileURL: string;
}

export interface MypageResponse {
  userId: number;
  employeeNo: string;
  name: string;
  email: string;
  departmentName: string;
  position: string;
  empType: string;
  hireDate: string;
  overallCompletionRate: number;
  completedCoursesCount: number;
  certificates: MypageCertificateItem[];
}

// 이수증
export interface CertificateResponse {
  certificateId: number;
  courseId: number;
  courseTitle: string;
  issuedAt: string;
  fileURL: string;
}

// 공지사항
export interface NoticeListItem {
  noticeId: number;
  title: string;
  contentPreview: string;
  viewCount: number;
  isPinned: boolean;
  createdAt: string;
}

export interface NoticeDetail {
  noticeId: number;
  title: string;
  content: string;
  viewCount: number;
  isPinned: boolean;
  createdAt: string;
  updatedAt: string;
}

// 알림
export interface NotificationItem {
  notificationId: number;
  type: string;  // ENROLLMENT_APPROVED | ENROLLMENT_REJECTED | CERTIFICATE_ISSUED | COURSE_DEADLINE | COURSE_STARTED | SYSTEM
  message: string;
  enrollmentId: number | null;
  read: boolean;
  createdAt: string;
}

// 피드백
export interface FeedbackResponse {
  feedbackId: number;
  enrollmentId: number;
  rating: number;
  comment: string;
  createdAt: string;
}

// QnA
export interface QnaResponse {
  questionId: number;
  courseId: number;
  courseTitle: string;
  title: string;
  content: string;
  resolved: boolean;
  createdAt: string;
  answers: { answerId: number; authorName: string; content: string; createdAt: string }[];
}

// 수강 이력 (enrollment)
export interface EnrollmentHistoryItem {
  enrollmentId: number;
  userId: number;
  userName: string;
  department: string;
  courseId: number;
  courseTitle: string;
  roundId: number;
  roundNo: number;
  progress: number;
  approvalStatus: string;
  status: string; // IN_PROGRESS | DONE | NOT_STARTED
  enrolledAt: string;
  completedAt: string | null;
}

// 수강 캘린더
export interface CalendarItem {
  roundId: number;
  courseId: number;
  courseTitle: string;
  category: string;
  startDate: string;
  endDate: string;
  roundNo: number | null;
  enrollmentId: number | null;
  myStatus: string | null; // IN_PROGRESS | DONE | NOT_STARTED | NONE
  myProgress: number | null;
}

// 관리자 시험 응시
export interface AdminAttemptItem {
  attemptId: number;
  userId: number;
  employeeNo: string;
  userName: string;
  score: number;
  passed: boolean;
  attemptedAt: string;
}

export interface AdminExamStats {
  totalAttempts: number;
  passedCount: number;
  failedCount: number;
  passRate: number;
  averageScore: number;
}

// 관리자 이수증
export interface AdminCertificateItem {
  certificateId: number;
  userId: number;
  employeeNo: string;
  userName: string;
  departmentName: string | null;
  courseId: number;
  courseTitle: string;
  roundNo: number;
  issuedAt: string;
  fileUrl: string;
}

// 관리자 영상 진도 상세
export interface VideoProgressDetail {
  videoId: number;
  title: string;
  durationSec: number;
  watchedSec: number;
  completed: boolean;
}
export interface LectureProgressDetail {
  lectureId: number;
  lectureTitle: string;
  completed: boolean;
  videos: VideoProgressDetail[];
}
export interface UserVideoProgress {
  userId: number;
  employeeNo: string;
  userName: string;
  departmentName: string | null;
  enrollmentId: number;
  courseTitle: string;
  enrollmentProgress: number;
  lectures: LectureProgressDetail[];
  totalLectures: number;
  completedLectures: number;
}
