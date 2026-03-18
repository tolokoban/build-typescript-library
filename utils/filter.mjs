import FS from "node:fs/promises"
import Path from "node:path"

/**
 * @param {string[]} filenames
 * @param {Map<string, number>} fileCompilTimes
 * @param {string} outDir
 * @return {Promise<string[]>}
 */
export async function keepOnlyNewOnes(filenames, fileCompilTimes, outDir) {
    /** 
     * @type {string[]} 
     */
    const newFiles = []
    for (const filename of filenames) {
        const stats = await FS.stat(Path.join(outDir, filename))
        const curTime = stats.mtime.valueOf()
        const oldTime = fileCompilTimes.get(filename)
        if (curTime !== oldTime) {
            newFiles.push(filename)
            fileCompilTimes.set(filename, curTime)
        }
    }
    return newFiles
}