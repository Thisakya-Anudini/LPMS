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
                    echo 'Linting and Building Frontend in Node 20 container...'
                    sh '''
                        docker build -t lpms-frontend-ci -f - . << 'EOF'
                        FROM node:20
                        WORKDIR /app
                        COPY . .
                        RUN npm install --legacy-peer-deps
                        RUN npm install eslint@8.57.0 --no-save --legacy-peer-deps
                        RUN npm run lint
                        RUN npm run build
                        EOF
                    '''
                }
            }
        }

        stage('Backend CI (Unit Tests)') {
            steps {
                dir('server') {
                    echo 'Starting temporary PostgreSQL test database...'
                    sh '''
                        docker run -d --name jenkins-test-postgres \
                          -e POSTGRES_USER=user \
                          -e POSTGRES_PASSWORD=password \
                          -e POSTGRES_DB=lpms_db \
                          -p 5432:5432 postgres:15 || true
                        
                        sleep 5
                    '''

                    echo 'Running Backend Migrations & Unit Tests...'
                    sh '''
                        docker build -t lpms-backend-ci --network host -f - . << 'EOF'
                        FROM node:20
                        WORKDIR /app
                        COPY . .
                        ENV DATABASE_URL=postgresql://user:password@localhost:5432/lpms_db
                        ENV SECRET_KEY=test-secret
                        RUN npm install --legacy-peer-deps
                        RUN npm run migrate
                        RUN npm test
                        EOF
                    '''
                }
            }
        }
    }

    post {
        always {
            echo 'Cleaning up test database and images...'
            sh '''
                docker stop jenkins-test-postgres && docker rm jenkins-test-postgres || true
                docker rmi lpms-frontend-ci lpms-backend-ci || true
            '''
        }
        success {
            echo '==========================================='
            echo ' SUCCESS: All Code & Error Checks Passed!  '
            echo '==========================================='
        }
        failure {
            echo '==========================================='
            echo ' FAILURE: Linting, Build, or Test Errors!  '
            echo '==========================================='
        }
    }
}
