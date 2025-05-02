const mysql = require('mysql2/promise');
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
        if (!this.connection) {
            this.connection = await mysql.createConnection(this.config);
        }
        return this.connection;
    }

    async disconnect() {
        if (this.connection) {
            await this.connection.end();
            this.connection = null;
        }
    }

    async query(sql, params = []) {
        await this.connect();
        const [rows] = await this.connection.execute(sql, params);
        return rows;
    }
}

module.exports = DBConnection; 