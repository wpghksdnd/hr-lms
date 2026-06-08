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
 * ⚠️ prod 프로파일에서는 실행되지 않음 (@Profile("!prod"))
 *    프로덕션 초기 데이터는 별도의 DB 마이그레이션 스크립트 사용
 */
@Slf4j
@Profile("!prod")   // prod 환경에서는 이 Bean 등록 자체를 건너뜀
@Component
@RequiredArgsConstructor
public class DataInitializer implements ApplicationRunner {

    private final UserRepository       userRepository;
    private final DepartmentRepository departmentRepository;
    private final NotificationRepository notificationRepository;
    private final PasswordEncoder      passwordEncoder;

    @Override
    @Transactional
    public void run(ApplicationArguments args) {
        // 부서가 없으면 기본 부서 생성
        if (departmentRepository.count() == 0) {
            departmentRepository.save(Department.builder().name("관리팀").build());
            departmentRepository.save(Department.builder().name("개발팀").build());
            departmentRepository.save(Department.builder().name("현장팀").build());
            log.info("[DataInitializer] 기본 부서 3개 생성 완료");
        }

        // 관리자 계정이 없으면 생성
        if (!userRepository.existsByEmployeeNo("ADMIN001")) {
            Department dept = departmentRepository.findAll().get(0);
            User admin = User.builder()
                    .employeeNo("ADMIN001")
                    .name("시스템관리자")
                    .email("admin@company.com")
                    .rawPassword("ADMIN001")   // 초기 비밀번호 = 사번
                    .department(dept)
                    .position("관리자")
                    .empType(0)
                    .role("ROLE_ADMIN")
                    .phone("010-0000-0000")
                    .hireDate(LocalDate.now())
                    .encoder(passwordEncoder)
                    .build();
            userRepository.save(admin);
            log.info("[DataInitializer] 관리자 계정 생성 완료");
        }

        // 일반 유저 테스트 계정
        if (!userRepository.existsByEmployeeNo("EMP001")) {
            Department dept = departmentRepository.findAll().get(1); // 개발팀
            User user = User.builder()
                    .employeeNo("EMP001")
                    .name("테스트직원")
                    .email("emp001@company.com")
                    .rawPassword("EMP001")     // 초기 비밀번호 = 사번
                    .department(dept)
                    .position("사원")
                    .empType(0)
                    .role("ROLE_USER")
                    .phone("010-1234-5678")
                    .hireDate(LocalDate.now())
                    .encoder(passwordEncoder)
                    .build();
            userRepository.save(user);
            log.info("[DataInitializer] 일반 유저 테스트 계정 생성 완료");
        }

        User emp001 = userRepository.findByEmployeeNo("EMP001")
                .orElseThrow(() -> new IllegalStateException("EMP001 테스트 계정을 찾을 수 없습니다."));
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
