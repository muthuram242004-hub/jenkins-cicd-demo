// =====================================================================
//  Jenkinsfile — CI/CD pipeline for jenkins-cicd-demo
//  Flow: Checkout -> Build -> Test -> Deploy -> Smoke Test
//  Requirements on the Jenkins agent: git + Docker CLI with access
//  to a Docker daemon (see jenkins/docker-compose.yml).
// =====================================================================
pipeline {
    agent any

    environment {
        APP_NAME   = 'jenkins-cicd-demo'
        IMAGE_NAME = "${APP_NAME}"
        IMAGE_TAG  = "${BUILD_NUMBER}"          // unique tag per build
        TEST_IMAGE = "${APP_NAME}-test:${BUILD_NUMBER}"
        CONTAINER  = "${APP_NAME}"              // name of the running app
        APP_PORT   = '3000'                     // host port for the deployed app
    }

    options {
        timestamps()                                    // timestamps in console log
        buildDiscarder(logRotator(numToKeepStr: '10'))  // keep last 10 builds
        disableConcurrentBuilds()                       // one deploy at a time
        timeout(time: 20, unit: 'MINUTES')
    }

    // ---- (b) Trigger the pipeline on every commit ----
    triggers {
        githubPush()             // instant: fires when GitHub sends a push webhook
        pollSCM('H/2 * * * *')   // fallback: check the repo every ~2 min (works on localhost)
    }

    stages {

        stage('Checkout') {
            steps {
                checkout scm
                script {
                    env.GIT_SHORT = sh(script: 'git rev-parse --short HEAD', returnStdout: true).trim()
                    env.APP_VERSION = "${BUILD_NUMBER}-${env.GIT_SHORT}"
                }
                echo "Building ${APP_NAME} version ${env.APP_VERSION}"
            }
        }

        stage('Build') {
            steps {
                echo 'Building test image and production image...'
                sh "docker build --target test -t ${TEST_IMAGE} ."
                sh """
                    docker build --target production \
                        --build-arg APP_VERSION=${env.APP_VERSION} \
                        -t ${IMAGE_NAME}:${IMAGE_TAG} \
                        -t ${IMAGE_NAME}:latest .
                """
            }
        }

        stage('Test') {
            steps {
                echo 'Running unit tests inside the test container...'
                sh "docker run --name test-${BUILD_NUMBER} ${TEST_IMAGE} npm run test:ci"
            }
            post {
                always {
                    // Copy the JUnit report out of the container and publish it
                    sh "docker cp test-${BUILD_NUMBER}:/app/test-results . || true"
                    sh "docker rm -f test-${BUILD_NUMBER} || true"
                    junit allowEmptyResults: true, testResults: 'test-results/*.xml'
                }
            }
        }

        stage('Deploy') {
            steps {
                echo "Deploying ${IMAGE_NAME}:${IMAGE_TAG} on port ${APP_PORT}..."
                sh """
                    docker rm -f ${CONTAINER} || true
                    docker run -d \
                        --name ${CONTAINER} \
                        --restart unless-stopped \
                        -p ${APP_PORT}:3000 \
                        ${IMAGE_NAME}:${IMAGE_TAG}
                """
            }
        }

        stage('Smoke Test') {
            steps {
                echo 'Verifying the deployed app is healthy...'
                retry(5) {
                    sleep(time: 3, unit: 'SECONDS')
                    sh "docker exec ${CONTAINER} wget -qO- http://localhost:3000/health"
                }
            }
        }
    }

    post {
        success {
            echo "SUCCESS: version ${env.APP_VERSION} is live at http://localhost:${APP_PORT}"
        }
        failure {
            echo 'FAILED: check the stage that turned red in the Stage View / console output.'
        }
        always {
            // House-keeping: remove the throwaway test image and dangling layers
            sh "docker rmi ${TEST_IMAGE} || true"
            sh 'docker image prune -f || true'
        }
    }
}
