package com.hr.backend.admin.controller;

import com.hr.backend.admin.dto.EmployeeRequest;
import com.hr.backend.admin.dto.EmployeeResponse;
import com.hr.backend.domain.user.service.EmployeeExcelService;
import com.hr.backend.domain.user.service.EmployeeService;
import lombok.RequiredArgsConstructor;
import jakarta.validation.Valid;
import org.springframework.http.ContentDisposition;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.time.LocalDate;
import java.util.List;
import org.springframework.data.domain.Page;

@RestController
@RequestMapping("/api/admin/employees")
@RequiredArgsConstructor
public class EmployeeController {

    private final EmployeeService      employeeService;
    private final EmployeeExcelService employeeExcelService;

    @GetMapping
    public ResponseEntity<?> getAll(
            @RequestParam(required = false) String keyword,
            @RequestParam(required = false) Integer page,
            @RequestParam(defaultValue = "50") int size) {
        if (page != null) {
            Page<EmployeeResponse> result = employeeService.getAllPaged(keyword, page, size);
            return ResponseEntity.ok(result);
        }
        return ResponseEntity.ok(employeeService.getAll(keyword));
    }

    @GetMapping("/{id}")
    public ResponseEntity<EmployeeResponse> getOne(@PathVariable Long id) {
        return ResponseEntity.ok(employeeService.getOne(id));
    }

    @PostMapping
    public ResponseEntity<EmployeeResponse> register(@Valid @RequestBody EmployeeRequest req) {
        return ResponseEntity.ok(employeeService.register(req));
    }

    @PutMapping("/{id}")
    public ResponseEntity<EmployeeResponse> update(
            @PathVariable Long id, @Valid @RequestBody EmployeeRequest req) {
        return ResponseEntity.ok(employeeService.update(id, req));
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<Void> delete(@PathVariable Long id) {
        employeeService.delete(id);
        return ResponseEntity.noContent().build();
    }

    @PostMapping("/excel")
    public ResponseEntity<List<EmployeeResponse>> registerByExcel(
            @RequestParam("file") MultipartFile file) throws IOException {
        return ResponseEntity.ok(employeeService.registerByExcel(file));
    }

    /** 직원 목록 Excel 내보내기 (keyword 필터 적용 가능) */
    @GetMapping("/export")
    public ResponseEntity<byte[]> exportExcel(
            @RequestParam(required = false) String keyword) {
        List<EmployeeResponse> data = employeeService.getAll(keyword);
        byte[] excelBytes = employeeExcelService.export(data);
        String filename = "employees_" + LocalDate.now() + ".xlsx";

        return ResponseEntity.ok()
                .contentType(MediaType.parseMediaType(
                        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"))
                .header(HttpHeaders.CONTENT_DISPOSITION,
                        ContentDisposition.attachment()
                                .filename(filename, StandardCharsets.UTF_8)
                                .build().toString())
                .body(excelBytes);
    }
}
