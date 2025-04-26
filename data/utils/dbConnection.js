const { createError, ErrorCodes } = require('./errorHandler');

// 테스트용 데이터
const testData = {
    quizzes: [
        {
            id: 1,
            title: "테스트 퀴즈",
            description: "테스트용 설명",
            thumbnail: "/rogo.png",
            category: "test",
            total_questions: 2
        }
    ],
    questions: [
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
    ],
    answers: [
        {
            user_id: 1,
            quiz_id: 1,
            question_id: 1,
            answer: "2",
            submitted_at: new Date()
        }
    ]
};

class DBConnection {
    constructor(config) {
        this.config = config;
        this.connection = null;
    }

    async connect() {
        try {
            // 테스트용 데이터베이스 연결
            this.connection = {
                query: async (sql, params) => {
                    console.log('Executing query:', sql, params);
                    
                    // 퀴즈 목록 조회
                    if (sql.includes('FROM quizzes q')) {
                        return testData.quizzes;
                    }
                    
                    // 특정 퀴즈 조회
                    if (sql.includes('FROM quizzes WHERE id = ?')) {
                        return [testData.quizzes[0]];
                    }
                    
                    // 질문 조회
                    if (sql.includes('FROM quiz_questions qq')) {
                        return testData.questions.map(q => ({
                            ...q,
                            option_id: q.options?.[0]?.id,
                            option_text: q.options?.[0]?.text,
                            is_correct: q.options?.[0]?.is_correct,
                            order: q.options?.[0]?.order
                        }));
                    }
                    
                    // 답안 제출
                    if (sql.includes('INSERT INTO quiz_answers')) {
                        return { insertId: 1 };
                    }
                    
                    // 결과 조회
                    if (sql.includes('FROM quiz_answers qa')) {
                        return testData.answers.map(a => ({
                            ...a,
                            question_type: testData.questions.find(q => q.id === a.question_id)?.question_type,
                            correct_answer: testData.questions.find(q => q.id === a.question_id)?.correct_answer,
                            option_text: testData.questions.find(q => q.id === a.question_id)?.options?.find(o => o.is_correct)?.text
                        }));
                    }
                    
                    return [];
                }
            };
            return this.connection;
        } catch (error) {
            throw createError(
                '데이터베이스 연결 중 오류가 발생했습니다.',
                ErrorCodes.DATABASE,
                { originalError: error.message }
            );
        }
    }

    async disconnect() {
        try {
            if (this.connection) {
                this.connection = null;
            }
        } catch (error) {
            throw createError(
                '데이터베이스 연결 해제 중 오류가 발생했습니다.',
                ErrorCodes.DATABASE,
                { originalError: error.message }
            );
        }
    }

    async query(sql, params = []) {
        try {
            if (!this.connection) {
                await this.connect();
            }
            return await this.connection.query(sql, params);
        } catch (error) {
            throw createError(
                '쿼리 실행 중 오류가 발생했습니다.',
                ErrorCodes.DATABASE,
                { originalError: error.message }
            );
        }
    }
}

module.exports = DBConnection; 