// 테스트용 퀴즈 데이터
const testQuizData = {
    textQuiz: [
        { 
            id: 1, 
            title: "시각적 효과 퀴즈", 
            description: "이미지를 보고 답을 맞춰보세요", 
            thumbnail: "/rogo.png",
            category: "textQuiz",
            questions: [
                {
                    id: 1,
                    question: "정답이 123인 테스트 문항",
                    question_type: "text",
                    correct_answer: "123",
                    created_by: 1
                }
            ]
        }
    ],
    choiceQuiz: [
        {
            id: 2,
            title: "객관식 테스트 퀴즈",
            description: "객관식 문제를 풀어보세요",
            thumbnail: "/rogo.png",
            category: "choiceQuiz",
            questions: [
                {
                    id: 1,
                    question: "다음 중 올바른 답을 고르시오",
                    question_type: "choice",
                    correct_answer: "2",
                    created_by: 1,
                    options: [
                        { id: 1, option_text: "보기 1", is_correct: false, order: 1 },
                        { id: 2, option_text: "보기 2", is_correct: true, order: 2 },
                        { id: 3, option_text: "보기 3", is_correct: false, order: 3 },
                        { id: 4, option_text: "보기 4", is_correct: false, order: 4 }
                    ]
                }
            ]
        }
    ]
};

module.exports = testQuizData; 