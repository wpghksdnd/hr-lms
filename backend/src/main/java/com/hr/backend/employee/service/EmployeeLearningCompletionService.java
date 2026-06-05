package com.hr.backend.employee.service;

import com.hr.backend.domain.course.entity.Course;
import com.hr.backend.domain.course.entity.Lecture;
import com.hr.backend.domain.course.entity.LectureProgress;
import com.hr.backend.domain.course.repository.LectureProgressRepository;
import com.hr.backend.domain.enrollment.entity.Enrollment;
import com.hr.backend.domain.enrollment.repository.EnrollmentRepository;
import com.hr.backend.domain.enrollment.service.CertificateWorkflowService;
import com.hr.backend.domain.quiz.repository.AttemptRepository;
// import com.hr.backend.domain.survey.repository.SurveyRepository;
// import com.hr.backend.domain.survey.repository.SurveyResponseRepository;
import com.hr.backend.domain.user.entity.User;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@RequiredArgsConstructor
public class EmployeeLearningCompletionService {
    private final LectureProgressRepository lectureProgressRepository;
    private final AttemptRepository attemptRepository;
    private final EnrollmentRepository enrollmentRepository;
    private final CertificateWorkflowService certificateWorkflowService;
    // private final SurveyRepository surveyRepository;
    // private final SurveyResponseRepository surveyResponseRepository;

    @Transactional
    public void completeLectureIfReady(User user, Lecture lecture) {
        boolean quizPassed = attemptRepository.existsByUser_UserIdAndQuiz_Lecture_LectureIdAndPassedTrue(user.getUserId(), lecture.getLectureId())
                || lecture.getVideos().isEmpty();
        if (quizPassed || lecture.getVideos().isEmpty()) {
            LectureProgress progress = lectureProgressRepository.findByUser_UserIdAndLecture_LectureId(user.getUserId(), lecture.getLectureId())
                    .orElseGet(() -> LectureProgress.builder().user(user).lecture(lecture).build());
            progress.complete();
            lectureProgressRepository.save(progress);
            recalculateEnrollmentProgress(user, lecture.getCourse());
        }
    }

    @Transactional
    public void recalculateEnrollmentProgress(User user, Course course) {
        int total = course.getLectures().size();
        int completed = total == 0 ? 0 : (int) lectureProgressRepository.countByUser_UserIdAndLecture_Course_CourseIdAndCompletedTrue(user.getUserId(), course.getCourseId());
        int progress = total == 0 ? 0 : Math.min(100, (completed * 100) / total);
        enrollmentRepository.findAllByUserId(user.getUserId()).stream()
                .filter(e -> e.getRound().getCourse().getCourseId().equals(course.getCourseId()))
                .findFirst()
                .ifPresent(e -> {
                    e.updateProgress(progress);
                    if (canIssueCertificate(user, e)) {
                        e.updateProgress(100);
                        // CertificateWorkflowService를 통해 이수증 발급 (n8n 연동 or 직접 PDF 생성)
                        certificateWorkflowService.triggerCompletionWorkflow(e);
                    }
                });
    }

    @Transactional(readOnly = true)
    public boolean canIssueCertificate(User user, Enrollment enrollment) {
        Course course = enrollment.getRound().getCourse();
        int totalLectures = course.getLectures().size();
        long completedLectures = lectureProgressRepository.countByUser_UserIdAndLecture_Course_CourseIdAndCompletedTrue(user.getUserId(), course.getCourseId());
        // 영상이 없는 단원은 별도 시청 없이 완료로 간주 (콘텐츠 없는 단원은 수강 대상 아님)
        long emptyLectures = course.getLectures().stream()
                .filter(l -> l.getVideos().isEmpty()).count();
        boolean lecturesDone = totalLectures == 0 || (completedLectures + emptyLectures) >= totalLectures;
        boolean examPassed = attemptRepository.existsByUser_UserIdAndExam_Course_CourseIdAndPassedTrue(user.getUserId(), course.getCourseId());
        boolean surveyCompleted = true;
        // boolean surveySubmitted = surveyRepository.findFirstByCourse_CourseIdAndActiveTrue(course.getCourseId())
        //         .map(s -> surveyResponseRepository.existsBySurvey_SurveyIdAndUser_UserId(s.getSurveyId(), user.getUserId()))
        //         .orElse(true);
        return enrollment.getApprovalStatus() == Enrollment.ApprovalStatus.APPROVED && lecturesDone && examPassed && surveyCompleted;
    }
}
