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
- question_img_url VARCHAR(255) NULL

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

> **pending_quiz 설명:**
> 사용자가 퀴즈 등록을 신청했으나 관리자가 아직 승인하지 않은 임시 퀴즈를 저장하는 테이블입니다. 관리자가 승인하면 정식 quiz 테이블로 이동됩니다.

## question_responses
- id INT (PK)
- user_id INT (FK → user.id)         -- 비회원은 NULL 허용
- quiz_id INT (FK → quiz.id)
- question_id INT (FK → question.id)
- user_answer TEXT                   -- 사용자가 제출한 답(선택지 번호/텍스트/주관식 답 등)
- is_correct TINYINT(1)              -- 1: 정답, 0: 오답
- answered_at TIMESTAMP              -- 답변 제출 시각

> **question_responses 설명:**
> 사용자가 퀴즈를 풀 때 각 문제별로 제출한 답, 정답 여부, 제출 시각 등을 저장합니다.
> 이 테이블을 활용해 문제별 정답률, 오답률, 선택 분포 등 다양한 통계가 가능합니다.