import {
    Pomodoro,
    Space,
    SpaceItem,
    VaultItem,
    pomodoroSchema,
    spaceItemsSchema,
    spaceSchema,
    vaultSchema,
} from 'schemas/spaces';
import moment from 'moment';
import type { Database } from 'sql.js';
import { deleteFromDB, insertIntoDB, replaceDB, selectDB, updateDB } from './db/db';

export const initiateDB = (db: Database) => {
    replaceDB(db, {
        vault: vaultSchema,
        spaces: spaceSchema,
        spaceItems: spaceItemsSchema,
        pomodoro: pomodoroSchema,
    });
};

export class PomodoroStatus {
    private pomodoro: Pomodoro;

    constructor(pomodoro: Pomodoro) {
        this.pomodoro = pomodoro;
    }

    getState() {
        return this.pomodoro.status;
    }

    setState(state) {
        this.pomodoro.status = state;
    }

    setEnd() {
        this.pomodoro.end = moment().format('YYYY-MM-DD HH:mm:ss');
    }

    setSpend() {
        const oldSpend = parseInt(this.pomodoro.spend);
        const lastTime = moment(parseInt(this.pomodoro.lastactive)).valueOf();
        const range = moment().valueOf() - lastTime;
        const spend = oldSpend + range;
        this.pomodoro.spend = spend.toString();
    }

    setBreakNum() {
        this.pomodoro.breaknum = (parseInt(this.pomodoro.breaknum) + 1).toString();
    }

    setStart() {
        this.pomodoro.start = moment().format('YYYY-MM-DD HH:mm:ss');
        this.pomodoro.lastactive = moment().valueOf().toString();
    }

    changeState(targetStatus) {
        const oldStatus = this.getState();
        if ([targetStatus, 'cancelled', 'done'].contains(oldStatus)) {
            return false;
        }
        return this[targetStatus + 'Fun'](targetStatus);
    }

    getPomodoro() {
        return this.pomodoro;
    }

    ingFun(targetStatus) {
        const currentStatus = this.getState();
        if (['done', 'cancelled', 'ing'].contains(currentStatus)) {
            return false;
        } else {
            console.log('开始任务');
            this.setStart();
            this.setState(targetStatus);
            return true;
        }
    }

    doneFun(targetStatus) {
        const currentStatus = this.getState();
        if (['cancelled', 'break', 'todo', 'break'].contains(currentStatus)) {
            return false;
        } else {
            console.log('完成任务');
            this.setEnd();
            this.setSpend();
            this.setState(targetStatus);
            return true;
        }
    }

    todoFun(targetStatus) {
        console.log('加入任务');
        this.setState(targetStatus);
        return true;
    }

    cancelledFun(targetStatus) {
        const oldStatus = this.getState();
        if (['done', 'cancelled'].contains(oldStatus)) {
            return false;
        } else {
            console.log('放弃任务');
            this.setSpend();
            this.setEnd();
            this.setState(targetStatus);
            return true;
        }
    }

    breakFun(targetStatus) {
        const oldStatus = this.getState();
        if (['done', 'cancelled', 'todo', 'break'].contains(oldStatus)) {
            return false;
        } else {
            console.log('暂停任务');
            // 统计并记录spend
            this.setSpend();
            this.setBreakNum();
            this.setState(targetStatus);
            return true;
        }
    }
}
