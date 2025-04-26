# 퀴즈 애플리케이션 데이터베이스 스키마

## 테이블 구조

### 1. users (사용자)
```sql
CREATE TABLE users (
    id INT PRIMARY KEY AUTO_INCREMENT,
    username VARCHAR(50) NOT NULL UNIQUE,
    email VARCHAR(100) NOT NULL UNIQUE,
    password_hash VARCHAR(255) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);
```

### 2. quizzes (퀴즈)
```sql
CREATE TABLE quizzes (
    id INT PRIMARY KEY AUTO_INCREMENT,
    title VARCHAR(100) NOT NULL,
    description TEXT,
    thumbnail_url VARCHAR(255),
    created_by INT NOT NULL,
    is_public BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (created_by) REFERENCES users(id)
);
```

### 3. questions (문제)
```sql
CREATE TABLE questions (
    id INT PRIMARY KEY AUTO_INCREMENT,
    quiz_id INT NOT NULL,
    question_type ENUM('text', 'choice') NOT NULL,
    question_text TEXT NOT NULL,
    image_url VARCHAR(255),
    points INT DEFAULT 1,
    order_index INT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (quiz_id) REFERENCES quizzes(id) ON DELETE CASCADE
);
```

### 4. options (선택지)
```sql
CREATE TABLE options (
    id INT PRIMARY KEY AUTO_INCREMENT,
    question_id INT NOT NULL,
    option_text TEXT NOT NULL,
    is_correct BOOLEAN DEFAULT false,
    order_index INT NOT NULL,
    FOREIGN KEY (question_id) REFERENCES questions(id) ON DELETE CASCADE
);
```

### 5. quiz_attempts (퀴즈 시도)
```sql
CREATE TABLE quiz_attempts (
    id INT PRIMARY KEY AUTO_INCREMENT,
    user_id INT NOT NULL,
    quiz_id INT NOT NULL,
    started_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    completed_at TIMESTAMP NULL,
    score INT DEFAULT 0,
    FOREIGN KEY (user_id) REFERENCES users(id),
    FOREIGN KEY (quiz_id) REFERENCES quizzes(id)
);
```

### 6. question_answers (문제 답안)
```sql
CREATE TABLE question_answers (
    id INT PRIMARY KEY AUTO_INCREMENT,
    attempt_id INT NOT NULL,
    question_id INT NOT NULL,
    user_answer TEXT,
    is_correct BOOLEAN,
    time_spent INT DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (attempt_id) REFERENCES quiz_attempts(id) ON DELETE CASCADE,
    FOREIGN KEY (question_id) REFERENCES questions(id)
);
```

## 인덱스

```sql
-- 사용자 검색 최적화
CREATE INDEX idx_users_username ON users(username);
CREATE INDEX idx_users_email ON users(email);

-- 퀴즈 검색 최적화
CREATE INDEX idx_quizzes_title ON quizzes(title);
CREATE INDEX idx_quizzes_created_by ON quizzes(created_by);

-- 문제 순서 정렬 최적화
CREATE INDEX idx_questions_quiz_order ON questions(quiz_id, order_index);

-- 선택지 순서 정렬 최적화
CREATE INDEX idx_options_question_order ON options(question_id, order_index);

-- 퀴즈 시도 검색 최적화
CREATE INDEX idx_quiz_attempts_user ON quiz_attempts(user_id);
CREATE INDEX idx_quiz_attempts_quiz ON quiz_attempts(quiz_id);

-- 답안 검색 최적화
CREATE INDEX idx_question_answers_attempt ON question_answers(attempt_id);
CREATE INDEX idx_question_answers_question ON question_answers(question_id);
```

## 관계 설명

1. **사용자-퀴즈 관계**
   - 한 사용자는 여러 퀴즈를 생성할 수 있음 (1:N)
   - 퀴즈는 한 명의 생성자를 가짐 (N:1)

2. **퀴즈-문제 관계**
   - 한 퀴즈는 여러 문제를 가질 수 있음 (1:N)
   - 문제는 하나의 퀴즈에 속함 (N:1)

3. **문제-선택지 관계**
   - 한 문제는 여러 선택지를 가질 수 있음 (1:N)
   - 선택지는 하나의 문제에 속함 (N:1)

4. **사용자-퀴즈 시도 관계**
   - 한 사용자는 여러 퀴즈를 시도할 수 있음 (1:N)
   - 퀴즈 시도는 한 명의 사용자에 속함 (N:1)

5. **퀴즈 시도-답안 관계**
   - 한 퀴즈 시도는 여러 답안을 가질 수 있음 (1:N)
   - 답안은 하나의 퀴즈 시도에 속함 (N:1)

## 데이터 무결성 규칙

1. **CASCADE 삭제**
   - 퀴즈 삭제 시 관련 문제들도 삭제
   - 문제 삭제 시 관련 선택지들도 삭제
   - 퀴즈 시도 삭제 시 관련 답안들도 삭제

2. **NOT NULL 제약**
   - 사용자명, 이메일, 비밀번호
   - 퀴즈 제목, 생성자
   - 문제 유형, 문제 텍스트
   - 선택지 텍스트

3. **UNIQUE 제약**
   - 사용자명
   - 이메일

## 마이그레이션 가이드

1. **초기 스키마 생성**
```bash
mysql -u username -p database_name < schema.sql
```

2. **스키마 변경 시**
   - 변경사항을 마이그레이션 파일로 작성
   - 테스트 환경에서 먼저 적용
   - 백업 후 프로덕션 적용

## 성능 고려사항

1. **인덱스 활용**
   - 자주 검색되는 필드에 인덱스 적용
   - 정렬이 필요한 필드에 인덱스 적용

2. **데이터 타입 최적화**
   - 적절한 VARCHAR 길이 설정
   - ENUM 타입 활용으로 공간 절약

3. **쿼리 최적화**
   - JOIN 시 인덱스 활용
   - 필요한 필드만 SELECT
   - LIMIT 활용하여 페이징 처리 