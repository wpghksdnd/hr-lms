package com.hr.backend.employee.service;

import com.hr.backend.domain.course.entity.Course;
import com.hr.backend.domain.course.repository.CourseRepository;
import com.hr.backend.domain.qna.entity.QnaAnswer;
import com.hr.backend.domain.qna.entity.QnaQuestion;
import com.hr.backend.domain.qna.repository.QnaAnswerRepository;
import com.hr.backend.domain.qna.repository.QnaQuestionRepository;
import com.hr.backend.domain.user.entity.User;
import com.hr.backend.employee.dto.request.QnaQuestionRequest;
import com.hr.backend.employee.dto.response.QnaBoardItemResponse;
import com.hr.backend.employee.dto.response.QnaResponse;
import com.hr.backend.employee.exception.ResourceNotFoundException;
import com.hr.backend.employee.util.CurrentUserProvider;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.Comparator;
import java.util.List;

@Service
@RequiredArgsConstructor
@Transactional(readOnly = true)
public class EmployeeQnaService {

    private final QnaQuestionRepository qnaQuestionRepository;
    private final QnaAnswerRepository   qnaAnswerRepository;
    private final CourseRepository      courseRepository;
    private final CurrentUserProvider   currentUserProvider;

    /** 게시판 전체 목록 — content/answers 없이, isMine 플래그 포함 */
    public List<QnaBoardItemResponse> getBoardQuestions() {
        User me = currentUserProvider.getCurrentUser();
        return qnaQuestionRepository.findAllByOrderByCreatedAtDesc().stream()
                .map(q -> QnaBoardItemResponse.builder()
                        .questionId(q.getQuestionId())
                        .courseId(q.getCourse().getCourseId())
                        .courseTitle(q.getCourse().getTitle())
                        .title(q.getTitle())
                        .authorName(q.getUser().getName())
                        .resolved(q.isResolved())
                        .answerCount(qnaAnswerRepository.countByQuestion_QuestionId(q.getQuestionId()))
                        .isMine(q.getUser().getUserId().equals(me.getUserId()))
                        .createdAt(q.getCreatedAt())
                        .build())
                .toList();
    }

    public List<QnaResponse> getMyQuestions() {
        User user = currentUserProvider.getCurrentUser();
        return qnaQuestionRepository
                .findAllByUser_UserIdOrderByCreatedAtDesc(user.getUserId()).stream()
                .sorted(Comparator.comparing(QnaQuestion::getCreatedAt,
                        Comparator.nullsLast(Comparator.naturalOrder())).reversed())
                .map(this::toDto)
                .toList();
    }

    public List<QnaResponse> getCourseQuestions(Long courseId) {
        User user = currentUserProvider.getCurrentUser();
        return qnaQuestionRepository
                .findAllByUser_UserIdAndCourse_CourseIdOrderByCreatedAtDesc(user.getUserId(), courseId).stream()
                .sorted(Comparator.comparing(QnaQuestion::getCreatedAt,
                        Comparator.nullsLast(Comparator.naturalOrder())).reversed())
                .map(this::toDto)
                .toList();
    }

    public QnaResponse getQuestion(Long questionId) {
        User user = currentUserProvider.getCurrentUser();
        QnaQuestion q = qnaQuestionRepository.findById(questionId)
                .orElseThrow(() -> new ResourceNotFoundException("QnaQuestion", "questionId", questionId));
        if (!q.getUser().getUserId().equals(user.getUserId())) {
            throw new ResourceNotFoundException("QnaQuestion", "questionId", questionId);
        }
        return toDto(q);
    }

    @Transactional
    public QnaResponse createQuestion(QnaQuestionRequest request) {
        User user = currentUserProvider.getCurrentUser();
        Course course = courseRepository.findById(request.getCourseId())
                .orElseThrow(() -> new ResourceNotFoundException("Course", "courseId", request.getCourseId()));

        QnaQuestion question = QnaQuestion.builder()
                .user(user)
                .course(course)
                .title(request.getTitle())
                .content(request.getContent())
                .build();

        return toDto(qnaQuestionRepository.save(question));
    }

    private QnaResponse toDto(QnaQuestion q) {
        String courseTitle = q.getCourse().getTitle();

        List<QnaResponse.AnswerItem> answers = qnaAnswerRepository
                .findByQuestion_QuestionId(q.getQuestionId()).stream()
                .map(a -> QnaResponse.AnswerItem.builder()
                        .answerId(a.getAnswerId())
                        .authorName(a.getAuthor().getName())
                        .content(a.getContent())
                        .createdAt(a.getCreatedAt())
                        .build())
                .toList();

        return QnaResponse.builder()
                .questionId(q.getQuestionId())
                .courseId(q.getCourse().getCourseId())
                .courseTitle(courseTitle)
                .title(q.getTitle())
                .content(q.getContent())
                .resolved(q.isResolved())
                .createdAt(q.getCreatedAt())
                .answers(answers)
                .build();
    }
}
