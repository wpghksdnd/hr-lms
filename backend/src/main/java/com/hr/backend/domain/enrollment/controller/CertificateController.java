package com.hr.backend.domain.enrollment.controller;

import com.hr.backend.domain.enrollment.dto.CertificateActionResponse;
import com.hr.backend.domain.enrollment.dto.CertificateFailRequest;
import com.hr.backend.domain.enrollment.dto.CertificateGenerateRequest;
import com.hr.backend.domain.enrollment.dto.CertificateGenerateResponse;
import com.hr.backend.domain.enrollment.entity.Certificate;
import com.hr.backend.domain.enrollment.service.CertificateGenerationException;
import com.hr.backend.domain.enrollment.repository.CertificateRepository;
import com.hr.backend.domain.enrollment.service.CertificateWorkflowService;
import com.hr.backend.domain.user.entity.User;
import com.hr.backend.domain.user.repository.UserRepository;
import jakarta.annotation.PostConstruct;
import lombok.RequiredArgsConstructor;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.core.io.Resource;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

/**
 * 일반 유저용 이수증 API.
 *
 * POST /api/certificate/generate          — 본인 이수증 발급 (courseId만 전달, userId는 JWT에서 추출)
 * GET  /api/certificate/my                — 본인 이수증 목록
 * GET  /api/certificate/download/{id}     — 이수증 PDF 다운로드 (본인 소유 확인)
 */
@RestController
@RequestMapping("/api/certificate")
@RequiredArgsConstructor
public class CertificateController {

    private final CertificateWorkflowService certificateService;
    private final CertificateRepository      certificateRepository;
    private final UserRepository             userRepository;

    @Value("${certificate.internal-api-token:change-me-in-prod}")
    private String internalApiToken;

    @PostConstruct
    public void validateInternalToken() {
        if ("change-me-in-prod".equals(internalApiToken) || internalApiToken.isBlank()) {
            throw new IllegalStateException(
                "CERTIFICATE_INTERNAL_API_TOKEN 환경변수가 설정되지 않았습니다. 프로덕션 배포 전 반드시 변경하세요.");
        }
    }

    /**
     * 이수증 발급.
     * userId는 JWT에서 자동 추출 — 클라이언트가 타인의 userId를 넣어도 무시한다.
     * Body: { "courseId": 1 }
     */
    @PostMapping("/generate")
    public ResponseEntity<CertificateGenerateResponse> generate(
            @AuthenticationPrincipal String employeeNo,
            @RequestBody CertificateGenerateRequest request) {

        User user = getUser(employeeNo);

        // 클라이언트가 전달한 userId를 JWT 본인으로 덮어씀 (타인 발급 방지)
        request.setUserId(user.getUserId());

        return ResponseEntity.ok(certificateService.generateCertificate(request));
    }

    /** 이수증 발급 실패 처리 (n8n 내부 호출용) */
    @PostMapping("/fail")
    public ResponseEntity<CertificateActionResponse> fail(
            @RequestHeader(value = "X-Internal-Token", required = false) String token,
            @RequestBody CertificateFailRequest request) {
        if (!isValidInternalToken(token)) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED)
                    .body(CertificateActionResponse.builder()
                            .success(false)
                            .message("인증되지 않은 내부 요청입니다.")
                            .build());
        }
        return ResponseEntity.ok(certificateService.handleFailure(request));
    }

    /** 본인 이수증 목록 */
    @GetMapping("/my")
    public ResponseEntity<?> getMy(@AuthenticationPrincipal String employeeNo) {
        User user = getUser(employeeNo);
        return ResponseEntity.ok(certificateRepository.findAllByUserId(user.getUserId()));
    }

    /**
     * 이수증 PDF 다운로드.
     * 본인 이수증이 아니면 403 Forbidden.
     */
    @GetMapping("/download/{id}")
    public ResponseEntity<Resource> download(
            @AuthenticationPrincipal String employeeNo,
            @PathVariable Long id) {

        User user = getUser(employeeNo);

        // 본인 소유 확인
        Certificate cert = certificateRepository.findById(id)
                .orElse(null);
        if (cert == null) {
            return ResponseEntity.notFound().build();
        }
        if (!cert.getUser().getUserId().equals(user.getUserId())) {
            return ResponseEntity.status(HttpStatus.FORBIDDEN).build();
        }

        Resource resource = certificateService.downloadCertificate(id);
        String filename = resource.getFilename() != null ? resource.getFilename() : "certificate.pdf";
        return ResponseEntity.ok()
                .contentType(MediaType.APPLICATION_PDF)
                .header(HttpHeaders.CONTENT_DISPOSITION, "attachment; filename=\"" + filename + "\"")
                .body(resource);
    }

    private User getUser(String employeeNo) {
        return userRepository.findByEmployeeNo(employeeNo)
                .orElseThrow(() -> new IllegalStateException("인증된 사용자를 찾을 수 없습니다."));
    }

    private boolean isValidInternalToken(String token) {
        return token != null && !token.isBlank() && token.equals(internalApiToken);
    }
}
