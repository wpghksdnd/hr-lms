package com.hr.backend.domain.enrollment.controller;

import com.hr.backend.domain.enrollment.dto.EnrollmentCalendarResponse;
import com.hr.backend.domain.enrollment.service.EnrollmentCalendarService;
import com.hr.backend.employee.util.CurrentUserProvider;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

@RestController
@RequestMapping("/api/user/calendar")
@RequiredArgsConstructor
public class EnrollmentCalendarController {

    private final EnrollmentCalendarService calendarService;
    private final CurrentUserProvider       currentUserProvider;

    @GetMapping({"", "/all"})
    public ResponseEntity<List<EnrollmentCalendarResponse>> getAllRoundsWithMyStatus() {
        return ResponseEntity.ok(calendarService.getAllRoundsWithMyStatus(currentUserProvider.getCurrentUserId()));
    }
}
