package com.hr.backend.domain.course.controller;

import com.hr.backend.domain.course.service.VideoUploadService;
import com.hr.backend.domain.course.service.VideoWatchLogService;
import com.hr.backend.employee.util.CurrentUserProvider;
import lombok.RequiredArgsConstructor;
import org.springframework.core.io.Resource;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/user")
@RequiredArgsConstructor
public class VideoWatchController {

    private final VideoWatchLogService  videoWatchLogService;
    private final VideoUploadService    videoUploadService;
    private final CurrentUserProvider   currentUserProvider;

    @GetMapping("/videos/{lectureId}/stream/{filename}")
    public ResponseEntity<Resource> stream(@PathVariable Long lectureId, @PathVariable String filename) {
        Resource resource    = videoUploadService.stream(lectureId, filename);
        String   contentType = videoUploadService.detectContentType(filename);
        return ResponseEntity.ok()
                .header(HttpHeaders.CONTENT_DISPOSITION, "inline; filename=\"" + filename + "\"")
                .header(HttpHeaders.ACCEPT_RANGES, "bytes")
                .contentType(MediaType.parseMediaType(contentType))
                .body(resource);
    }

    @PostMapping("/videos/{videoId}/watch/start")
    public ResponseEntity<Void> startWatch(@PathVariable Long videoId) {
        videoWatchLogService.startWatch(currentUserProvider.getCurrentUserId(), videoId);
        return ResponseEntity.ok().build();
    }

    @PostMapping("/videos/{videoId}/watch/end")
    public ResponseEntity<Map<String, Object>> endWatch(@PathVariable Long videoId, @RequestParam int watchedSec) {
        return ResponseEntity.ok(videoWatchLogService.endWatch(currentUserProvider.getCurrentUserId(), videoId, watchedSec));
    }

    @GetMapping("/lectures/{lectureId}/watch-status")
    public ResponseEntity<List<Map<String, Object>>> getLectureWatchStatus(@PathVariable Long lectureId) {
        return ResponseEntity.ok(videoWatchLogService.getLectureWatchStatus(currentUserProvider.getCurrentUserId(), lectureId));
    }
}
