"""웹훅 중계 서비스를 서버에 배포한다. 토큰은 환경변수로 받아 ssh 표준입력으로만 서버에 전달한다.
  ai-secrets run yourunicorn-site deploy-relay
"""
import os
import subprocess
import sys
from pathlib import Path

HOST = os.environ.get("RELAY_HOST", "root@1.234.91.117")
DIR = Path(__file__).resolve().parent

REMOTE = """set -e
id ninehire-relay >/dev/null 2>&1 || useradd --system --no-create-home --shell /usr/sbin/nologin ninehire-relay
install -d -m 755 /opt/ninehire-relay
install -m 644 /tmp/ninehire-relay.py /opt/ninehire-relay/relay.py
install -m 644 /tmp/ninehire-relay.service /etc/systemd/system/ninehire-relay.service
rm -f /tmp/ninehire-relay.py /tmp/ninehire-relay.service
ufw allow 8100/tcp >/dev/null
systemctl daemon-reload
systemctl enable ninehire-relay >/dev/null 2>&1
systemctl restart ninehire-relay
sleep 2
echo "ninehire-relay: $(systemctl is-active ninehire-relay)"
echo "ezadmin-api: $(systemctl is-active ezadmin-api)"
"""


def main():
    tokens = {k: os.environ.get(k) for k in ("NINEHIRE_WEBHOOK_TOKEN", "GITHUB_DISPATCH_TOKEN")}
    missing = [k for k, v in tokens.items() if not v]
    if missing:
        sys.exit(f"환경변수 없음: {', '.join(missing)}")
    subprocess.run(["scp", "-q", str(DIR / "relay.py"), f"{HOST}:/tmp/ninehire-relay.py"], check=True)
    subprocess.run(["scp", "-q", str(DIR / "ninehire-relay.service"), f"{HOST}:/tmp/ninehire-relay.service"], check=True)
    env_file = "".join(f"{k}={v}\n" for k, v in tokens.items()) + "RELAY_PORT=8100\n"
    subprocess.run(
        ["ssh", HOST, "umask 077 && cat > /etc/ninehire-relay.env.new && mv /etc/ninehire-relay.env.new /etc/ninehire-relay.env"],
        input=env_file.encode(), check=True,
    )
    subprocess.run(["ssh", HOST, REMOTE], check=True)


if __name__ == "__main__":
    main()
