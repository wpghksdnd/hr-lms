FROM gradle:8.7-jdk17 AS build

WORKDIR /app

COPY . .

# 빌드 시점에 Korean TTF 폰트를 클래스패스 리소스로 번들 (JAR 안에 포함)
# registerClasspathFont()가 fonts/NotoSansKR-Regular.ttf 를 가장 먼저 탐색함
RUN apt-get update \
	&& apt-get install -y --no-install-recommends fonts-nanum \
	&& mkdir -p src/main/resources/fonts \
	&& cp /usr/share/fonts/truetype/nanum/NanumGothic.ttf src/main/resources/fonts/NotoSansKR-Regular.ttf \
	&& rm -rf /var/lib/apt/lists/*

RUN gradle clean build -x test

FROM eclipse-temurin:17-jdk

WORKDIR /app

RUN apt-get update \
	&& apt-get install -y --no-install-recommends fontconfig wget \
	&& rm -rf /var/lib/apt/lists/*

COPY --from=build /app/build/libs/*.jar app.jar

EXPOSE 8080

ENTRYPOINT ["java", "-jar", "app.jar"]