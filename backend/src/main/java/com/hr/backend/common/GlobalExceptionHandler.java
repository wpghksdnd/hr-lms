package com.hr.backend.common;

import com.hr.backend.employee.exception.AlreadyExistsException;
import com.hr.backend.employee.exception.BadRequestException;
import com.hr.backend.employee.exception.ForbiddenException;
import com.hr.backend.employee.exception.ResourceNotFoundException;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.validation.FieldError;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;
import org.springframework.web.servlet.resource.NoResourceFoundException;

import java.util.LinkedHashMap;
import java.util.Map;
import java.util.stream.Collectors;

/**
 * 전역 예외 처리기 (단일 핸들러).
 *
 * ResourceNotFoundException → 404 Not Found
 * ForbiddenException        → 403 Forbidden
 * AlreadyExistsException    → 409 Conflict
 * BadRequestException       → 400 Bad Request
 * IllegalArgumentException  → 400 Bad Request
 * IllegalStateException     → 409 Conflict
 * @Valid 실패               → 400 + 필드별 오류 메시지
 * Exception                → 500 Internal Server Error
 */
@Slf4j
@RestControllerAdvice
public class GlobalExceptionHandler {

    /** 리소스를 찾을 수 없음 → 404 */
    @ExceptionHandler(ResourceNotFoundException.class)
    public ResponseEntity<Map<String, String>> handleNotFound(ResourceNotFoundException e) {
        log.warn("[NotFound] {}", e.getMessage());
        return ResponseEntity
                .status(HttpStatus.NOT_FOUND)
                .body(Map.of("error", e.getMessage()));
    }

    /** 접근 권한 없음 → 403 */
    @ExceptionHandler(ForbiddenException.class)
    public ResponseEntity<Map<String, String>> handleForbidden(ForbiddenException e) {
        log.warn("[Forbidden] {}", e.getMessage());
        return ResponseEntity
                .status(HttpStatus.FORBIDDEN)
                .body(Map.of("error", e.getMessage()));
    }

    /** 리소스 중복 → 409 */
    @ExceptionHandler(AlreadyExistsException.class)
    public ResponseEntity<Map<String, String>> handleAlreadyExists(AlreadyExistsException e) {
        log.warn("[Conflict] {}", e.getMessage());
        return ResponseEntity
                .status(HttpStatus.CONFLICT)
                .body(Map.of("error", e.getMessage()));
    }

    /** 잘못된 요청 (커스텀) → 400 */
    @ExceptionHandler(BadRequestException.class)
    public ResponseEntity<Map<String, String>> handleBadRequestException(BadRequestException e) {
        log.warn("[BadRequest] {}", e.getMessage());
        return ResponseEntity
                .badRequest()
                .body(Map.of("error", e.getMessage()));
    }

    /** 잘못된 입력값 (사번 중복, 존재하지 않는 리소스 등) → 400 */
    @ExceptionHandler(IllegalArgumentException.class)
    public ResponseEntity<Map<String, String>> handleBadRequest(IllegalArgumentException e) {
        log.warn("[BadRequest] {}", e.getMessage());
        return ResponseEntity
                .badRequest()
                .body(Map.of("error", e.getMessage()));
    }

    /** 이미 처리된 상태 변경 등 비즈니스 충돌 → 409 */
    @ExceptionHandler(IllegalStateException.class)
    public ResponseEntity<Map<String, String>> handleConflict(IllegalStateException e) {
        log.warn("[Conflict] {}", e.getMessage());
        return ResponseEntity
                .status(HttpStatus.CONFLICT)
                .body(Map.of("error", e.getMessage()));
    }

    /** @Valid 유효성 검증 실패 → 400 + 필드별 메시지 */
    @ExceptionHandler(MethodArgumentNotValidException.class)
    public ResponseEntity<Map<String, Object>> handleValidation(MethodArgumentNotValidException e) {
        Map<String, String> fieldErrors = e.getBindingResult().getFieldErrors().stream()
                .collect(Collectors.toMap(
                        FieldError::getField,
                        fe -> fe.getDefaultMessage() != null ? fe.getDefaultMessage() : "유효하지 않은 값",
                        (a, b) -> a,
                        LinkedHashMap::new
                ));

        Map<String, Object> body = new LinkedHashMap<>();
        body.put("error", "입력값 유효성 검사 실패");
        body.put("fields", fieldErrors);

        log.warn("[Validation] {}", fieldErrors);
        return ResponseEntity.badRequest().body(body);
    }

    /** 정적 리소스 없음 (favicon.ico, 루트 경로 등) → 404 (로그 없음) */
    @ExceptionHandler(NoResourceFoundException.class)
    public ResponseEntity<Void> handleNoResource(NoResourceFoundException e) {
        // 브라우저 자동 요청(favicon.ico 등)에 의한 노이즈 — 스택트레이스 없이 404만 반환
        return ResponseEntity.notFound().build();
    }

    /** 그 외 예상치 못한 서버 오류 → 500 */
    @ExceptionHandler(Exception.class)
    public ResponseEntity<Map<String, String>> handleUnexpected(Exception e) {
        log.error("[ServerError] 예상치 못한 오류 발생", e);
        return ResponseEntity
                .status(HttpStatus.INTERNAL_SERVER_ERROR)
                .body(Map.of("error", "서버 내부 오류가 발생했습니다. 잠시 후 다시 시도해 주세요."));
    }
}
