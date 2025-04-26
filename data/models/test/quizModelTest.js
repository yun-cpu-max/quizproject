const QuizModel = require('../quizModel');
const TextQuiz = require('../../quizTypes/textQuiz');
const ChoiceQuiz = require('../../quizTypes/choiceQuiz');

// 테스트용 데이터베이스 연결 설정
const testConfig = {
    host: 'localhost',
    user: 'test',
    password: 'test',
    database: 'test_db'
};

// 테스트용 데이터
const testQuizData = {
    id: 1,
    title: '테스트 퀴즈',
    description: '테스트용 퀴즈입니다.',
    questions: [
        {
            id: 1,
            type: 'text',
            text: '첫 번째 문제입니다.',
            answer: '정답',
            image: '/rogo.png'
        },
        {
            id: 2,
            type: 'choice',
            text: '두 번째 문제입니다.',
            answer: 'A',
            options: [
                { id: 'A', text: '선택지 A' },
                { id: 'B', text: '선택지 B' },
                { id: 'C', text: '선택지 C' }
            ],
            image: '/rogo.png'
        }
    ]
};

const testQuestionData = [
    {
        id: 1,
        quiz_id: 1,
        question: "1 + 1 = ?",
        question_type: "text",
        correct_answer: "2"
    },
    {
        id: 2,
        quiz_id: 1,
        question: "다음 중 가장 큰 수는?",
        question_type: "choice",
        correct_answer: 3,
        options: [
            { id: 1, text: "1", is_correct: false, order: 1 },
            { id: 2, text: "2", is_correct: false, order: 2 },
            { id: 3, text: "3", is_correct: true, order: 3 }
        ]
    }
];

async function runTests() {
    console.log('=== 퀴즈 모델 테스트 시작 ===\n');

    try {
        // 모델 초기화 테스트
        console.log('1. 모델 초기화 테스트');
        const quizModel = new QuizModel(testQuizData);
        console.log('모델 초기화 성공\n');

        // 문제 데이터 가져오기 테스트
        console.log('2. 문제 데이터 가져오기 테스트');
        const question1 = await quizModel.getQuestion(1);
        console.log('문제 1 데이터:', JSON.stringify(question1, null, 2));
        const question2 = await quizModel.getQuestion(2);
        console.log('문제 2 데이터:', JSON.stringify(question2, null, 2));
        console.log('문제 데이터 가져오기 성공\n');

        // 답안 제출 테스트
        console.log('3. 답안 제출 테스트');
        const result1 = await quizModel.submitAnswer(1, '정답');
        console.log('문제 1 답안 제출 결과:', JSON.stringify(result1, null, 2));
        const result2 = await quizModel.submitAnswer(2, 'A');
        console.log('문제 2 답안 제출 결과:', JSON.stringify(result2, null, 2));
        console.log('답안 제출 성공\n');

        // 결과 조회 테스트
        console.log('4. 결과 조회 테스트');
        const results = await quizModel.getResults();
        console.log('전체 결과:', JSON.stringify(results, null, 2));
        console.log('결과 조회 성공\n');

        console.log('=== 모든 테스트 완료 ===');
    } catch (error) {
        console.error('테스트 실패:', error);
    }
}

// 테스트 실행
runTests(); 