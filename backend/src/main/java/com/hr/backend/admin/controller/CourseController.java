package com.hr.backend.admin.controller;

import com.hr.backend.admin.dto.CourseRequest;
import com.hr.backend.admin.dto.CourseResponse;
import com.hr.backend.domain.course.service.CourseService;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/admin/courses")
@RequiredArgsConstructor
public class CourseController {

    private final CourseService courseService;

    @GetMapping
    public ResponseEntity<?> getAll(
            @RequestParam(required = false) Integer page,
            @RequestParam(defaultValue = "50") int size) {
        if (page != null) {
            Page<CourseResponse> result = courseService.getAllPaged(page, size);
            return ResponseEntity.ok(result);
        }
        return ResponseEntity.ok(courseService.getAll());
    }

    @GetMapping("/{id}")
    public ResponseEntity<CourseResponse> getOne(@PathVariable Long id) {
        return ResponseEntity.ok(courseService.getOne(id));
    }

    @PostMapping
    public ResponseEntity<CourseResponse> create(@RequestBody CourseRequest req) {
        return ResponseEntity.ok(courseService.create(req));
    }

    @PutMapping("/{id}")
    public ResponseEntity<CourseResponse> update(
            @PathVariable Long id, @RequestBody CourseRequest req) {
        return ResponseEntity.ok(courseService.update(id, req));
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<Void> delete(@PathVariable Long id) {
        courseService.delete(id);
        return ResponseEntity.noContent().build();
    }
}
