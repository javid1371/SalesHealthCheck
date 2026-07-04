#!/usr/bin/env bash
# Guardrail: production app images must come from GHCR (built by GitHub Actions).
# Source from deploy scripts: source "$(dirname "$0")/lib/validate-ghcr-image.sh"

validate_ghcr_app_image() {
  local image="${1:-}"
  local ghcr_prefix="ghcr.io/javid1371/sales-health-check:"

  if [ -z "${image}" ]; then
    echo "ERROR: APP_IMAGE is empty." >&2
    exit 1
  fi

  case "${image}" in
    "${ghcr_prefix}"*)
      ;;
    *)
      echo "ERROR: APP_IMAGE must be a GHCR image: ${ghcr_prefix}<tag>" >&2
      echo "       Got: ${image}" >&2
      echo "" >&2
      echo "Production deploys: push to main → CI builds → GHCR → docker pull on VPS." >&2
      echo "Forbidden: docker build on VPS, docker save/load, scp images, local-only tags." >&2
      echo "See docs/ops/production-deploy.md and AGENTS.md (Production deploy)." >&2
      exit 1
      ;;
  esac
}
