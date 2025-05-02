# 데이터베이스 스키마 (ERD 기반)

## user
- id INT (PK)
- username VARCHAR(255)
- email VARCHAR(255)
- password VARCHAR(255)
- role VARCHAR(50)
- is_active TINYINT(1)
- created_at TIMESTAMP
- updated_at TIMESTAMP

## quiz
- id INT (PK)
- category VARCHAR(255)
- title VARCHAR(255)
- description TEXT
- thumbnail_url VARCHAR(255)

## question
- id INT (PK)
- quiz_id INT (FK → quiz.id)
- question TEXT
- question_type VARCHAR(255)
- correct_answer TEXT
- created_by INT (FK → user.id)

## question_option
- id INT (PK)
- question_id INT (FK → question.id)
- option_text TEXT
- is_correct TINYINT(1)
- option_order INT

## quiz_results
- id INT (PK)
- user_id INT (FK → user.id)
- quiz_id INT (FK → quiz.id)
- score INT
- total_questions INT
- created_at TIMESTAMP

## pending_quiz
- id INT (PK)
- category VARCHAR(255)
- title VARCHAR(255)
- description TEXT
- thumbnail_url VARCHAR(255)
- questions JSON
- created_at TIMESTAMP

> **pending_quiz 설명:**
> 사용자가 퀴즈 등록을 신청했으나 관리자가 아직 승인하지 않은 임시 퀴즈를 저장하는 테이블입니다. 관리자가 승인하면 정식 quiz 테이블로 이동됩니다.
