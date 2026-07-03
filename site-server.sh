#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BUILD_DIR="${ROOT_DIR}/dist"
PID_FILE="${ROOT_DIR}/.site-server.pid"
LOG_FILE="${ROOT_DIR}/.site-server.log"
HOST="${HOST:-0.0.0.0}"
PORT="${PORT:-8766}"

usage() {
    cat <<'EOF'
Usage: ./site-server.sh <start|stop|restart|status>

Environment overrides:
  PORT=8766
  HOST=0.0.0.0
EOF
}

is_running() {
    [[ -f "${PID_FILE}" ]] && kill -0 "$(cat "${PID_FILE}")" 2>/dev/null
}

find_free_port() {
    python3 - "${PORT}" <<'PY'
import socket
import sys

start = int(sys.argv[1])
for port in range(start, start + 100):
    sock = socket.socket()
    sock.settimeout(0.3)
    try:
        if sock.connect_ex(("127.0.0.1", port)) != 0:
            print(port)
            raise SystemExit(0)
    except OSError:
        continue
    finally:
        sock.close()
raise SystemExit(1)
PY
}

show_urls() {
    local port="${1:-${PORT}}"
    local lan_ip
    lan_ip="$(hostname -I 2>/dev/null | awk '{print $1}')"

    echo "Local: http://127.0.0.1:${port}/"
    if [[ -n "${lan_ip}" ]]; then
        echo "LAN:   http://${lan_ip}:${port}/"
    fi
}

start_server() {
    if [[ ! -f "${BUILD_DIR}/index.html" ]]; then
        echo "Site has not been built yet. Run npm run build first." >&2
        exit 1
    fi

    if is_running; then
        local old_port
        old_port="$(cat "${PID_FILE}.port" 2>/dev/null || echo "${PORT}")"
        echo "Site server is already running with PID $(cat "${PID_FILE}")."
        show_urls "${old_port}"
        exit 0
    fi

    rm -f "${PID_FILE}" "${PID_FILE}.port"

    local actual_port
    actual_port="$(find_free_port)"

    nohup python3 -m http.server "${actual_port}" --bind "${HOST}" \
        --directory "${BUILD_DIR}" >"${LOG_FILE}" 2>&1 &
    local pid=$!
    echo "${pid}" >"${PID_FILE}"
    echo "${actual_port}" >"${PID_FILE}.port"

    sleep 1
    if ! kill -0 "${pid}" 2>/dev/null; then
        echo "Failed to start the site server. Check ${LOG_FILE}." >&2
        rm -f "${PID_FILE}" "${PID_FILE}.port"
        exit 1
    fi

    echo "Site server started with PID ${pid}."
    show_urls "${actual_port}"
    echo "Log: ${LOG_FILE}"
}

stop_server() {
    if [[ ! -f "${PID_FILE}" ]]; then
        echo "No managed site server is running."
        exit 0
    fi

    local pid
    pid="$(cat "${PID_FILE}")"

    if kill -0 "${pid}" 2>/dev/null; then
        kill "${pid}"

        for _ in $(seq 1 10); do
            if ! kill -0 "${pid}" 2>/dev/null; then
                break
            fi
            sleep 1
        done

        if kill -0 "${pid}" 2>/dev/null; then
            kill -9 "${pid}"
        fi

        echo "Site server stopped."
    else
        echo "Removing stale PID file."
    fi

    rm -f "${PID_FILE}" "${PID_FILE}.port"
}

status_server() {
    if is_running; then
        local running_port
        running_port="$(cat "${PID_FILE}.port" 2>/dev/null || echo "${PORT}")"
        echo "Site server is running with PID $(cat "${PID_FILE}")."
        show_urls "${running_port}"
    else
        echo "Site server is not running."
        exit 1
    fi
}

case "${1:-}" in
    start)
        start_server
        ;;
    stop)
        stop_server
        ;;
    restart)
        stop_server || true
        start_server
        ;;
    status)
        status_server
        ;;
    -h|--help|"")
        usage
        ;;
    *)
        echo "Unknown command: ${1}" >&2
        usage
        exit 1
        ;;
esac

