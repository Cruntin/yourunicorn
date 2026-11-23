# 루트(/) 언어 자동 이동 — Cloudflare Redirect Rules

결정일: 2026-11-19

## 결론
- `https://yourunicorn.world/` 접속만 브라우저 언어(Accept-Language)와 `yu_lang` 쿠키를 보고 Cloudflare가 302로 `/jp/`·`/en/` 으로 보낸다. 한국어는 루트 그대로다.
- 다른 경로(`/culture/`, `/recruit/`, `/en/…`, `/jp/…`)는 이동하지 않는다. 공유 링크가 그대로 열리게 하기 위해서다.
- 비용 없음: Cloudflare Free 플랜 Single Redirects(규칙 10개 한도 중 2개 사용).
- 설정은 저장소 밖(Cloudflare 대시보드)에 있다. 바꾸면 이 문서도 고친다.

## 동작
| 상황 | 결과 |
|-|-|
| 쿠키 `yu_lang=ja` | /jp/ |
| 쿠키 `yu_lang=en` | /en/ |
| 쿠키 `yu_lang=ko` | 이동 없음 |
| 쿠키 없음, 첫 번째 언어가 일본어 | /jp/ |
| 쿠키 없음, 언어 목록에 한국어(ko)가 없는 그 밖의 언어 | /en/ |
| 쿠키 없음, 언어 목록에 ko가 있음 | 이동 없음 |
| Accept-Language 없음(Googlebot 등), 알려진 봇 | 이동 없음 |

`yu_lang` 쿠키는 `i18n.js`가 언어 선택 메뉴(`.approved-lang a[hreflang]`)를 누를 때 1년짜리로 저장한다.

## 이렇게 정한 이유
- 한국어가 `/ko/`가 아니라 루트에 있다. "언어 정보가 없으면 영어"로 하면 Googlebot(미국 IP, Accept-Language 없음)이 `/en/`으로 가서 한국어 홈(hreflang ko·x-default)이 색인에서 빠진다. 그래서 언어 정보가 있을 때만 보낸다.
- 루트가 한국어라서 쿠키는 "있음/없음"이 아니라 값(ko/en/ja)을 담아야 한다. 그래야 EN을 고른 사람이 다음에 루트로 와도 /en/ 으로 간다.
- IP 국가 대신 브라우저 언어를 쓴다. VPN·로밍·해외 출장에 흔들리지 않는다.
- `http.request.accepted_languages`는 Transform Rules 전용이라 Redirect Rules에서 못 쓴다. 대신 `http.request.headers["accept-language"][0]`를 쓰고, 헤더가 없을 때는 `coalesce(…, "")`로 빈 문자열로 만든다.
- 301이 아니라 302: 브라우저가 기억하지 않게 해서 언어를 바꿔도 예전 언어로 튀지 않게 한다.

- `cf.client.bot`(알려진 봇)은 Free 플랜 Redirect Rules에서 쓸 수 없다(저장 시 "the use of field cf.client.bot is not allowed"). 대신 Accept-Language가 없으면 이동하지 않는 조건으로 봇을 거른다. Googlebot은 이 헤더를 보내지 않는다.
- GitHub Pages는 HTML에 `Cache-Control: max-age=600`을 붙인다. 그대로 두면 루트를 본 지 10분 안에 언어를 바꾸고 루트로 돌아올 때 브라우저가 저장본을 보여 줘서 규칙이 실행되지 않는다. 그래서 루트(`/`) 응답만 `Cache-Control: no-cache`로 바꿔 매번 Cloudflare를 거치게 한다.
- `about.yourunicorn.world`도 같은 존에서 프록시 중이므로 규칙마다 `http.host eq "yourunicorn.world"`로 범위를 묶는다.

## Cloudflare 설정값 (2026-11-19 적용)
- SSL/TLS 암호화 모드: **Full**, 자동 SSL/TLS 모드 끔. 자동 모드는 원본 검사 후 Full (strict)로 올릴 수 있는데, 그러면 GitHub 인증서 갱신이 실패할 때 526 오류가 난다. Flexible은 GitHub Pages의 HTTPS 강제와 맞물려 무한 리다이렉트가 된다.
- 보안 → 설정 → 이메일 주소 난독화: 끔(페이지의 mailto 주소를 Cloudflare가 고쳐 쓰지 않게). Rocket Loader·Speed Brain·Cloudflare Fonts는 원래 꺼져 있다.
- DNS: `yourunicorn.world` A 레코드 4개(185.199.108–111.153) Proxied. `www`(→ cruntin.github.io)와 `article`(나인하이어)은 DNS only 그대로. `about`(→ 루트 301 규칙)과 `media`(R2)는 원래 Proxied.
- Rules → Redirect Rules (1번은 기존 `about to root`. 2·3번이 이 기능. 둘 다 Static · 302 · 쿼리 문자열 유지)

규칙 2 `언어 자동 이동: 일본어 → /jp/` → `https://yourunicorn.world/jp/`
```
http.host eq "yourunicorn.world" and http.request.uri.path eq "/" and (http.cookie contains "yu_lang=ja" or (not http.cookie contains "yu_lang=" and starts_with(lower(coalesce(http.request.headers["accept-language"][0], "")), "ja")))
```

규칙 3 `언어 자동 이동: 영어 등 외국어 → /en/` → `https://yourunicorn.world/en/`
```
http.host eq "yourunicorn.world" and http.request.uri.path eq "/" and (http.cookie contains "yu_lang=en" or (not http.cookie contains "yu_lang=" and lower(coalesce(http.request.headers["accept-language"][0], "")) ne "" and not lower(coalesce(http.request.headers["accept-language"][0], "")) contains "ko" and not starts_with(lower(coalesce(http.request.headers["accept-language"][0], "")), "ja")))
```

- Rules → 응답 헤더 변환 규칙 `루트(/) 브라우저 캐시 끄기 (언어 자동 이동용)`: 식 `http.host eq "yourunicorn.world" and http.request.uri.path eq "/"`, 정적 설정 `Cache-Control = no-cache`.

## 점검 명령
```sh
for al in "" "ja-JP,ja;q=0.9" "en-US,en;q=0.9" "zh-CN,zh;q=0.9" "en-US,en;q=0.9,ko;q=0.8" "ko-KR,ko;q=0.9"; do
  printf '%-28s ' "${al:-(없음)}"
  curl -s -o /dev/null -w '%{http_code} %{redirect_url}\n' -H "Accept-Language:$al" https://yourunicorn.world/
done
```
기대값: 없음 200, ja 302→/jp/, en 302→/en/, zh 302→/en/, en+ko 200, ko 200.
`-H "Accept-Language:"`처럼 값이 비면 curl은 그 헤더를 보내지 않는다. 그래서 "없음"도 헤더가 없는 요청이 되고, bash·zsh 어디서나 같게 동작한다. 예전 명령의 `${al:+-H "…"}`는 zsh에서 한 단어로 붙어서 헤더가 깨졌다.
2026-11-19 적용 직후 이 값과 쿠키(`yu_lang=ko|en|ja`)·쿼리 유지·다른 경로 비이동·Googlebot·www/http/about 301까지 18가지를 확인했고, 실제 브라우저에서 언어를 고른 뒤 루트 재방문 시 고른 언어로 가는 것도 확인했다.

## 되돌리기
- Redirect Rules의 2·3번 규칙을 끄면 바로 원래 동작으로 돌아간다. 응답 헤더 변환 규칙도 함께 꺼도 된다.
- 프록시까지 되돌리려면 A 레코드를 DNS only로 바꾼다.
- 프록시 상태에서는 GitHub Pages 설정 화면에 DNS 경고가 뜰 수 있다. 사이트 동작과는 무관하다.
