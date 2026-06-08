pipeline {
    agent any

    options {
        disableConcurrentBuilds()
        buildDiscarder(logRotator(numToKeepStr: '20'))
        timestamps()
    }

    environment {
        SLACK_NOTIFICATION_CHANNEL = '#jenkins-알림'
    }

    stages {

        stage('Git Pull') {
            steps {
                git branch: 'main',
                    credentialsId: 'github-token',
                    url: 'https://github.com/wpghksdnd/hr-lms.git'
            }
        }

        stage('Prepare Environment') {
            steps {
                withCredentials([file(credentialsId: 'lms-env-file', variable: 'ENV_FILE')]) {
                    sh '''
                        set -eu
                        cp "$ENV_FILE" .env
                        sed -i 's/\r$//' .env
                        chmod 600 .env

                                                # 필수 키 검증
                                                required_keys="MYSQL_DATABASE MYSQL_USER MYSQL_PASSWORD MYSQL_ROOT_PASSWORD SPRING_DATASOURCE_USERNAME SPRING_DATASOURCE_PASSWORD JWT_SECRET"
                                                for key in $required_keys; do
                                                    if ! awk -F= -v k="$key" '$1==k && length($2)>0 {found=1} END{exit(found?0:1)}' .env; then
                                                        echo "[ERROR] .env 필수값 누락: $key"
                                                        exit 1
                                                    fi
                                                done

                                                # DB명/URL 불일치 방지: SPRING_DATASOURCE_URL을 MYSQL_DATABASE 기준으로 고정
                                                DB_NAME=$(awk -F= '/^MYSQL_DATABASE=/{print $2; exit}' .env | tr -d '\r')
                                                [ -n "$DB_NAME" ] || DB_NAME=lms
                                                sed -i '/^SPRING_DATASOURCE_URL=/d' .env
                                                echo "SPRING_DATASOURCE_URL=jdbc:mysql://mysql:3306/${DB_NAME}?serverTimezone=Asia/Seoul&characterEncoding=UTF-8" >> .env

                                                # CERTIFICATE_INTERNAL_API_TOKEN 누락 시 배포 중단
                                                if ! awk -F= -v k="CERTIFICATE_INTERNAL_API_TOKEN" '$1==k && length($2)>0 {found=1} END{exit(found?0:1)}' .env; then
                                                    echo "[ERROR] .env 필수값 누락: CERTIFICATE_INTERNAL_API_TOKEN"
                                                    exit 1
                                                fi

                        docker compose --env-file .env config -q
                    '''
                }
            }
        }

        stage('Backend Tests') {
            steps {
                sh '''
                    tar -C backend -cf - . | docker run --rm -i \
                      -v "$HOME/.gradle:/home/gradle/.gradle" \
                      -w /app \
                      gradle:8.7-jdk17 \
                      /bin/sh -c 'mkdir -p /app; tar -xf - -C /app; gradle test --no-daemon'
                '''
            }
        }

        stage('Frontend Validation') {
            steps {
                sh '''
                    tar -C frontend -cf - . | docker run --rm -i \
                      -w /app \
                      node:20-alpine \
                      /bin/sh -c 'mkdir -p /app; tar -xf - -C /app; npm ci; npm run lint; npm run build'
                '''
            }
        }

        stage('Cleanup Legacy Containers') {
            steps {
                sh '''
                    for name in lms_frontend lms_backend lms_ai hr-lms-frontend-1 hr-lms-backend-1 hr-lms-ai-1; do
                      docker rm -f "$name" 2>/dev/null || true
                    done
                '''
            }
        }

        stage('Docker Deploy') {
            steps {
                sh 'docker compose --env-file .env up -d --build --force-recreate ai backend frontend dozzle'
            }
        }

        stage('Post-Deploy Health Check') {
            steps {
                sh '''
                    sed -i 's/\r$//' .env

                                        AI_PORT=$(awk -F= '/^AI_HTTP_PORT=/{print $2}' .env | tr -d '\r')
                                        BACKEND_PORT=$(awk -F= '/^BACKEND_HTTP_PORT=/{print $2}' .env | tr -d '\r')
                                        FRONTEND_PORT=$(awk -F= '/^FRONTEND_HTTP_PORT=/{print $2}' .env | tr -d '\r')

                                        [ -n "$AI_PORT" ] || AI_PORT=5005
                                        [ -n "$BACKEND_PORT" ] || BACKEND_PORT=8085
                                        [ -n "$FRONTEND_PORT" ] || FRONTEND_PORT=3005

                                        FRONTEND_CID=$(docker compose --env-file .env ps -q frontend)
                                        if [ -n "$FRONTEND_CID" ]; then
                                            i=0
                                            while [ $i -lt 24 ]; do
                                                STATUS=$(docker inspect -f '{{if .State.Health}}{{.State.Health.Status}}{{else}}none{{end}}' "$FRONTEND_CID")
                                                if [ "$STATUS" = "healthy" ] || [ "$STATUS" = "none" ]; then
                                                    break
                                                fi
                                                i=$((i+1))
                                                sleep 5
                                            done
                                        fi

                                        curl --fail --retry 12 --retry-delay 5 --retry-all-errors "http://host.docker.internal:${AI_PORT}/health"
                                        curl --fail --retry 12 --retry-delay 5 --retry-all-errors "http://host.docker.internal:${BACKEND_PORT}/health"
                                        curl --fail --retry 12 --retry-delay 5 --retry-all-errors -o /dev/null "http://host.docker.internal:${FRONTEND_PORT}/"
                '''
            }
        }
    }

    post {
        success {
            script {
                try {
                    slackSend(channel: "${SLACK_NOTIFICATION_CHANNEL}", color: '#41fc03',
                        message: "운영 서버에 성공적으로 배포했습니다! \n Job : <${env.BUILD_URL}|${env.JOB_NAME} ${env.BUILD_NUMBER}>")
                } catch (Exception e) {
                    echo "Deploy Success (Slack send skipped: ${e.getMessage()})"
                }
            }
        }

        failure {
            script {
                try {
                    slackSend(channel: "${SLACK_NOTIFICATION_CHANNEL}", color: '#fc0f03',
                        message: "운영 서버에 배포가 실패했습니다! \n Job : <${env.BUILD_URL}|${env.JOB_NAME} ${env.BUILD_NUMBER}>")
                } catch (Exception e) {
                    echo "Deploy Failed (Slack send skipped: ${e.getMessage()})"
                }
            }
        }
    }
}