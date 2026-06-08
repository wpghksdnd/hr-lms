package com.hr.backend.admin.dto;

import lombok.AllArgsConstructor;
import lombok.Getter;

import com.fasterxml.jackson.annotation.JsonIgnore;

@Getter
@AllArgsConstructor
public class LoginResponse {
    private String token;
    /** 쿠키로만 전달되며 응답 JSON에는 포함하지 않는다. */
    @JsonIgnore
    private String refreshToken;
    private String name;
    private String role;
    private boolean passwordChanged;
}
