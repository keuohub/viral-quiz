
> viral-quiz-h5@0.1.0 links
> node scripts/links.mjs

# 对外上架链接清单

一套测试一条链接，链接里只带这一个测试，不会串到别的问卷。
发到哪个平台就用对应平台的版本，页面配色和分享文案会自动切成那个平台的风格。

当前域名：https://viral-quiz-nine.vercel.app

上线换域名后，在项目目录跑一次下面这行重新生成：

```bash
BASE_URL=https://你的域名 npm run links > docs/LINKS.md
```

## 测测你的精神内核是什么质感

10 题 · 约 3 分钟

- 小红书：https://viral-quiz-nine.vercel.app/test.html?t=quality-kernel&p=xhs
- 视频号：https://viral-quiz-nine.vercel.app/test.html?t=quality-kernel&p=video
- 抖音：https://viral-quiz-nine.vercel.app/test.html?t=quality-kernel&p=douyin
- 快手：https://viral-quiz-nine.vercel.app/test.html?t=quality-kernel&p=kuaishou

## 三角洲行动：测测你是哪种显眼包干员

5 题 · 约 1 分钟

- 抖音：https://viral-quiz-nine.vercel.app/test.html?t=delta-operator&p=douyin
- 快手：https://viral-quiz-nine.vercel.app/test.html?t=delta-operator&p=kuaishou

## 测测你的性格对应王者荣耀哪位英雄

8 题 · 约 2 分钟

- 小红书：https://viral-quiz-nine.vercel.app/test.html?t=hok-hero&p=xhs
- 抖音：https://viral-quiz-nine.vercel.app/test.html?t=hok-hero&p=douyin
- 快手：https://viral-quiz-nine.vercel.app/test.html?t=hok-hero&p=kuaishou
- 视频号：https://viral-quiz-nine.vercel.app/test.html?t=hok-hero&p=video

## 测测你是无畏契约里的哪位特工人格

8 题 · 约 2 分钟

- 小红书：https://viral-quiz-nine.vercel.app/test.html?t=valorant-agent&p=xhs
- 抖音：https://viral-quiz-nine.vercel.app/test.html?t=valorant-agent&p=douyin
- 快手：https://viral-quiz-nine.vercel.app/test.html?t=valorant-agent&p=kuaishou

## 测测你的恋爱隐藏属性

10 题 · 约 3 分钟

- 小红书：https://viral-quiz-nine.vercel.app/test.html?t=love-style&p=xhs
- 视频号：https://viral-quiz-nine.vercel.app/test.html?t=love-style&p=video
- 抖音：https://viral-quiz-nine.vercel.app/test.html?t=love-style&p=douyin
- 快手：https://viral-quiz-nine.vercel.app/test.html?t=love-style&p=kuaishou

## 备注

- 链接里的 `t` 是测试编号，`p` 是平台版本，两个都不要改，改错会打不开或串版本
- 用户答完的结果页分享按钮，自动带上的就是这个专属链接
- 想单独调某一套测试的题目或文案，只改 `tests/<编号>.json`，其它测试不受影响
