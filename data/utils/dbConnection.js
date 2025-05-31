const mysql = require('mysql2/promise');
const { createError, ErrorCodes } = require('./errorHandler');


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