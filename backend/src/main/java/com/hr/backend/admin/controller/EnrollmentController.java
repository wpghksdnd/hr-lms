package com.hr.backend.admin.controller;

import com.hr.backend.admin.dto.EnrollmentResponse;
import com.hr.backend.domain.course.entity.CourseRound;
import com.hr.backend.domain.enrollment.service.EnrollmentExcelService;
import com.hr.backend.domain.enrollment.service.EnrollmentService;
import lombok.RequiredArgsConstructor;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.http.ContentDisposition;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.net.URLEncoder;
import java.nio.charset.StandardCharsets;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.util.List;
import java.util.Map;
import org.springframework.data.domain.Page;

@RestController
@RequestMapping("/api/admin/enrollments")
@RequiredArgsConstructor
public class EnrollmentController {

    private final EnrollmentService      enrollmentService;
    private final EnrollmentExcelService enrollmentExcelService;

    // ── 조회 ────────────────────────────────────────────────

    /** 전체 이수 현황 (필터 옵션 통합)
     *
     * @param filter 필터 종류
     *   - 생략/all  : 전체
     *   - incomplete: 미이수자만
     * @param dept     부서명 (filter=dept 일 때)
     * @param category 카테고리 (법정의무교육 / 직무교육)
     * @param role     대상직군 (1=현장직, 2=사무직)
     */
    @GetMapping
    public ResponseEntity<?> getAll(
            @RequestParam(required = false) String filter,
            @RequestParam(required = false) String dept,
            @RequestParam(required = false) String category,
            @RequestParam(required = false) Integer role,
            @RequestParam(required = false) Integer page,
            @RequestParam(defaultValue = "20") int size) {
        if (page != null) {
            // page 파라미터가 있으면 항상 Page<T> 반환 (필터 포함)
            Page<EnrollmentResponse> result =
                    enrollmentService.getFilteredPaged(filter, dept, category, page, size);
            return ResponseEntity.ok(result);
        }
        return ResponseEntity.ok(enrollmentService.getFiltered(filter, dept, category, role));
    }

    /** 직원별 이수 현황 */
    @GetMapping("/user/{userId}")
    public ResponseEntity<List<EnrollmentResponse>> getByUser(@PathVariable Long userId) {
        return ResponseEntity.ok(enrollmentService.getByUser(userId));
    }

    /** 강의별 수강자 현황 */
    @GetMapping("/course/{courseId}")
    public ResponseEntity<List<EnrollmentResponse>> getByCourse(@PathVariable Long courseId) {
        return ResponseEntity.ok(enrollmentService.getByCourse(courseId));
    }

    /**
     * 승인 대기 중인 수강 신청 목록.
     * 관리자 승인/반려 화면에서 사용한다.
     * GET /api/admin/enrollments/pending
     */
    @GetMapping("/pending")
    public ResponseEntity<List<EnrollmentResponse>> getPending() {
        return ResponseEntity.ok(enrollmentService.getPendingEnrollments());
    }

    // ── 등록 / 상태 변경 ────────────────────────────────────

    /** 수강 등록 (차수 기반) */
    @PostMapping
    public ResponseEntity<EnrollmentResponse> enroll(
            @RequestParam Long userId, @RequestParam Long roundId) {
        return ResponseEntity.ok(enrollmentService.enroll(userId, roundId));
    }

    /** 진행률 업데이트 */
    @PatchMapping("/{enrollmentId}/progress")
    public ResponseEntity<EnrollmentResponse> updateProgress(
            @PathVariable Long enrollmentId, @RequestParam int progress) {
        return ResponseEntity.ok(enrollmentService.updateProgress(enrollmentId, progress));
    }

    /** 차수 마감일 변경 */
    @PutMapping("/schedule/{roundId}")
    public ResponseEntity<CourseRound> manageEnrollmentSchedule(
            @PathVariable Long roundId,
            @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate endDate) {
        return ResponseEntity.ok(enrollmentService.updateRoundSchedule(roundId, endDate));
    }

    /** 수강 상태 변경 */
    @PutMapping("/{enrollmentId}/status")
    public ResponseEntity<EnrollmentResponse> changeEnrollmentStatus(
            @PathVariable Long enrollmentId, @RequestParam String status) {
        return ResponseEntity.ok(enrollmentService.changeEnrollmentStatus(enrollmentId, status));
    }

    /**
     * 수강 신청 승인 (PENDING → APPROVED + IN_PROGRESS).
     * 해당 직원에게 승인 알림이 자동 발송된다.
     */
    @PutMapping("/{enrollmentId}/approve")
    public ResponseEntity<EnrollmentResponse> approveEnrollment(@PathVariable Long enrollmentId) {
        return ResponseEntity.ok(enrollmentService.approveEnrollment(enrollmentId));
    }

    /**
     * 수강 신청 반려 (PENDING → REJECTED).
     * 해당 직원에게 반려 알림이 자동 발송된다.
     */
    @PutMapping("/{enrollmentId}/reject")
    public ResponseEntity<EnrollmentResponse> rejectEnrollment(@PathVariable Long enrollmentId) {
        return ResponseEntity.ok(enrollmentService.rejectEnrollment(enrollmentId));
    }

    // ── 통계 ────────────────────────────────────────────────

    /** 수강 통계 */
    @GetMapping("/statistics")
    public ResponseEntity<Map<String, Object>> getEnrollmentStatistics() {
        return ResponseEntity.ok(enrollmentService.getEnrollmentStatistics());
    }

    // ── Excel 내보내기 ───────────────────────────────────────

    /**
     * 이수 현황 Excel 내보내기
     * 필터 파라미터는 GET /api/admin/enrollments 와 동일하게 사용 가능
     */
    @GetMapping("/export")
    public ResponseEntity<byte[]> exportExcel(
            @RequestParam(required = false) String filter,
            @RequestParam(required = false) String dept,
            @RequestParam(required = false) String category,
            @RequestParam(required = false) Integer role) {

        List<EnrollmentResponse> data = enrollmentService.getFiltered(filter, dept, category, role);
        byte[] excelBytes = enrollmentExcelService.export(data);

        String timestamp = LocalDateTime.now().format(DateTimeFormatter.ofPattern("yyyyMMdd_HHmm"));
        String filename  = URLEncoder.encode("이수현황_" + timestamp + ".xlsx", StandardCharsets.UTF_8);

        HttpHeaders headers = new HttpHeaders();
        headers.setContentType(MediaType.parseMediaType(
                "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"));
        headers.setContentDisposition(
                ContentDisposition.attachment().filename(filename, StandardCharsets.UTF_8).build());

        return ResponseEntity.ok().headers(headers).body(excelBytes);
    }
}
