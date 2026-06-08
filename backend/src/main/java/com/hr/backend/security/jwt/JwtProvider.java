package com.hr.backend.security.jwt;

import io.jsonwebtoken.*;
import io.jsonwebtoken.security.Keys;
import jakarta.annotation.PostConstruct;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

import javax.crypto.SecretKey;
import java.util.Base64;
import java.util.Date;
import java.util.UUID;

@Component
public class JwtProvider {

    @Value("${jwt.secret}")
    private String secret;

    @Value("${jwt.expiration-ms:86400000}")
    private long expirationMs;

    @Value("${jwt.refresh-expiration-days:7}")
    private int refreshExpirationDays;

    private SecretKey key;

    @PostConstruct
    public void init() {
        byte[] decoded = Base64.getDecoder().decode(secret);
        this.key = Keys.hmacShaKeyFor(decoded);
    }

    public String generate(String employeeNo, String role) {
        return Jwts.builder()
                .subject(employeeNo)
                .claim("role", role)
                .issuedAt(new Date())
                .expiration(new Date(System.currentTimeMillis() + expirationMs))
                .signWith(key)
                .compact();
    }

    public Claims parse(String token) {
        return Jwts.parser()
                .verifyWith(key)
                .build()
                .parseSignedClaims(token)
                .getPayload();
    }

    public boolean isValid(String token) {
        try { parse(token); return true; }
        catch (JwtException | IllegalArgumentException e) { return false; }
    }

    /** Refresh Token용 UUID 생성 (DB에 저장하는 opaque token) */
    public String generateRefreshToken() {
        return UUID.randomUUID().toString();
    }

    public int getRefreshExpirationDays() {
        return refreshExpirationDays;
    }

    public long getExpirationMs() {
        return expirationMs;
    }
}
