package com.hr.backend.employee.service;

import com.hr.backend.domain.course.entity.CourseRound;
import com.hr.backend.domain.enrollment.entity.Enrollment;
import com.hr.backend.domain.enrollment.repository.EnrollmentRepository;
import com.hr.backend.domain.notice.repository.NoticeRepository;
import com.hr.backend.domain.notification.repository.NotificationRepository;
import com.hr.backend.domain.user.entity.User;
import com.hr.backend.domain.user.repository.UserRepository;
import com.hr.backend.employee.dto.response.DashboardResponse;
import com.hr.backend.employee.exception.ResourceNotFoundException;
import com.hr.backend.employee.util.CurrentUserProvider;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;
import java.util.List;

@Service
@RequiredArgsConstructor
@Transactional(readOnly = true)
public class EmployeeDashboardService {
    private final UserRepository userRepository;
    private final EnrollmentRepository enrollmentRepository;
    private final NoticeRepository noticeRepository;
    private final NotificationRepository notificationRepository;
    private final CurrentUserProvider currentUserProvider;

    public DashboardResponse getDashboardData() {
        User user = getCurrentUser();

        List<Enrollment> enrollments = enrollmentRepository.findAllByUserId(user.getUserId())
                .stream().filter(e -> e.getRound().getCourse().isActive()).toList();

        long completed = enrollments.stream().filter(e -> e.getStatus() == Enrollment.Status.DONE).count();
        long current   = enrollments.stream().filter(e -> e.getStatus() != Enrollment.Status.DONE).count();
        double avg     = enrollments.stream().mapToInt(Enrollment::getProgress).average().orElse(0.0);

        List<DashboardResponse.DashboardCourseItem> courses = enrollments.stream()
                .filter(e -> e.getStatus() != Enrollment.Status.DONE)
                .map(e -> DashboardResponse.DashboardCourseItem.builder()
                        .courseId(e.getRound().getCourse().getCourseId())
                        .title(e.getRound().getCourse().getTitle())
                        .thumbnailURL(e.getRound().getCourse().getThumbnailUrl())
                        .progress(e.getProgress())
                        .status(e.getStatus().name())
                        .deadline(e.getRound().getEndDate())
                        .build())
                .toList();

        List<DashboardResponse.DashboardNoticeItem> notices = noticeRepository.findAllWithAuthor().stream()
                .limit(5)
                .map(n -> DashboardResponse.DashboardNoticeItem.builder()
                        .noticeId(n.getNoticeId())
                        .title(n.getTitle())
                        .contentPreview(preview(n.getContent()))
                        .isPinned(false)
                        .build())
                .toList();

        long unreadCount = notificationRepository.countByUser_UserIdAndIsReadFalse(user.getUserId());

        return DashboardResponse.builder()
                .userName(user.getName())
                .currentCoursesCount(current)
                .completedCoursesCount(completed)
                .overallCompletionRate(avg)
                .inProgressCourses(courses)
                .mandatoryCoursesStatus(courses.stream()
                        .filter(c -> c.getDeadline() == null || !c.getDeadline().isBefore(LocalDate.now()))
                        .toList())
                .recentNotices(notices)
                .unreadNotificationsCount(unreadCount)
                .build();
    }

    private User getCurrentUser() {
        Long id = currentUserProvider.getCurrentUserId();
        return userRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("User", "userId", id));
    }

    private String preview(String s) {
        if (s == null) return "";
        return s.length() > 80 ? s.substring(0, 80) + "..." : s;
    }
}
