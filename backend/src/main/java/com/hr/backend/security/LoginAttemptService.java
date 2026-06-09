package com.hr.backend.security;

import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;

import java.util.concurrent.ConcurrentHashMap;

/**
 * IP별 로그인 실패 횟수를 추적해 브루트포스 공격을 차단한다.
 * MAX_ATTEMPTS 초과 시 BLOCK_DURATION_MS 동안 해당 IP의 로그인을 거부한다.
 */
@Service
public class LoginAttemptService {

    private static final int MAX_ATTEMPTS = 5;
    private static final long BLOCK_DURATION_MS = 60 * 1000L; // 1분

    private record AttemptRecord(int count, long lastAttemptMs) {}

    private final ConcurrentHashMap<String, AttemptRecord> attempts = new ConcurrentHashMap<>();

    public boolean isBlocked(String ip) {
        AttemptRecord record = attempts.get(ip);
        if (record == null || record.count() < MAX_ATTEMPTS) return false;
        if (System.currentTimeMillis() - record.lastAttemptMs() > BLOCK_DURATION_MS) {
            attempts.remove(ip);
            return false;
        }
        return true;
    }

    /** 잠금 해제까지 남은 시간(초), 잠금 중이 아니면 0 */
    public long getRemainingBlockSec(String ip) {
        AttemptRecord record = attempts.get(ip);
        if (record == null || record.count() < MAX_ATTEMPTS) return 0;
        long remainingMs = BLOCK_DURATION_MS - (System.currentTimeMillis() - record.lastAttemptMs());
        return Math.max(0, remainingMs / 1000);
    }

    public void recordFailure(String ip) {
        attempts.merge(ip, new AttemptRecord(1, System.currentTimeMillis()),
            (existing, newVal) -> {
                // 이전 차단 기간이 지났으면 카운터 리셋
                if (System.currentTimeMillis() - existing.lastAttemptMs() > BLOCK_DURATION_MS) {
                    return new AttemptRecord(1, System.currentTimeMillis());
                }
                return new AttemptRecord(existing.count() + 1, System.currentTimeMillis());
            });
    }

    public void recordSuccess(String ip) {
        attempts.remove(ip);
    }

    /** 1시간마다 만료된 IP 잠금 항목을 정리해 메모리 누수를 방지한다. */
    @Scheduled(fixedDelay = 3_600_000)
    public void evictExpiredEntries() {
        long now = System.currentTimeMillis();
        attempts.entrySet().removeIf(entry ->
                now - entry.getValue().lastAttemptMs() > BLOCK_DURATION_MS);
    }
}
