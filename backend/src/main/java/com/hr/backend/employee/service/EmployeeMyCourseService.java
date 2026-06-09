package com.hr.backend.employee.service;

import com.hr.backend.domain.course.entity.CourseVideo;
import com.hr.backend.domain.course.entity.Lecture;
import com.hr.backend.domain.course.entity.VideoWatchLog;
import com.hr.backend.domain.course.entity.Course;
import com.hr.backend.domain.course.repository.LectureRepository;
import com.hr.backend.domain.course.repository.VideoWatchLogRepository;
import com.hr.backend.domain.enrollment.entity.Enrollment;
import com.hr.backend.domain.enrollment.repository.EnrollmentRepository;
import com.hr.backend.domain.quiz.entity.Attempt;
import com.hr.backend.domain.quiz.entity.Exam;
import com.hr.backend.domain.quiz.entity.Quiz;
import com.hr.backend.domain.quiz.repository.AttemptRepository;
import com.hr.backend.domain.quiz.repository.ExamRepository;
import com.hr.backend.domain.quiz.repository.QuizRepository;
import com.hr.backend.domain.user.entity.User;
import com.hr.backend.domain.user.repository.UserRepository;
import com.hr.backend.employee.dto.response.MyCourseResponse;
import com.hr.backend.employee.exception.ResourceNotFoundException;
import com.hr.backend.employee.util.CurrentUserProvider;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageImpl;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.Comparator;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
@Transactional(readOnly = true)
public class EmployeeMyCourseService {

    private final EnrollmentRepository enrollmentRepository;
    private final LectureRepository lectureRepository;
    private final UserRepository userRepository;
    private final VideoWatchLogRepository videoWatchLogRepository;
    private final QuizRepository quizRepository;
    private final ExamRepository examRepository;
    private final AttemptRepository attemptRepository;
    private final CurrentUserProvider currentUserProvider;

    public Page<MyCourseResponse> getMyCourses(Pageable pageable) {
        List<MyCourseResponse> list = enrollmentRepository.findAllByUserId(getCurrentUser().getUserId())
                .stream()
                .filter(e -> e.getRound().getCourse().isActive())
                .map(this::toResponse).toList();
        int start = (int) Math.min(pageable.getOffset(), list.size());
        int end = Math.min(start + pageable.getPageSize(), list.size());
        return new PageImpl<>(list.subList(start, end), pageable, list.size());
    }

    public MyCourseResponse.MyCourseDetailResponse getMyCourseDetail(Long courseId) {
        Long userId = getCurrentUser().getUserId();
        Enrollment e = enrollmentRepository.findAllByUserId(userId).stream()
                .filter(x -> x.getRound().getCourse().getCourseId().equals(courseId))
                .findFirst()
                .orElseThrow(() -> new ResourceNotFoundException("Enrollment", "courseId", courseId));

        Course c = e.getRound().getCourse();

        // 직접 쿼리로 강의 목록 조회 — c.getLectures()는 JOIN FETCH로 로드된 Course 엔티티에서
        // 컬렉션이 초기화되지 않을 수 있어 0건 반환 문제가 발생함
        List<Lecture> lectures = lectureRepository.findAllByCourse_CourseIdOrderBySortOrderAsc(courseId);

        // 해당 강좌의 시청 기록을 한 번에 조회 (N+1 방지)
        Map<Long, VideoWatchLog> watchLogMap = videoWatchLogRepository
                .findByUserIdAndCourseId(userId, courseId)
                .stream()
                .collect(Collectors.toMap(w -> w.getVideo().getVideoId(), w -> w));

        List<MyCourseResponse.MyCourseVideoWatchStatusDto> videos = lectures.stream()
                .flatMap(l -> l.getVideos().stream()
                        .map(vid -> Map.entry(l, vid)))
                .sorted(Comparator
                        .comparingInt((Map.Entry<Lecture, CourseVideo> entry) -> entry.getKey().getSortOrder())
                        .thenComparingInt(entry -> entry.getValue().getSortOrder()))
                .map(entry -> {
                    Lecture lecture = entry.getKey();
                    CourseVideo v  = entry.getValue();
                    VideoWatchLog log = watchLogMap.get(v.getVideoId());
                    return MyCourseResponse.MyCourseVideoWatchStatusDto.builder()
                            .videoId(v.getVideoId())
                            .lectureId(lecture.getLectureId())
                            .lectureSortOrder(lecture.getSortOrder())
                            .title(v.getTitle())
                            .videoURL(v.getVideoUrl())
                            .durationSec(v.getDurationSec())
                            .sortOrder(v.getSortOrder())
                            .watchedSec(log != null ? log.getWatchedSec() : 0)
                            .isCompleted(log != null && log.isCompleted())
                            .build();
                })
                .toList();

        return MyCourseResponse.MyCourseDetailResponse.builder()
                .enrollmentId(e.getEnrollmentId())
                .courseId(c.getCourseId())
                .courseTitle(c.getTitle())
                .courseDescription(c.getDescription())
                .courseCategory(c.getCategory())
                .courseThumbnailUrl(c.getThumbnailUrl())
                .currentProgress(e.getProgress())
                .currentStatus(e.getStatus().name())
                .courseDeadline(e.getRound().getEndDate())
                .enrolledAt(e.getEnrolledAt())
                .completedAt(e.getCompletedAt())
                .quiz(buildQuizSummary(userId, lectures))
                .exam(buildExamSummary(userId, c.getCourseId()))
                .videos(videos)
                .build();
    }

    private MyCourseResponse.QuizSummary buildQuizSummary(Long userId, List<Lecture> lectures) {
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

        return MyCourseResponse.QuizSummary.builder()
                .quizId(firstQuiz.getQuizId())
                .title(title)
                .passScore(firstQuiz.getPassScore())
                .questionCount(questionCount)
                .completed(allPassed)
                .score(averageScore)
                .build();
    }

    private MyCourseResponse.ExamSummary buildExamSummary(Long userId, Long courseId) {
        Optional<Exam> examOptional = examRepository.findByCourse_CourseId(courseId);
        if (examOptional.isEmpty()) {
            return null;
        }

        Exam exam = examOptional.get();
        Optional<Attempt> latestAttempt = attemptRepository
                .findTopByUser_UserIdAndExam_ExamIdOrderByAttemptedAtDesc(userId, exam.getExamId());

        return MyCourseResponse.ExamSummary.builder()
                .examId(exam.getExamId())
                .title(exam.getTitle())
                .passScore(exam.getPassScore())
                .questionCount(exam.getQuestions().size())
                .completed(latestAttempt.map(Attempt::isPassed).orElse(false))
                .score(latestAttempt.map(Attempt::getScore).orElse(null))
                .build();
    }

    private MyCourseResponse toResponse(Enrollment e) {
        Course c = e.getRound().getCourse();
        return MyCourseResponse.builder()
                .enrollmentId(e.getEnrollmentId())
                .courseId(c.getCourseId())
                .courseTitle(c.getTitle())
                .courseThumbnailUrl(c.getThumbnailUrl())
                .progress(e.getProgress())
                .status(e.getStatus().name())
                .deadline(e.getRound().getEndDate())
                .enrolledAt(e.getEnrolledAt())
                .completedAt(e.getCompletedAt())
                .build();
    }

    private User getCurrentUser() {
        Long id = currentUserProvider.getCurrentUserId();
        return userRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("User", "userId", id));
    }
}
