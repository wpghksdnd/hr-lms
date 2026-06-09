package com.hr.backend.domain.enrollment.service;

import com.hr.backend.admin.dto.EnrollmentResponse;
import com.hr.backend.domain.course.entity.CourseRound;
import com.hr.backend.domain.course.entity.Lecture;
import com.hr.backend.domain.course.repository.CourseRoundRepository;
import com.hr.backend.domain.enrollment.entity.Enrollment;
import com.hr.backend.domain.enrollment.repository.EnrollmentRepository;
import com.hr.backend.domain.notification.service.NotificationService;
import com.hr.backend.domain.quiz.repository.AttemptRepository;
import com.hr.backend.domain.quiz.repository.ExamRepository;
import com.hr.backend.domain.quiz.repository.QuizRepository;
import com.hr.backend.domain.user.entity.User;
import com.hr.backend.domain.user.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;
import java.util.Arrays;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;

@Service
@RequiredArgsConstructor
@Transactional(readOnly = true)
public class EnrollmentService {

    private final EnrollmentRepository  enrollmentRepository;
    private final UserRepository        userRepository;
    private final CourseRoundRepository courseRoundRepository;
    private final NotificationService        notificationService;
    private final AttemptRepository          attemptRepository;
    private final ExamRepository             examRepository;
    private final QuizRepository             quizRepository;
    private final CertificateWorkflowService certificateWorkflowService;

    /** 승인 대기 중인 수강 신청 목록 (관리자 승인 화면용) */
    public List<EnrollmentResponse> getPendingEnrollments() {
        return enrollmentRepository.findAllPending().stream()
                .map(EnrollmentResponse::new)
                .toList();
    }

    /** 전체 이수 현황 조회 (관리자용) */
    public List<EnrollmentResponse> getAll() {
        return enrollmentRepository.findAllWithUserAndCourse().stream()
                .map(EnrollmentResponse::new)
                .toList();
    }

    /** 전체 이수 현황 페이지네이션 조회 (관리자용) */
    public Page<EnrollmentResponse> getAllPaged(int page, int size) {
        var pageable = PageRequest.of(page, size, Sort.by(Sort.Direction.DESC, "enrollmentId"));
        return enrollmentRepository.findAllWithUserAndCoursePaged(pageable).map(EnrollmentResponse::new);
    }

    /** 필터 + 페이지네이션 통합 조회 */
    public Page<EnrollmentResponse> getFilteredPaged(
            String filter, String dept, String category, Integer role, int page, int size) {
        boolean onlyIncomplete = "incomplete".equalsIgnoreCase(filter);
        String deptParam     = (dept     != null && !dept.isBlank())     ? dept     : null;
        String categoryParam = (category != null && !category.isBlank()) ? category : null;
        var pageable = PageRequest.of(page, size, Sort.by(Sort.Direction.DESC, "enrollmentId"));
        return enrollmentRepository.findFilteredPaged(deptParam, categoryParam, onlyIncomplete, role, pageable)
                .map(EnrollmentResponse::new);
    }

    
    /**
     * 수강신청 취소 — 수강 레코드 삭제 (이수 완료 강좌는 취소 불가)
     */
    @Transactional
    public void cancelEnrollment(Long enrollmentId) {
        Enrollment enrollment = enrollmentRepository.findById(enrollmentId)
                .orElseThrow(() -> new IllegalArgumentException("존재하지 않는 수강 내역입니다."));
        if (enrollment.getStatus() == Enrollment.Status.DONE) {
            throw new IllegalStateException("이수 완료된 강좌는 취소할 수 없습니다.");
        }
        enrollmentRepository.delete(enrollment);
    }
    /**
     * 복합 필터 이수 현황 조회 — 조건들을 AND로 조합한다.
     *
     * @param filter   "incomplete" → 미이수자만, 그 외/null → 전체
     * @param dept     부서명 필터 (null이면 전체)
     * @param category 카테고리 필터 (법정의무교육 / 직무교육, null이면 전체)
     * @param role     대상직군 필터 (1=현장직, 2=사무직, null이면 전체)
     */
    public List<EnrollmentResponse> getFiltered(
            String filter, String dept, String category, Integer role) {
        boolean onlyIncomplete = "incomplete".equalsIgnoreCase(filter);
        String deptParam     = (dept     != null && !dept.isBlank())     ? dept     : null;
        String categoryParam = (category != null && !category.isBlank()) ? category : null;
        return enrollmentRepository.findFiltered(deptParam, categoryParam, onlyIncomplete, role)
                .stream()
                .map(EnrollmentResponse::new)
                .toList();
    }

    /** 특정 직원 이수 현황 */
    public List<EnrollmentResponse> getByUser(Long userId) {
        return enrollmentRepository.findAllByUserId(userId).stream()
                .map(EnrollmentResponse::new)
                .toList();
    }

    /** 특정 직원 이수 이력 (완료된 강좌만) */
    public List<EnrollmentResponse> getHistoryByUser(Long userId) {
        return enrollmentRepository.findAllByUserId(userId).stream()
                .filter(e -> e.getStatus() == Enrollment.Status.DONE)
                .map(EnrollmentResponse::new)
                .toList();
    }

    /** 특정 차수 수강자 현황 */
    public List<EnrollmentResponse> getByCourse(Long courseId) {
        return enrollmentRepository.findAllByCourseId(courseId).stream()
                .map(EnrollmentResponse::new)
                .toList();
    }

    /** 수강 등록 (관리자용 - 차수 기반, 신청 즉시 APPROVED + IN_PROGRESS) */
    @Transactional
    public EnrollmentResponse enroll(Long userId, Long roundId) {
        if (enrollmentRepository.existsByUser_UserIdAndRound_RoundId(userId, roundId)) {
            throw new IllegalArgumentException("이미 수강 등록된 차수입니다.");
        }
        User user = userRepository.findById(userId)
                .orElseThrow(() -> new IllegalArgumentException("직원을 찾을 수 없습니다."));
        CourseRound round = courseRoundRepository.findById(roundId)
                .orElseThrow(() -> new IllegalArgumentException("차수를 찾을 수 없습니다."));

        Enrollment enrollment = Enrollment.builder()
                .user(user)
                .round(round)
                .build();
        enrollment.approve();
        enrollment.changeStatus(Enrollment.Status.IN_PROGRESS);
        return new EnrollmentResponse(enrollmentRepository.save(enrollment));
    }

    /** 수강 신청 (사용자용 - 신청 즉시 자동 승인 + IN_PROGRESS, 관리자 승인 절차 없음) */
    @Transactional
    public EnrollmentResponse applyEnrollment(Long userId, Long roundId) {
        if (enrollmentRepository.existsByUser_UserIdAndRound_RoundId(userId, roundId)) {
            throw new IllegalArgumentException("이미 수강 신청된 차수입니다.");
        }
        User user = userRepository.findById(userId)
                .orElseThrow(() -> new IllegalArgumentException("직원을 찾을 수 없습니다."));
        CourseRound round = courseRoundRepository.findById(roundId)
                .orElseThrow(() -> new IllegalArgumentException("차수를 찾을 수 없습니다."));

        Enrollment enrollment = Enrollment.builder()
                .user(user)
                .round(round)
                .build();
        enrollment.approve();                                    // approvalStatus = APPROVED, approvedAt = now()
        enrollment.changeStatus(Enrollment.Status.IN_PROGRESS);  // 바로 수강 시작
        return new EnrollmentResponse(enrollmentRepository.save(enrollment));
    }

    /** 진행률 업데이트 */
    @Transactional
    public EnrollmentResponse updateProgress(Long enrollmentId, int progress) {
        Enrollment enrollment = findEnrollmentOrThrow(enrollmentId);
        enrollment.updateProgress(progress);
        return new EnrollmentResponse(enrollment);
    }

    /** 진행률 업데이트 (소유자/관리자 검증 포함) */
    @Transactional
    public EnrollmentResponse updateProgressForActor(Long enrollmentId, int progress, Long actorUserId, boolean actorIsAdmin) {
        Enrollment enrollment = getAccessibleEnrollment(enrollmentId, actorUserId, actorIsAdmin);
        enrollment.updateProgress(progress);
        return new EnrollmentResponse(enrollment);
    }

    /** 수강 상세 조회 */
    public EnrollmentResponse getEnrollmentById(Long enrollmentId) {
        Enrollment enrollment = findEnrollmentOrThrow(enrollmentId);
        return new EnrollmentResponse(enrollment);
    }

    /** 수강 상세 조회 (소유자/관리자 검증 포함) */
    public EnrollmentResponse getEnrollmentByIdForActor(Long enrollmentId, Long actorUserId, boolean actorIsAdmin) {
        Enrollment enrollment = getAccessibleEnrollment(enrollmentId, actorUserId, actorIsAdmin);
        return new EnrollmentResponse(enrollment);
    }

    /** 수강 완료 처리 (조건부) */
    @Transactional
    public EnrollmentResponse completeEnrollment(Long enrollmentId) {
        Enrollment enrollment = findEnrollmentOrThrow(enrollmentId);
        // 이미 이수 완료된 경우 재검증 없이 반환 (재시험 시 불필요한 실패 방지)
        if (enrollment.getStatus() == Enrollment.Status.DONE) {
            return new EnrollmentResponse(enrollment);
        }
        validateCompletionRequirements(enrollment);

        // 모든 조건을 만족하면 완료 처리
        enrollment.changeStatus(Enrollment.Status.DONE);
        enrollment.updateProgress(100);
        certificateWorkflowService.triggerCompletionWorkflow(enrollment);
        return new EnrollmentResponse(enrollment);
    }

    /** 수강 완료 처리 (소유자/관리자 검증 포함) */
    @Transactional
    public EnrollmentResponse completeEnrollmentForActor(Long enrollmentId, Long actorUserId, boolean actorIsAdmin) {
        Enrollment enrollment = getAccessibleEnrollment(enrollmentId, actorUserId, actorIsAdmin);
        validateCompletionRequirements(enrollment);

        // 모든 조건을 만족하면 완료 처리
        enrollment.changeStatus(Enrollment.Status.DONE);
        enrollment.updateProgress(100);
        certificateWorkflowService.triggerCompletionWorkflow(enrollment);
        return new EnrollmentResponse(enrollment);
    }

    /** 수강 상세/변경 API 공통 접근 검증 */
    public void validateEnrollmentAccess(Long enrollmentId, Long actorUserId, boolean actorIsAdmin) {
        getAccessibleEnrollment(enrollmentId, actorUserId, actorIsAdmin);
    }

    private Enrollment findEnrollmentOrThrow(Long enrollmentId) {
        return enrollmentRepository.findById(enrollmentId)
                .orElseThrow(() -> new IllegalArgumentException("존재하지 않는 수강 내역입니다."));
    }

    private Enrollment getAccessibleEnrollment(Long enrollmentId, Long actorUserId, boolean actorIsAdmin) {
        Enrollment enrollment = findEnrollmentOrThrow(enrollmentId);
        if (!actorIsAdmin && !enrollment.getUser().getUserId().equals(actorUserId)) {
            throw new IllegalArgumentException("본인 수강 정보만 조회/수정할 수 있습니다.");
        }
        return enrollment;
    }

    private void validateCompletionRequirements(Enrollment enrollment) {
        Long userId = enrollment.getUser().getUserId();
        Long courseId = enrollment.getRound().getCourse().getCourseId();
        
        // 조건 1: 진도율 80% 이상 확인
        if (enrollment.getProgress() < 80) {
            throw new IllegalArgumentException("진도율 80% 이상이어야 이수 처리가 가능합니다. 현재 진도율: " + enrollment.getProgress() + "%");
        }

        // 조건 2: 시험이 존재하면 통과 필수
        if (examRepository.existsByCourse_CourseId(courseId)
                && !attemptRepository.existsByUser_UserIdAndExam_Course_CourseIdAndPassedTrue(userId, courseId)) {
            throw new IllegalArgumentException("최종 시험 합격 후 이수 처리할 수 있습니다.");
        }

        // 조건 3: 강의별 퀴즈가 존재하면 모두 통과 필수
        for (Lecture lecture : enrollment.getRound().getCourse().getLectures()) {
            Long lectureId = lecture.getLectureId();
            if (quizRepository.existsByLecture_LectureId(lectureId)
                    && !attemptRepository.existsByUser_UserIdAndQuiz_Lecture_LectureIdAndPassedTrue(userId, lectureId)) {
                throw new IllegalArgumentException("필수 퀴즈를 모두 합격해야 이수 처리할 수 있습니다.");
            }
        }
    }

    /** 수강 상태 변경 */
    @Transactional
    public EnrollmentResponse changeEnrollmentStatus(Long enrollmentId, String status) {
        Enrollment enrollment = enrollmentRepository.findById(enrollmentId)
                .orElseThrow(() -> new IllegalArgumentException("존재하지 않는 수강 내역입니다."));
        try {
            Enrollment.Status newStatus = Enrollment.Status.valueOf(status);
            enrollment.changeStatus(newStatus);
        } catch (IllegalArgumentException e) {
            throw new IllegalArgumentException("유효하지 않은 상태값입니다. 유효한 값: "
                    + Arrays.toString(Enrollment.Status.values()));
        }
        return new EnrollmentResponse(enrollment);
    }

    /** 수강중인 교육 조회 */
    public List<EnrollmentResponse> getOngoingEnrollments(Long userId) {
        return enrollmentRepository.findAllByUserId(userId).stream()
                .filter(e -> e.getStatus() == Enrollment.Status.IN_PROGRESS)
                .map(EnrollmentResponse::new)
                .toList();
    }

    /** 수강 통계 조회 */
    public Map<String, Object> getEnrollmentStatistics() {
        Map<String, Object> stats = new HashMap<>();
        stats.put("total",      enrollmentRepository.count());
        stats.put("notStarted", enrollmentRepository.countByStatus(Enrollment.Status.NOT_STARTED));
        stats.put("inProgress", enrollmentRepository.countByStatus(Enrollment.Status.IN_PROGRESS));
        stats.put("completed",  enrollmentRepository.countByStatus(Enrollment.Status.DONE));
        return stats;
    }

    /** 차수 일정 변경 (마감일 업데이트) */
    @Transactional
    public CourseRound updateRoundSchedule(Long roundId, LocalDate endDate) {
        CourseRound round = courseRoundRepository.findById(roundId)
                .orElseThrow(() -> new IllegalArgumentException("차수를 찾을 수 없습니다."));
        round.update(round.getStartDate(), endDate);
        return courseRoundRepository.save(round);
    }

    // ──────────────────────────────────────────────────────────
    // 수강 신청 승인 / 반려 (관리자용, 알림 자동 발송)
    // ──────────────────────────────────────────────────────────

    /**
     * 수강 신청 승인.
     * ApprovalStatus → APPROVED, Status → IN_PROGRESS
     * 해당 직원에게 알림 생성.
     */
    @Transactional
    public EnrollmentResponse approveEnrollment(Long enrollmentId) {
        Enrollment enrollment = enrollmentRepository.findById(enrollmentId)
                .orElseThrow(() -> new IllegalArgumentException("수강 정보를 찾을 수 없습니다."));

        if (enrollment.getApprovalStatus() == Enrollment.ApprovalStatus.APPROVED) {
            throw new IllegalStateException("이미 승인된 수강 신청입니다.");
        }

        enrollment.approve();
        enrollment.changeStatus(Enrollment.Status.IN_PROGRESS);

        String courseTitle = enrollment.getRound().getCourse().getTitle();
        notificationService.notifyEnrollmentApproved(
                enrollment.getUser(), courseTitle, enrollment.getEnrollmentId());

        return new EnrollmentResponse(enrollment);
    }

    /**
     * 수강 신청 반려.
     * ApprovalStatus → REJECTED
     * 해당 직원에게 알림 생성.
     */
    @Transactional
    public EnrollmentResponse rejectEnrollment(Long enrollmentId) {
        Enrollment enrollment = enrollmentRepository.findById(enrollmentId)
                .orElseThrow(() -> new IllegalArgumentException("수강 정보를 찾을 수 없습니다."));

        if (enrollment.getApprovalStatus() == Enrollment.ApprovalStatus.REJECTED) {
            throw new IllegalStateException("이미 반려된 수강 신청입니다.");
        }

        enrollment.reject();

        String courseTitle = enrollment.getRound().getCourse().getTitle();
        notificationService.notifyEnrollmentRejected(
                enrollment.getUser(), courseTitle, enrollment.getEnrollmentId());

        return new EnrollmentResponse(enrollment);
    }
}
