package com.hr.backend.domain.course.service;

import com.hr.backend.admin.dto.CourseRequest;
import com.hr.backend.admin.dto.CourseResponse;
import com.hr.backend.domain.course.entity.Course;
import com.hr.backend.domain.course.repository.CourseRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;

@Service
@RequiredArgsConstructor
@Transactional(readOnly = true)
public class CourseService {

    private final CourseRepository courseRepository;

    public List<CourseResponse> getAll() {
        return courseRepository.findAllByActiveTrue().stream()
                .map(CourseResponse::new)
                .toList();
    }

    public Page<CourseResponse> getAllPaged(int page, int size) {
        var pageable = PageRequest.of(page, size, Sort.by(Sort.Direction.DESC, "courseId"));
        return courseRepository.findAllByActiveTrue(pageable).map(CourseResponse::new);
    }

    public CourseResponse getOne(Long id) {
        return new CourseResponse(findById(id));
    }

    @Transactional
    public CourseResponse create(CourseRequest req) {
        Course course = Course.builder()
                .title(req.getTitle())
                .description(req.getDescription())
                .category(req.getCategory())
                .targetRole(req.getTargetRole())
                .durationMin(req.getDurationMin())
                .thumbnailUrl(req.getThumbnailUrl())
                .build();
        return new CourseResponse(courseRepository.save(course));
    }

    @Transactional
    public CourseResponse update(Long id, CourseRequest req) {
        Course course = findById(id);
        course.update(req.getTitle(), req.getDescription(), req.getCategory(),
                req.getTargetRole(), req.getDurationMin(), req.getThumbnailUrl());
        return new CourseResponse(course);
    }

    @Transactional
    public void delete(Long id) {
        Course course = findById(id);
        course.deactivate();
    }

    private Course findById(Long id) {
        return courseRepository.findById(id)
                .orElseThrow(() -> new IllegalArgumentException("강좌를 찾을 수 없습니다."));
    }
}
