package com.hr.backend.domain.quiz.service;

import com.hr.backend.domain.course.entity.Lecture;
import com.hr.backend.domain.course.entity.LectureProgress;
import com.hr.backend.domain.course.repository.LectureProgressRepository;
import com.hr.backend.domain.course.repository.LectureRepository;
import com.hr.backend.domain.enrollment.entity.Enrollment;
import com.hr.backend.domain.enrollment.repository.EnrollmentRepository;
import com.hr.backend.domain.enrollment.service.EnrollmentService;
import com.hr.backend.domain.quiz.dto.AttemptRequest;
import com.hr.backend.domain.quiz.dto.AttemptResponse;
import com.hr.backend.domain.quiz.entity.Attempt;
import com.hr.backend.domain.quiz.entity.AttemptAnswer;
import com.hr.backend.domain.quiz.entity.Choice;
import com.hr.backend.domain.quiz.entity.Exam;
import com.hr.backend.domain.quiz.entity.Question;
import com.hr.backend.domain.quiz.entity.Quiz;
import com.hr.backend.domain.quiz.repository.AttemptAnswerRepository;
import com.hr.backend.domain.quiz.repository.AttemptRepository;
import com.hr.backend.domain.quiz.repository.ExamRepository;
import com.hr.backend.domain.quiz.repository.QuizRepository;
import com.hr.backend.domain.user.entity.User;
import com.hr.backend.domain.user.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.ArrayList;
import java.util.List;
import java.util.Map;

@Slf4j
@Service
@RequiredArgsConstructor
@Transactional(readOnly = true)
public class AttemptService {

    private final AttemptRepository         attemptRepository;
    private final AttemptAnswerRepository   attemptAnswerRepository;
    private final QuizRepository            quizRepository;
    private final ExamRepository            examRepository;
    private final UserRepository            userRepository;
    private final LectureRepository         lectureRepository;
    private final LectureProgressRepository lectureProgressRepository;
    private final EnrollmentRepository      enrollmentRepository;
    private final EnrollmentService         enrollmentService;

    // ──────────────────────────────────────────────────────────
    // 퀴즈 응시
    // ──────────────────────────────────────────────────────────

    /**
     * 퀴즈 제출 → 채점 → 문항별 답안 저장 → LectureProgress 완료 처리(통과 시)
     */
    @Transactional
    public AttemptResponse submitQuiz(Long userId, Long lectureId, AttemptRequest req) {
        User user = findUser(userId);
        Quiz quiz = quizRepository.findByLecture_LectureId(lectureId)
                .orElseThrow(() -> new IllegalArgumentException("해당 강의의 퀴즈가 없습니다."));

        GradeResult result = grade(quiz.getQuestions(), req.getAnswers());

        Attempt attempt = Attempt.builder()
                .user(user)
                .quiz(quiz)
                .exam(null)
                .score(result.score())
                .passScore(quiz.getPassScore())
                .build();
        Attempt saved = attemptRepository.save(attempt);

        // 문항별 답안 저장
        saveAttemptAnswers(saved, result.answers());

        // 통과 시 LectureProgress 완료 처리
        if (saved.isPassed()) {
            completeLectureProgress(user, quiz.getLecture());
        }

        return new AttemptResponse(saved);
    }

    /** 퀴즈 응시 이력 조회 */
    public List<AttemptResponse> getQuizAttempts(Long userId, Long lectureId) {
        Quiz quiz = quizRepository.findByLecture_LectureId(lectureId)
                .orElseThrow(() -> new IllegalArgumentException("해당 강의의 퀴즈가 없습니다."));
        return attemptRepository
                .findByUser_UserIdAndQuiz_QuizIdOrderByAttemptedAtDesc(userId, quiz.getQuizId())
                .stream().map(AttemptResponse::new).toList();
    }

    // ──────────────────────────────────────────────────────────
    // 시험 응시
    // ──────────────────────────────────────────────────────────

    /**
     * 시험 제출 → 채점 → 문항별 답안 저장 → Enrollment DONE + 이수증 트리거(통과 시)
     */
    @Transactional
    public AttemptResponse submitExam(Long userId, Long courseId, AttemptRequest req) {
        User user = findUser(userId);
        Exam exam = examRepository.findByCourse_CourseId(courseId)
                .orElseThrow(() -> new IllegalArgumentException("해당 강좌의 시험이 없습니다."));

        GradeResult result = grade(exam.getQuestions(), req.getAnswers());

        Attempt attempt = Attempt.builder()
                .user(user)
                .quiz(null)
                .exam(exam)
                .score(result.score())
                .passScore(exam.getPassScore())
                .build();
        Attempt saved = attemptRepository.save(attempt);

        // 문항별 답안 저장
        saveAttemptAnswers(saved, result.answers());

        // 통과 시 수강 완료(DONE) 처리 + 이수증 트리거
        if (saved.isPassed()) {
            completeEnrollmentAndTriggerCertificate(user, courseId);
        }

        return new AttemptResponse(saved);
    }

    /** 시험 응시 이력 조회 */
    public List<AttemptResponse> getExamAttempts(Long userId, Long courseId) {
        Exam exam = examRepository.findByCourse_CourseId(courseId)
                .orElseThrow(() -> new IllegalArgumentException("해당 강좌의 시험이 없습니다."));
        return attemptRepository
                .findByUser_UserIdAndExam_ExamIdOrderByAttemptedAtDesc(userId, exam.getExamId())
                .stream().map(AttemptResponse::new).toList();
    }

    // ──────────────────────────────────────────────────────────
    // private helpers
    // ──────────────────────────────────────────────────────────

    /** 채점 결과 — 총점 + 문항별 답안 목록 */
    private record GradeResult(int score, List<AttemptAnswer.Draft> answers) {}

    /**
     * 채점: 정답 선택지와 제출 답안 비교 → 총점 + 문항별 정오답 Draft 반환
     * Draft는 Attempt FK가 없는 임시 객체이며, saveAttemptAnswers()에서 영속화함
     */
    private GradeResult grade(List<Question> questions, Map<Long, Long> answers) {
        if (answers == null || answers.isEmpty()) {
            return new GradeResult(0, List.of());
        }

        int totalScore = 0;
        List<AttemptAnswer.Draft> drafts = new ArrayList<>();

        for (Question q : questions) {
            Long submittedChoiceId = answers.get(q.getQuestionId());

            Choice selectedChoice = submittedChoiceId == null ? null :
                    q.getChoices().stream()
                            .filter(c -> c.getChoiceId().equals(submittedChoiceId))
                            .findFirst()
                            .orElse(null);

            boolean correct = selectedChoice != null && selectedChoice.isCorrect();
            if (correct) totalScore += q.getScore();

            drafts.add(new AttemptAnswer.Draft(q, selectedChoice, correct));
        }
        return new GradeResult(totalScore, drafts);
    }

    /** 문항별 답안을 attempt_answers 테이블에 일괄 저장 */
    private void saveAttemptAnswers(Attempt attempt, List<AttemptAnswer.Draft> drafts) {
        List<AttemptAnswer> entities = drafts.stream()
                .map(d -> AttemptAnswer.builder()
                        .attempt(attempt)
                        .question(d.question())
                        .choice(d.choice())
                        .correct(d.correct())
                        .build())
                .toList();
        attemptAnswerRepository.saveAll(entities);
    }

    /** 강의 완료 처리 — 이미 완료된 경우 멱등성 보장 */
    private void completeLectureProgress(User user, Lecture lecture) {
        LectureProgress progress = lectureProgressRepository
                .findByUser_UserIdAndLecture_LectureId(user.getUserId(), lecture.getLectureId())
                .orElseGet(() -> LectureProgress.builder().user(user).lecture(lecture).build());

        if (!progress.isCompleted()) {
            progress.complete();
            lectureProgressRepository.save(progress);
        }
    }

    /** 수강 완료(DONE) 처리 + 이수증 트리거 — 진행 중인 수강 내역 대상 */
    private void completeEnrollmentAndTriggerCertificate(User user, Long courseId) {
        enrollmentRepository
                .findAllByUserId(user.getUserId())
                .stream()
                .filter(e -> e.getRound().getCourse().getCourseId().equals(courseId)
                        && e.getStatus() == Enrollment.Status.IN_PROGRESS)
                .forEach(enrollment -> {
                    try {
                        // completeEnrollment 내부에서 triggerCompletionWorkflow 호출됨 — 중복 호출 제거
                        enrollmentService.completeEnrollment(enrollment.getEnrollmentId());
                    } catch (IllegalArgumentException ex) {
                        // 시험은 통과했지만 나머지 완료 조건(진도/퀴즈)을 충족하지 못한 경우
                        log.debug("수강 완료 조건 미충족으로 DONE 처리 생략 - enrollmentId={} reason={}",
                                enrollment.getEnrollmentId(), ex.getMessage());
                    }
                });
    }

    private User findUser(Long userId) {
        return userRepository.findById(userId)
                .orElseThrow(() -> new IllegalArgumentException("사용자를 찾을 수 없습니다."));
    }
}
