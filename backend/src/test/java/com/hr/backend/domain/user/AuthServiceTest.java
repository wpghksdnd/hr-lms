package com.hr.backend.domain.user;

import com.hr.backend.admin.dto.LoginRequest;
import com.hr.backend.admin.dto.LoginResponse;
import com.hr.backend.domain.user.entity.RefreshToken;
import com.hr.backend.domain.user.entity.User;
import com.hr.backend.domain.user.repository.RefreshTokenRepository;
import com.hr.backend.domain.user.repository.UserRepository;
import com.hr.backend.domain.user.service.AuthService;
import com.hr.backend.security.LoginAttemptService;
import com.hr.backend.security.jwt.JwtProvider;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.security.crypto.password.PasswordEncoder;

import java.time.LocalDateTime;
import java.util.Optional;

import static org.assertj.core.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.BDDMockito.*;

@ExtendWith(MockitoExtension.class)
class AuthServiceTest {

    @InjectMocks AuthService authService;

    @Mock UserRepository         userRepository;
    @Mock PasswordEncoder        passwordEncoder;
    @Mock JwtProvider            jwtProvider;
    @Mock LoginAttemptService    loginAttemptService;
    @Mock RefreshTokenRepository refreshTokenRepository;

    private static final String IP    = "127.0.0.1";
    private static final String EMP   = "A-0001";
    private static final String PWD   = "Password1!";
    private static final String TOKEN = "jwt.access.token";
    private static final String REFRESH = "uuid-refresh-token";

    // ── 로그인 성공 ──────────────────────────────────────────────────────────

    @Test
    @DisplayName("정상 자격증명으로 로그인 성공")
    void login_success() {
        User user = mock(User.class);
        given(user.getEmployeeNo()).willReturn(EMP);
        given(user.getRole()).willReturn("ROLE_USER");
        given(user.getName()).willReturn("홍길동");
        given(user.isActive()).willReturn(true);
        given(user.isPasswordChanged()).willReturn(true);

        given(loginAttemptService.isBlocked(IP)).willReturn(false);
        given(userRepository.findByEmployeeNo(EMP)).willReturn(Optional.of(user));
        given(passwordEncoder.matches(PWD, null)).willReturn(true);
        given(jwtProvider.generate(EMP, "ROLE_USER")).willReturn(TOKEN);
        given(jwtProvider.generateRefreshToken()).willReturn(REFRESH);
        given(jwtProvider.getRefreshExpirationDays()).willReturn(7);

        LoginResponse result = authService.login(new LoginRequest(EMP, PWD), IP);

        assertThat(result.getToken()).isEqualTo(TOKEN);
        assertThat(result.getName()).isEqualTo("홍길동");
        assertThat(result.getRole()).isEqualTo("ROLE_USER");
        then(loginAttemptService).should().recordSuccess(IP);
    }

    // ── 로그인 실패 ──────────────────────────────────────────────────────────

    @Test
    @DisplayName("존재하지 않는 사원번호로 로그인 시 예외")
    void login_userNotFound_throws() {
        given(loginAttemptService.isBlocked(IP)).willReturn(false);
        given(userRepository.findByEmployeeNo(EMP)).willReturn(Optional.empty());

        assertThatThrownBy(() -> authService.login(new LoginRequest(EMP, PWD), IP))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("사원번호 또는 비밀번호");

        then(loginAttemptService).should().recordFailure(IP);
    }

    @Test
    @DisplayName("비밀번호 불일치 시 예외")
    void login_wrongPassword_throws() {
        User user = mock(User.class);
        given(user.isActive()).willReturn(true);
        given(userRepository.findByEmployeeNo(EMP)).willReturn(Optional.of(user));
        given(loginAttemptService.isBlocked(IP)).willReturn(false);
        given(passwordEncoder.matches(any(), any())).willReturn(false);

        assertThatThrownBy(() -> authService.login(new LoginRequest(EMP, "wrongpw"), IP))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("사원번호 또는 비밀번호");

        then(loginAttemptService).should().recordFailure(IP);
    }

    @Test
    @DisplayName("비활성 계정으로 로그인 시 예외")
    void login_inactiveUser_throws() {
        User user = mock(User.class);
        given(user.isActive()).willReturn(false);
        given(userRepository.findByEmployeeNo(EMP)).willReturn(Optional.of(user));
        given(loginAttemptService.isBlocked(IP)).willReturn(false);

        assertThatThrownBy(() -> authService.login(new LoginRequest(EMP, PWD), IP))
                .isInstanceOf(IllegalArgumentException.class);
    }

    // ── Rate Limiter ──────────────────────────────────────────────────────────

    @Test
    @DisplayName("IP 차단 중이면 로그인 시도 없이 예외")
    void login_blockedIp_throws() {
        given(loginAttemptService.isBlocked(IP)).willReturn(true);
        given(loginAttemptService.getRemainingBlockSec(IP)).willReturn(600L);

        assertThatThrownBy(() -> authService.login(new LoginRequest(EMP, PWD), IP))
                .isInstanceOf(IllegalStateException.class)
                .hasMessageContaining("초과");

        then(userRepository).shouldHaveNoInteractions();
    }

    // ── Refresh Token ──────────────────────────────────────────────────────────

    @Test
    @DisplayName("유효한 refresh token으로 access token 재발급 성공")
    void refreshAccessToken_valid_returnsNewToken() {
        User user = mock(User.class);
        given(user.getEmployeeNo()).willReturn(EMP);
        given(user.getRole()).willReturn("ROLE_USER");

        RefreshToken stored = RefreshToken.builder()
                .token(REFRESH)
                .employeeNo(EMP)
                .expiresAt(LocalDateTime.now().plusDays(7))
                .build();

        given(refreshTokenRepository.findByToken(REFRESH)).willReturn(Optional.of(stored));
        given(userRepository.findByEmployeeNo(EMP)).willReturn(Optional.of(user));
        given(jwtProvider.generate(EMP, "ROLE_USER")).willReturn("new.access.token");

        String result = authService.refreshAccessToken(REFRESH);

        assertThat(result).isEqualTo("new.access.token");
    }

    @Test
    @DisplayName("만료된 refresh token이면 예외")
    void refreshAccessToken_expired_throws() {
        RefreshToken stored = RefreshToken.builder()
                .token(REFRESH)
                .employeeNo(EMP)
                .expiresAt(LocalDateTime.now().minusSeconds(1))
                .build();

        given(refreshTokenRepository.findByToken(REFRESH)).willReturn(Optional.of(stored));

        assertThatThrownBy(() -> authService.refreshAccessToken(REFRESH))
                .isInstanceOf(IllegalStateException.class)
                .hasMessageContaining("만료");
    }
}
