package com.hr.backend.employee.service;

import com.hr.backend.domain.enrollment.entity.Certificate;
import com.hr.backend.domain.enrollment.entity.Enrollment;
import com.hr.backend.domain.enrollment.repository.CertificateRepository;
import com.hr.backend.domain.enrollment.repository.EnrollmentRepository;
import com.hr.backend.domain.enrollment.service.CertificateWorkflowService;
import com.hr.backend.employee.dto.response.CertificateResponse;
import com.hr.backend.employee.exception.ForbiddenException;
import com.hr.backend.employee.exception.ResourceNotFoundException;
import com.hr.backend.employee.util.CurrentUserProvider;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;

@Slf4j
@Service
@RequiredArgsConstructor
@Transactional(readOnly = true)
public class EmployeeCertificateService {

    private final CertificateRepository certificateRepository;
    private final EnrollmentRepository enrollmentRepository;
    private final CertificateWorkflowService certificateWorkflowService;
    private final CurrentUserProvider currentUserProvider;

    @Transactional
    public List<CertificateResponse> getMyCertificates() {
        Long userId = currentUserProvider.getCurrentUserId();

        // 보정 1: DONE인데 이수증 레코드 없는 건 생성 (개별 실패해도 계속)
        try {
            enrollmentRepository.findAllByUserId(userId).stream()
                    .filter(e -> e.getStatus() == Enrollment.Status.DONE)
                    .filter(e -> !certificateRepository.existsByUser_UserIdAndRound_RoundId(userId, e.getRound().getRoundId()))
                    .forEach(e -> {
                        try {
                            certificateWorkflowService.triggerCompletionWorkflow(e);
                        } catch (Exception ex) {
                            log.warn("[이수증 보정1] enrollmentId={} 실패: {}", e.getEnrollmentId(), ex.getMessage());
                        }
                    });
        } catch (Exception ex) {
            log.warn("[이수증 보정1] 전체 실패: {}", ex.getMessage());
        }

        // 보정 2: 이수증 레코드는 있는데 PDF가 없는 건 재생성
        try {
            certificateRepository.findAllByUserId(userId).stream()
                    .filter(c -> c.getFileUrl() == null || c.getFileUrl().isBlank())
                    .forEach(c -> {
                        try {
                            certificateWorkflowService.generateCertificateForRound(
                                    c.getUser().getUserId(), c.getRound().getRoundId());
                        } catch (Exception ex) {
                            log.warn("[이수증 보정2] certificateId={} 실패: {}", c.getCertificateId(), ex.getMessage());
                        }
                    });
        } catch (Exception ex) {
            log.warn("[이수증 보정2] 전체 실패: {}", ex.getMessage());
        }

        return certificateRepository.findAllByUserId(userId)
                .stream()
                .map(this::toResponse)
                .toList();
    }

    public CertificateResponse getCertificateDetail(Long certificateId) {
        Certificate c = certificateRepository.findById(certificateId)
                .orElseThrow(() -> new ResourceNotFoundException("Certificate", "certificateId", certificateId));
        // 본인 이수증인지 확인
        Long loginUserId = currentUserProvider.getCurrentUserId();
        if (!c.getUser().getUserId().equals(loginUserId)) {
            throw new ForbiddenException("문서에 대한 접근 권한이 없습니다.");
        }
        return toResponse(c);
    }

    private CertificateResponse toResponse(Certificate c) {
        return CertificateResponse.builder()
                .certificateId(c.getCertificateId())
                .courseId(c.getRound().getCourse().getCourseId())
                .courseTitle(c.getRound().getCourse().getTitle())
                .issuedAt(c.getIssuedAt())
                .fileURL(c.getFileUrl())
                .build();
    }
}
