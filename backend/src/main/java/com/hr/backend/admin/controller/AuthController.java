package com.hr.backend.admin.controller;

import com.hr.backend.admin.dto.ChangePasswordRequest;
import com.hr.backend.admin.dto.LoginRequest;
import com.hr.backend.admin.dto.LoginResponse;
import com.hr.backend.domain.user.service.AuthService;
import com.hr.backend.domain.user.service.PasswordService;
import com.hr.backend.security.jwt.JwtProvider;
import jakarta.servlet.http.Cookie;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import lombok.RequiredArgsConstructor;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpHeaders;
import org.springframework.http.ResponseCookie;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.util.Arrays;

@RestController
@RequestMapping("/api/auth")
@RequiredArgsConstructor
public class AuthController {

    private final AuthService    authService;
    private final PasswordService passwordService;
    private final JwtProvider    jwtProvider;

    /** 프로덕션 환경 여부 (Secure 쿠키 설정에 사용) */
    @Value("${cookie.secure:false}")
    private boolean cookieSecure;

    @PostMapping("/login")
    public ResponseEntity<LoginResponse> login(
            @RequestBody LoginRequest req,
            HttpServletRequest httpRequest,
            HttpServletResponse httpResponse) {
        String clientIp = resolveClientIp(httpRequest);
        LoginResponse result = authService.login(req, clientIp);

        // access_token: httpOnly 쿠키 (만료 = JWT 만료 시간)
        int accessMaxAge = (int) (jwtProvider.getExpirationMs() / 1000);
        setAuthCookie(httpResponse, "access_token", result.getToken(),
                accessMaxAge, "/");

        // refresh_token: httpOnly 쿠키, /api/auth/refresh 경로로만 전송
        int refreshMaxAge = jwtProvider.getRefreshExpirationDays() * 24 * 3600;
        setAuthCookie(httpResponse, "refresh_token", result.getRefreshToken(),
                refreshMaxAge, "/api/auth/refresh");

        return ResponseEntity.ok(result);
    }

    /** Refresh Token으로 Access Token 재발급 */
    @PostMapping("/refresh")
    public ResponseEntity<Void> refresh(
            HttpServletRequest httpRequest,
            HttpServletResponse httpResponse) {
        String refreshToken = extractCookieValue(httpRequest, "refresh_token");
        if (refreshToken == null) {
            return ResponseEntity.status(401).build();
        }
        String newAccessToken = authService.refreshAccessToken(refreshToken);
        int accessMaxAge = (int) (jwtProvider.getExpirationMs() / 1000);
        setAuthCookie(httpResponse, "access_token", newAccessToken, accessMaxAge, "/");
        return ResponseEntity.ok().build();
    }

    /** 로그아웃 — 쿠키 삭제 + Refresh Token DB 삭제 */
    @PostMapping("/logout")
    public ResponseEntity<Void> logout(
            HttpServletRequest httpRequest,
            HttpServletResponse httpResponse) {
        String refreshToken = extractCookieValue(httpRequest, "refresh_token");
        if (refreshToken != null) {
            authService.revokeRefreshToken(refreshToken);
        }
        clearAuthCookie(httpResponse, "access_token", "/");
        clearAuthCookie(httpResponse, "refresh_token", "/api/auth/refresh");
        return ResponseEntity.noContent().build();
    }

    @PutMapping("/password")
    public ResponseEntity<Void> changePassword(
            @AuthenticationPrincipal String employeeNo,
            @RequestBody ChangePasswordRequest req) {
        passwordService.changePassword(employeeNo, req);
        return ResponseEntity.noContent().build();
    }

    // ─────────────────────────────────────────────────────────────────────────
    // private helpers
    // ─────────────────────────────────────────────────────────────────────────

    private void setAuthCookie(HttpServletResponse res, String name, String value,
                               int maxAgeSec, String path) {
        ResponseCookie cookie = ResponseCookie.from(name, value)
                .httpOnly(true)
                .secure(cookieSecure)
                .path(path)
                .maxAge(maxAgeSec)
                .sameSite("Lax")
                .build();
        res.addHeader(HttpHeaders.SET_COOKIE, cookie.toString());
    }

    private void clearAuthCookie(HttpServletResponse res, String name, String path) {
        ResponseCookie cookie = ResponseCookie.from(name, "")
                .httpOnly(true)
                .secure(cookieSecure)
                .path(path)
                .maxAge(0)
                .sameSite("Lax")
                .build();
        res.addHeader(HttpHeaders.SET_COOKIE, cookie.toString());
    }

    private String extractCookieValue(HttpServletRequest req, String name) {
        if (req.getCookies() == null) return null;
        return Arrays.stream(req.getCookies())
                .filter(c -> name.equals(c.getName()))
                .map(Cookie::getValue)
                .findFirst()
                .orElse(null);
    }

    /** 프록시(X-Forwarded-For) 뒤에서도 실제 클라이언트 IP를 추출한다. */
    private String resolveClientIp(HttpServletRequest request) {
        String xForwardedFor = request.getHeader("X-Forwarded-For");
        if (xForwardedFor != null && !xForwardedFor.isBlank()) {
            return xForwardedFor.split(",")[0].trim();
        }
        return request.getRemoteAddr();
    }
}
