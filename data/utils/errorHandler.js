const ErrorCodes = {
    VALIDATION: 'VALIDATION_ERROR',
    DATA: 'DATA_ERROR',
    PROCESSING: 'PROCESSING_ERROR',
    NOT_FOUND: 'NOT_FOUND_ERROR'
};

class QuizError extends Error {
    constructor(message, code, details = null) {
        super(message);
        this.name = 'QuizError';
        this.code = code;
        this.details = details;
    }
}

function handleError(error, source) {
    if (error instanceof QuizError) {
        return {
            success: false,
            error: {
                message: error.message,
                code: error.code,
                details: error.details,
                source
            }
        };
    }

    return {
        success: false,
        error: {
            message: error.message,
            code: ErrorCodes.PROCESSING,
            source
        }
    };
}

function createError(message, code, details = null) {
    return new QuizError(message, code, details);
}

module.exports = {
    QuizError,
    ErrorCodes,
    handleError,
    createError
}; 