"""나인하이어 웹훅 중계: 공고 이벤트를 받으면 GitHub Actions(나인하이어 공고 동기화)를 실행한다.

나인하이어 등록 URL
  http://<서버>:8100/ninehire-webhook?event=job_status_updated&token=<NINEHIRE_WEBHOOK_TOKEN>
  http://<서버>:8100/ninehire-webhook?event=job_posting_updated&token=<NINEHIRE_WEBHOOK_TOKEN>

환경변수(systemd EnvironmentFile=/etc/ninehire-relay.env)
  NINEHIRE_WEBHOOK_TOKEN  웹훅 URL의 token 값
  GITHUB_DISPATCH_TOKEN   Cruntin/yourunicorn 저장소 Contents 읽기·쓰기 fine-grained 토큰
  RELAY_PORT              수신 포트(기본 8100)
"""
import hmac
import json
import os
import sys
import urllib.error
import urllib.request
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from urllib.parse import parse_qs, urlsplit

GITHUB_REPO = "Cruntin/yourunicorn"
DISPATCH_EVENT = "ninehire-job-updated"
ALLOWED_EVENTS = {"job_status_updated", "job_posting_updated"}
PATH = "/ninehire-webhook"
MAX_BODY = 1024 * 1024


def log(message):
    print(message, file=sys.stderr, flush=True)


def dispatch(event, job_id):
    req = urllib.request.Request(
        f"https://api.github.com/repos/{GITHUB_REPO}/dispatches",
        method="POST",
        data=json.dumps({"event_type": DISPATCH_EVENT, "client_payload": {"event": event, "jobId": job_id}}).encode(),
        headers={
            "Accept": "application/vnd.github+json",
            "Authorization": f"Bearer {os.environ['GITHUB_DISPATCH_TOKEN']}",
            "X-GitHub-Api-Version": "2022-11-28",
            "User-Agent": "yourunicorn-ninehire-relay",
            "Content-Type": "application/json",
        },
    )
    try:
        with urllib.request.urlopen(req, timeout=10) as res:
            return res.status
    except urllib.error.HTTPError as e:
        log(f"GitHub dispatch 실패 status={e.code} body={e.read()[:300]!r}")
        return e.code
    except urllib.error.URLError as e:
        log(f"GitHub dispatch 실패 error={e.reason}")
        return 0


class Handler(BaseHTTPRequestHandler):
    server_version = "ninehire-relay"

    def log_message(self, fmt, *args):
        # 기본 로그는 요청 줄 전체(토큰 포함)를 남기므로 경로만 기록한다.
        log(f"{self.client_address[0]} {self.command} {urlsplit(self.path).path} -> {args[1] if len(args) > 1 else ''}")

    def reply(self, status, message):
        body = json.dumps({"message": message}).encode()
        self.send_response(status)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def do_GET(self):
        if urlsplit(self.path).path == "/health":
            return self.reply(200, "ok")
        self.reply(404, "not found")

    def do_POST(self):
        url = urlsplit(self.path)
        if url.path != PATH:
            return self.reply(404, "not found")
        query = parse_qs(url.query)
        token = query.get("token", [""])[0]
        if not hmac.compare_digest(token.encode(), os.environ["NINEHIRE_WEBHOOK_TOKEN"].encode()):
            return self.reply(403, "invalid token")

        length = min(int(self.headers.get("Content-Length") or 0), MAX_BODY)
        raw = self.rfile.read(length) if length else b""
        event = query.get("event", [""])[0]
        if event not in ALLOWED_EVENTS:
            # 지원자 이벤트 등 공고 목록과 무관한 이벤트는 받기만 하고 무시한다.
            return self.reply(200, "ignored")
        try:
            job_id = str((json.loads(raw or b"null") or {}).get("id", ""))
        except (ValueError, AttributeError):
            job_id = ""

        status = dispatch(event, job_id)
        log(f"event={event} jobId={job_id} dispatch={status}")
        # GitHub는 성공 시 204를 돌려준다.
        self.reply(200, "dispatched") if status == 204 else self.reply(502, "dispatch failed")


def main():
    for name in ("NINEHIRE_WEBHOOK_TOKEN", "GITHUB_DISPATCH_TOKEN"):
        if not os.environ.get(name):
            sys.exit(f"{name} 환경변수가 없습니다.")
    port = int(os.environ.get("RELAY_PORT", "8100"))
    log(f"ninehire-relay listening on :{port}")
    ThreadingHTTPServer(("0.0.0.0", port), Handler).serve_forever()


if __name__ == "__main__":
    main()
