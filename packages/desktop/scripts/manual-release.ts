#!/usr/bin/env bun

import { $ } from "bun"
import { Glob } from "bun"
import { parseArgs } from "node:util"
import path from "node:path"
import { uploadGitHubReleaseAssets, proxyEnv } from "./github-release"

const DEFAULT_REPO = "otanjian/opencode"
const DEFAULT_VERSION = "1.0.0"

const { values } = parseArgs({
  args: Bun.argv.slice(2),
  options: {
    version: { type: "string", short: "v" },
    repo: { type: "string", short: "r" },
    platform: { type: "string", short: "p" },
    upload: { type: "boolean", default: true },
    "build-only": { type: "boolean", default: false },
    "upload-only": { type: "boolean", default: false },
  },
})

const version = values.version ?? process.env.OPENCODE_VERSION ?? DEFAULT_VERSION
const repo = values.repo ?? process.env.GH_REPO ?? DEFAULT_REPO
const tag = `v${version}`
const desktopDir = path.join(import.meta.dir, "..")
const dist = path.join(desktopDir, "dist")

process.chdir(desktopDir)

function nativeRustTarget() {
  const { platform, arch } = process
  if (platform === "darwin") return arch === "arm64" ? "aarch64-apple-darwin" : "x86_64-apple-darwin"
  if (platform === "win32") return arch === "arm64" ? "aarch64-pc-windows-msvc" : "x86_64-pc-windows-msvc"
  if (platform === "linux") return arch === "arm64" ? "aarch64-unknown-linux-gnu" : "x86_64-unknown-linux-gnu"
  throw new Error(`Unsupported platform: ${platform}/${arch}`)
}

function parsePlatforms(raw?: string) {
  if (!raw || raw === "native") {
    if (process.platform === "darwin") return ["mac"]
    if (process.platform === "win32") return ["win"]
    return ["linux"]
  }
  return raw.split(",").map((item) => item.trim()).filter(Boolean)
}

function electronBuilderArgs(platforms: string[]) {
  const args: string[] = []
  if (platforms.includes("mac")) args.push("--mac", process.arch === "arm64" ? "--arm64" : "--x64")
  if (platforms.includes("win")) args.push("--win", "--x64")
  if (platforms.includes("linux")) args.push("--linux", "--x64")
  if (args.length === 0) throw new Error(`Unknown platforms: ${platforms.join(", ")}`)
  return args
}

async function releaseArtifacts(platforms: string[]) {
  const patterns: string[] = []
  if (platforms.includes("mac")) patterns.push("*.dmg", "*.zip", "latest-mac.yml")
  if (platforms.includes("win")) patterns.push("*.exe", "latest.yml")
  if (platforms.includes("linux")) {
    patterns.push("*.AppImage", "*.deb", "*.rpm", "latest-linux.yml", "latest-linux-arm64.yml")
  }

  const files = new Set<string>()
  for (const pattern of patterns) {
    const glob = new Glob(pattern)
    for await (const match of glob.scan({ cwd: dist, absolute: true })) files.add(match)
  }
  return [...files].sort()
}

async function packagePlatforms(platforms: string[]) {
  await $`bunx electron-builder ${electronBuilderArgs(platforms)} --config electron-builder.config.ts`
}

async function uploadArtifacts(files: string[]) {
  if (files.length === 0) throw new Error(`No release artifacts found in ${dist}`)
  await uploadGitHubReleaseAssets({ repo, tag, files })
}

const platforms = parsePlatforms(values.platform ?? process.env.OPENCODE_RELEASE_PLATFORMS)

process.env.OPENCODE_VERSION = version
process.env.GH_REPO = repo
process.env.OPENCODE_CHANNEL = "prod"
process.env.RUST_TARGET = process.env.RUST_TARGET ?? nativeRustTarget()
process.env.CSC_IDENTITY_AUTO_DISCOVERY = "false"
process.env.OPENCODE_NOTARIZE = "false"

if (process.env.OPENCODE_USE_DEV_SIDECAR !== "0") {
  Object.assign(process.env, proxyEnv())
}

console.log("manual release", {
  version,
  repo,
  tag,
  platforms,
  platform: process.platform,
  arch: process.arch,
  rustTarget: process.env.RUST_TARGET,
  upload: values.upload && !values["build-only"],
  uploadOnly: values["upload-only"],
})

if (!values["upload-only"]) {
  await $`bun ./scripts/prepare.ts`
  await $`bun run build`
  await packagePlatforms(platforms)
}

const artifacts = await releaseArtifacts(platforms)
console.log("built artifacts:")
for (const file of artifacts) console.log(`  ${path.basename(file)}`)

if (!values.upload || values["build-only"]) {
  if (values["build-only"]) console.log("build-only: skipping GitHub upload")
  process.exit(0)
}

await uploadArtifacts(artifacts)
