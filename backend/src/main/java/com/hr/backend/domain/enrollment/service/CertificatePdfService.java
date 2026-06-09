package com.hr.backend.domain.enrollment.service;

import com.openhtmltopdf.pdfboxout.PdfRendererBuilder;
import lombok.RequiredArgsConstructor;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.core.io.ClassPathResource;
import org.springframework.stereotype.Service;
import org.thymeleaf.TemplateEngine;
import org.thymeleaf.context.Context;

import java.io.File;
import java.io.IOException;
import java.io.InputStream;
import java.io.OutputStream;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.Map;

@Service
@RequiredArgsConstructor
public class CertificatePdfService {

    private final TemplateEngine templateEngine;

    @Value("${certificate.storage-path:/app/certificates}")
    private String storagePath;

    /**
     * Thymeleaf 템플릿을 렌더링한 뒤 OpenHTMLToPDF로 PDF를 생성하고 저장 경로를 반환한다.
     *
     * @param variables 템플릿 변수 맵
     * @param fileName  저장할 파일명 (예: cert_1.pdf)
     * @param subDir    연도 서브 디렉토리 (예: "2026")
     * @return 저장된 파일의 절대 경로
     */
    public Path generatePdf(Map<String, Object> variables, String fileName, String subDir) {
        // 1. Thymeleaf → HTML 문자열
        Context ctx = new Context();
        ctx.setVariables(variables);
        String htmlContent = templateEngine.process("certificate", ctx);

        // 2. 저장 디렉토리 생성
        Path dir = Paths.get(storagePath, subDir);
        try {
            Files.createDirectories(dir);
        } catch (IOException e) {
            throw new CertificateGenerationException("이수증 디렉토리 생성 실패: " + dir, e);
        }

        // 3. PDF 생성
        Path pdfFile = dir.resolve(fileName);
        try (OutputStream os = Files.newOutputStream(pdfFile)) {
            PdfRendererBuilder builder = new PdfRendererBuilder();
            builder.useFastMode();
            builder.withHtmlContent(htmlContent, null);
            registerKoreanFonts(builder);
            builder.toStream(os);
            builder.run();
        } catch (Exception e) {
            throw new CertificateGenerationException("PDF 변환 실패: " + e.getMessage(), e);
        }

        return pdfFile;
    }

    private void registerKoreanFonts(PdfRendererBuilder builder) {
        // 1) 프로젝트에 폰트를 포함한 경우 우선 사용
        registerClasspathFont(builder, "fonts/NotoSansKR-Regular.ttf", "KoreanEmbedded");
        registerClasspathFont(builder, "fonts/NotoSansKR-Regular.ttf", "Noto Sans KR");
        registerClasspathFont(builder, "fonts/NotoSansCJKkr-Regular.otf", "KoreanEmbedded");
        registerClasspathFont(builder, "fonts/NotoSansCJKkr-Regular.otf", "Noto Sans CJK KR");

        // 2) OS 기본 폰트 경로 fallback
        for (String path : candidateSystemFontPaths()) {
            File font = new File(path);
            if (font.exists() && font.isFile()) {
                builder.useFont(font, "KoreanFallback");
                builder.useFont(font, "Malgun Gothic");
                builder.useFont(font, "NanumGothic");
                builder.useFont(font, "Noto Sans KR");
                builder.useFont(font, "Noto Sans CJK KR");
            }
        }
    }

    private void registerClasspathFont(PdfRendererBuilder builder, String classpathLocation, String familyName) {
        ClassPathResource resource = new ClassPathResource(classpathLocation);
        if (resource.exists()) {
            builder.useFont(() -> {
                try {
                    return resource.getInputStream();
                } catch (IOException e) {
                    throw new RuntimeException(e);
                }
            }, familyName);
        }
    }

    private Iterable<String> candidateSystemFontPaths() {
        // OTF/CFF 폰트(NotoSansCJK .ttc 등)는 PDFBox 임베딩 불가 → TTF 경로만 포함
        // 클래스패스 폰트(fonts/NotoSansKR-Regular.ttf)가 먼저 등록되므로 여기는 최후 fallback
        ArrayList<String> candidates = new ArrayList<>(Arrays.asList(
                "C:/Windows/Fonts/malgun.ttf",
                "C:/Windows/Fonts/NanumGothic.ttf",
                "/usr/share/fonts/truetype/nanum/NanumGothic.ttf"
        ));

        String javaHome = System.getProperty("java.home");
        if (javaHome != null && !javaHome.isBlank()) {
            candidates.add(javaHome + "/lib/fonts/NanumGothic.ttf");
        }

        return candidates;
    }
}
