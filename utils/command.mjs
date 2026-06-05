import { exec } from "node:child_process"
import Chalk from "chalk"


/**
 * @param {string} cmd
 */
export async function command(cmd) {
    return new Promise((resolve, reject) => {
        console.log(Chalk.cyanBright(cmd))
        exec(cmd, (err, stdout, stderr) => {
            if (err) {
                if (stdout) console.error(Chalk.redBright(stdout))
                if (stderr) console.error(Chalk.redBright(stderr))
                console.error()
                reject(err)
            } else {
                if (stdout) console.log(stdout)
                if (stderr) console.log(stderr)
                console.log()
                resolve({ stdout, stderr })
            }
        })
    })
}

