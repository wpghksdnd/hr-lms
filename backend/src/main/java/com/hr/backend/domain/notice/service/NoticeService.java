package com.hr.backend.domain.notice.service;

import com.hr.backend.admin.dto.NoticeRequest;
import com.hr.backend.admin.dto.NoticeResponse;
import com.hr.backend.domain.notice.entity.Notice;
import com.hr.backend.domain.notice.repository.NoticeRepository;
import com.hr.backend.domain.notification.service.NotificationService;
import com.hr.backend.domain.user.entity.User;
import com.hr.backend.domain.user.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;

@Service
@RequiredArgsConstructor
@Transactional(readOnly = true)
public class NoticeService {

    private final NoticeRepository noticeRepository;
    private final UserRepository   userRepository;
    private final NotificationService notificationService;

    public List<NoticeResponse> getAll() {
        return noticeRepository.findAllWithAuthor().stream()
                .map(NoticeResponse::new)
                .toList();
    }

    @Transactional
    public NoticeResponse getOne(Long id) {
        Notice notice = noticeRepository.findByIdWithAuthor(id)
                .orElseThrow(() -> new IllegalArgumentException("공지사항을 찾을 수 없습니다."));
        notice.incrementViewCount();
        return new NoticeResponse(notice);
    }

    @Transactional
    public NoticeResponse create(String employeeNo, NoticeRequest req) {
        User author = userRepository.findByEmployeeNo(employeeNo)
                .orElseThrow(() -> new IllegalArgumentException("사용자를 찾을 수 없습니다."));
        Notice notice = Notice.builder()
                .title(req.getTitle())
                .content(req.getContent())
                .author(author)
                .build();
        Notice saved = noticeRepository.save(notice);
        notificationService.notifyNewNotice(saved.getTitle(), saved.getContent());
        return new NoticeResponse(saved);
    }

    @Transactional
    public NoticeResponse update(Long id, NoticeRequest req) {
        Notice notice = noticeRepository.findByIdWithAuthor(id)
                .orElseThrow(() -> new IllegalArgumentException("공지사항을 찾을 수 없습니다."));
        notice.update(req.getTitle(), req.getContent());
        return new NoticeResponse(notice);
    }

    @Transactional
    public void delete(Long id) {
        if (!noticeRepository.existsById(id)) {
            throw new IllegalArgumentException("공지사항을 찾을 수 없습니다.");
        }
        noticeRepository.deleteById(id);
    }
}
