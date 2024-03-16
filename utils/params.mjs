export function parseParams() {
    const [_node, _program, ...args] = process.argv
    /**
     * @type {{
     *   path: string
     *   watch: boolean
     *   srcDir: string
     *   runBefore: string[]
     *   runAfter: string[]
     * }}
     */
    const params = {
        path: "",
        watch: false,
        srcDir: "src",
        runBefore: [],
        runAfter: [],
    }
    let hasPath = false
    while (args.length) {
        const arg = args.shift()
        if (!arg) break

        if (arg === "-w" || arg === "--watch") {
            params.watch = true
        } else if (arg === "-s" || arg === "--srcDir") {
            const srcDir = args.shift()
            if (srcDir) params.srcDir = srcDir
        } else if (arg === "-b" || arg === "--runBefore") {
            const task = args.shift()
            if (task) params.runBefore.push(task)
        } else if (arg === "-a" || arg === "--runAfter") {
            const task = args.shift()
            if (task) params.runAfter.push(task)
        } else {
            params.path = arg
            hasPath = true
        }
    }
    if (!hasPath) {
        console.log()
        console.log("Usage:")
        console.log(
            "  node build-typescript-library <destination folder> [--watch] [--scDir <source folder>] [--runBefore <tasks names>] [--runAfter <tasks names>]"
        )
        console.log()
        console.log("Options:")
        console.log(
            "  --watch, -w: Watch mode. Compilation will start again as soon as a file is changed in the source dir."
        )
        console.log(
            '  --srcDir, -s: Define the source dir. Default to "./src".'
        )
        console.log(
            "  --runBefore, -b: Task to run with npm just before the compilation starts. To start several tasks, just repeat the --runBefore option as many times as needed."
        )
        console.log(
            "  --runAfter, -a: Task to run with npm just after the compilation starts."
        )
        console.log()
        process.exit(1)
    }
    return params
}
