import { Dirent, existsSync } from "node:fs"
import FS from "node:fs/promises"
import Path from "node:path"
import URL from "node:url"

const filenameUrl = URL.parse(import.meta.url)
const filename = filenameUrl.path ?? "fs.mjs"
const projectPath = Path.resolve(Path.dirname(filename), "..", "..")

export function getProjectPath() {
    return projectPath
}

export async function saveTextFile(path, content) {
    return FS.writeFile(Path.resolve(getProjectPath(), path), content)
}

export async function loadTextFile(path) {
    const content = await FS.readFile(Path.resolve(getProjectPath(), path))
    return content.toString()
}

/**
 * @param {string} filename
 */
export function stripfileExtension(filename) {
    const pos = filename.lastIndexOf(".")
    if (pos < 0) return filename

    return filename.substring(0, pos)
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
    const path = Path.resolve(getProjectPath(), root)
    const items = await FS.readdir(path, {
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
    return folders.map((name) => Path.resolve(root, name))
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

/**
 * @param {Dirent} item
 */
export function isCapitalized(item) {
    const { name } = item
    const initial = name.charAt(0)
    return initial === initial.toLocaleUpperCase()
}

/**
 * @param {string} prefix
 */
export function startsWith(prefix) {
    /**
     * @param {Dirent} item
     */
    function filter(item) {
        return item.name.startsWith(prefix)
    }
    return filter
}
