const { createError, ErrorCodes } = require('../utils/errorHandler');

class BaseQuestionValidator {
    static validate(question) {
        if (!question) {
            throw createError('문제 데이터가 제공되지 않았습니다.', ErrorCodes.VALIDATION);
        }

        if (!question.id || typeof question.id !== 'number') {
            throw createError('유효하지 않은 문제 ID입니다.', ErrorCodes.VALIDATION);
        }

        if (!question.text) {
            throw createError('문제 내용이 없습니다.', ErrorCodes.VALIDATION);
        }

        return true;
    }
}

class TextQuestionValidator extends BaseQuestionValidator {
    static validate(question) {
        // 기본 검증
        super.validate(question);

        // 텍스트 문제 특화 검증
        if (!question.answer) {
            throw createError('정답이 설정되지 않았습니다.', ErrorCodes.VALIDATION);
        }

        return true;
    }
}

class ChoiceQuestionValidator extends BaseQuestionValidator {
    static validate(question) {
        // 기본 검증
        super.validate(question);

        // 객관식 문제 특화 검증
        if (!question.options || !Array.isArray(question.options)) {
            throw createError('선택지가 제공되지 않았습니다.', ErrorCodes.VALIDATION);
        }

        if (question.options.length === 0) {
            throw createError('선택지가 비어있습니다.', ErrorCodes.VALIDATION);
        }

        if (!question.answer) {
            throw createError('정답이 설정되지 않았습니다.', ErrorCodes.VALIDATION);
        }

        // 선택지 유효성 검사
        question.options.forEach((option, index) => {
            if (!option.id || !option.text) {
                throw createError(
                    '유효하지 않은 선택지 형식입니다.',
                    ErrorCodes.VALIDATION,
                    { optionIndex: index }
                );
            }
        });

        // 정답이 선택지에 있는지 확인
        const hasCorrectAnswer = question.options.some(opt => opt.id === question.answer);
        if (!hasCorrectAnswer) {
            throw createError(
                '정답이 선택지에 없습니다.',
                ErrorCodes.VALIDATION,
                { answer: question.answer }
            );
        }

        return true;
    }
}

class QuestionValidator {
    static validate(question, type) {
        const validators = {
            text: TextQuestionValidator,
            choice: ChoiceQuestionValidator
        };

        const Validator = validators[type];
        if (!Validator) {
            throw createError(
                '지원하지 않는 문제 타입입니다.',
                ErrorCodes.VALIDATION,
                { type }
            );
        }

        return Validator.validate(question);
    }
}

module.exports = {
    QuestionValidator,
    BaseQuestionValidator,
    TextQuestionValidator,
    ChoiceQuestionValidator
}; 