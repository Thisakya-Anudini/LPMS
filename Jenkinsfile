pipeline {
    agent any

    stages {
        stage('Checkout Code') {
            steps {
                checkout scm
            }
        }

        stage('Frontend CI (React + Vite)') {
            steps {
                dir('client') {
                    echo 'Generating temporary Dockerfile for Frontend...'
                    writeFile file: 'Dockerfile.ci', text: '''FROM node:20
WORKDIR /app
COPY . .
RUN npm install --legacy-peer-deps
RUN npm install eslint@8.57.0 --no-save --legacy-peer-deps
RUN npm run lint
RUN npm run build
'''
                    echo 'Running Frontend Lint & Build inside Docker...'
                    sh 'docker build -t lpms-frontend-ci -f Dockerfile.ci .'
                }
            }
        }

        stage('Backend CI (Unit Tests)') {
            steps {
                dir('server') {
                    echo 'Starting temporary PostgreSQL test database on port 5433...'
                    sh '''
                        docker stop jenkins-test-postgres || true
                        docker rm jenkins-test-postgres || true
                        docker run -d --name jenkins-test-postgres \
                          -e POSTGRES_USER=user \
                          -e POSTGRES_PASSWORD=password \
                          -e POSTGRES_DB=lpms_db \
                          -p 5433:5432 postgres:15
                        
                        sleep 5
                    '''

                    echo 'Generating temporary Dockerfile for Backend...'
                    writeFile file: 'Dockerfile.ci', text: '''FROM node:20
WORKDIR /app
COPY . .
ENV DATABASE_URL=postgresql://user:password@localhost:5433/lpms_db
ENV SECRET_KEY=test-secret
RUN npm install --legacy-peer-deps
RUN npm run migrate
RUN npm test
'''
                    echo 'Running Backend Migrations & Unit Tests inside Docker...'
                    sh 'docker build -t lpms-backend-ci --network host -f Dockerfile.ci .'
                }
            }
        }

        stage('SonarQube Analysis') {
            steps {
                echo 'Running SonarQube Code Analysis...'
                withCredentials([string(credentialsId: 'SONAR_TOKEN', variable: 'SONAR_TOKEN')]) {
                    sh '''
                        docker run --rm --network host \
                          -v $PWD:/usr/src \
                          sonarsource/sonar-scanner-cli \
                          -Dsonar.host.url=https://dpdlab1.slt.lk:9443 \
                          -Dsonar.token="$SONAR_TOKEN" \
                          -Dsonar.projectKey="LPMS" \
                          -Dsonar.projectName="LPMS Learning Portal" \
                          -Dsonar.sources="server,client/src" \
                          -Dsonar.exclusions="**/node_modules/**,**/dist/**,**/build/**"
                    '''
                }
            }
        }
    }

    post {
        always {
            echo 'Cleaning up test database, images, and temporary files...'
            sh '''
                docker stop jenkins-test-postgres && docker rm jenkins-test-postgres || true
                docker rmi lpms-frontend-ci lpms-backend-ci || true
                rm -f client/Dockerfile.ci server/Dockerfile.ci || true
            '''
        }
        success {
            echo '==================================================='
            echo ' SUCCESS: All Code, Tests & Sonar Scan Passed!     '
            echo '==================================================='
        }
        failure {
            echo '==================================================='
            echo ' FAILURE: CI Checks or Sonar Scan Failed!          '
            echo '==================================================='
        }
    }
}
