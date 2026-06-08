package com.hr.backend.domain.notification.dto;

import com.hr.backend.domain.notification.entity.Notification;
import lombok.Getter;

import java.time.LocalDateTime;

@Getter
public class NotificationResponse {

    private Long   notificationId;
    private String type;
    private String title;
    private String message;
    private String content;
    private Long   enrollmentId;
    private boolean read;
    private LocalDateTime createdAt;

    public NotificationResponse(Notification n) {
        this.notificationId = n.getNotificationId();
        this.type           = n.getType().name();
        this.title          = buildTitle(n);
        this.message        = n.getMessage();
        this.content        = buildContent(n);
        this.enrollmentId   = n.getEnrollmentId();
        this.read           = n.isRead();
        this.createdAt      = n.getCreatedAt();
    }

    private String buildTitle(Notification n) {
        return switch (n.getType()) {
            case NEW_NOTICE -> firstLine(stripPrefix(n.getMessage(), "[공지]"));
            case COURSE_STARTED -> "교육 시작 안내";
            case ENROLLMENT_APPROVED -> "수강신청 승인 완료";
            case ENROLLMENT_REJECTED -> "수강신청 반려";
            case COURSE_DEADLINE -> "교육 마감 임박";
            case CERTIFICATE_ISSUED -> "이수증 발급 완료";
            case SYSTEM -> "시스템 알림";
        };
    }

    private String stripPrefix(String message, String prefix) {
        if (message == null) {
            return "";
        }
        String trimmed = message.trim();
        return trimmed.startsWith(prefix) ? trimmed.substring(prefix.length()).trim() : trimmed;
    }

    private String firstLine(String value) {
        if (value == null || value.isBlank()) {
            return "";
        }
        return value.lines().findFirst().orElse(value).trim();
    }

    private String buildContent(Notification n) {
        if (n.getType() != Notification.NotificationType.NEW_NOTICE) {
            return n.getMessage();
        }

        String withoutPrefix = stripPrefix(n.getMessage(), "[공지]");
        return withoutPrefix.lines()
                .skip(1)
                .reduce((a, b) -> a + "\n" + b)
                .map(String::trim)
                .filter(value -> !value.isBlank())
                .orElse(withoutPrefix);
    }
}
