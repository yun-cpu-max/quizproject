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
            title: "프로그래밍 기초 퀴즈",
            description: "프로그래밍의 기본 개념을 테스트하는 객관식 퀴즈입니다",
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
            question: "다음 중 JavaScript의 원시(Primitive) 데이터 타입이 아닌 것은?",
            question_type: "choice",
            correct_answer: "4",
            created_by: 1
        }
    ],
    question_option: [
        {
            id: 1,
            question_id: 2,
            option_text: "Number",
            is_correct: false,
            order: 1
        },
        {
            id: 2,
            question_id: 2,
            option_text: "String",
            is_correct: false,
            order: 2
        },
        {
            id: 3,
            question_id: 2,
            option_text: "Boolean",
            is_correct: false,
            order: 3
        },
        {
            id: 4,
            question_id: 2,
            option_text: "Array",
            is_correct: true,
            order: 4
        }
    ]
};

module.exports = quizData; 