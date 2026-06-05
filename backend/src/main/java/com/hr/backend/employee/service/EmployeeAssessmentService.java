package com.hr.backend.employee.service;

import com.hr.backend.domain.quiz.entity.*;
import com.hr.backend.domain.quiz.repository.*;
import com.hr.backend.domain.user.entity.User;
import com.hr.backend.employee.dto.request.AnswerSubmitRequest;
import com.hr.backend.employee.dto.response.AssessmentResponse;
import com.hr.backend.employee.dto.response.AttemptResponse;
import com.hr.backend.employee.exception.ResourceNotFoundException;
import com.hr.backend.employee.util.CurrentUserProvider;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.Map;

@Service
@RequiredArgsConstructor
@Transactional(readOnly = true)
public class EmployeeAssessmentService {
    private final QuizRepository quizRepository;
    private final ExamRepository examRepository;
    private final AttemptRepository attemptRepository;
    private final CurrentUserProvider currentUserProvider;
    private final EmployeeLearningCompletionService completionService;

    public AssessmentResponse getQuizByLecture(Long lectureId) {
        Quiz quiz = quizRepository.findByLecture_LectureId(lectureId)
                .orElseThrow(() -> new ResourceNotFoundException("Quiz", "lectureId", lectureId));
        return toResponse("QUIZ", quiz.getQuizId(), quiz.getTitle(), quiz.getPassScore(), quiz.getQuestions());
    }

    public AssessmentResponse getExamByCourse(Long courseId) {
        Exam exam = examRepository.findByCourse_CourseId(courseId)
                .orElseThrow(() -> new ResourceNotFoundException("Exam", "courseId", courseId));
        return toResponse("EXAM", exam.getExamId(), exam.getTitle(), exam.getPassScore(), exam.getQuestions());
    }

    @Transactional
    public AttemptResponse submitQuiz(Long quizId, AnswerSubmitRequest request) {
        User user = currentUserProvider.getCurrentUser();
        Quiz quiz = quizRepository.findById(quizId).orElseThrow(() -> new ResourceNotFoundException("Quiz", "quizId", quizId));
        int score = calculateScore(quiz.getQuestions(), request.getAnswers());
        Attempt attempt = attemptRepository.save(Attempt.builder().user(user).quiz(quiz).score(score).passScore(quiz.getPassScore()).build());
        if (attempt.isPassed()) completionService.completeLectureIfReady(user, quiz.getLecture());
        return toAttemptResponse("QUIZ", quizId, attempt);
    }

    @Transactional
    public AttemptResponse submitExam(Long examId, AnswerSubmitRequest request) {
        User user = currentUserProvider.getCurrentUser();
        Exam exam = examRepository.findById(examId).orElseThrow(() -> new ResourceNotFoundException("Exam", "examId", examId));
        int score = calculateScore(exam.getQuestions(), request.getAnswers());
        Attempt attempt = attemptRepository.save(Attempt.builder().user(user).exam(exam).score(score).passScore(exam.getPassScore()).build());
        if (attempt.isPassed()) completionService.recalculateEnrollmentProgress(user, exam.getCourse());
        return toAttemptResponse("EXAM", examId, attempt);
    }

    public List<AttemptResponse> getMyAttempts() {
        User user = currentUserProvider.getCurrentUser();
        return attemptRepository.findAllByUser_UserIdOrderByAttemptedAtDesc(user.getUserId()).stream()
                .map(a -> toAttemptResponse(a.getQuiz()!=null?"QUIZ":"EXAM", a.getQuiz()!=null?a.getQuiz().getQuizId():a.getExam().getExamId(), a))
                .toList();
    }

    private int calculateScore(List<Question> questions, Map<Long, Long> answers) {
        int score = 0;
        for (Question q : questions) {
            Long selectedChoiceId = answers.get(q.getQuestionId());
            if (selectedChoiceId == null) {
                continue;
            }
            boolean correct = q.getChoices().stream()
                    .anyMatch(c ->
                            c.getChoiceId().equals(selectedChoiceId)
                                    && c.isCorrect()
                    );
            if (correct) {
                score += q.getScore();
            }
        }
        return Math.min(score, 100);
    }

    private AssessmentResponse toResponse(String type, Long id, String title, int passScore, List<Question> questions) {
        return AssessmentResponse.builder().type(type).id(id).title(title).passScore(passScore)
                .questions(questions.stream().map(q -> AssessmentResponse.QuestionItem.builder()
                        .questionId(q.getQuestionId()).questionText(q.getQuestionText()).score(q.getScore()).sortOrder(q.getSortOrder())
                        .choices(q.getChoices().stream().map(c -> AssessmentResponse.ChoiceItem.builder()
                                .choiceId(c.getChoiceId()).choiceText(c.getChoiceText()).sortOrder(c.getSortOrder()).build()).toList())
                        .build()).toList()).build();
    }

    private AttemptResponse toAttemptResponse(String type, Long targetId, Attempt attempt) {
        return AttemptResponse.builder().attemptId(attempt.getAttemptId()).type(type).targetId(targetId)
                .score(attempt.getScore()).passed(attempt.isPassed()).attemptedAt(attempt.getAttemptedAt()).build();
    }
}
