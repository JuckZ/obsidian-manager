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
