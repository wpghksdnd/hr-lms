package com.hr.backend.domain.enrollment.repository;

import com.hr.backend.domain.enrollment.entity.Enrollment;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;
import java.util.Optional;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;

public interface EnrollmentRepository extends JpaRepository<Enrollment, Long> {

    @Query("SELECT e FROM Enrollment e JOIN FETCH e.user JOIN FETCH e.round r JOIN FETCH r.course WHERE e.user.userId = :userId")
    List<Enrollment> findAllByUserId(@Param("userId") Long userId);

    @Query("SELECT e FROM Enrollment e JOIN FETCH e.user JOIN FETCH e.round r JOIN FETCH r.course WHERE r.course.courseId = :courseId")
    List<Enrollment> findAllByCourseId(@Param("courseId") Long courseId);

    Optional<Enrollment> findByUser_UserIdAndRound_RoundId(Long userId, Long roundId);

    boolean existsByUser_UserIdAndRound_RoundId(Long userId, Long roundId);

    @Query("SELECT e FROM Enrollment e JOIN FETCH e.user u LEFT JOIN FETCH u.department JOIN FETCH e.round r JOIN FETCH r.course")
    List<Enrollment> findAllWithUserAndCourse();

    // ── 필터용 쿼리 ──────────────────────────────────────────

    /** 부서명으로 필터 */
    @Query("""
        SELECT e FROM Enrollment e
        JOIN FETCH e.user u
        LEFT JOIN FETCH u.department d
        JOIN FETCH e.round r
        JOIN FETCH r.course c
        WHERE d.name = :deptName
        """)
    List<Enrollment> findAllByDepartment(@Param("deptName") String deptName);

    /** 강좌 카테고리로 필터 (법정의무교육 / 직무교육) */
    @Query("""
        SELECT e FROM Enrollment e
        JOIN FETCH e.user u
        LEFT JOIN FETCH u.department
        JOIN FETCH e.round r
        JOIN FETCH r.course c
        WHERE c.category = :category
        """)
    List<Enrollment> findAllByCategory(@Param("category") String category);

    /** targetRole로 필터 (1=현장직, 2=사무직) */
    @Query("""
        SELECT e FROM Enrollment e
        JOIN FETCH e.user u
        LEFT JOIN FETCH u.department
        JOIN FETCH e.round r
        JOIN FETCH r.course c
        WHERE c.targetRole = :targetRole
        """)
    List<Enrollment> findAllByTargetRole(@Param("targetRole") int targetRole);

    /** 미이수자만 — DONE이 아닌 수강 내역 */
    @Query("""
        SELECT e FROM Enrollment e
        JOIN FETCH e.user u
        LEFT JOIN FETCH u.department
        JOIN FETCH e.round r
        JOIN FETCH r.course c
        WHERE e.status <> 'DONE'
        """)
    List<Enrollment> findAllNotCompleted();

    /** 승인 대기 중인 수강 신청 목록 (관리자 승인 화면용) */
    @Query("""
        SELECT e FROM Enrollment e
        JOIN FETCH e.user u
        LEFT JOIN FETCH u.department
        JOIN FETCH e.round r
        JOIN FETCH r.course c
        WHERE e.approvalStatus = 'PENDING'
        ORDER BY e.enrolledAt ASC
        """)
    List<Enrollment> findAllPending();

    @Query(value = """
        SELECT e FROM Enrollment e
        JOIN FETCH e.user u
        LEFT JOIN FETCH u.department
        JOIN FETCH e.round r
        JOIN FETCH r.course
        """,
        countQuery = "SELECT COUNT(e) FROM Enrollment e")
    Page<Enrollment> findAllWithUserAndCoursePaged(Pageable pageable);

    /** 필터(부서/카테고리/미이수/직군) + 페이지네이션 통합 쿼리 */
    @Query(value = """
        SELECT e FROM Enrollment e
        JOIN FETCH e.user u
        LEFT JOIN FETCH u.department d
        JOIN FETCH e.round r
        JOIN FETCH r.course c
        WHERE (:dept IS NULL OR d.name = :dept)
          AND (:category IS NULL OR c.category = :category)
          AND (:onlyIncomplete = false OR e.status <> 'DONE')
          AND (:role IS NULL OR c.targetRole = :role)
        """,
        countQuery = """
        SELECT COUNT(e) FROM Enrollment e
        LEFT JOIN e.user u
        LEFT JOIN u.department d
        LEFT JOIN e.round r
        LEFT JOIN r.course c
        WHERE (:dept IS NULL OR d.name = :dept)
          AND (:category IS NULL OR c.category = :category)
          AND (:onlyIncomplete = false OR e.status <> 'DONE')
          AND (:role IS NULL OR c.targetRole = :role)
        """)
    Page<Enrollment> findFilteredPaged(
        @Param("dept") String dept,
        @Param("category") String category,
        @Param("onlyIncomplete") boolean onlyIncomplete,
        @Param("role") Integer role,
        Pageable pageable);

    /** 복합 필터 조회 (dept, category, onlyIncomplete, targetRole 조합 가능) */
    @Query("""
        SELECT e FROM Enrollment e
        JOIN FETCH e.user u
        LEFT JOIN FETCH u.department d
        JOIN FETCH e.round r
        JOIN FETCH r.course c
        WHERE (:dept IS NULL OR d.name = :dept)
          AND (:category IS NULL OR c.category = :category)
          AND (:onlyIncomplete = false OR e.status <> 'DONE')
          AND (:role IS NULL OR c.targetRole = :role)
        """)
    List<Enrollment> findFiltered(
        @Param("dept") String dept,
        @Param("category") String category,
        @Param("onlyIncomplete") boolean onlyIncomplete,
        @Param("role") Integer role);

    /** 통계용 count 쿼리 — findAll() 대신 사용 */
    long countByStatus(Enrollment.Status status);

    /** enrollment 단건 + 연관 엔티티 일괄 로드 (EnrollmentUserController 전용) */
    @Query("""
        SELECT e FROM Enrollment e
        JOIN FETCH e.user u
        JOIN FETCH e.round r
        JOIN FETCH r.course c
        WHERE e.enrollmentId = :id
        """)
    Optional<Enrollment> findByIdWithRound(@Param("id") Long id);
}
