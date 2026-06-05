package com.hr.backend.domain.course.entity;

import jakarta.persistence.*;
import lombok.*;

import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;

@Entity
@Table(name = "courses")
@Getter
@NoArgsConstructor(access = AccessLevel.PROTECTED)
public class Course {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "course_id")
    private Long courseId;

    @Column(nullable = false, length = 200)
    private String title;

    @Column(columnDefinition = "TEXT")
    private String description;

    @Column(length = 100)
    private String category;       // 법정의무교육 / 직무교육

    @Column(name = "target_role", nullable = false)
    private int targetRole;        // 0=전체, 1=현장직, 2=사무직

    @Column(name = "duration_min")
    private Integer durationMin;

    @Column(name = "thumbnail_url", length = 500)
    private String thumbnailUrl;

    @Column(name = "is_active", nullable = false)
    private boolean active = true;

    @Column(name = "created_at", nullable = false, updatable = false)
    private LocalDateTime createdAt;

    @Column(name = "updated_at")
    private LocalDateTime updatedAt;

    // 강좌 > 강의
    @OneToMany(mappedBy = "course", cascade = CascadeType.ALL, orphanRemoval = true)
    @OrderBy("sortOrder ASC")
    private List<Lecture> lectures = new ArrayList<>();

    // 강좌 > 차수
    @OneToMany(mappedBy = "course", cascade = CascadeType.ALL, orphanRemoval = true)
    @OrderBy("roundNo ASC")
    private List<CourseRound> rounds = new ArrayList<>();

    @PrePersist
    protected void onCreate() {
        this.createdAt = LocalDateTime.now();
        this.updatedAt = LocalDateTime.now();
    }

    @PreUpdate
    protected void onUpdate() {
        this.updatedAt = LocalDateTime.now();
    }

    @Builder
    public Course(String title, String description, String category,
                  int targetRole, Integer durationMin, String thumbnailUrl) {
        this.title        = title;
        this.description  = description;
        this.category     = category;
        this.targetRole   = targetRole;
        this.durationMin  = durationMin;
        this.thumbnailUrl = thumbnailUrl;
        this.active       = true;
    }

    public void update(String title, String description, String category,
                       int targetRole, Integer durationMin, String thumbnailUrl) {
        this.title        = title;
        this.description  = description;
        this.category     = category;
        this.targetRole   = targetRole;
        this.durationMin  = durationMin;
        this.thumbnailUrl = thumbnailUrl;
    }

    public void deactivate() {
        this.active = false;
    }
}
