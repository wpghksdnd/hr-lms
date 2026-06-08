package com.hr.backend.domain.user.repository;

import com.hr.backend.domain.user.entity.User;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;
import java.util.Optional;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;

public interface UserRepository extends JpaRepository<User, Long> {
    Optional<User> findByEmployeeNo(String employeeNo);
    boolean existsByEmployeeNo(String employeeNo);
    boolean existsByEmail(String email);

    /** 부서 삭제 전 소속 직원 수 확인 */
    long countByDepartment_DepartmentId(Integer departmentId);

    /**
     * 이름 / 사번 / 부서명 키워드 검색 (DB 레벨 LIKE 쿼리 — 전체 로드 후 메모리 필터링 제거)
     * keyword가 null 이면 전체 조회.
     */
    @Query("""
        SELECT u FROM User u
        LEFT JOIN FETCH u.department d
        WHERE u.isActive = true
          AND (:keyword IS NULL
               OR u.name       LIKE %:keyword%
               OR u.employeeNo LIKE %:keyword%
               OR d.name       LIKE %:keyword%)
        ORDER BY u.userId DESC
        """)
    List<User> searchByKeyword(@Param("keyword") String keyword);

    @Query(value = """
        SELECT u FROM User u
        LEFT JOIN u.department d
        WHERE u.isActive = true
          AND (:keyword IS NULL
               OR u.name       LIKE %:keyword%
               OR u.employeeNo LIKE %:keyword%
               OR d.name       LIKE %:keyword%)
        """,
        countQuery = """
        SELECT COUNT(u) FROM User u
        LEFT JOIN u.department d
        WHERE u.isActive = true
          AND (:keyword IS NULL
               OR u.name       LIKE %:keyword%
               OR u.employeeNo LIKE %:keyword%
               OR d.name       LIKE %:keyword%)
        """)
    Page<User> searchByKeywordPaged(@Param("keyword") String keyword, Pageable pageable);
}
