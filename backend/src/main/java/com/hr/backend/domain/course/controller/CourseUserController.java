package com.hr.backend.domain.course.controller;

import com.hr.backend.domain.course.dto.CourseDetailResponse;
import com.hr.backend.domain.course.dto.CourseListItemResponse;
import com.hr.backend.domain.course.service.CourseUserService;
import com.hr.backend.employee.util.CurrentUserProvider;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.authentication.AnonymousAuthenticationToken;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/user/courses")
@RequiredArgsConstructor
public class CourseUserController {

    private final CourseUserService   courseUserService;
    private final CurrentUserProvider currentUserProvider;

    /** 강좌 목록 — 비로그인도 허용 (신청 상태만 숨김) */
    @GetMapping
    public ResponseEntity<List<CourseListItemResponse>> getCourseList() {
        return ResponseEntity.ok(courseUserService.getCourseList(resolveUserIdOrNull()));
    }

    @GetMapping("/{courseId}")
    public ResponseEntity<CourseDetailResponse> getCourseDetail(@PathVariable Long courseId) {
        return ResponseEntity.ok(courseUserService.getCourseDetail(currentUserProvider.getCurrentUserId(), courseId));
    }

    private Long resolveUserIdOrNull() {
        Authentication auth = SecurityContextHolder.getContext().getAuthentication();
        if (auth == null || !auth.isAuthenticated() || auth instanceof AnonymousAuthenticationToken) return null;
        Object principal = auth.getPrincipal();
        if (!(principal instanceof String employeeNo) || "anonymousUser".equals(employeeNo)) return null;
        try {
            return currentUserProvider.getCurrentUserId();
        } catch (Exception e) {
            return null;
        }
    }
}
