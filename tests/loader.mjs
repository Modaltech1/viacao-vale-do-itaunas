import { access } from 'node:fs/promises'
import { pathToFileURL } from 'node:url'
import path from 'node:path'

const root = process.cwd()

async function existingFile(basePath) {
  const candidates = path.extname(basePath)
    ? [basePath]
    : [`${basePath}.ts`, `${basePath}.tsx`, path.join(basePath, 'index.ts')]

  for (const candidate of candidates) {
    try {
      await access(candidate)
      return candidate
    } catch {
      // Try the next supported TypeScript path.
    }
  }

  return basePath
}

export async function resolve(specifier, context, nextResolve) {
  if (specifier === 'server-only') {
    return { url: 'data:text/javascript,export {}', shortCircuit: true }
  }

  if (specifier === 'next/server') {
    return {
      url: pathToFileURL(path.join(root, 'node_modules', 'next', 'server.js')).href,
      shortCircuit: true,
    }
  }

  if (specifier.startsWith('@/')) {
    const resolvedPath = await existingFile(path.join(root, specifier.slice(2)))
    return { url: pathToFileURL(resolvedPath).href, shortCircuit: true }
  }

  return nextResolve(specifier, context)
}
