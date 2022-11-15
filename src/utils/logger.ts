import chalk from 'chalk';
import { inspect } from 'util'

chalk.level = 3;

const printer = (args, chalkify) => {
    if(args.length === 0) throw '::::::error::::: no argument supplied to logger'

    args.forEach((element) => {
        if (typeof element === 'object') {
			// const {inspect} = require('util') // src: https://stackoverflow.com/a/6157569/10012446
			console.error(chalkify(inspect(element)))
		} else {
			console.error(chalkify(element))
		}
    })
}

export default class Logger {
    static info(...args: any) {
        printer(args, chalk.bgGreen.blue.bold)
    }
    static warn(...args: any) {
        printer(args, chalk.bgGreen.yellow.bold)
    }
    static error(...args: any) {
        printer(args, chalk.bgGreen.red.bold)
    }
}
