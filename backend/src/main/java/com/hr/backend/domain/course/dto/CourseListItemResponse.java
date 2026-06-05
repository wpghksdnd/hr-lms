package com.hr.backend.domain.course.dto;

import lombok.Builder;
import lombok.Getter;
import java.time.LocalDate;
import java.util.List;

@Getter
@Builder
public class CourseListItemResponse {
    private Long courseId;
    private String title;
    private String description;
    private String category;
    private String thumbnailUrl;
    private Integer durationMin;
    
    // 차수별 정보
    private Long roundId;
    private Integer roundNo;
    private LocalDate startDate;
    private LocalDate endDate;
    
    // 신청 상태
    private String enrollmentStatus; // NOT_STARTED, IN_PROGRESS, DONE, NOT_ENROLLED
    private Long enrollmentId;       // 수강 취소 등에 사용, 미신청 시 null
}