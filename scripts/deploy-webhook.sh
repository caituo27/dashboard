#!/usr/bin/env bash
set -Eeuo pipefail

# Baota/CNB webhook entrypoint for SprixPortal.
# Default deploys the user app to the current temporary IP site root.
# Override variables in Baota's webhook command when paths differ, for example:
# AGENT_WEB_ROOT=/www/wwwroot/example.com ADMIN_WEB_ROOT=/www/wwwroot/admin.example.com bash scripts/deploy-webhook.sh

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

: "${REPO_DIR:=$(cd "${SCRIPT_DIR}/.." && pwd)}"
: "${BRANCH:=main}"
: "${AGENT_WEB_ROOT:=/www/wwwroot/42.194.150.73_8081}"
: "${ADMIN_WEB_ROOT:=}"
: "${LOG_FILE:=${REPO_DIR}/deploy-webhook.log}"
: "${LOCK_FILE:=/tmp/sprix-portal-deploy.lock}"

mkdir -p "$(dirname "${LOG_FILE}")"

exec 9>"${LOCK_FILE}"
if ! flock -n 9; then
  echo "Another SprixPortal deploy is already running."
  exit 75
fi

exec > >(tee -a "${LOG_FILE}") 2>&1

log() {
  printf '[%s] %s\n' "$(date '+%Y-%m-%d %H:%M:%S')" "$*"
}

require_command() {
  if ! command -v "$1" >/dev/null 2>&1; then
    log "Missing required command: $1"
    exit 127
  fi
}

publish_dist() {
  local source_dir="$1"
  local target_dir="$2"
  local label="$3"

  if [[ -z "${target_dir}" ]]; then
    log "Skip ${label}: target directory is not configured."
    return
  fi

  if [[ ! -d "${source_dir}" ]]; then
    log "Missing ${label} dist directory: ${source_dir}"
    exit 1
  fi

  mkdir -p "${target_dir}"
  rsync -a --delete "${source_dir}/" "${target_dir}/"
  log "Published ${label}: ${source_dir} -> ${target_dir}"
}

require_command git
require_command pnpm
require_command rsync

log "Starting SprixPortal deploy."
log "Repository: ${REPO_DIR}"
log "Branch: ${BRANCH}"

cd "${REPO_DIR}"

if ! git diff --quiet || ! git diff --cached --quiet; then
  log "Repository has local changes. Refusing to deploy over a dirty worktree."
  git status --short
  exit 1
fi

git fetch origin
git checkout "${BRANCH}"
git pull --ff-only origin "${BRANCH}"

pnpm install --frozen-lockfile
pnpm build

publish_dist "${REPO_DIR}/apps/sprix-agent/dist" "${AGENT_WEB_ROOT}" "sprix-agent"
publish_dist "${REPO_DIR}/apps/sprix-admin/dist" "${ADMIN_WEB_ROOT}" "sprix-admin"

log "SprixPortal deploy finished."
