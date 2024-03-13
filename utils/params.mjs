export function parseParams() {
    const [_node, _program, ...args] = process.argv
    const params = {
        path: process.cwd(),
        watch: false,
    }
    for (const arg of args) {
        if (arg === "-w" || arg === "--watch") {
            params.watch = true
        } else {
            params.path = arg
        }
    }
    return params
}
