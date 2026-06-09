package com.hr.backend.domain.notification.service;

import com.hr.backend.domain.notification.dto.NotificationResponse;
import com.hr.backend.domain.notification.entity.Notification;
import com.hr.backend.domain.notification.entity.Notification.NotificationType;
import com.hr.backend.domain.notification.repository.NotificationRepository;
import com.hr.backend.domain.user.entity.User;
import com.hr.backend.domain.user.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.Map;

@Slf4j
@Service
@RequiredArgsConstructor
@Transactional(readOnly = true)
public class NotificationService {

    private final NotificationRepository notificationRepository;
    private final UserRepository         userRepository;

    // ──────────────────────────────────────────────────────────
    // 알림 생성 (내부 서비스에서 호출)
    // ──────────────────────────────────────────────────────────

    /**
     * 수강 신청 승인 알림 생성.
     * EnrollmentService.approveEnrollment()에서 호출.
     */
    @Transactional
    public void notifyEnrollmentApproved(User user, String courseTitle, Long enrollmentId) {
        create(user, NotificationType.ENROLLMENT_APPROVED,
                String.format("[수강 승인] '%s' 교육 수강 신청이 승인되었습니다.", courseTitle),
                enrollmentId);
    }

    /**
     * 수강 신청 반려 알림 생성.
     * EnrollmentService.rejectEnrollment()에서 호출.
     */
    @Transactional
    public void notifyEnrollmentRejected(User user, String courseTitle, Long enrollmentId) {
        create(user, NotificationType.ENROLLMENT_REJECTED,
                String.format("[수강 반려] '%s' 교육 수강 신청이 반려되었습니다. 자세한 내용은 담당자에게 문의하세요.", courseTitle),
                enrollmentId);
    }

    /**
     * 이수증 발급 알림 생성.
     * CertificateWorkflowService에서 호출.
     */
    @Transactional
    public void notifyCertificateIssued(User user, String courseTitle, Long enrollmentId) {
        create(user, NotificationType.CERTIFICATE_ISSUED,
                String.format("[이수증 발급] '%s' 교육 이수증이 발급되었습니다.", courseTitle),
                enrollmentId);
    }

    /**
     * 공지사항 등록 시 전체 직원에게 새 공지 알림을 생성한다.
     */
    @Transactional
    public int notifyNewNotice(String title, String content) {
        List<User> targets = userRepository.findAll().stream()
                .filter(u -> !"ROLE_ADMIN".equals(u.getRole()) && u.isActive())
                .toList();

        String safeTitle = title == null ? "" : title.trim();
        String safeContent = content == null ? "" : content.trim();
        String message = "[공지] " + safeTitle + (safeContent.isBlank() ? "" : "\n" + safeContent);

        targets.forEach(user -> create(user, NotificationType.NEW_NOTICE, message, null));
        log.info("새 공지 알림 생성: {}명 발송, title={}", targets.size(), safeTitle);
        return targets.size();
    }

    // ──────────────────────────────────────────────────────────
    // 사용자 API용 조회/읽음 처리
    // ──────────────────────────────────────────────────────────

    /** 내 전체 알림 목록 (최신순) */
    public List<NotificationResponse> getMyNotifications(Long userId) {
        return notificationRepository
                .findAllByUser_UserIdOrderByCreatedAtDesc(userId)
                .stream()
                .map(NotificationResponse::new)
                .toList();
    }

    /** 읽지 않은 알림만 */
    public List<NotificationResponse> getUnread(Long userId) {
        return notificationRepository
                .findAllByUser_UserIdAndIsReadFalseOrderByCreatedAtDesc(userId)
                .stream()
                .map(NotificationResponse::new)
                .toList();
    }

    /** 단건 알림 상세 조회 및 읽음 처리 */
    @Transactional
    public NotificationResponse getMyNotification(Long notificationId, Long userId) {
        Notification notification = findMyNotification(notificationId, userId);
        notification.markAsRead();
        return new NotificationResponse(notification);
    }

    /** 읽지 않은 알림 개수 */
    public Map<String, Long> getUnreadCount(Long userId) {
        long count = notificationRepository.countByUser_UserIdAndIsReadFalse(userId);
        return Map.of("unreadCount", count);
    }

    /** 단건 읽음 처리 */
    @Transactional
    public void markAsRead(Long notificationId, Long userId) {
        findMyNotification(notificationId, userId).markAsRead();
    }

    /** 전체 읽음 처리 */
    @Transactional
    public void markAllAsRead(Long userId) {
        notificationRepository.markAllAsReadByUserId(userId);
    }

    // ──────────────────────────────────────────────────────────
    // 관리자 API용
    // ──────────────────────────────────────────────────────────

    /** 전체 알림 이력 조회 (최신순) */
    public List<NotificationResponse> getAllNotifications() {
        return notificationRepository.findAllByOrderByCreatedAtDesc()
                .stream()
                .map(NotificationResponse::new)
                .toList();
    }

    /** 유형별 알림 이력 조회 */
    public List<NotificationResponse> getNotificationsByType(NotificationType type) {
        return notificationRepository.findAllByTypeOrderByCreatedAtDesc(type)
                .stream()
                .map(NotificationResponse::new)
                .toList();
    }

    /**
     * 공지 알림 브로드캐스트.
     * userIds 비어있으면 전체 직원(ROLE_USER)에게 발송.
     */
    @Transactional
    public int broadcast(String message, List<Long> userIds) {
        List<User> targets;
        if (userIds == null || userIds.isEmpty()) {
            targets = userRepository.findAll().stream()
                    .filter(u -> !"ROLE_ADMIN".equals(u.getRole()) && u.isActive())
                    .toList();
        } else {
            targets = userRepository.findAllById(userIds);
        }

        targets.forEach(user -> create(user, NotificationType.SYSTEM, message, null));
        log.info("공지 알림 브로드캐스트: {}명 발송, message={}", targets.size(), message);
        return targets.size();
    }

    // ──────────────────────────────────────────────────────────
    // private
    // ──────────────────────────────────────────────────────────

    private void create(User user, NotificationType type, String message, Long enrollmentId) {
        Notification n = Notification.builder()
                .user(user)
                .type(type)
                .title(resolveTitle(type))
                .message(message)
                .enrollmentId(enrollmentId)
                .build();
        notificationRepository.save(n);
        log.debug("알림 생성: userId={}, type={}", user.getUserId(), type);
    }

    private String resolveTitle(NotificationType type) {
        return switch (type) {
            case ENROLLMENT_APPROVED -> "수강 승인";
            case ENROLLMENT_REJECTED -> "수강 반려";
            case CERTIFICATE_ISSUED  -> "이수증 발급";
            case NEW_NOTICE          -> "새 공지";
            case COURSE_STARTED      -> "교육 시작";
            case COURSE_DEADLINE     -> "교육 마감 임박";
            case SYSTEM              -> "시스템 알림";
        };
    }

    private Notification findMyNotification(Long notificationId, Long userId) {
        Notification notification = notificationRepository.findById(notificationId)
                .orElseThrow(() -> new IllegalArgumentException("알림을 찾을 수 없습니다."));

        if (!notification.getUser().getUserId().equals(userId)) {
            throw new IllegalStateException("본인의 알림만 조회할 수 있습니다.");
        }

        return notification;
    }
}
