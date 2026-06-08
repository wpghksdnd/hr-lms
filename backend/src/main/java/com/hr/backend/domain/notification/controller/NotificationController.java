package com.hr.backend.domain.notification.controller;

import com.hr.backend.domain.notification.dto.NotificationResponse;
import com.hr.backend.domain.notification.service.NotificationService;
import com.hr.backend.domain.user.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

/**
 * 사용자 알림 API.
 *
 * GET  /api/user/notifications           — 전체 알림 목록 (최신순)
 * GET  /api/user/notifications/unread    — 읽지 않은 알림만
 * GET  /api/user/notifications/count     — 읽지 않은 알림 개수 { "unreadCount": N }
 * PUT  /api/user/notifications/{id}/read — 단건 읽음 처리
 * PUT  /api/user/notifications/read-all  — 전체 읽음 처리
 */
@RestController
@RequestMapping("/api/user/notifications")
@RequiredArgsConstructor
public class NotificationController {

    private final NotificationService notificationService;
    private final UserRepository      userRepository;

    @GetMapping
    public ResponseEntity<List<NotificationResponse>> getAll() {
        return ResponseEntity.ok(notificationService.getMyNotifications(getLoginUserId()));
    }

    @GetMapping("/unread")
    public ResponseEntity<List<NotificationResponse>> getUnread() {
        return ResponseEntity.ok(notificationService.getUnread(getLoginUserId()));
    }

    @GetMapping("/count")
    public ResponseEntity<Map<String, Long>> getUnreadCount() {
        return ResponseEntity.ok(notificationService.getUnreadCount(getLoginUserId()));
    }

    @GetMapping("/{notificationId}")
    public ResponseEntity<NotificationResponse> getDetail(@PathVariable Long notificationId) {
        return ResponseEntity.ok(notificationService.getMyNotification(notificationId, getLoginUserId()));
    }

    @PutMapping("/{notificationId}/read")
    public ResponseEntity<Void> markAsRead(@PathVariable Long notificationId) {
        notificationService.markAsRead(notificationId, getLoginUserId());
        return ResponseEntity.ok().build();
    }

    @PutMapping("/read-all")
    public ResponseEntity<Void> markAllAsRead() {
        notificationService.markAllAsRead(getLoginUserId());
        return ResponseEntity.ok().build();
    }

    // ──────────────────────────────────────────────────────────

    private Long getLoginUserId() {
        String employeeNo = (String) SecurityContextHolder.getContext()
                .getAuthentication().getPrincipal();
        return userRepository.findByEmployeeNo(employeeNo)
                .orElseThrow(() -> new IllegalStateException("인증된 사용자를 찾을 수 없습니다."))
                .getUserId();
    }
}
