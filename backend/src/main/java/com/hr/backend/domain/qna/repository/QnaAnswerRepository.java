package com.hr.backend.domain.qna.repository;

import com.hr.backend.domain.qna.entity.QnaAnswer;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface QnaAnswerRepository extends JpaRepository<QnaAnswer, Long> {
    // 질문 ID로 답변 목록 조회 (question 연관관계 기준)
    List<QnaAnswer> findByQuestion_QuestionId(Long questionId);

    // 질문 ID로 답변 수 조회
    int countByQuestion_QuestionId(Long questionId);
}
