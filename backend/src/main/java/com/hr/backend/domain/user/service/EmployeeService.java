package com.hr.backend.domain.user.service;

import com.hr.backend.admin.dto.EmployeeRequest;
import com.hr.backend.admin.dto.EmployeeResponse;
import com.hr.backend.domain.user.entity.Department;
import com.hr.backend.domain.user.entity.User;
import com.hr.backend.domain.user.repository.DepartmentRepository;
import com.hr.backend.domain.user.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import org.apache.poi.ss.usermodel.*;
import org.apache.poi.xssf.usermodel.XSSFWorkbook;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.List;

@Service
@RequiredArgsConstructor
@Transactional(readOnly = true)
public class EmployeeService {

    private final UserRepository userRepository;
    private final DepartmentRepository departmentRepository;
    private final PasswordEncoder passwordEncoder;

    /** 직원 목록 조회 (키워드: 이름/사번/부서명) — DB LIKE 쿼리로 처리 */
    public List<EmployeeResponse> getAll(String keyword) {
        String kw = (keyword == null || keyword.isBlank()) ? null : keyword;
        return userRepository.searchByKeyword(kw).stream()
                .map(EmployeeResponse::new)
                .toList();
    }

    /** 직원 목록 페이지네이션 조회 */
    public Page<EmployeeResponse> getAllPaged(String keyword, int page, int size) {
        String kw = (keyword == null || keyword.isBlank()) ? null : keyword;
        var pageable = PageRequest.of(page, size, Sort.by(Sort.Direction.DESC, "userId"));
        return userRepository.searchByKeywordPaged(kw, pageable).map(EmployeeResponse::new);
    }

    /** 직원 단건 조회 */
    public EmployeeResponse getOne(Long id) {
        return new EmployeeResponse(findById(id));
    }

    /** 직원 등록 (초기 비밀번호 = 사번) */
    @Transactional
    public EmployeeResponse register(EmployeeRequest req) {
        if (userRepository.existsByEmployeeNo(req.getEmployeeNo())) {
            throw new IllegalArgumentException("이미 존재하는 사번입니다: " + req.getEmployeeNo());
        }
        Department dept = findDepartment(req.getDepartmentId());

        User user = User.builder()
                .employeeNo(req.getEmployeeNo())
                .name(req.getName())
                .email(req.getEmail())
                .rawPassword(req.getEmployeeNo())   // 초기 비밀번호 = 사번
                .department(dept)
                .position(req.getPosition())
                .empType(req.getEmpType())
                .phone(req.getPhone())
                .hireDate(req.getHireDate())
                .role(req.getRole() != null ? req.getRole() : "ROLE_USER")
                .encoder(passwordEncoder)
                .build();

        return new EmployeeResponse(userRepository.save(user));
    }

    /** 직원 정보 수정 */
    @Transactional
    public EmployeeResponse update(Long id, EmployeeRequest req) {
        User user = findById(id);
        Department dept = findDepartment(req.getDepartmentId());

        user.updateInfo(req.getName(), req.getEmail(), dept,
                req.getPosition(), req.getEmpType(), req.getPhone(),
                req.getRole() != null ? req.getRole() : user.getRole());
        return new EmployeeResponse(user);
    }

    /** 직원 비활성화 (Soft delete) */
    @Transactional
    public void delete(Long id) {
        User user = findById(id);
        user.deactivate();
    }

    /** 엑셀 일괄 등록
     * 컬럼 순서: 사번 | 이름 | 이메일 | 부서ID | 직급 | 직원유형(0/1) | 전화번호 | 입사일(yyyy-MM-dd)
     */
    @Transactional
    public List<EmployeeResponse> registerByExcel(MultipartFile file) throws IOException {
        List<EmployeeResponse> results = new ArrayList<>();

        try (Workbook wb = new XSSFWorkbook(file.getInputStream())) {
            Sheet sheet = wb.getSheetAt(0);
            for (int i = 1; i <= sheet.getLastRowNum(); i++) {
                Row row = sheet.getRow(i);
                if (row == null) continue;

                String employeeNo = cellStr(row.getCell(0));
                String name       = cellStr(row.getCell(1));
                String email      = cellStr(row.getCell(2));
                int deptId        = (int) row.getCell(3).getNumericCellValue();
                String position   = cellStr(row.getCell(4));
                int empType       = (int) row.getCell(5).getNumericCellValue();
                String phone      = cellStr(row.getCell(6));
                LocalDate hireDate = LocalDate.parse(cellStr(row.getCell(7)));

                if (employeeNo.isBlank() || name.isBlank()) continue;
                if (userRepository.existsByEmployeeNo(employeeNo)) continue;

                Department dept = departmentRepository.findById(deptId).orElse(null);
                if (dept == null) continue;

                User user = User.builder()
                        .employeeNo(employeeNo)
                        .name(name)
                        .email(email)
                        .rawPassword(employeeNo)
                        .department(dept)
                        .position(position)
                        .empType(empType)
                        .phone(phone)
                        .hireDate(hireDate)
                        .role("ROLE_USER")
                        .encoder(passwordEncoder)
                        .build();
                results.add(new EmployeeResponse(userRepository.save(user)));
            }
        }
        return results;
    }

    private User findById(Long id) {
        return userRepository.findById(id)
                .orElseThrow(() -> new IllegalArgumentException("직원을 찾을 수 없습니다."));
    }

    private Department findDepartment(Integer departmentId) {
        if (departmentId == null) throw new IllegalArgumentException("부서 ID는 필수입니다.");
        return departmentRepository.findById(departmentId)
                .orElseThrow(() -> new IllegalArgumentException("부서를 찾을 수 없습니다."));
    }

    private String cellStr(Cell cell) {
        if (cell == null) return "";
        return switch (cell.getCellType()) {
            case STRING  -> cell.getStringCellValue().trim();
            case NUMERIC -> String.valueOf((long) cell.getNumericCellValue());
            default      -> "";
        };
    }
}
