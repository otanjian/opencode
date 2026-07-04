import { exec } from "node:child_process"
import { promisify } from "node:util"
import path from "node:path"

const execAsync = promisify(exec)

const DEV_SIDECAR_HTTP = process.env.OPENCODE_DEV_SIDECAR_HTTP_PROXY ?? "http://127.0.0.1:31180"
const DEV_SIDECAR_HTTPS = process.env.OPENCODE_DEV_SIDECAR_HTTPS_PROXY ?? "http://127.0.0.1:31181"
const DEV_SIDECAR_CA =
  process.env.OPENCODE_DEV_SIDECAR_CA ?? `${process.env.HOME ?? ""}/.dev-sidecar/dev-sidecar.ca.crt`

function shellQuote(value: string) {
  return `'${value.replace(/'/g, `'\\''`)}'`
}

export function useDevSidecarProxy() {
  return process.env.OPENCODE_USE_DEV_SIDECAR !== "0"
}

export function proxyEnv() {
  if (!useDevSidecarProxy()) return process.env
  return {
    ...process.env,
    HTTP_PROXY: DEV_SIDECAR_HTTP,
    HTTPS_PROXY: DEV_SIDECAR_HTTPS,
    http_proxy: DEV_SIDECAR_HTTP,
    https_proxy: DEV_SIDECAR_HTTPS,
    ALL_PROXY: DEV_SIDECAR_HTTPS,
    all_proxy: DEV_SIDECAR_HTTPS,
    NODE_EXTRA_CA_CERTS: DEV_SIDECAR_CA,
  }
}

function curlProxyFlag() {
  if (!useDevSidecarProxy()) return ""
  return `-x ${shellQuote(DEV_SIDECAR_HTTPS)} --cacert ${shellQuote(DEV_SIDECAR_CA)} `
}

type Release = {
  id: number
  tag_name: string
  upload_url: string
}

function parseRepo(repo: string) {
  const slash = repo.indexOf("/")
  if (slash === -1) throw new Error(`Invalid repo: ${repo}`)
  return { owner: repo.slice(0, slash), name: repo.slice(slash + 1) }
}

export async function resolveGitHubToken() {
  const fromEnv = process.env.GH_TOKEN ?? process.env.GITHUB_TOKEN
  if (fromEnv) return fromEnv

  for (const file of [
    path.join(process.env.HOME ?? "", ".config/opencode/github-token"),
    path.join(import.meta.dir, "..", ".github-token"),
  ]) {
    const item = Bun.file(file)
    if (!(await item.exists())) continue
    const token = (await item.text()).trim()
    if (token) return token
  }

  try {
    const { stdout: credText } = await execAsync("printf 'protocol=https\\nhost=github.com\\n\\n' | git credential fill")
    const password = credText
      .split("\n")
      .find((line) => line.startsWith("password="))
      ?.slice("password=".length)
    if (password) return password
  } catch {}

  throw new Error("No GitHub token found (set GH_TOKEN, run gh auth login, or configure git credentials)")
}

async function githubRequest(token: string, url: string, init?: RequestInit) {
  if (useDevSidecarProxy()) return githubRequestCurl(token, url, init)

  const response = await fetch(url, {
    ...init,
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: "application/vnd.github+json",
      "X-GitHub-Api-Version": "2022-11-28",
      ...init?.headers,
    },
  })
  if (!response.ok) {
    const body = await response.text()
    throw new Error(`GitHub API ${response.status}: ${body}`)
  }
  return response
}

async function githubRequestCurl(token: string, url: string, init?: RequestInit) {
  const method = init?.method ?? "GET"
  const headers = [
    `-H ${shellQuote(`Authorization: Bearer ${token}`)}`,
    `-H ${shellQuote("Accept: application/vnd.github+json")}`,
    `-H ${shellQuote("X-GitHub-Api-Version: 2022-11-28")}`,
  ]
  if (init?.headers) {
    const extra = init.headers instanceof Headers ? Object.fromEntries(init.headers.entries()) : init.headers
    for (const [key, value] of Object.entries(extra)) {
      if (typeof value === "string") headers.push(`-H ${shellQuote(`${key}: ${value}`)}`)
    }
  }

  const data =
    typeof init?.body === "string"
      ? init.body
      : init?.body
        ? JSON.stringify(init.body)
        : undefined
  const bodyFlag = data ? `-d ${shellQuote(data)}` : ""

  const { stdout, stderr } = await execAsync(
    `curl -fSL ${curlProxyFlag()}-X ${method} ${headers.join(" ")} ${bodyFlag} ${shellQuote(url)}`,
    { env: proxyEnv(), maxBuffer: 64 * 1024 * 1024 },
  )
  if (stderr.trim()) console.log(stderr.trim())

  return {
    ok: true,
    status: 200,
    json: async () => JSON.parse(stdout),
    text: async () => stdout,
  }
}

async function getRelease(token: string, owner: string, name: string, tag: string) {
  const response = await githubRequest(
    token,
    `https://api.github.com/repos/${owner}/${name}/releases/tags/${encodeURIComponent(tag)}`,
  ).catch(() => undefined)
  if (!response) return undefined
  return (await response.json()) as Release
}

async function createRelease(token: string, owner: string, name: string, tag: string) {
  const response = await githubRequest(token, `https://api.github.com/repos/${owner}/${name}/releases`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      tag_name: tag,
      name: tag,
      body: `OpenCode Desktop ${tag} (custom fork)`,
      target_commitish: process.env.GITHUB_RELEASE_BRANCH ?? "master",
    }),
  })
  return (await response.json()) as Release
}

async function deleteAsset(token: string, owner: string, name: string, assetId: number) {
  await githubRequest(token, `https://api.github.com/repos/${owner}/${name}/releases/assets/${assetId}`, {
    method: "DELETE",
  })
}

async function listAssets(token: string, owner: string, name: string, releaseId: number) {
  const response = await githubRequest(
    token,
    `https://api.github.com/repos/${owner}/${name}/releases/${releaseId}/assets`,
  )
  return (await response.json()) as Array<{ id: number; name: string }>
}

async function uploadAsset(token: string, uploadUrl: string, file: string) {
  const name = path.basename(file)
  const size = Bun.file(file).size
  const url = `${uploadUrl.replace(/\{.*$/, "")}?name=${encodeURIComponent(name)}`
  const attempts = 3
  let lastError: unknown

  for (let attempt = 1; attempt <= attempts; attempt++) {
    try {
      await execAsync(
        `curl -fSL ${curlProxyFlag()}--retry 3 --retry-delay 5 --max-time 7200 -X POST -H "Authorization: Bearer $GH_UPLOAD_TOKEN" -H "Accept: application/vnd.github+json" -H "Content-Type: application/octet-stream" -T ${shellQuote(file)} ${shellQuote(url)}`,
        {
          env: { ...proxyEnv(), GH_UPLOAD_TOKEN: token },
          maxBuffer: 64 * 1024 * 1024,
        },
      )
      console.log(`  uploaded ${name} (${(size / 1024 / 1024).toFixed(1)} MB)`)
      return name
    } catch (error) {
      lastError = error
      if (attempt < attempts) {
        console.log(`  retry ${attempt}/${attempts - 1} for ${name}...`)
        await new Promise((resolve) => setTimeout(resolve, attempt * 5_000))
      }
    }
  }

  throw lastError
}

export async function ensureGitHubRelease(input: { repo: string; tag: string; token: string }) {
  const { owner, name } = parseRepo(input.repo)
  const existing = await getRelease(input.token, owner, name, input.tag)
  if (existing) {
    console.log(`Release ${input.tag} already exists on ${input.repo}`)
    return existing
  }
  const created = await createRelease(input.token, owner, name, input.tag)
  console.log(`Created release ${input.tag} on ${input.repo}`)
  return created
}

export async function uploadGitHubReleaseAssets(input: {
  repo: string
  tag: string
  files: string[]
  token?: string
}) {
  if (input.files.length === 0) throw new Error("No files to upload")
  if (useDevSidecarProxy()) {
    console.log(`using DevSidecar proxy: ${DEV_SIDECAR_HTTPS}`)
  }
  const token = input.token ?? (await resolveGitHubToken())
  const { owner, name } = parseRepo(input.repo)
  const release = await ensureGitHubRelease({ repo: input.repo, tag: input.tag, token })
  const assets = await listAssets(token, owner, name, release.id)
  const byName = new Map(assets.map((asset) => [asset.name, asset.id]))

  for (const file of input.files) {
    const basename = path.basename(file)
    const existingId = byName.get(basename)
    if (existingId) await deleteAsset(token, owner, name, existingId)
    console.log(`uploading ${basename}...`)
    await uploadAsset(token, release.upload_url, file)
  }

  console.log(`Uploaded ${input.files.length} file(s) to ${input.repo} release ${input.tag}`)
  console.log(`Release: https://github.com/${input.repo}/releases/tag/${input.tag}`)
}
