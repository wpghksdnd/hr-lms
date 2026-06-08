package com.hr.backend.domain.enrollment.entity;

import com.hr.backend.domain.course.entity.CourseRound;
import com.hr.backend.domain.user.entity.User;
import jakarta.persistence.*;
import lombok.*;

import java.time.LocalDateTime;

@Entity
@Table(name = "enrollments",
       uniqueConstraints = @UniqueConstraint(columnNames = {"user_id", "round_id"}))
@Getter
@NoArgsConstructor(access = AccessLevel.PROTECTED)
public class Enrollment {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "enrollment_id")
    private Long enrollmentId;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "user_id", nullable = false)
    private User user;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "round_id", nullable = false)
    private CourseRound round;   // course_id → round_id 변경

    @Enumerated(EnumType.STRING)
    @Column(name = "approval_status", nullable = false, length = 20)
    private ApprovalStatus approvalStatus = ApprovalStatus.PENDING;

    @Column(nullable = false)
    private int progress = 0;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20)
    private Status status = Status.NOT_STARTED;

    @Column(name = "enrolled_at", nullable = false, updatable = false)
    private LocalDateTime enrolledAt;

    @Column(name = "approved_at")
    private LocalDateTime approvedAt;

    @Column(name = "completed_at")
    private LocalDateTime completedAt;

    public enum ApprovalStatus {
        PENDING,    // 신청 대기
        APPROVED,   // 승인
        REJECTED    // 반려
    }

    public enum Status {
        NOT_STARTED, IN_PROGRESS, DONE
    }

    @PrePersist
    protected void onCreate() {
        this.enrolledAt = LocalDateTime.now();
    }

    @Builder
    public Enrollment(User user, CourseRound round) {
        this.user  = user;
        this.round = round;
    }

    public void approve() {
        this.approvalStatus = ApprovalStatus.APPROVED;
        this.approvedAt     = LocalDateTime.now();
    }

    public void reject() {
        this.approvalStatus = ApprovalStatus.REJECTED;
    }

    public void updateProgress(int progress) {
        this.progress = progress;
        if (progress > 0 && this.status == Status.NOT_STARTED) {
            this.status = Status.IN_PROGRESS;
        }
    }

    public void changeStatus(Status status) {
        this.status = status;
        if (status == Status.DONE && this.completedAt == null) {
            this.completedAt = LocalDateTime.now();
        }
    }
}
