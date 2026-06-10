package com.hr.backend.domain.qna.repository;

import com.hr.backend.domain.qna.entity.QnaQuestion;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface QnaQuestionRepository extends JpaRepository<QnaQuestion, Long> {

    List<QnaQuestion> findAllByOrderByCreatedAtDesc();

    List<QnaQuestion> findAllByResolvedFalseOrderByCreatedAtDesc();

    // 과정별 질문 목록 (course 연관관계 기준)
    List<QnaQuestion> findAllByCourse_CourseIdOrderByCreatedAtDesc(Long courseId);

    // 유저별 질문 목록 (user 연관관계 기준)
    List<QnaQuestion> findAllByUser_UserIdOrderByCreatedAtDesc(Long userId);

    // 유저 + 강좌 복합 조회 (내 강좌 Q&A)
    List<QnaQuestion> findAllByUser_UserIdAndCourse_CourseIdOrderByCreatedAtDesc(Long userId, Long courseId);
}
