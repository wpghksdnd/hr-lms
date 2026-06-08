package com.hr.backend.domain.chat.service;

import com.hr.backend.domain.enrollment.entity.Enrollment;
import com.hr.backend.domain.enrollment.repository.EnrollmentRepository;
import com.hr.backend.domain.user.entity.User;
import com.hr.backend.domain.user.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.*;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestClientException;
import org.springframework.web.client.RestTemplate;

import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;

/**
 * Flask AI 챗봇 서버(/chat)와 통신하는 서비스.
 * - 사용자 수강 현황을 DB에서 조회해 메시지 컨텍스트에 자동 주입
 * application.yaml: ai.server.url (기본값 http://localhost:5000)
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class ChatService {

    private final RestTemplate        restTemplate;
    private final UserRepository      userRepository;
    private final EnrollmentRepository enrollmentRepository;

    @Value("${ai.server.url:http://localhost:5000}")
    private String aiServerUrl;

    @Value("${ai.internal-token:}")
    private String aiInternalToken;

    /**
     * Flask 챗봇에 메시지를 전달하고 응답을 받는다.
     * 수강 현황·이수 정보 등 개인화 데이터를 컨텍스트로 함께 전송한다.
     */
    public String sendMessage(String employeeNo, String message) {
        String url = aiServerUrl + "/chat";

        // ── 사용자 수강 컨텍스트 구성 ────────────────────────────────
        String userContext = buildUserContext(employeeNo);
        String enrichedMessage = userContext.isBlank()
                ? message
                : userContext + "\n\n사용자 질문: " + message;

        HttpHeaders headers = new HttpHeaders();
        headers.setContentType(MediaType.APPLICATION_JSON);
        if (aiInternalToken != null && !aiInternalToken.isBlank()) {
            headers.set("X-Internal-Token", aiInternalToken);
        }

        Map<String, String> body = new HashMap<>();
        body.put("user_id", employeeNo);
        body.put("message", enrichedMessage);

        HttpEntity<Map<String, String>> request = new HttpEntity<>(body, headers);

        try {
            ResponseEntity<Map> response = restTemplate.exchange(
                    url, HttpMethod.POST, request, Map.class);

            if (response.getStatusCode().is2xxSuccessful() && response.getBody() != null) {
                Object reply = response.getBody().get("reply");
                return reply != null ? reply.toString() : "AI 서버에서 응답을 받지 못했습니다.";
            }

            log.warn("AI 서버 비정상 응답: status={}", response.getStatusCode());
            return "AI 서버에서 응답을 받지 못했습니다.";

        } catch (RestClientException e) {
            log.error("AI 서버 연결 실패: url={}, error={}", url, e.getMessage());
            return "챗봇 서버에 연결할 수 없습니다. 잠시 후 다시 시도해 주세요.";
        }
    }

    // ─────────────────────────────────────────────────────────────────────────
    // private helpers
    // ─────────────────────────────────────────────────────────────────────────

    /**
     * 사용자의 수강 현황을 조회해 AI 프롬프트용 텍스트로 변환한다.
     * 조회 실패 시 빈 문자열 반환 (챗봇 동작에는 영향 없음).
     */
    private String buildUserContext(String employeeNo) {
        try {
            Optional<User> userOpt = userRepository.findByEmployeeNo(employeeNo);
            if (userOpt.isEmpty()) return "";

            User user = userOpt.get();
            List<Enrollment> enrollments = enrollmentRepository.findAllByUserId(user.getUserId());
            if (enrollments.isEmpty()) return "[현재 수강 중인 강좌 없음]";

            StringBuilder sb = new StringBuilder();
            sb.append("[").append(user.getName()).append("님의 수강 현황]\n");

            long inProgress = enrollments.stream()
                    .filter(e -> e.getStatus() == Enrollment.Status.IN_PROGRESS).count();
            long done = enrollments.stream()
                    .filter(e -> e.getStatus() == Enrollment.Status.DONE).count();

            sb.append(String.format("- 수강 중: %d개  이수 완료: %d개  전체: %d개\n",
                    inProgress, done, enrollments.size()));
            sb.append("\n강좌 상세:\n");

            for (Enrollment e : enrollments) {
                String courseTitle = e.getRound().getCourse().getTitle();
                String status = switch (e.getStatus()) {
                    case IN_PROGRESS -> "수강 중";
                    case DONE        -> "이수 완료";
                    case NOT_STARTED -> "미시작";
                };
                String approval = e.getApprovalStatus() == Enrollment.ApprovalStatus.APPROVED
                        ? "승인됨" : "승인 대기";
                sb.append(String.format("  • %s — 진도 %d%%, %s, %s\n",
                        courseTitle, e.getProgress(), status, approval));
                if (e.getCompletedAt() != null) {
                    sb.append(String.format("    (이수일: %s)\n",
                            e.getCompletedAt().toLocalDate()));
                }
            }

            return sb.toString().trim();

        } catch (Exception ex) {
            log.warn("사용자 컨텍스트 조회 실패 (employeeNo={}): {}", employeeNo, ex.getMessage());
            return "";
        }
    }
}
