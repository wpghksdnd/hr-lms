package com.hr.backend.domain.course.repository;

import com.hr.backend.domain.course.entity.VideoWatchLog;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;
import java.util.Optional;

public interface VideoWatchLogRepository extends JpaRepository<VideoWatchLog, Long> {

    Optional<VideoWatchLog> findByUser_UserIdAndVideo_VideoId(Long userId, Long videoId);

    /** 특정 사용자 + 강의 내 완료 영상 수 */
    @Query("SELECT COUNT(w) FROM VideoWatchLog w " +
           "WHERE w.user.userId = :userId " +
           "  AND w.video.lecture.lectureId = :lectureId " +
           "  AND w.completed = true")
    long countCompletedByUserAndLecture(@Param("userId") Long userId,
                                        @Param("lectureId") Long lectureId);

    @Query("SELECT w FROM VideoWatchLog w WHERE w.user.userId = :userId AND w.video.lecture.course.courseId = :courseId")
    List<VideoWatchLog> findByUserIdAndCourseId(@Param("userId") Long userId, @Param("courseId") Long courseId);

    /** 특정 강의 내 완료된 videoId 목록 — N+1 방지용 배치 조회 */
    @Query("SELECT w.video.videoId FROM VideoWatchLog w " +
           "WHERE w.user.userId = :userId AND w.video.lecture.lectureId = :lectureId AND w.completed = true")
    List<Long> findCompletedVideoIdsByUserAndLecture(@Param("userId") Long userId,
                                                     @Param("lectureId") Long lectureId);
}
