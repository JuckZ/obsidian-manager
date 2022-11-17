import { inspect } from 'util';
import chalk from 'chalk';

chalk.level = 3;

// TODO 溯源，显示调用处
const printer = (args, chalkify) => {
    if (args.length === 0) throw '::::::error::::: no argument supplied to logger';

    args.forEach(element => {
        if (typeof element === 'object') {
            // const {inspect} = require('util') // src: https://stackoverflow.com/a/6157569/10012446
            console.error(chalkify(inspect(element)));
        } else {
            console.error(chalkify(element));
        }
    });
};

export default class Logger {
    static log(...args: any) {
        printer(args, chalk.cyanBright.bold);
    }
    static dir(...args: any) {
        printer(args, chalk.blueBright.bold);
    }
    static info(...args: any) {
        printer(args, chalk.blue.bold);
    }
    static warn(...args: any) {
        printer(args, chalk.yellow.bold);
    }
    static error(...args: any) {
        printer(args, chalk.red.bold);
    }
}
