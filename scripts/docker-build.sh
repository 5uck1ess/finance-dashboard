#!/usr/bin/env bash
set -euo pipefail

# ─────────────────────────────────────────────────────────────
# Finance Dashboard — Docker image builder
#
# Auto-detects your host platform and lets you pick the target.
# Produces a .tar file ready to upload to any NAS.
#
# Usage:
#   ./scripts/docker-build.sh              # interactive platform picker
#   ./scripts/docker-build.sh --platform linux/amd64   # skip prompt
#   ./scripts/docker-build.sh --load       # also load into local Docker
# ─────────────────────────────────────────────────────────────

VERSION="$(node -p "require('./package.json').version")"
VERSION_SLUG="${VERSION//./-}"
IMAGE_NAME="finance-dashboard"
LOAD_IMAGE=false
TARGET_PLATFORM=""

# ── Parse flags ──────────────────────────────────────────────
while [[ $# -gt 0 ]]; do
    case "$1" in
        --platform)
            TARGET_PLATFORM="$2"
            shift 2
            ;;
        --load)
            LOAD_IMAGE=true
            shift
            ;;
        *)
            echo "Unknown option: $1"
            echo "Usage: $0 [--platform linux/amd64|linux/arm64] [--load]"
            exit 1
            ;;
    esac
done

# ── Detect host architecture ─────────────────────────────────
detect_host_platform() {
    local arch
    arch="$(uname -m)"
    case "$arch" in
        x86_64|amd64)   echo "linux/amd64" ;;
        aarch64|arm64)   echo "linux/arm64" ;;
        armv7l)          echo "linux/arm/v7" ;;
        *)               echo "linux/amd64" ;;   # safe default
    esac
}

HOST_PLATFORM="$(detect_host_platform)"

# ── Interactive platform picker ──────────────────────────────
if [[ -z "$TARGET_PLATFORM" ]]; then
    echo ""
    echo "┌─────────────────────────────────────────────┐"
    echo "│  Finance Dashboard Docker Builder v${VERSION}  │"
    echo "└─────────────────────────────────────────────┘"
    echo ""
    echo "  Detected host: $(uname -m) → ${HOST_PLATFORM}"
    echo ""
    echo "  What platform are you building for?"
    echo ""

    # Build menu — mark the host platform as default
    OPTIONS=("linux/amd64" "linux/arm64" "linux/arm/v7")
    DEFAULT_IDX=1
    for i in "${!OPTIONS[@]}"; do
        marker="  "
        label=""
        if [[ "${OPTIONS[$i]}" == "$HOST_PLATFORM" ]]; then
            DEFAULT_IDX=$((i + 1))
            marker="▸ "
            label=" (this machine)"
        fi
        # Common NAS hints
        case "${OPTIONS[$i]}" in
            linux/amd64)  hint="Intel/AMD — Ugreen, most Synology, QNAP x86" ;;
            linux/arm64)  hint="Apple Silicon, Raspberry Pi 4/5, some QNAP" ;;
            linux/arm/v7) hint="Raspberry Pi 3, older ARM NAS" ;;
        esac
        echo "    ${marker}$((i + 1))) ${OPTIONS[$i]}  — ${hint}${label}"
    done

    echo ""
    read -r -p "  Select [${DEFAULT_IDX}]: " choice
    choice="${choice:-$DEFAULT_IDX}"

    if ! [[ "$choice" =~ ^[0-9]+$ ]] || (( choice < 1 || choice > ${#OPTIONS[@]} )); then
        echo "Invalid selection. Exiting."
        exit 1
    fi

    TARGET_PLATFORM="${OPTIONS[$((choice - 1))]}"
fi

# ── Derive arch slug for filename ────────────────────────────
ARCH_SLUG="${TARGET_PLATFORM//\//-}"   # linux/amd64 → linux-amd64
ARCH_SHORT="${TARGET_PLATFORM##*/}"    # linux/amd64 → amd64
TAR_NAME="${IMAGE_NAME}-${ARCH_SHORT}-${VERSION_SLUG}.tar"

echo ""
echo "  Building ${IMAGE_NAME}:${VERSION} for ${TARGET_PLATFORM}..."
echo ""

# ── Build ────────────────────────────────────────────────────
docker buildx build \
    --platform "${TARGET_PLATFORM}" \
    -t "${IMAGE_NAME}:${VERSION}" \
    -t "${IMAGE_NAME}:latest" \
    -o "type=docker,dest=${TAR_NAME}" \
    .

echo ""
echo "  ✓ Built: ${TAR_NAME} ($(du -h "${TAR_NAME}" | cut -f1 | xargs))"
echo ""
echo "  To deploy on your NAS:"
echo "    1. Upload ${TAR_NAME} to your NAS"
echo "    2. Load:  docker load < ${TAR_NAME}"
echo "    3. Run:   docker compose up -d"

# ── Optional: load into local Docker ─────────────────────────
if [[ "$LOAD_IMAGE" == true ]]; then
    echo ""
    echo "  Loading image into local Docker..."
    docker load < "${TAR_NAME}"
    echo "  ✓ Done. Run: docker compose up -d"
fi

echo ""
