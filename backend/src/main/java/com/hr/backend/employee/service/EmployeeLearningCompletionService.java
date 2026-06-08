package com.hr.backend.employee.service;

import com.hr.backend.domain.course.entity.Course;
import com.hr.backend.domain.course.entity.Lecture;
import com.hr.backend.domain.course.entity.LectureProgress;
import com.hr.backend.domain.course.repository.LectureProgressRepository;
import com.hr.backend.domain.enrollment.entity.Enrollment;
import com.hr.backend.domain.enrollment.repository.EnrollmentRepository;
import com.hr.backend.domain.quiz.repository.AttemptRepository;
import com.hr.backend.domain.quiz.repository.ExamRepository;
import com.hr.backend.domain.enrollment.service.EnrollmentService;
import com.hr.backend.domain.user.entity.User;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@RequiredArgsConstructor
public class EmployeeLearningCompletionService {
    private final LectureProgressRepository lectureProgressRepository;
    private final AttemptRepository attemptRepository;
    private final ExamRepository examRepository;
    private final EnrollmentRepository enrollmentRepository;
    private final EnrollmentService enrollmentService;

    @Transactional
    public void completeLectureIfReady(User user, Lecture lecture) {
        boolean hasVideos = !lecture.getVideos().isEmpty();
        boolean hasQuiz = hasVideos && attemptRepository
                .existsByUser_UserIdAndQuiz_Lecture_LectureIdAndPassedTrue(
                        user.getUserId(), lecture.getLectureId());
        boolean quizExists = hasVideos && lecture.getVideos().stream()
                .anyMatch(v -> v.getLecture() != null); // 퀴즈는 Attempt로 존재 여부 판단

        // 강의 완료 조건:
        //   1. 영상이 없는 강의 → 즉시 완료
        //   2. 영상이 있고 퀴즈를 통과 → 완료
        //   3. 영상이 있고 퀴즈 통과 이력이 없으면 → 미완료 (퀴즈가 실제로 없는 경우도 퀴즈 통과 여부가 false)
        boolean ready = !hasVideos || hasQuiz;
        if (ready) {
            LectureProgress progress = lectureProgressRepository
                    .findByUser_UserIdAndLecture_LectureId(user.getUserId(), lecture.getLectureId())
                    .orElseGet(() -> LectureProgress.builder().user(user).lecture(lecture).build());
            progress.complete();
            lectureProgressRepository.save(progress);
            recalculateEnrollmentProgress(user, lecture.getCourse());
        }
    }

    @Transactional
    public void recalculateEnrollmentProgress(User user, Course course) {
        int total = course.getLectures().size();
        int completed = total == 0 ? 0 : (int) lectureProgressRepository
                .countByUser_UserIdAndLecture_Course_CourseIdAndCompletedTrue(
                        user.getUserId(), course.getCourseId());
        int progress = total == 0 ? 0 : Math.min(100, (completed * 100) / total);
        enrollmentRepository.findAllByUserId(user.getUserId()).stream()
                .filter(e -> e.getRound().getCourse().getCourseId().equals(course.getCourseId()))
                .findFirst()
                .ifPresent(e -> {
                    e.updateProgress(progress);
                    if (canIssueCertificate(user, e)) {
                        enrollmentService.completeEnrollment(e.getEnrollmentId());
                    }
                });
    }

    @Transactional(readOnly = true)
    public boolean canIssueCertificate(User user, Enrollment enrollment) {
        Course course = enrollment.getRound().getCourse();
        int totalLectures = course.getLectures().size();
        long completedLectures = lectureProgressRepository
                .countByUser_UserIdAndLecture_Course_CourseIdAndCompletedTrue(
                        user.getUserId(), course.getCourseId());
        // 영상이 없는 단원은 완료로 간주
        long emptyLectures = course.getLectures().stream()
                .filter(l -> l.getVideos().isEmpty()).count();
        boolean lecturesDone = totalLectures == 0 || (completedLectures + emptyLectures) >= totalLectures;
        boolean examPassed = !examRepository.existsByCourse_CourseId(course.getCourseId())
                || attemptRepository.existsByUser_UserIdAndExam_Course_CourseIdAndPassedTrue(
                        user.getUserId(), course.getCourseId());
        return enrollment.getApprovalStatus() == Enrollment.ApprovalStatus.APPROVED
                && lecturesDone && examPassed;
    }
}
