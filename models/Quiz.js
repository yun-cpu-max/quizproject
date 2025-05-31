const DBConnection = require('../data/utils/dbConnection');
const dbConfig = {
    host: 'localhost',
    user: 'root',
    password: 'mysql@24!',
    database: 'quiz_db'
};

class Quiz {
    constructor(id, title, description, type = 'general', createdAt = new Date()) {
        this.id = id;
        this.title = title;
        this.description = description;
        this.type = type;
        this.createdAt = createdAt;
    }

    static create(data) {
        return new Quiz(data.id || Date.now(), data.title, data.description, data.type, data.createdAt);
    }

    addQuestion(question) {
        this.questions.push(question);
    }

    removeQuestion(questionId) {
        this.questions = this.questions.filter(q => q.id !== questionId);
    }

    toJSON() {
        return {
            id: this.id,
            title: this.title,
            description: this.description,
            type: this.type,
            createdAt: this.createdAt,
            questions: this.questions.map(q => q.toJSON())
        };
    }

    static async getById(quizId) {
        const db = new DBConnection(dbConfig);
        await db.connect();

        // 퀴즈 정보
        const quizRows = await db.query('SELECT * FROM quiz WHERE id = ?', [quizId]);
        if (!quizRows || quizRows.length === 0) return null;
        const quiz = quizRows[0];

        // 문제 정보
        const questionRows = await db.query('SELECT * FROM question WHERE quiz_id = ?', [quizId]);

        // 각 문제별 선택지 정보
        for (let question of questionRows) {
            const optionRows = await db.query('SELECT * FROM question_option WHERE question_id = ? ORDER BY option_order', [question.id]);
            question.options = optionRows;
        }

        quiz.questions = questionRows;
        await db.disconnect();
        return quiz;
    }

    static async getAll() {
        const db = new DBConnection(dbConfig);
        await db.connect();
        const quizzes = await db.query('SELECT * FROM quiz');
        await db.disconnect();
        return quizzes;
    }

    static async saveResult({ user_id, quiz_id, score, total_questions }) {
        const db = new DBConnection(dbConfig);
        await db.connect();
        const result = await db.query(
            'INSERT INTO quiz_results (user_id, quiz_id, score, total_questions, created_at) VALUES (?, ?, ?, ?, NOW())',
            [user_id, quiz_id, score, total_questions]
        );
        await db.disconnect();
        return result;
    }

    static async getStatsByQuizId(quizId) {
        const db = new DBConnection(dbConfig);
        await db.connect();
        const stats = await db.query(
            'SELECT COUNT(DISTINCT user_id) AS total_participants, AVG(score) AS avg_score, MAX(score) AS max_score, MIN(score) AS min_score FROM quiz_results WHERE quiz_id = ?',
            [quizId]
        );
        await db.disconnect();
        return stats[0];
    }
}

class Question {
    constructor(id, quizId, type, text, correctAnswer, points = 1, imageUrl = null) {
        this.id = id;
        this.quiz_id = quizId;
        this.type = type;
        this.text = text;
        this.correct_answer = correctAnswer;
        this.points = points;
        this.image_url = imageUrl;
    }

    validateAnswer(userAnswer) {
        if (!userAnswer) return false;
        
        if (this.type === 'text') {
            return userAnswer.trim().toLowerCase() === this.correct_answer.toLowerCase();
        } else if (this.type === 'choice') {
            return userAnswer === this.correct_answer;
        }
        
        return false;
    }

    toJSON() {
        return {
            id: this.id,
            quiz_id: this.quiz_id,
            type: this.type,
            text: this.text,
            correct_answer: this.correct_answer,
            points: this.points,
            image_url: this.image_url
        };
    }
}

class Option {
    constructor(id, questionId, text) {
        this.id = id;
        this.question_id = questionId;
        this.text = text;
    }

    toJSON() {
        return {
            id: this.id,
            question_id: this.question_id,
            text: this.text
        };
    }
}

module.exports = {
    Quiz,
    Question,
    Option
}; 