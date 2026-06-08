package com.hr.backend.domain.user.service;

import com.hr.backend.admin.dto.LoginRequest;
import com.hr.backend.admin.dto.LoginResponse;
import com.hr.backend.domain.user.entity.RefreshToken;
import com.hr.backend.domain.user.entity.User;
import com.hr.backend.domain.user.repository.RefreshTokenRepository;
import com.hr.backend.domain.user.repository.UserRepository;
import com.hr.backend.security.LoginAttemptService;
import com.hr.backend.security.jwt.JwtProvider;
import lombok.RequiredArgsConstructor;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;

@Service
@RequiredArgsConstructor
public class AuthService {

    private final UserRepository userRepository;
    private final PasswordEncoder passwordEncoder;
    private final JwtProvider jwtProvider;
    private final LoginAttemptService loginAttemptService;
    private final RefreshTokenRepository refreshTokenRepository;

    @Transactional
    public LoginResponse login(LoginRequest req, String clientIp) {
        if (loginAttemptService.isBlocked(clientIp)) {
            long remainSec = loginAttemptService.getRemainingBlockSec(clientIp);
            throw new IllegalStateException(
                    "로그인 시도 횟수를 초과했습니다. " + remainSec + "초 후에 다시 시도해주세요.");
        }

        User user = userRepository.findByEmployeeNo(req.getEmployeeNo()).orElse(null);

        if (user == null || !user.isActive()
                || !passwordEncoder.matches(req.getPassword(), user.getPassword())) {
            loginAttemptService.recordFailure(clientIp);
            throw new IllegalArgumentException("사원번호 또는 비밀번호가 올바르지 않습니다.");
        }

        loginAttemptService.recordSuccess(clientIp);
        String role         = user.getRole();
        String accessToken  = jwtProvider.generate(user.getEmployeeNo(), role);
        String refreshToken = issueRefreshToken(user.getEmployeeNo());

        return new LoginResponse(accessToken, refreshToken, user.getName(), role, user.isPasswordChanged());
    }

    /**
     * Refresh Token을 검증하고 새 Access Token을 반환한다.
     * @return 새 access token (JWT)
     */
    @Transactional
    public String refreshAccessToken(String rawRefreshToken) {
        RefreshToken stored = refreshTokenRepository.findByToken(rawRefreshToken)
                .orElseThrow(() -> new IllegalArgumentException("유효하지 않은 refresh token입니다."));

        if (stored.isExpired()) {
            refreshTokenRepository.delete(stored);
            throw new IllegalStateException("refresh token이 만료되었습니다. 다시 로그인해 주세요.");
        }

        User user = userRepository.findByEmployeeNo(stored.getEmployeeNo())
                .orElseThrow(() -> new IllegalArgumentException("사용자를 찾을 수 없습니다."));

        return jwtProvider.generate(user.getEmployeeNo(), user.getRole());
    }

    /** Refresh Token 삭제 (로그아웃) */
    @Transactional
    public void revokeRefreshToken(String rawRefreshToken) {
        refreshTokenRepository.findByToken(rawRefreshToken)
                .ifPresent(refreshTokenRepository::delete);
    }

    private String issueRefreshToken(String employeeNo) {
        // 기존 refresh token 삭제 후 신규 발급 (1인 1토큰)
        refreshTokenRepository.deleteByEmployeeNo(employeeNo);
        String token = jwtProvider.generateRefreshToken();
        refreshTokenRepository.save(RefreshToken.builder()
                .token(token)
                .employeeNo(employeeNo)
                .expiresAt(LocalDateTime.now().plusDays(jwtProvider.getRefreshExpirationDays()))
                .build());
        return token;
    }
}
