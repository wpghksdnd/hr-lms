package com.hr.backend.employee.dto.response;

import com.fasterxml.jackson.annotation.JsonProperty;
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
    @JsonProperty("isMine")          // boolean + is 접두사 → Jackson이 "mine"으로 직렬화하는 것 방지
    private boolean   isMine;
    private LocalDateTime createdAt;
}
