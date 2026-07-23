pipeline {
    agent any

    environment {
        // Database credentials used during unit tests
        DATABASE_URL = 'postgresql://user:password@localhost:5432/lpms_db'
        SECRET_KEY   = 'test-secret'
    }

    stages {
        stage('Checkout Code') {
            steps {
                checkout scm
            }
        }

        stage('Frontend CI (Lint & Build)') {
            steps {
                dir('client') {
                    echo 'Installing Frontend Dependencies...'
                    sh 'npm install --legacy-peer-deps'
                    
                    echo 'Fixing ESLint Version...'
                    sh 'npm install eslint@8.57.0 --no-save --legacy-peer-deps'
                    
                    echo 'Running Code Quality Checks (Lint)...'
                    sh 'npm run lint'
                    
                    echo 'Testing Production Build...'
                    sh 'npm run build'
                }
            }
        }

        stage('Backend CI (Unit Tests)') {
            steps {
                dir('server') {
                    echo 'Installing Backend Dependencies...'
                    sh 'npm install --legacy-peer-deps'

                    echo 'Starting temporary PostgreSQL for testing...'
                    sh '''
                        docker run -d --name jenkins-test-postgres \
                          -e POSTGRES_USER=user \
                          -e POSTGRES_PASSWORD=password \
                          -e POSTGRES_DB=lpms_db \
                          -p 5432:5432 postgres:15 || true
                        
                        # Wait 5 seconds for Postgres to start
                        sleep 5
                    '''
                    
                    echo 'Running Database Migrations...'
                    sh 'npm run migrate'
                    
                    echo 'Running Unit Tests...'
                    sh 'npm test'
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
