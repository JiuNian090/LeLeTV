#!/usr/bin/env bash
# ============================================================
# Project Skills Bootstrap Script
# ============================================================
# Detects project type, checks skill installation status,
# and guides the user to set up skills.
#
# Usage:
#   bash scripts/bootstrap.sh          # Detection + guidance
#   bash scripts/bootstrap.sh --check  # Just check status, exit 0/1
# ============================================================

set -euo pipefail
ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"

# ---- Colour helpers ----
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

info()  { echo -e "${CYAN}ℹ${NC} $1"; }
ok()    { echo -e "${GREEN}✔${NC} $1"; }
warn()  { echo -e "${YELLOW}⚡${NC} $1"; }
err()   { echo -e "${RED}✘${NC} $1"; }

# ---- Detect project type ----
detect_project_type() {
    if [[ -f "$ROOT_DIR/package.json" ]]; then
        echo "node"
    elif [[ -f "$ROOT_DIR/pyproject.toml" ]]; then
        echo "python"
    elif [[ -f "$ROOT_DIR/requirements.txt" ]]; then
        echo "python"
    elif [[ -f "$ROOT_DIR/Cargo.toml" ]]; then
        echo "rust"
    elif [[ -f "$ROOT_DIR/go.mod" ]]; then
        echo "go"
    else
        echo "unknown"
    fi
}

# ---- Skill installation status ----
check_skills_status() {
    local skills_dir="$ROOT_DIR/.agents/skills"
    local rules_dir="$ROOT_DIR/.agents/rules"

    if [[ ! -d "$skills_dir" ]]; then
        echo "no-skills-dir"
    elif [[ ! -f "$skills_dir/INDEX.md" ]]; then
        echo "no-index"
    else
        local count
        count=$(find "$skills_dir" -maxdepth 2 -name "SKILL.md" 2>/dev/null | wc -l)
        if [[ "$count" -eq 0 ]]; then
            echo "empty"
        else
            echo "installed:$count"
        fi
    fi
}

# ---- Print guidance ----
print_guidance() {
    local project_type="$1"
    local skills_status="$2"

    echo ""
    echo "============================================"
    echo "  Project Skills — Bootstrap Report"
    echo "============================================"
    echo ""

    # Project type
    case "$project_type" in
        node)    ok "项目类型: Node.js / Frontend" ;;
        python)  ok "项目类型: Python" ;;
        rust)    ok "项目类型: Rust" ;;
        go)      ok "项目类型: Go" ;;
        *)       warn "项目类型: 未能自动识别（未找到 package.json/pyproject.toml/Cargo.toml/go.mod）" ;;
    esac

    # Skills status
    echo ""
    case "$skills_status" in
        no-skills-dir)
            warn "技能尚未安装"
            info "解决方案: 在 IDE 中打开项目，输入「安装技能和规则」即可自动配置"
            ;;
        no-index|empty)
            warn "技能目录存在但尚未完成安装"
            info "解决方案: 在 IDE 中打开项目，输入「安装技能和规则」即可自动安装"
            ;;
        installed:*)
            local count="${skills_status#installed:}"
            ok "已安装 ${count} 个技能"
            info "运行以下命令查看技能清单:"
            echo "  ls ${ROOT_DIR}/.agents/skills/"
            info "如需更新技能，在 IDE 中输入「更新技能和规则」"
            ;;
    esac

    # IDE hints
    echo ""
    echo "━━━ IDE 使用提示 ━━━"
    echo ""
    echo "  支持的 IDE 命令:"
    echo "    「安装技能和规则」  — 首次安装/配置"
    echo "    「更新技能和规则」  — 升级已有技能"
    echo "    「卸载技能 xxx」    — 移除指定技能"
    echo "    「查看技能」        — 查看技能状态"
    echo "    「更新更新日志为 vx.x.x」 — 生成 CHANGELOG"
    echo ""
    echo "━━━━━━━━━━━━━━━━━━"
    echo ""
}

# ---- Main ----
main() {
    local project_type
    project_type=$(detect_project_type)

    local skills_status
    skills_status=$(check_skills_status)

    # --check mode: just exit with status
    if [[ "${1:-}" == "--check" ]]; then
        case "$skills_status" in
            no-skills-dir|no-index|empty) exit 1 ;;
            *) exit 0 ;;
        esac
    fi

    print_guidance "$project_type" "$skills_status"
}

main "$@"
