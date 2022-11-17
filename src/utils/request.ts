import axios from 'axios';
import { Notice } from 'obsidian';
import Logger from './logger';

export function notify(msg: any, config: any) {
    Logger.error(msg);
    let auth = config.NTFY_AUTH;
    if (!auth) {
        auth = process.env.NTFY_AUTH;
    }
    Logger.error(auth);
    if (auth) {
        axios
            .post('https://ntfy.ihave.cool/test', 'msg', {
                headers: {
                    Authorization: `Basic ${auth}`,
                },
            })
            .then(res => new Notice('Ntfy sent the message successfully'))
            .catch(error => new Notice('Please check the ntfy configuration first'));
    } else {
        new Notice('Please configure ntfy first');
    }
}
