package com.hr.backend;

import com.hr.backend.domain.notification.entity.Notification;
import com.hr.backend.domain.notification.entity.Notification.NotificationType;
import com.hr.backend.domain.notification.repository.NotificationRepository;
import com.hr.backend.domain.user.entity.Department;
import com.hr.backend.domain.user.entity.User;
import com.hr.backend.domain.user.repository.DepartmentRepository;
import com.hr.backend.domain.user.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.context.annotation.Profile;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;

/**
 * 앱 최초 실행 시 테스트용 데이터 자동 생성
 * - 관리자 계정: ADMIN001 / ADMIN001 (사번 = 초기 비밀번호)
 * - 기본 부서: 관리팀
 *
 * ⚠️ local 프로파일에서만 실행됨 (@Profile("local"))
 *    Jenkins/운영 서버에서는 spring.profiles.active=local 이 없으므로 실행되지 않음
 */
@Slf4j
@Profile("local")   // local 프로파일에서만 Bean 등록 (Jenkins/prod 환경에서는 건너뜀)
@Component
@RequiredArgsConstructor
public class DataInitializer implements ApplicationRunner {

    private final UserRepository         userRepository;
    private final DepartmentRepository   departmentRepository;
    private final NotificationRepository notificationRepository;
    private final PasswordEncoder        passwordEncoder;

    @Override
    @Transactional
    public void run(ApplicationArguments args) {
        try {
            initDepartments();
            initAdminAccount();
            initTestUserAccount();
            initTestNotifications();
        } catch (Exception e) {
            // 테스트 데이터 초기화 실패는 앱 구동을 중단시키지 않음
            log.warn("[DataInitializer] 초기 데이터 생성 중 오류 발생 (무시됨): {}", e.getMessage());
        }
    }

    private void initDepartments() {
        if (departmentRepository.count() == 0) {
            departmentRepository.save(Department.builder().name("관리팀").build());
            departmentRepository.save(Department.builder().name("개발팀").build());
            departmentRepository.save(Department.builder().name("현장팀").build());
            log.info("[DataInitializer] 기본 부서 3개 생성 완료");
        }
    }

    private void initAdminAccount() {
        if (userRepository.existsByEmployeeNo("ADMIN001")) return;
        java.util.List<Department> depts = departmentRepository.findAll();
        if (depts.isEmpty()) return;
        Department dept = depts.get(0);
        userRepository.save(User.builder()
                .employeeNo("ADMIN001")
                .name("시스템관리자")
                .email("admin@company.com")
                .rawPassword("ADMIN001")
                .department(dept)
                .position("관리자")
                .empType(0)
                .role("ROLE_ADMIN")
                .phone("010-0000-0000")
                .hireDate(LocalDate.now())
                .encoder(passwordEncoder)
                .build());
        log.info("[DataInitializer] 관리자 계정 생성 완료");
    }

    private void initTestUserAccount() {
        if (userRepository.existsByEmployeeNo("EMP001")) return;
        java.util.List<Department> depts = departmentRepository.findAll();
        // 부서가 2개 이상일 때만 개발팀(index 1) 사용, 없으면 첫 번째 부서 사용
        Department dept = depts.size() >= 2 ? depts.get(1) : (depts.isEmpty() ? null : depts.get(0));
        if (dept == null) return;
        userRepository.save(User.builder()
                .employeeNo("EMP001")
                .name("테스트직원")
                .email("emp001@company.com")
                .rawPassword("EMP001")
                .department(dept)
                .position("사원")
                .empType(0)
                .role("ROLE_USER")
                .phone("010-1234-5678")
                .hireDate(LocalDate.now())
                .encoder(passwordEncoder)
                .build());
        log.info("[DataInitializer] 테스트 직원 계정 생성 완료");
    }

    private void initTestNotifications() {
        java.util.Optional<User> emp001Opt = userRepository.findByEmployeeNo("EMP001");
        if (emp001Opt.isEmpty()) return;
        User emp001 = emp001Opt.get();

        if (notificationRepository.countByUser_UserId(emp001.getUserId()) == 0) {
            Notification courseStarted = Notification.builder()
                    .user(emp001)
                    .type(NotificationType.COURSE_STARTED)
                    .message("[교육 시작] 산업안전보건 기본교육이 시작되었습니다.")
                    .build();
            courseStarted.markAsRead();

            Notification courseDeadline = Notification.builder()
                    .user(emp001)
                    .type(NotificationType.COURSE_DEADLINE)
                    .message("[마감 임박] 산업안전보건 기본교육 마감일이 다가오고 있습니다.")
                    .build();
            courseDeadline.markAsRead();

            Notification certificateIssued = Notification.builder()
                    .user(emp001)
                    .type(NotificationType.CERTIFICATE_ISSUED)
                    .message("[이수증 발급] 산업안전보건 기본교육 이수증이 발급되었습니다.")
                    .build();
            certificateIssued.markAsRead();

            notificationRepository.save(Notification.builder()
                    .user(emp001)
                    .type(NotificationType.NEW_NOTICE)
                    .message("[공지] 산업안전보건 기본교육 개설\n전 직원을 대상으로 하는 필수 교육이 개설되었습니다.")
                    .build());
            notificationRepository.save(Notification.builder()
                    .user(emp001)
                    .type(NotificationType.ENROLLMENT_APPROVED)
                    .message("[수강 승인] 산업안전보건 기본교육 수강신청 승인 완료")
                    .build());
            notificationRepository.save(courseStarted);
            notificationRepository.save(courseDeadline);
            notificationRepository.save(certificateIssued);
            log.info("[DataInitializer] EMP001 알림 테스트 데이터 5건 생성 완료");
        }
    }
}
