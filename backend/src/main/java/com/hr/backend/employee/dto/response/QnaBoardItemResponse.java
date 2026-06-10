package com.hr.backend.employee.dto.response;

import lombok.Builder;
import lombok.Getter;
import java.time.LocalDateTime;

@Getter @Builder
public class QnaBoardItemResponse {
    private Long      questionId;
    private Long      courseId;
    private String    courseTitle;
    private String    title;
    private String    authorName;   // 작성자 이름 (게시판 표시용)
    private boolean   resolved;
    private int       answerCount;
    private boolean   isMine;       // 현재 로그인 유저가 작성한 글 여부
    private LocalDateTime createdAt;
}
