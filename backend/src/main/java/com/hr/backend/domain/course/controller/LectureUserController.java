package com.hr.backend.domain.course.controller;

import com.hr.backend.domain.course.dto.LectureWithProgressResponse;
import com.hr.backend.domain.course.service.CourseUserService;
import com.hr.backend.employee.util.CurrentUserProvider;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/user/courses/{courseId}/lectures")
@RequiredArgsConstructor
public class LectureUserController {

    private final CourseUserService   courseUserService;
    private final CurrentUserProvider currentUserProvider;

    @GetMapping
    public ResponseEntity<List<LectureWithProgressResponse>> getLectureList(@PathVariable Long courseId) {
        Long userId = currentUserProvider.getCurrentUserId();
        return ResponseEntity.ok(courseUserService.getCourseDetail(userId, courseId).getLectures());
    }
}
