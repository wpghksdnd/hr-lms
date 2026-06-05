package com.hr.backend.employee.dto.response;

import lombok.Builder;
import lombok.Getter;
import lombok.Setter;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.List;

@Getter
@Setter
@Builder
public class MyCourseResponse {
    private Long enrollmentId;
    private Long courseId;
    private String courseTitle;
    private String courseThumbnailUrl;
    private Integer progress;
    private String status;
    private LocalDate deadline;
    private LocalDateTime enrolledAt;
    private LocalDateTime completedAt;

    // 내 학습 상세 조회 시 사용
    @Getter
    @Setter
    @Builder
    public static class MyCourseDetailResponse {
        private Long enrollmentId;
        private Long courseId;
        private String courseTitle;
        private String courseDescription;
        private String courseCategory;
        private String courseThumbnailUrl;
        private Integer currentProgress; // 현재 진행률 (0-100)
        private String currentStatus; // 현재 상태
        private LocalDate courseDeadline;
        private LocalDateTime enrolledAt;
        private LocalDateTime completedAt;
        private List<MyCourseVideoWatchStatusDto> videos; // 영상별 시청 여부 포함
    }

    // 내 학습 영상별 시청 상태 (MyCourseDetailResponse 내부에 포함)
    @Getter
    @Setter
    @Builder
    public static class MyCourseVideoWatchStatusDto {
        private Long videoId;
        private Long lectureId;   // 단원 퀴즈 조회용
        private String title;
        private String videoURL;
        private Integer durationSec;
        private Integer sortOrder;
        private Integer watchedSec; // 시청한 시간 (초)
        private Boolean isCompleted; // 시청 완료 여부 (duration_sec의 90% 이상)
    }
}