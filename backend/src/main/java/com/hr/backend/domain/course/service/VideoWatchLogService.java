package com.hr.backend.domain.course.service;

import com.hr.backend.domain.course.entity.CourseVideo;
import com.hr.backend.domain.course.entity.Lecture;
import com.hr.backend.domain.course.entity.LectureProgress;
import com.hr.backend.domain.course.entity.VideoWatchLog;
import com.hr.backend.domain.course.repository.CourseVideoRepository;
import com.hr.backend.domain.course.repository.LectureProgressRepository;
import com.hr.backend.domain.course.repository.LectureRepository;
import com.hr.backend.domain.course.repository.VideoWatchLogRepository;
import com.hr.backend.domain.enrollment.entity.Enrollment;
import com.hr.backend.domain.enrollment.repository.EnrollmentRepository;
import com.hr.backend.domain.enrollment.service.EnrollmentService;
import com.hr.backend.domain.quiz.repository.QuizRepository;
import com.hr.backend.domain.user.entity.User;
import com.hr.backend.domain.user.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.Map;

@Service
@RequiredArgsConstructor
@Transactional(readOnly = true)
public class VideoWatchLogService {

    private final VideoWatchLogRepository   videoWatchLogRepository;
    private final LectureProgressRepository lectureProgressRepository;
    private final CourseVideoRepository     courseVideoRepository;
    private final LectureRepository         lectureRepository;
    private final UserRepository            userRepository;
    private final EnrollmentRepository      enrollmentRepository;
    private final EnrollmentService         enrollmentService;
    private final QuizRepository            quizRepository;

    // ──────────────────────────────────────────────────────────
    // 영상 시청 시작
    // ──────────────────────────────────────────────────────────

    @Transactional
    public void startWatch(Long userId, Long videoId) {
        User user       = findUser(userId);
        CourseVideo video = findVideo(videoId);

        VideoWatchLog log = videoWatchLogRepository
                .findByUser_UserIdAndVideo_VideoId(userId, videoId)
                .orElseGet(() -> VideoWatchLog.builder().user(user).video(video).build());

        log.startSession();
        videoWatchLogRepository.save(log);
    }

    // ──────────────────────────────────────────────────────────
    // 영상 시청 종료 (누적 시청 시간 기록)
    // ──────────────────────────────────────────────────────────

    /**
     * @param watchedSec 이번 세션에서 실제 시청한 초
     * @return videoCompleted, lectureCompleted 포함한 결과 Map
     */
    @Transactional
    public Map<String, Object> endWatch(Long userId, Long videoId, int watchedSec) {
        User user       = findUser(userId);
        CourseVideo video = findVideo(videoId);

        VideoWatchLog log = videoWatchLogRepository
                .findByUser_UserIdAndVideo_VideoId(userId, videoId)
                .orElseGet(() -> VideoWatchLog.builder().user(user).video(video).build());

        log.endSession(watchedSec);
        videoWatchLogRepository.save(log);

        // 영상 완료 시 강의 완료 여부 체크
        boolean lectureCompleted = false;
        if (log.isCompleted()) {
            lectureCompleted = checkAndCompleteLecture(user, video);
        }

        return Map.of(
                "videoId",          videoId,
                "watchedSec",       log.getWatchedSec(),
                "videoCompleted",   log.isCompleted(),
                "lectureCompleted", lectureCompleted
        );
    }

    // ──────────────────────────────────────────────────────────
    // 강의 진행 현황 조회
    // ──────────────────────────────────────────────────────────

    /**
     * 특정 강의의 영상별 시청 완료 여부 반환
     */
    public List<Map<String, Object>> getLectureWatchStatus(Long userId, Long lectureId) {
        List<CourseVideo> videos = courseVideoRepository
                .findAllByLecture_LectureIdOrderBySortOrderAsc(lectureId);

        return videos.stream().map(video -> {
            VideoWatchLog log = videoWatchLogRepository
                    .findByUser_UserIdAndVideo_VideoId(userId, video.getVideoId())
                    .orElse(null);
            return Map.<String, Object>of(
                    "videoId",     video.getVideoId(),
                    "title",       video.getTitle(),
                    "durationSec", video.getDurationSec(),
                    "completed",   log != null && log.isCompleted(),
                    "watchedSec",  log != null ? log.getWatchedSec() : 0
            );
        }).toList();
    }

    // ──────────────────────────────────────────────────────────
    // private helpers
    // ──────────────────────────────────────────────────────────

    /**
     * 강의 내 모든 영상이 완료됐으면 LectureProgress 완료 처리
     */
    private boolean checkAndCompleteLecture(User user, CourseVideo video) {
        Long lectureId = video.getLecture().getLectureId();
        List<CourseVideo> allVideos = courseVideoRepository
                .findAllByLecture_LectureIdOrderBySortOrderAsc(lectureId);

        boolean allCompleted = allVideos.stream().allMatch(v ->
                videoWatchLogRepository
                        .findByUser_UserIdAndVideo_VideoId(user.getUserId(), v.getVideoId())
                        .map(VideoWatchLog::isCompleted)
                        .orElse(false)
        );

        if (!allCompleted) {
            return false;
        }

        Lecture lecture = findLecture(lectureId);
        if (quizRepository.existsByLecture_LectureId(lectureId)) {
            return true;
        }

        LectureProgress progress = lectureProgressRepository
                .findByUser_UserIdAndLecture_LectureId(user.getUserId(), lectureId)
                .orElseGet(() -> LectureProgress.builder().user(user).lecture(lecture).build());

        if (!progress.isCompleted()) {
            progress.complete();
            lectureProgressRepository.save(progress);
            recalculateEnrollmentProgress(user, lecture);
        }
        return true;
    }

    /** 강의 완료 후 수강 진행률 재계산 */
    private void recalculateEnrollmentProgress(User user, Lecture lecture) {
        Long courseId = lecture.getCourse().getCourseId();
        int total = lecture.getCourse().getLectures().size();
        if (total == 0) return;

        long completed = lectureProgressRepository
                .countByUser_UserIdAndLecture_Course_CourseIdAndCompletedTrue(user.getUserId(), courseId);
        int progress = Math.min(100, (int) ((completed * 100) / total));

        enrollmentRepository.findAllByUserId(user.getUserId()).stream()
                .filter(e -> e.getRound().getCourse().getCourseId().equals(courseId))
                .findFirst()
                .ifPresent(e -> {
                    e.updateProgress(progress);
                    if (progress >= 100 && e.getStatus() != Enrollment.Status.DONE) {
                        try {
                            enrollmentService.completeEnrollment(e.getEnrollmentId());
                        } catch (IllegalArgumentException ignored) {
                            // 시험 또는 퀴즈 조건이 남아 있으면 DONE 처리는 이후 응시 완료 시점에 진행한다.
                        }
                    }
                });
    }

    private User findUser(Long userId) {
        return userRepository.findById(userId)
                .orElseThrow(() -> new IllegalArgumentException("사용자를 찾을 수 없습니다."));
    }

    private CourseVideo findVideo(Long videoId) {
        return courseVideoRepository.findById(videoId)
                .orElseThrow(() -> new IllegalArgumentException("영상을 찾을 수 없습니다."));
    }

    private Lecture findLecture(Long lectureId) {
        return lectureRepository.findById(lectureId)
                .orElseThrow(() -> new IllegalArgumentException("강의를 찾을 수 없습니다."));
    }
}
