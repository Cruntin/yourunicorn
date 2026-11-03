"""배포한 중계 서비스에 공고 이벤트를 한 번 보내 GitHub Actions 실행까지 확인한다. 토큰은 출력하지 않는다.
  ai-secrets run yourunicorn-site test-relay
"""
import os
import urllib.error
import urllib.request

url = f"http://1.234.91.117:8100/ninehire-webhook?event=job_status_updated&token={os.environ['NINEHIRE_WEBHOOK_TOKEN']}"
req = urllib.request.Request(url, method="POST", data=b'{"id":"relay-test"}', headers={"Content-Type": "application/json"})
try:
    with urllib.request.urlopen(req, timeout=20) as res:
        print(res.status, res.read().decode())
except urllib.error.HTTPError as e:
    print(e.code, e.read().decode())
