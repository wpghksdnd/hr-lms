package com.hr.backend.domain.quiz.controller;

import com.hr.backend.domain.quiz.dto.AttemptRequest;
import com.hr.backend.domain.quiz.dto.AttemptResponse;
import com.hr.backend.domain.quiz.service.AttemptService;
import com.hr.backend.employee.util.CurrentUserProvider;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequiredArgsConstructor
public class AttemptController {

    private final AttemptService      attemptService;
    private final CurrentUserProvider currentUserProvider;

    @PostMapping("/api/user/lectures/{lectureId}/quiz/submit")
    public ResponseEntity<AttemptResponse> submitQuiz(@PathVariable Long lectureId, @RequestBody AttemptRequest req) {
        return ResponseEntity.ok(attemptService.submitQuiz(currentUserProvider.getCurrentUserId(), lectureId, req));
    }

    @GetMapping("/api/user/lectures/{lectureId}/quiz/attempts")
    public ResponseEntity<List<AttemptResponse>> getQuizAttempts(@PathVariable Long lectureId) {
        return ResponseEntity.ok(attemptService.getQuizAttempts(currentUserProvider.getCurrentUserId(), lectureId));
    }

    @PostMapping("/api/user/courses/{courseId}/exam/submit")
    public ResponseEntity<AttemptResponse> submitExam(@PathVariable Long courseId, @RequestBody AttemptRequest req) {
        return ResponseEntity.ok(attemptService.submitExam(currentUserProvider.getCurrentUserId(), courseId, req));
    }

    @GetMapping("/api/user/courses/{courseId}/exam/attempts")
    public ResponseEntity<List<AttemptResponse>> getExamAttempts(@PathVariable Long courseId) {
        return ResponseEntity.ok(attemptService.getExamAttempts(currentUserProvider.getCurrentUserId(), courseId));
    }
}
