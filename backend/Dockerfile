FROM gradle:8.7-jdk17 AS build

WORKDIR /app

COPY . .

RUN gradle clean build -x test

FROM eclipse-temurin:17-jdk

WORKDIR /app

RUN apt-get update \
	&& apt-get install -y --no-install-recommends fonts-noto-cjk fonts-nanum fontconfig wget \
	&& fc-cache -fv \
	&& rm -rf /var/lib/apt/lists/*

COPY --from=build /app/build/libs/*.jar app.jar

EXPOSE 8080

ENTRYPOINT ["java", "-jar", "app.jar"]