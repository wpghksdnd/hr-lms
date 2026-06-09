package com.hr.backend.domain.notification.entity;

import com.hr.backend.domain.user.entity.User;
import jakarta.persistence.*;
import lombok.*;

import java.time.LocalDateTime;

/**
 * 사용자별 알림 메시지.
 * 수강 신청 승인/반려, 교육 시작/마감 D-day 등에 자동 생성된다.
 */
@Entity
@Table(name = "notifications",
       indexes = @Index(name = "idx_notifications_user", columnList = "user_id, is_read, created_at"))
@Getter
@NoArgsConstructor(access = AccessLevel.PROTECTED)
public class Notification {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "notification_id")
    private Long notificationId;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "user_id", nullable = false)
    private User user;

    /**
     * 알림 유형.
     * NEW_NOTICE          : 신규 공지
     * ENROLLMENT_APPROVED  : 수강 신청 승인
     * ENROLLMENT_REJECTED  : 수강 신청 반려
     * COURSE_STARTED       : 교육 시작
     * COURSE_DEADLINE      : 교육 마감 임박
     * CERTIFICATE_ISSUED   : 이수증 발급
     * SYSTEM               : 기타 시스템 알림
     */
    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 30)
    private NotificationType type;

    @Column(nullable = false, length = 100)
    private String title;

    @Column(nullable = false, length = 500)
    private String message;

    /** 연관 수강 ID (없을 수도 있음) */
    @Column(name = "enrollment_id")
    private Long enrollmentId;

    @Column(name = "is_read", nullable = false)
    private boolean isRead = false;

    @Column(name = "created_at", nullable = false, updatable = false)
    private LocalDateTime createdAt;

    @PrePersist
    protected void onCreate() {
        this.createdAt = LocalDateTime.now();
    }

    @Builder
    public Notification(User user, NotificationType type, String title, String message, Long enrollmentId) {
        this.user         = user;
        this.type         = type;
        this.title        = title;
        this.message      = message;
        this.enrollmentId = enrollmentId;
    }

    public void markAsRead() {
        this.isRead = true;
    }

    public enum NotificationType {
        NEW_NOTICE,
        ENROLLMENT_APPROVED,
        ENROLLMENT_REJECTED,
        COURSE_STARTED,
        COURSE_DEADLINE,
        CERTIFICATE_ISSUED,
        SYSTEM
    }
}
