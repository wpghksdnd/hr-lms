package com.hr.backend.domain.enrollment;

import com.hr.backend.domain.course.entity.Course;
import com.hr.backend.domain.course.entity.CourseRound;
import com.hr.backend.domain.course.entity.Lecture;
import com.hr.backend.domain.course.repository.CourseRoundRepository;
import com.hr.backend.domain.enrollment.entity.Enrollment;
import com.hr.backend.domain.enrollment.repository.EnrollmentRepository;
import com.hr.backend.domain.enrollment.service.CertificateWorkflowService;
import com.hr.backend.domain.enrollment.service.EnrollmentService;
import com.hr.backend.domain.notification.service.NotificationService;
import com.hr.backend.domain.quiz.repository.AttemptRepository;
import com.hr.backend.domain.quiz.repository.ExamRepository;
import com.hr.backend.domain.quiz.repository.QuizRepository;
import com.hr.backend.domain.user.entity.User;
import com.hr.backend.domain.user.repository.UserRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.List;
import java.util.Optional;

import static org.assertj.core.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.BDDMockito.*;

@ExtendWith(MockitoExtension.class)
class EnrollmentServiceTest {

    @InjectMocks EnrollmentService enrollmentService;

    @Mock EnrollmentRepository  enrollmentRepository;
    @Mock UserRepository        userRepository;
    @Mock CourseRoundRepository courseRoundRepository;
    @Mock NotificationService   notificationService;
    @Mock AttemptRepository     attemptRepository;
    @Mock ExamRepository        examRepository;
    @Mock QuizRepository        quizRepository;
    @Mock CertificateWorkflowService certificateWorkflowService;

    private Enrollment enrollment;
    private User user;
    private Course course;
    private CourseRound round;

    @BeforeEach
    void setUp() {
        user   = mock(User.class);
        course = mock(Course.class);
        round  = mock(CourseRound.class);
        enrollment = mock(Enrollment.class);

        given(user.getUserId()).willReturn(1L);
        given(course.getCourseId()).willReturn(10L);
        given(round.getCourse()).willReturn(course);
        given(enrollment.getUser()).willReturn(user);
        given(enrollment.getRound()).willReturn(round);
        given(enrollmentRepository.findById(1L)).willReturn(Optional.of(enrollment));
    }

    // ── 이수 조건 — 진도율 ──────────────────────────────────────────────────────

    @Test
    @DisplayName("진도율 80% 미만이면 이수 처리 실패")
    void completeEnrollment_progressUnder80_throws() {
        given(enrollment.getProgress()).willReturn(79);

        assertThatThrownBy(() -> enrollmentService.completeEnrollment(1L))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("진도율 80%");
    }

    @Test
    @DisplayName("시험 미통과 시 이수 처리 실패")
    void completeEnrollment_examNotPassed_throws() {
        given(enrollment.getProgress()).willReturn(100);
        given(course.getLectures()).willReturn(List.of());
        given(examRepository.existsByCourse_CourseId(10L)).willReturn(true);
        given(attemptRepository.existsByUser_UserIdAndExam_Course_CourseIdAndPassedTrue(1L, 10L))
                .willReturn(false);

        assertThatThrownBy(() -> enrollmentService.completeEnrollment(1L))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("최종 시험");
    }

    @Test
    @DisplayName("퀴즈 미통과 시 이수 처리 실패")
    void completeEnrollment_quizNotPassed_throws() {
        Lecture lecture = mock(Lecture.class);
        given(lecture.getLectureId()).willReturn(100L);

        given(enrollment.getProgress()).willReturn(100);
        given(course.getLectures()).willReturn(List.of(lecture));
        given(examRepository.existsByCourse_CourseId(10L)).willReturn(false);
        given(quizRepository.existsByLecture_LectureId(100L)).willReturn(true);
        given(attemptRepository.existsByUser_UserIdAndQuiz_Lecture_LectureIdAndPassedTrue(1L, 100L))
                .willReturn(false);

        assertThatThrownBy(() -> enrollmentService.completeEnrollment(1L))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("퀴즈");
    }

    @Test
    @DisplayName("모든 조건 충족 시 이수 처리 성공")
    void completeEnrollment_allConditionsMet_succeeds() {
        given(enrollment.getProgress()).willReturn(100);
        given(course.getLectures()).willReturn(List.of());
        given(examRepository.existsByCourse_CourseId(10L)).willReturn(true);
        given(attemptRepository.existsByUser_UserIdAndExam_Course_CourseIdAndPassedTrue(1L, 10L))
                .willReturn(true);
        given(enrollment.getStatus()).willReturn(Enrollment.Status.IN_PROGRESS);
        // EnrollmentResponse 생성에 필요한 stub
        given(user.getName()).willReturn("홍길동");
        given(round.getRoundId()).willReturn(5L);
        given(enrollment.getApprovalStatus()).willReturn(Enrollment.ApprovalStatus.APPROVED);

        // 이수 완료가 정상 호출되는지 확인 (예외 없음)
        assertThatCode(() -> enrollmentService.completeEnrollment(1L))
                .doesNotThrowAnyException();

        then(enrollment).should().changeStatus(Enrollment.Status.DONE);
        then(certificateWorkflowService).should().triggerCompletionWorkflow(enrollment);
    }

    // ── 승인/반려 ────────────────────────────────────────────────────────────────

    @Test
    @DisplayName("이미 승인된 수강 신청을 재승인하면 예외 발생")
    void approveEnrollment_alreadyApproved_throws() {
        given(enrollment.getApprovalStatus()).willReturn(Enrollment.ApprovalStatus.APPROVED);

        assertThatThrownBy(() -> enrollmentService.approveEnrollment(1L))
                .isInstanceOf(IllegalStateException.class)
                .hasMessageContaining("이미 승인");
    }

    @Test
    @DisplayName("이미 반려된 수강 신청을 재반려하면 예외 발생")
    void rejectEnrollment_alreadyRejected_throws() {
        given(enrollment.getApprovalStatus()).willReturn(Enrollment.ApprovalStatus.REJECTED);

        assertThatThrownBy(() -> enrollmentService.rejectEnrollment(1L))
                .isInstanceOf(IllegalStateException.class)
                .hasMessageContaining("이미 반려");
    }
}
