/**
 * @param {Map<string, string[]>} depMap
 */
export function checkCircuilarDependencies(depMap) {
    for (const root of depMap.keys()) {
        recursiveCheck([root], depMap.get(root) ?? [], depMap)
    }
}

/**
 *
 * @param {string[]} chain
 * @param {string[]} dependencies
 * @param {Map<string, string[]>} depMap
 */
function recursiveCheck(chain, dependencies, depMap) {
    for (const dep of dependencies) {
        if (chain.includes(dep)) {
            throw Error(
                `Circular dependencies found!\n${[...chain, dep]
                    .map(name => `    ${name}`)
                    .join("\n")}`
            )
        }
        const next = depMap.get(dep) ?? []
        if (next.length > 0) {
            chain.push(dep)
            recursiveCheck(chain, next, depMap)
            chain.pop()
        }
    }
}
