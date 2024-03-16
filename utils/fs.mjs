import { Dirent, existsSync } from "node:fs"
import AsyncFS from "node:fs/promises"
import FS from "node:fs"
import Path from "node:path"

/**
 *
 * @param {string} filename
 * @param {Array<{ start: number, end: number, value: string }>} replacements
 */
export function replaceInFile(filename, replacements) {
    if (replacements.length > 0) {
        const content = FS.readFileSync(filename).toString()
        const code = []
        let i = 0
        for (const { start, end, value } of replacements) {
            code.push(content.substring(i, start))
            code.push(value)
            i = end
        }
        if (i < content.length) code.push(content.substring(i))
        const newContent = code.join("")
        FS.writeFileSync(filename, newContent)
    }
}

/**
 * @param {string} path
 * @param {string[]} acceptedExtensions
 */
export async function findFiles(path, acceptedExtensions) {
    const jsFilter = info =>
        !info.isDirectory() && matchAnyExtension(info.name, acceptedExtensions)
    const dirFilter = info => !info.name.startsWith(".") && info.isDirectory()
    const files = await readDir(path, jsFilter)
    const fringe = await readDir(path, dirFilter)
    while (fringe.length > 0) {
        const folder = fringe.shift()
        if (!folder) continue

        const subFolders = await readDir(folder, dirFilter)
        subFolders.forEach(dir => fringe.push(dir))
        const subFiles = await readDir(folder, jsFilter)
        subFiles.forEach(f => files.push(f))
    }
    return files.map(f => Path.relative(path, f))
}

function matchAnyExtension(name, acceptedExtensions) {
    for (const ext of acceptedExtensions) {
        if (name.endsWith(ext)) return true
    }
    return false
}

/**
 * @param {string} filename
 */
export function extractExtension(filename) {
    const slashPos = filename.lastIndexOf("/") + 1
    const dotPos = filename.substring(slashPos).lastIndexOf(".")
    if (dotPos < 0) return ""

    return filename.substring(dotPos + slashPos)
}

/**
 * @param root {string}
 * @param filters {Array<(info: Dirent) => boolean>}
 * @return {Promise<string[]>}
 */
export async function readDir(root, ...filters) {
    if (!existsSync(root)) throw Error(`[readDir] Path not found: "${root}"!`)

    const folders = []
    const items = await AsyncFS.readdir(root, {
        withFileTypes: true,
        encoding: "utf-8",
    })
    for (const item of items) {
        const { name } = item
        if (name === "." || name === "..") continue

        let pass = true
        for (const filter of filters) {
            if (!filter(item)) {
                pass = false
                break
            }
        }
        if (pass) folders.push(name)
    }
    folders.sort()
    return folders.map(name => Path.resolve(root, name))
}

/**
 * @param {Dirent} item
 */
export function isDirectory(item) {
    return item.isDirectory()
}

/**
 * @param {Dirent} item
 */
export function isFile(item) {
    return item.isFile()
}
