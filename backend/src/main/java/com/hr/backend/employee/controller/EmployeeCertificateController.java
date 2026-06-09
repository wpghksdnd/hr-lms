package com.hr.backend.employee.controller;

import com.hr.backend.employee.dto.CommonResponse;
import com.hr.backend.employee.dto.response.CertificateResponse;
import com.hr.backend.domain.enrollment.service.CertificateWorkflowService;
import com.hr.backend.employee.service.EmployeeCertificateService;
import lombok.RequiredArgsConstructor;
import org.springframework.core.io.Resource;
import org.springframework.http.ContentDisposition;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.nio.charset.StandardCharsets;

import java.util.List;

@RestController
@RequestMapping("/api/user/certificates")
@RequiredArgsConstructor
public class EmployeeCertificateController {

    private final EmployeeCertificateService certificateService;
    private final CertificateWorkflowService certificateWorkflowService;

    @GetMapping
    public ResponseEntity<CommonResponse<List<CertificateResponse>>> getMyCertificates() {
        List<CertificateResponse> certificates = certificateService.getMyCertificates();
        return ResponseEntity.ok(CommonResponse.success("내 이수증 목록을 성공적으로 조회했습니다.", certificates));
    }

    @GetMapping("/{certificateId}")
    public ResponseEntity<CommonResponse<CertificateResponse>> getCertificateDetail(@PathVariable Long certificateId) {
        CertificateResponse certificateDetail = certificateService.getCertificateDetail(certificateId);
        return ResponseEntity.ok(CommonResponse.success("이수증 상세 정보를 성공적으로 조회했습니다.", certificateDetail));
    }

    @GetMapping("/{certificateId}/download")
    public ResponseEntity<Resource> downloadCertificate(@PathVariable Long certificateId) {
        // 본인 문서 접근 검증 + PDF 없으면 온디맨드 생성
        // (certificateWorkflowService 프록시 경유 → @Transactional REQUIRES_NEW 정상 적용)
        certificateService.ensurePdfGenerated(certificateId);

        Resource resource = certificateWorkflowService.downloadCertificate(certificateId);
        String fileName = "certificate_" + certificateId + ".pdf";

        return ResponseEntity.ok()
                .contentType(MediaType.APPLICATION_PDF)
                .header(HttpHeaders.CONTENT_DISPOSITION,
                        ContentDisposition.attachment()
                                .filename(fileName, StandardCharsets.UTF_8)
                                .build()
                                .toString())
                .body(resource);
    }
}