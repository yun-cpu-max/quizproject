const db = require('./db');

class NotificationCleanup {
    // 읽은 알림 중 30일 이상 된 것들 삭제
    static async cleanupOldReadNotifications(daysOld = 30) {
        const query = `
            DELETE un FROM user_notifications un
            JOIN notifications n ON un.notification_id = n.id
            WHERE un.is_read = 1 
            AND n.created_at < DATE_SUB(NOW(), INTERVAL ? DAY)
        `;
        
        return new Promise((resolve, reject) => {
            db.query(query, [daysOld], (err, result) => {
                if (err) {
                    console.error('읽은 알림 정리 실패:', err);
                    return reject(err);
                }
                console.log(`${result.affectedRows}개의 오래된 읽은 알림을 정리했습니다.`);
                resolve(result.affectedRows);
            });
        });
    }

    // 모든 사용자가 읽거나 삭제한 시스템 알림 정리
    static async cleanupOrphanedNotifications() {
        const query = `
            DELETE n FROM notifications n
            LEFT JOIN user_notifications un ON n.id = un.notification_id
            WHERE un.notification_id IS NULL
            AND n.created_at < DATE_SUB(NOW(), INTERVAL 7 DAY)
        `;
        
        return new Promise((resolve, reject) => {
            db.query(query, [], (err, result) => {
                if (err) {
                    console.error('고아 알림 정리 실패:', err);
                    return reject(err);
                }
                console.log(`${result.affectedRows}개의 고아 알림을 정리했습니다.`);
                resolve(result.affectedRows);
            });
        });
    }

    // 전체 정리 작업 실행
    static async runCleanup() {
        try {
            console.log('알림 정리 작업 시작...');
            
            const readCount = await this.cleanupOldReadNotifications(30);
            const orphanCount = await this.cleanupOrphanedNotifications();
            
            console.log(`알림 정리 완료 - 읽은 알림: ${readCount}개, 고아 알림: ${orphanCount}개`);
            
            return { readCount, orphanCount };
        } catch (error) {
            console.error('알림 정리 중 오류 발생:', error);
            throw error;
        }
    }
}

// 스크립트로 직접 실행할 때
if (require.main === module) {
    NotificationCleanup.runCleanup()
        .then(() => {
            console.log('정리 작업 완료');
            process.exit(0);
        })
        .catch((error) => {
            console.error('정리 작업 실패:', error);
            process.exit(1);
        });
}

module.exports = NotificationCleanup; 