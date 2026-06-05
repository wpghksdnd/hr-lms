package com.hr.backend.employee.service;

import com.hr.backend.domain.course.entity.Course;
import com.hr.backend.domain.course.entity.CourseRound;
import com.hr.backend.domain.course.entity.CourseVideo;
import com.hr.backend.domain.course.repository.CourseRepository;
import com.hr.backend.domain.enrollment.entity.Enrollment;
import com.hr.backend.domain.enrollment.repository.EnrollmentRepository;
import com.hr.backend.domain.notification.service.NotificationService;
import com.hr.backend.domain.user.entity.User;
import com.hr.backend.domain.user.repository.UserRepository;
import com.hr.backend.employee.dto.response.CourseResponse;
import com.hr.backend.employee.exception.AlreadyExistsException;
import com.hr.backend.employee.exception.BadRequestException;
import com.hr.backend.employee.exception.ForbiddenException;
import com.hr.backend.employee.exception.ResourceNotFoundException;
import com.hr.backend.employee.util.CurrentUserProvider;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageImpl;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;
import java.util.Comparator;
import java.util.List;
import java.util.Optional;

@Service
@RequiredArgsConstructor
@Transactional(readOnly = true)
public class EmployeeCourseService {
    private final CourseRepository courseRepository;
    private final EnrollmentRepository enrollmentRepository;
    private final UserRepository userRepository;
    private final CurrentUserProvider currentUserProvider;
    private final NotificationService notificationService;

    public Page<CourseResponse.CourseListItem> getAllCourses(String searchKeyword, String category, Pageable pageable) {
        User currentUser = getCurrentUser();
        List<CourseResponse.CourseListItem> items = courseRepository.findAllByActiveTrue().stream()
                .filter(c -> searchKeyword == null || searchKeyword.isBlank() || c.getTitle().contains(searchKeyword))
                .filter(c -> category == null || category.isBlank() || category.equals(c.getCategory()))
                .filter(c -> c.getTargetRole() == 0 || c.getTargetRole() == currentUser.getEmpType())
                .map(c -> toListItem(c, currentUser))
                .toList();
        return toPage(items, pageable);
    }

    public CourseResponse.CourseDetailResponse getCourseDetail(Long courseId) {
        User currentUser = getCurrentUser();
        Course course = courseRepository.findById(courseId)
                .orElseThrow(() -> new ResourceNotFoundException("Course", "courseId", courseId));
        if (!course.isActive()) throw new BadRequestException("비활성 상태의 강좌입니다.");
        if (course.getTargetRole() != 0 && course.getTargetRole() != currentUser.getEmpType()) {
            throw new ForbiddenException("해당 강좌는 접근 권한이 없습니다.");
        }
        Optional<Enrollment> enrollment = findEnrollment(currentUser, course);
        List<CourseResponse.CourseVideoResponse> videos = course.getLectures().stream()
                .flatMap(l -> l.getVideos().stream())
                .sorted(Comparator.comparingInt(CourseVideo::getSortOrder))
                .map(v -> CourseResponse.CourseVideoResponse.builder()
                        .videoId(v.getVideoId()).title(v.getTitle()).videoURL(v.getVideoUrl())
                        .durationSec(v.getDurationSec()).sortOrder(v.getSortOrder()).build())
                .toList();
        CourseResponse.EnrollmentStatusDto status = enrollment.map(e -> CourseResponse.EnrollmentStatusDto.builder()
                .enrollmentId(e.getEnrollmentId()).progress(e.getProgress()).status(e.getStatus().name()).userId(currentUser.getUserId()).build()).orElse(null);
        return CourseResponse.CourseDetailResponse.builder()
                .courseId(course.getCourseId()).title(course.getTitle()).description(course.getDescription())
                .category(course.getCategory()).targetRole(String.valueOf(course.getTargetRole()))
                .durationMin(course.getDurationMin()).thumbnailURL(course.getThumbnailUrl())
                .deadline(getDeadline(course)).isActive(course.isActive()).myEnrollmentStatus(status).videos(videos).build();
    }

    @Transactional
    public void enrollCourse(Long courseId) {
        User user = getCurrentUser();
        Course course = courseRepository.findById(courseId)
                .orElseThrow(() -> new ResourceNotFoundException("Course", "courseId", courseId));
        CourseRound round = course.getRounds().stream().filter(CourseRound::isOpen).findFirst()
                .orElseGet(() -> course.getRounds().stream().findFirst()
                        .orElseThrow(() -> new BadRequestException("등록 가능한 차수가 없습니다.")));
        if (enrollmentRepository.existsByUser_UserIdAndRound_RoundId(user.getUserId(), round.getRoundId())) {
            throw new AlreadyExistsException("이미 수강 신청한 강좌입니다.");
        }
        Enrollment enrollment = Enrollment.builder().user(user).round(round).build();
        enrollment.approve();  // 자체 신청 즉시 승인 처리 (이수증 발급 조건 충족을 위해)
        enrollment.changeStatus(Enrollment.Status.IN_PROGRESS);
        Enrollment saved = enrollmentRepository.save(enrollment);
        // 수강 승인 알림 발송
        notificationService.notifyEnrollmentApproved(
                user,
                round.getCourse().getTitle(),
                saved.getEnrollmentId());
    }

    private CourseResponse.CourseListItem toListItem(Course c, User user) {
        Optional<Enrollment> enrollment = findEnrollment(user, c);
        return CourseResponse.CourseListItem.builder()
                .courseId(c.getCourseId()).title(c.getTitle()).category(c.getCategory())
                .durationMin(c.getDurationMin()).thumbnailURL(c.getThumbnailUrl()).deadline(getDeadline(c))
                .isEnrolled(enrollment.isPresent()).enrollmentProgress(enrollment.map(Enrollment::getProgress).orElse(null)).build();
    }

    private Optional<Enrollment> findEnrollment(User user, Course course) {
        return enrollmentRepository.findAllByUserId(user.getUserId()).stream()
                .filter(e -> e.getRound().getCourse().getCourseId().equals(course.getCourseId())).findFirst();
    }
    private User getCurrentUser(){Long id=currentUserProvider.getCurrentUserId();return userRepository.findById(id).orElseThrow(() -> new ResourceNotFoundException("User", "userId", id));}
    private LocalDate getDeadline(Course c){return c.getRounds().stream().map(CourseRound::getEndDate).max(LocalDate::compareTo).orElse(null);}    
    private <T> Page<T> toPage(List<T> list, Pageable pageable){int start=(int)Math.min(pageable.getOffset(), list.size());int end=Math.min(start+pageable.getPageSize(), list.size());return new PageImpl<>(list.subList(start,end), pageable, list.size());}
}
