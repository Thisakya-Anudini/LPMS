pipeline {
    agent any

    environment {
        // Environment variables for Backend CI Tests
        DATABASE_URL = 'postgresql://user:password@localhost:5432/lpms_db'
        SECRET_KEY   = 'test-secret'
    }

    stages {
        stage('Checkout Code') {
            steps {
                checkout scm
            }
        }

        stage('Frontend CI (React + Vite)') {
            steps {
                dir('client') {
                    echo 'Running Frontend Lint & Build inside Node 20 Docker container...'
                    sh '''
                        docker run --rm -v $PWD:/app -w /app node:20 sh -c "
                          npm install --legacy-peer-deps && \
                          npm install eslint@8.57.0 --no-save --legacy-peer-deps && \
                          npm run lint && \
                          npm run build
                        "
                    '''
                }
            }
        }

        stage('Backend CI (Unit Tests)') {
            steps {
                dir('server') {
                    echo 'Starting temporary PostgreSQL container...'
                    sh '''
                        docker run -d --name jenkins-test-postgres \
                          -e POSTGRES_USER=user \
                          -e POSTGRES_PASSWORD=password \
                          -e POSTGRES_DB=lpms_db \
                          -p 5432:5432 postgres:15 || true
                        
                        sleep 5
                    '''

                    echo 'Running Backend Migrations & Tests inside Node 20 Docker container...'
                    sh '''
                        docker run --rm --network host -v $PWD:/app -w /app node:20 sh -c "
                          npm install --legacy-peer-deps && \
                          npm run migrate && \
                          npm test
                        "
                    '''
                }
            }
        }
    }

    post {
        always {
            echo 'Cleaning up temporary test database...'
            sh 'docker stop jenkins-test-postgres && docker rm jenkins-test-postgres || true'
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
