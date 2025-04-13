// 퀴즈 데이터 (데이터베이스 연동 전 임시 데이터)
const quizData = {
    quiz: [
        {
            id: 1,
            category: "textQuiz",
            title: "시각적 효과 퀴즈",
            description: "이미지를 보고 답을 입력하는 주관식 퀴즈입니다",
            thumbnail: "/rogo.png"
        },
        {
            id: 2,
            category: "choiceQuiz",
            title: "객관식 테스트 퀴즈",
            description: "여러 보기 중 정답을 선택하는 객관식 퀴즈입니다",
            thumbnail: "/rogo.png"
        }
    ],
    question: [
        {
            id: 1,
            quiz_id: 1,
            question: "정답이 123인 테스트 문항",
            question_type: "text",
            correct_answer: "123",
            created_by: 1
        },
        {
            id: 2,
            quiz_id: 2,
            question: "다음 중 올바른 답을 고르시오",
            question_type: "choice",
            correct_answer: "2",
            created_by: 1
        }
    ],
    question_option: [
        {
            id: 1,
            question_id: 2,
            option_text: "보기 1",
            is_correct: false,
            order: 1
        },
        {
            id: 2,
            question_id: 2,
            option_text: "보기 2",
            is_correct: true,
            order: 2
        },
        {
            id: 3,
            question_id: 2,
            option_text: "보기 3",
            is_correct: false,
            order: 3
        },
        {
            id: 4,
            question_id: 2,
            option_text: "보기 4",
            is_correct: false,
            order: 4
        }
    ]
};

module.exports = quizData; 