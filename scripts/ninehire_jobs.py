"""나인하이어 공고로 Recruit 페이지 공고 목록을 만든다.

사용법:
  python3 scripts/ninehire_jobs.py           모집 중 공고 목록 출력
  python3 scripts/ninehire_jobs.py --all     마감·보관·비노출 공고까지 출력
  python3 scripts/ninehire_jobs.py --write   recruit/index.html 공고 영역 갱신

NINEHIRE_API_KEY 환경변수로 인증한다. 키 값은 출력하지 않는다.
"""
import html
import json
import os
import re
import sys
import urllib.error
import urllib.parse
import urllib.request
from pathlib import Path

API_BASE = "https://api.ninehire.com/api/v2"
PAGE_SIZE = 100
RECRUIT_HTML = Path(__file__).resolve().parent.parent / "recruit" / "index.html"
START = "<!-- ninehire-jobs:start -->"
END = "<!-- ninehire-jobs:end -->"
JOB_BASE = "https://article.yourunicorn.world/job_posting/"

EMPLOYMENT = {
    "full_time": "정규직", "intern": "인턴", "contractor": "계약직", "part_time": "파트타임",
    "freelancer": "프리랜서", "dispatched": "파견직", "day_labor": "일용직", "trainee": "수습",
}
# 나인하이어에 직군(jobGroup)이 비어 있는 공고는 제목 앞 [태그]로 직군을 정한다.
PREFIX_GROUP = {
    "Channel": "채널관리", "Design": "디자인", "Marketing": "마케팅", "Global": "마케팅",
    "SCM": "SCM", "Finance": "Business", "AI·Data": "Business",
}
TITLE_RE = re.compile(r"^\s*\[([^\]]+)\]\s*(.*?)\s*$")
CAREER_SUFFIX_RE = re.compile(r"\s*\((?:경력|신입|인턴|경력무관|경력직|신입/경력)\)\s*$")


def fetch_jobs(include_all=False):
    key = os.environ.get("NINEHIRE_API_KEY")
    if not key:
        sys.exit("NINEHIRE_API_KEY 환경변수가 없습니다.")
    params = {"countPerPage": PAGE_SIZE}
    if include_all:
        params.update(includeUnpublished="true", includeHidden="true")
    results, page = [], 1
    while True:
        query = urllib.parse.urlencode({**params, "page": page})
        req = urllib.request.Request(
            f"{API_BASE}/jobs?{query}",
            headers={"Authorization": f"Bearer {key}", "Accept": "application/json"},
        )
        try:
            with urllib.request.urlopen(req, timeout=30) as res:
                data = json.load(res)
        except urllib.error.HTTPError as e:
            sys.exit(f"나인하이어 API 오류: HTTP {e.code} {e.read()[:300]!r}")
        results += data["results"]
        # count가 전체 건수가 아니라 현재 페이지 건수로 오는 경우가 있어 페이지가 가득 찼는지로 판단한다.
        if len(data["results"]) < PAGE_SIZE:
            return results
        page += 1


def is_open(job):
    return job.get("receptionStatus") == "open" and job.get("isListExposed")


def card(job):
    m = TITLE_RE.match(job["title"])
    prefix, title = (m.group(1), m.group(2)) if m else ("", job["title"].strip())
    title = CAREER_SUFFIX_RE.sub("", title)
    group = job.get("jobGroup") or PREFIX_GROUP.get(prefix, "기타")

    career = job.get("career")
    over = (job.get("careerRange") or {}).get("over") or 0
    if career == "newcomer":
        career_label = "신입"
    elif career == "experienced":
        career_label = f"경력 {over}년+" if over else "경력"
    else:
        career_label = "경력무관"
    types = job.get("employmentTypes") or []
    employment = EMPLOYMENT.get(types[0], "") if types else ""

    meta = [x for x in (prefix, career_label, employment) if x]
    code = job["applyUrl"].rstrip("/").rsplit("/", 1)[-1]
    esc = html.escape
    return {
        "group": group,
        "html": (
            f'            <a class="job job--clean" href="{JOB_BASE}{esc(code)}" target="_blank" rel="noopener" data-group="{esc(group)}">\n'
            f'              <p class="job__title">{esc(title)}</p>\n'
            f'              <p class="job__meta">{"".join(f"<span>{esc(x)}</span>" for x in meta)}</p>\n'
            f"            </a>"
        ),
    }


def render(jobs):
    cards = [card(j) for j in jobs if is_open(j)]
    groups = sorted({c["group"] for c in cards})
    chips = [f'            <button type="button" class="art-chip is-on" data-job-filter="">전체<span>{len(cards)}</span></button>']
    for g in groups:
        n = sum(c["group"] == g for c in cards)
        chips.append(f'            <button type="button" class="art-chip" data-job-filter="{html.escape(g)}">{html.escape(g)}<span>{n}</span></button>')
    block = "\n".join([
        f"          {START}",
        '          <div class="art-chips" role="toolbar" aria-label="직군 필터">',
        *chips,
        "          </div>",
        '          <div class="art-jobs" data-jobs="">',
        *[c["html"] for c in cards],
        "          </div>",
        f"          {END}",
    ])
    return block, len(cards)


def write(jobs):
    page = RECRUIT_HTML.read_text(encoding="utf-8")
    pattern = re.compile(r"[ \t]*" + re.escape(START) + r".*?" + re.escape(END), re.S)
    if len(pattern.findall(page)) != 1:
        sys.exit(f"{RECRUIT_HTML}에서 공고 영역 표시 주석을 찾지 못했습니다.")
    block, count = render(jobs)
    updated = pattern.sub(lambda _: block, page)
    if updated == page:
        print(f"변경 없음 (공고 {count}건)")
        return
    RECRUIT_HTML.write_text(updated, encoding="utf-8")
    print(f"recruit/index.html 갱신 (공고 {count}건)")


def main():
    if "--write" in sys.argv:
        write(fetch_jobs())
        return
    for j in fetch_jobs(include_all="--all" in sys.argv):
        print(" | ".join(str(x) for x in [
            j["applyUrl"].rstrip("/").rsplit("/", 1)[-1], j["title"], j.get("receptionStatus"),
            "노출" if j.get("isListExposed") else "비노출", (j.get("reception") or {}).get("endAt"),
        ]))


if __name__ == "__main__":
    main()
