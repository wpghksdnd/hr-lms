package com.hr.backend.domain.course.service;

import com.hr.backend.domain.course.dto.CourseDetailResponse;
import com.hr.backend.domain.course.dto.CourseListItemResponse;
import com.hr.backend.domain.course.dto.LectureWithProgressResponse;
import com.hr.backend.domain.course.entity.Course;
import com.hr.backend.domain.course.entity.CourseRound;
import com.hr.backend.domain.course.entity.Lecture;
import com.hr.backend.domain.course.repository.CourseRepository;
import com.hr.backend.domain.course.repository.CourseRoundRepository;
import com.hr.backend.domain.course.repository.LectureRepository;
import com.hr.backend.domain.course.repository.LectureProgressRepository;
import com.hr.backend.domain.course.repository.VideoWatchLogRepository;
import com.hr.backend.domain.enrollment.entity.Enrollment;
import com.hr.backend.domain.enrollment.repository.EnrollmentRepository;
import com.hr.backend.domain.quiz.entity.Attempt;
import com.hr.backend.domain.quiz.entity.Exam;
import com.hr.backend.domain.quiz.entity.Quiz;
import com.hr.backend.domain.quiz.repository.AttemptRepository;
import com.hr.backend.domain.quiz.repository.ExamRepository;
import com.hr.backend.domain.quiz.repository.QuizRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.Collections;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
@Transactional(readOnly = true)
public class CourseUserService {
    
    private final CourseRepository courseRepository;
    private final CourseRoundRepository courseRoundRepository;
    private final EnrollmentRepository enrollmentRepository;
    private final LectureRepository lectureRepository;
    private final LectureProgressRepository lectureProgressRepository;
        private final VideoWatchLogRepository videoWatchLogRepository;
        private final QuizRepository quizRepository;
        private final ExamRepository examRepository;
        private final AttemptRepository attemptRepository;

    /**
     * 강좌 목록 조회 (사용자용 - 신청 상태 포함)
     */
    public List<CourseListItemResponse> getCourseList(Long userId) {
        // 모든 활성화된 강좌 조회
        List<Course> courses = courseRepository.findAllByActiveTrue();
        
        // 사용자의 수강 현황 조회
        List<Enrollment> enrollments = userId == null
                ? Collections.emptyList()
                : enrollmentRepository.findAllByUserId(userId);
        Map<Long, Enrollment> enrollmentMap = enrollments.stream()
                .collect(Collectors.toMap(
                        e -> e.getRound().getCourse().getCourseId(),
                        e -> e,
                        (a, b) -> b.getEnrolledAt().isAfter(a.getEnrolledAt()) ? b : a
                ));
        
        return courses.stream()
                .flatMap(course -> courseRoundRepository.findAllByCourse_CourseIdOrderByRoundNoAsc(course.getCourseId()).stream()
                        .map(round -> {
                            Enrollment enrollment = enrollmentMap.get(course.getCourseId());
                            String status = enrollment == null ? "NOT_ENROLLED" : enrollment.getStatus().name();
                            Long enrollmentId = enrollment == null ? null : enrollment.getEnrollmentId();

                            return CourseListItemResponse.builder()
                                    .courseId(course.getCourseId())
                                    .title(course.getTitle())
                                    .description(course.getDescription())
                                    .category(course.getCategory())
                                    .thumbnailUrl(course.getThumbnailUrl())
                                    .durationMin(course.getDurationMin())
                                    .roundId(round.getRoundId())
                                    .roundNo(round.getRoundNo())
                                    .startDate(round.getStartDate())
                                    .endDate(round.getEndDate())
                                    .enrollmentStatus(status)
                                    .enrollmentId(enrollmentId)
                                    .build();
                        })
                )
                .collect(Collectors.toList());
    }

    /**
     * 강좌 상세 조회 (강의/퀴즈/시험/설문 상태 포함)
     */
    public CourseDetailResponse getCourseDetail(Long userId, Long courseId) {
        Course course = courseRepository.findById(courseId)
                .orElseThrow(() -> new IllegalArgumentException("강좌를 찾을 수 없습니다."));

        // 강의 목록 with 시청률
        List<Lecture> lectureEntities = lectureRepository.findAllByCourse_CourseIdOrderBySortOrderAsc(courseId);
        var lectures = lectureEntities.stream()
                .map(lecture -> buildLectureWithProgress(userId, lecture))
                .collect(Collectors.toList());

        CourseDetailResponse.QuizSummary quizSummary = buildQuizSummary(userId, lectureEntities);
        CourseDetailResponse.ExamSummary examSummary = buildExamSummary(userId, courseId);

        return CourseDetailResponse.builder()
                .courseId(course.getCourseId())
                .title(course.getTitle())
                .description(course.getDescription())
                .category(course.getCategory())
                .thumbnailUrl(course.getThumbnailUrl())
                .durationMin(course.getDurationMin())
                .lectures(lectures)
                .quiz(quizSummary)
                .exam(examSummary)
                .survey(null)
                .build();
    }

    /**
     * 강의별 시청률 및 완료 여부 조회
     */
        private LectureWithProgressResponse buildLectureWithProgress(Long userId, Lecture lecture) {
        // 강의 내 영상 개수
        int videoCount = lecture.getVideos().size();
        
        // 시청한 영상 개수 (예: video_watch_logs에서 완료 여부 체크)
        int completedCount = (int) lecture.getVideos().stream()
                .filter(video -> isVideoCompleted(userId, video.getVideoId()))
                .count();
        
        double watchPercentage = videoCount > 0 ? (completedCount * 100.0 / videoCount) : 0.0;
        
        // 강의 완료 여부
        boolean isCompleted = lectureProgressRepository.findByUser_UserIdAndLecture_LectureId(userId, lecture.getLectureId())
                .map(lp -> lp.isCompleted())
                .orElse(false);
        
        return LectureWithProgressResponse.builder()
                .lectureId(lecture.getLectureId())
                .title(lecture.getTitle())
                .description(lecture.getDescription())
                .sortOrder(lecture.getSortOrder())
                .videoCount(videoCount)
                .completedVideoCount(completedCount)
                .watchPercentage(Math.round(watchPercentage * 10.0) / 10.0)
                .isCompleted(isCompleted)
                .build();
    }

    /**
     * 특정 영상 시청 완료 여부 확인 (예시)
     */
    private boolean isVideoCompleted(Long userId, Long videoId) {
        return videoWatchLogRepository.findByUser_UserIdAndVideo_VideoId(userId, videoId)
                .map(w -> w.isCompleted())
                .orElse(false);
    }

    private CourseDetailResponse.QuizSummary buildQuizSummary(Long userId, List<Lecture> lectures) {
        List<Quiz> quizzes = lectures.stream()
                .map(lecture -> quizRepository.findByLecture_LectureId(lecture.getLectureId()))
                .flatMap(Optional::stream)
                .toList();

        if (quizzes.isEmpty()) {
            return null;
        }

        int questionCount = quizzes.stream().mapToInt(q -> q.getQuestions().size()).sum();
        boolean allPassed = quizzes.stream()
                .allMatch(q -> attemptRepository.existsByUser_UserIdAndQuiz_QuizIdAndPassedTrue(userId, q.getQuizId()));

        List<Integer> latestScores = quizzes.stream()
                .map(q -> attemptRepository.findTopByUser_UserIdAndQuiz_QuizIdOrderByAttemptedAtDesc(userId, q.getQuizId()))
                .flatMap(Optional::stream)
                .map(Attempt::getScore)
                .toList();

        Integer averageScore = latestScores.isEmpty()
                ? null
                : (int) Math.round(latestScores.stream().mapToInt(Integer::intValue).average().orElse(0));

        Quiz firstQuiz = quizzes.get(0);
        String title = quizzes.size() == 1 ? firstQuiz.getTitle() : "강의 퀴즈(" + quizzes.size() + "개)";

        return CourseDetailResponse.QuizSummary.builder()
                .quizId(firstQuiz.getQuizId())
                .title(title)
                .passScore(firstQuiz.getPassScore())
                .questionCount(questionCount)
                .completed(allPassed)
                .score(averageScore)
                .build();
    }

    private CourseDetailResponse.ExamSummary buildExamSummary(Long userId, Long courseId) {
        Optional<Exam> examOptional = examRepository.findByCourse_CourseId(courseId);
        if (examOptional.isEmpty()) {
            return null;
        }

        Exam exam = examOptional.get();
        Optional<Attempt> latestAttempt = attemptRepository
                .findTopByUser_UserIdAndExam_ExamIdOrderByAttemptedAtDesc(userId, exam.getExamId());

        return CourseDetailResponse.ExamSummary.builder()
                .examId(exam.getExamId())
                .title(exam.getTitle())
                .passScore(exam.getPassScore())
                .questionCount(exam.getQuestions().size())
                .completed(latestAttempt.map(Attempt::isPassed).orElse(false))
                .score(latestAttempt.map(Attempt::getScore).orElse(null))
                .build();
    }
}