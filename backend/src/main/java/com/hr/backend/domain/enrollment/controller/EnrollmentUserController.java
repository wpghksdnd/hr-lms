package com.hr.backend.domain.enrollment.controller;

import com.hr.backend.admin.dto.EnrollmentResponse;
import com.hr.backend.domain.enrollment.dto.EnrollmentCalendarResponse;
import com.hr.backend.domain.enrollment.dto.EnrollmentScheduleResponse;
import com.hr.backend.domain.enrollment.dto.FeedbackRequest;
import com.hr.backend.domain.enrollment.dto.FeedbackResponse;
import com.hr.backend.domain.enrollment.entity.Enrollment;
import com.hr.backend.domain.enrollment.repository.EnrollmentRepository;
import com.hr.backend.domain.enrollment.service.EnrollmentCalendarService;
import com.hr.backend.domain.enrollment.service.EnrollmentService;
import com.hr.backend.domain.enrollment.service.FeedbackService;
import com.hr.backend.employee.util.CurrentUserProvider;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.web.bind.annotation.*;

import java.time.format.DateTimeFormatter;
import java.util.List;

@RestController
@RequestMapping("/api/user/enrollments")
@RequiredArgsConstructor
public class EnrollmentUserController {

    private final EnrollmentService         enrollmentService;
    private final EnrollmentCalendarService enrollmentCalendarService;
    private final FeedbackService           feedbackService;
    private final EnrollmentRepository      enrollmentRepository;
    private final CurrentUserProvider       currentUserProvider;

    private static final DateTimeFormatter DATE_FORMATTER = DateTimeFormatter.ofPattern("yyyy-MM-dd");

    @PostMapping
    public ResponseEntity<EnrollmentResponse> applyEnrollment(@RequestParam Long roundId) {
        return ResponseEntity.ok(enrollmentService.applyEnrollment(currentUserProvider.getCurrentUserId(), roundId));
    }

    @DeleteMapping("/cancel/{enrollmentId}")
    public ResponseEntity<Void> cancelEnrollment(@PathVariable Long enrollmentId) {
        Long loginUserId = currentUserProvider.getCurrentUserId();
        Enrollment enrollment = findEnrollmentWithRound(enrollmentId);
        if (!enrollment.getUser().getUserId().equals(loginUserId) && !isAdmin()) {
            throw new IllegalArgumentException("본인 또는 관리자만 취소할 수 있습니다.");
        }
        enrollmentService.cancelEnrollment(enrollmentId);
        return ResponseEntity.noContent().build();
    }

    @GetMapping("/history")
    public ResponseEntity<List<EnrollmentResponse>> enrollmentHistory() {
        return ResponseEntity.ok(enrollmentService.getHistoryByUser(currentUserProvider.getCurrentUserId()));
    }

    @GetMapping("/all")
    public ResponseEntity<List<EnrollmentResponse>> getALLEnrollmentsByUser() {
        return ResponseEntity.ok(enrollmentService.getByUser(currentUserProvider.getCurrentUserId()));
    }

    @GetMapping("/ongoing")
    public ResponseEntity<List<EnrollmentResponse>> getOngoingEnrollments() {
        return ResponseEntity.ok(enrollmentService.getOngoingEnrollments(currentUserProvider.getCurrentUserId()));
    }

    @GetMapping("/history/{userId}")
    public ResponseEntity<List<EnrollmentResponse>> enrollmentHistoryLegacy(@PathVariable Long userId) {
        if (!isAdmin() && !currentUserProvider.getCurrentUserId().equals(userId))
            throw new IllegalArgumentException("본인 수강 이력만 조회할 수 있습니다.");
        return ResponseEntity.ok(enrollmentService.getHistoryByUser(userId));
    }

    @GetMapping("/all/{userId}")
    public ResponseEntity<List<EnrollmentResponse>> getALLEnrollmentsByUserLegacy(@PathVariable Long userId) {
        if (!isAdmin() && !currentUserProvider.getCurrentUserId().equals(userId))
            throw new IllegalArgumentException("본인 전체 수강 내역만 조회할 수 있습니다.");
        return ResponseEntity.ok(enrollmentService.getByUser(userId));
    }

    @GetMapping("/ongoing/{userId}")
    public ResponseEntity<List<EnrollmentResponse>> getOngoingEnrollmentsLegacy(@PathVariable Long userId) {
        if (!isAdmin() && !currentUserProvider.getCurrentUserId().equals(userId))
            throw new IllegalArgumentException("본인 수강중인 교육만 조회할 수 있습니다.");
        return ResponseEntity.ok(enrollmentService.getOngoingEnrollments(userId));
    }

    @GetMapping("/{enrollmentId}")
    public ResponseEntity<EnrollmentResponse> getEnrollmentDetails(@PathVariable Long enrollmentId) {
        Long loginUserId = currentUserProvider.getCurrentUserId();
        return ResponseEntity.ok(enrollmentService.getEnrollmentByIdForActor(enrollmentId, loginUserId, isAdmin()));
    }

    @PutMapping("/{enrollmentId}/progress")
    public ResponseEntity<EnrollmentResponse> updateProgress(@PathVariable Long enrollmentId, @RequestParam int progress) {
        Long loginUserId = currentUserProvider.getCurrentUserId();
        return ResponseEntity.ok(enrollmentService.updateProgressForActor(enrollmentId, progress, loginUserId, isAdmin()));
    }

    @PutMapping("/{enrollmentId}/complete")
    public ResponseEntity<EnrollmentResponse> completeEnrollment(@PathVariable Long enrollmentId) {
        Long loginUserId = currentUserProvider.getCurrentUserId();
        return ResponseEntity.ok(enrollmentService.completeEnrollmentForActor(enrollmentId, loginUserId, isAdmin()));
    }

    @PostMapping("/{enrollmentId}/feedback")
    public ResponseEntity<FeedbackResponse> submitEnrollmentFeedback(@PathVariable Long enrollmentId, @RequestBody FeedbackRequest request) {
        String employeeNo = currentUserProvider.getCurrentUser().getEmployeeNo();
        return ResponseEntity.ok(feedbackService.submitFeedback(enrollmentId, employeeNo, request));
    }

    @GetMapping("/{enrollmentId}/feedback")
    public ResponseEntity<FeedbackResponse> getEnrollmentFeedback(@PathVariable Long enrollmentId) {
        return ResponseEntity.ok(feedbackService.getFeedback(enrollmentId));
    }

    @GetMapping("/schedule")
    public ResponseEntity<List<EnrollmentCalendarResponse>> getEnrollmentSchedule() {
        return ResponseEntity.ok(enrollmentCalendarService.getAllRoundsWithMyStatus(currentUserProvider.getCurrentUserId()));
    }

    @GetMapping("/{enrollmentId}/schedule/detail")
    public ResponseEntity<EnrollmentScheduleResponse> getEnrollmentScheduleDetail(@PathVariable Long enrollmentId) {
        Long loginUserId = currentUserProvider.getCurrentUserId();
        enrollmentService.validateEnrollmentAccess(enrollmentId, loginUserId, isAdmin());
        Enrollment enrollment = findEnrollmentWithRound(enrollmentId);
        Integer durationMin = enrollment.getRound().getCourse().getDurationMin();
        int hours = (durationMin == null || durationMin <= 0) ? 0 : durationMin / 60;
        return ResponseEntity.ok(EnrollmentScheduleResponse.builder()
                .enrollmentId(enrollment.getEnrollmentId())
                .userId(enrollment.getUser().getUserId())
                .userName(enrollment.getUser().getName())
                .roundId(enrollment.getRound().getRoundId())
                .roundNo(enrollment.getRound().getRoundNo())
                .courseId(enrollment.getRound().getCourse().getCourseId())
                .courseTitle(enrollment.getRound().getCourse().getTitle())
                .startDate(enrollment.getRound().getStartDate().format(DATE_FORMATTER))
                .endDate(enrollment.getRound().getEndDate().format(DATE_FORMATTER))
                .durationMin(durationMin)
                .trainingHours(hours)
                .status(enrollment.getStatus().name())
                .progress(enrollment.getProgress())
                .build());
    }

    private boolean isAdmin() {
        Authentication auth = SecurityContextHolder.getContext().getAuthentication();
        return auth != null && auth.getAuthorities().stream()
                .anyMatch(a -> a.getAuthority().equals("ROLE_ADMIN"));
    }

    private Enrollment findEnrollmentWithRound(Long enrollmentId) {
        return enrollmentRepository.findByIdWithRound(enrollmentId)
                .orElseThrow(() -> new IllegalArgumentException("수강 정보를 찾을 수 없습니다."));
    }
}
