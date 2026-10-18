import { loadAll, scoreQuiz, themeOf } from './quiz.js';
import { buildCard, saveCard } from './card.js';
import {
  PAYWALL,
  ensureSession,
  isUnlocked,
  maskTag,
  maskText,
  newSession,
  paywallPrice,
  unlock,
  verifyCode,
} from './paywall.js';

const params = new URLSearchParams(location.search);
const testId = params.get('t');
const platform = params.get('p') || 'xhs';
const isDev = location.hostname === 'localhost' || location.hostname === '127.0.0.1';
// 预览用：?peek=<结果key> 仅本地开发有效，线上生产环境强制拦截，防绕过
const previewResult = isDev ? params.get('peek') : null;

document.body.dataset.theme = themeOf(platform);
document.body.dataset.test = testId;

const app = document.getElementById('app');
const toastEl = document.getElementById('toast');
const STORE_KEY = `quiz:v1:${testId}`;

// 每套测试可以有自己的主题文件：themes/<测试编号>.css 放进去就自动生效，不用改代码
const themeLink = document.createElement('link');
themeLink.rel = 'stylesheet';
themeLink.href = `./themes/${testId}.css`;
document.head.append(themeLink);
const themeReady = new Promise((resolve) => {
  themeLink.addEventListener('load', resolve);
  themeLink.addEventListener('error', resolve);
  setTimeout(resolve, 800);
});

let test = null;
let state = { started: false, index: 0, answers: {} };
let busy = false;
let session = null;

const escapeHtml = (text) =>
  String(text).replace(/[&<>"]/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[ch]);

function save() {
  localStorage.setItem(STORE_KEY, JSON.stringify(state));
}

function restore() {
  try {
    const saved = JSON.parse(localStorage.getItem(STORE_KEY));
    if (saved && typeof saved.index === 'number' && saved.answers) {
      state = { started: Object.keys(saved.answers).length > 0, ...saved };
    }
  } catch {
    /* 进度损坏时直接从头开始 */
  }
}

let toastTimer;
function toast(message) {
  toastEl.textContent = message;
  toastEl.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toastEl.classList.remove('show'), 2200);
}

function renderStart() {
  app.innerHTML = `
    <div class="start">
      <p class="start-kicker">${test.questions.length} 题 · 约 ${test.estimatedMinutes} 分钟</p>
      <h1 class="start-title">${escapeHtml(test.title)}</h1>
      <p class="start-sub">${escapeHtml(test.subtitle)}</p>
      <p class="start-intro">${escapeHtml(test.intro)}</p>
      <div class="start-actions">
        <button class="btn btn-primary" type="button" data-act="start">开始测试</button>
      </div>
    </div>`;
}

function renderQuestion(animate) {
  const question = test.questions[state.index];
  const ratio = (state.index / test.questions.length) * 100;

  app.innerHTML = `
    <div class="quiz-top">
      <button class="back" type="button" data-act="back" aria-label="上一题" ${state.index === 0 ? 'disabled' : ''}>‹</button>
      <div class="progress"><i style="width:${ratio}%"></i></div>
      <div class="counter">${state.index + 1} / ${test.questions.length}</div>
    </div>
    <div class="stage">
      <div class="slide${animate ? ' in-right' : ''}">
        ${state.index === 0 ? `<p class="q-hint">${escapeHtml(test.title)}</p>` : ''}
        <h1 class="q-text">${escapeHtml(question.text)}</h1>
        ${question.options
          .map(
            (o) => `<button class="option" type="button" data-key="${o.key}" aria-pressed="${
              state.answers[state.index] === o.key
            }"><b>${o.key}</b><span>${escapeHtml(o.text)}</span></button>`,
          )
          .join('')}
      </div>
    </div>`;

  if (animate) {
    const slide = app.querySelector('.slide');
    requestAnimationFrame(() => slide.classList.remove('in-right'));
  }
}

function slideOut(next) {
  if (busy) return;
  busy = true;
  const slide = app.querySelector('.slide');
  if (slide) slide.classList.add('out-left');
  setTimeout(() => {
    busy = false;
    next();
  }, 200);
}

function choose(key) {
  state.answers[state.index] = key;
  save();
  const last = state.index === test.questions.length - 1;
  slideOut(() => {
    if (last) {
      state.index = test.questions.length;
      save();
      renderResult();
    } else {
      state.index += 1;
      save();
      renderQuestion(true);
    }
  });
}

function goBack() {
  if (state.index === 0) return;
  slideOut(() => {
    state.index -= 1;
    save();
    renderQuestion(true);
  });
}

function renderResult() {
  const scored = scoreQuiz(test, state.answers);
  const peeking = previewResult && test.results[previewResult] ? previewResult : null;
  const winner = peeking || scored.winner;
  const secondary = peeking ? null : scored.secondary;
  const result = test.results[winner];

  // 预览模式不受付费墙影响，方便调视觉；传 lock=1 则强制看锁定态与付费弹窗
  if (params.get('lock') === '1' || (!peeking && !isUnlocked(testId, session))) {
    renderLocked(result);
    return;
  }

  const second = secondary ? test.results[secondary] : null;
  const shareText = result.share[platform] || result.share.xhs;
  const link = location.href;
  // 玩家梗只在短视频平台的玩梗语境下展示，放到小红书/视频号会显得突兀
  const meme = platform === 'douyin' || platform === 'kuaishou' ? result.meme : '';

  app.innerHTML = `
    <div class="result">
      <h1 class="result-tag">${escapeHtml(result.tag)}</h1>
      <p class="result-quote">${escapeHtml(result.quote)}</p>
      <div class="result-body">
        <span class="result-anchor">${escapeHtml(result.anchor)}</span>
        <p class="result-desc">${escapeHtml(result.desc)}</p>
        ${meme ? `<p class="result-meme">${escapeHtml(meme)}</p>` : ''}
        ${second ? `<p class="result-extra">你的副标签是「${escapeHtml(second.tag)}」——${escapeHtml(second.quote)}</p>` : ''}
        <button class="save-link" type="button" data-act="card">保存结果图</button>
      </div>
      <div class="result-actions">
        <button class="btn btn-primary" type="button" data-act="share">分享给朋友</button>
        <button class="btn" type="button" data-act="reset">重新测试</button>
      </div>
    </div>`;

  app.querySelector('[data-act="share"]').addEventListener('click', () => share(shareText, link, result, second));
  app.querySelector('[data-act="card"]').addEventListener('click', async () => {
    await saveCard(test, result, platform, second);
    toast('结果图已保存到相册');
  });
}

/** 结果页锁定态：标签遮一半、解读打码，掏钱才能看 */
function renderLocked(result) {
  const price = paywallPrice(platform);
  app.innerHTML = `
    <div class="result is-locked">
      <h1 class="result-tag">${escapeHtml(maskTag(result.tag))}</h1>
      <p class="result-quote">${escapeHtml(maskText(result.quote, 4))}</p>
      <div class="result-body">
        <span class="result-anchor">${escapeHtml(result.anchor)}</span>
        <p class="result-desc">${escapeHtml(maskText(result.desc, 18))}</p>
        <p class="lock-note">完整报告已经生成，解锁后可见</p>
        <button class="save-link" type="button" data-act="unlock">解锁后可保存结果图</button>
      </div>
      <div class="result-actions">
        <button class="btn btn-primary" type="button" data-act="unlock">解锁完整结果 ¥${price}</button>
        <button class="btn" type="button" data-act="reset">重新测试</button>
      </div>
    </div>`;
}

function openUnlockSheet() {
  if (document.querySelector('.sheet')) return;
  const price = paywallPrice(platform);
  const pay = PAYWALL.pay;
  const sheet = document.createElement('div');
  sheet.className = 'sheet';
  sheet.innerHTML = `
    <div class="sheet-mask" data-act="close"></div>
    <div class="sheet-card">
      <p class="sheet-social">${PAYWALL.copy.social}</p>
      <h2 class="sheet-title">${PAYWALL.copy.title}</h2>
      <p class="sheet-sub">${PAYWALL.copy.subtitle}</p>
      <p class="sheet-price"><b>¥${price}</b><span>${PAYWALL.copy.limit}</span></p>
      ${
        pay.selfUnlock
          ? `<div class="pay-qr">
               <img src="${pay.qr}" alt="收款码" />
               <span class="pay-qr-hint">${pay.qrHint}</span>
             </div>
             <p class="pay-tip">${pay.tip}</p>
             <button class="btn btn-primary" type="button" data-act="paid">${PAYWALL.copy.payButton}</button>`
          : ''
      }
      ${
        pay.codeEntry
          ? `${pay.selfUnlock ? `<button class="pay-toggle" type="button" data-act="toggle-code">${PAYWALL.copy.codeToggle}</button>` : ''}
             <div class="pay-code" ${pay.selfUnlock ? 'hidden' : ''}>
               <label class="sheet-label" for="code-input">${PAYWALL.copy.inputLabel}</label>
               <input class="sheet-input" id="code-input" type="text" autocomplete="off" spellcheck="false"
                 placeholder="${PAYWALL.copy.placeholder}" />
               <p class="sheet-error" id="sheet-error" role="alert"></p>
               <button class="btn" type="button" data-act="submit">用激活码解锁</button>
             </div>`
          : ''
      }
      ${pay.contact ? `<p class="pay-contact">付款遇到问题：${pay.contact}</p>` : ''}
      <button class="btn sheet-later" type="button" data-act="close">先不看</button>
    </div>`;
  document.body.append(sheet);

  // 收款码没放图时，留一个虚线框提示放哪，不要显示破图
  const qrImg = sheet.querySelector('.pay-qr img');
  if (qrImg) {
    qrImg.addEventListener('error', () => qrImg.remove());
  }

  sheet.addEventListener('click', async (event) => {
    if (event.target.closest('[data-act="close"]')) {
      sheet.remove();
      return;
    }
    if (event.target.closest('[data-act="paid"]')) {
      unlock(testId, session, 'paid');
      sheet.remove();
      toast(PAYWALL.copy.paidDone);
      renderResult();
      return;
    }
    if (event.target.closest('[data-act="toggle-code"]')) {
      const box = sheet.querySelector('.pay-code');
      box.hidden = !box.hidden;
      if (!box.hidden) box.querySelector('input').focus();
      return;
    }
    if (event.target.closest('[data-act="submit"]')) {
      const input = sheet.querySelector('#code-input');
      const error = sheet.querySelector('#sheet-error');
      const submit = event.target.closest('[data-act="submit"]');
      submit.disabled = true;
      submit.textContent = '正在验证…';
      const res = await verifyCode(input.value, testId);
      if (!res.ok) {
        error.textContent = res.reason;
        submit.disabled = false;
        submit.textContent = '用激活码解锁';
        return;
      }
      unlock(testId, session, res.code);
      sheet.remove();
      toast(PAYWALL.copy.paidDone);
      renderResult();
    }
  });
}

/** 点解锁：配了付款页就直接跳过去，没配就用站内扫码面板兜底 */
function goCheckout() {
  const checkoutUrl = PAYWALL.pay.checkoutUrl;
  if (!checkoutUrl) {
    openUnlockSheet();
    return;
  }
  const back = `${location.origin}${location.pathname}?t=${testId}&p=${platform}&unlock=1`;
  const glue = checkoutUrl.includes('?') ? '&' : '?';
  location.href = `${checkoutUrl}${glue}${PAYWALL.pay.returnParam}=${encodeURIComponent(back)}`;
}

function restart() {
  session = newSession(testId);
  state = { started: true, index: 0, answers: {} };
  save();
  renderQuestion(false);
}

async function share(shareText, link, result, second) {
  const text = `${shareText}\n${link}`;

  if (navigator.share) {
    try {
      const canvas = buildCard(test, result, platform, second);
      const blob = await new Promise((resolve) => canvas.toBlob(resolve, 'image/png'));
      const file = new File([blob], 'quiz-result.png', { type: 'image/png' });
      await navigator.share({ text: shareText, url: link, files: [file] });
      return;
    } catch (error) {
      if (error && error.name === 'AbortError') return;
    }
  }

  try {
    await navigator.clipboard.writeText(text);
    toast('文案已复制，去粘贴发布吧');
  } catch {
    toast('长按选中上方文案，手动复制即可');
  }
}

app.addEventListener('click', (event) => {
  const option = event.target.closest('.option');
  if (option) {
    choose(option.dataset.key);
    return;
  }
  if (event.target.closest('[data-act="start"]')) {
    state.started = true;
    save();
    renderQuestion(false);
    return;
  }
  if (event.target.closest('[data-act="unlock"]')) {
    goCheckout();
    return;
  }
  if (event.target.closest('[data-act="reset"]')) {
    restart();
    return;
  }
  if (event.target.closest('[data-act="back"]')) goBack();
});

Promise.all([loadAll(), themeReady])
  .then(([tests]) => {
    test = tests.find((t) => t.id === testId);
    if (!test) throw new Error('未找到该测试');
    session = ensureSession(testId);

    // 付款页跳回来如带 unlock 参数，必须校验其为合法激活码才放行，防止随意拼参绕过
    const unlockVal = params.get('unlock');
    if (unlockVal) {
      if (unlockVal !== '1' && unlockVal !== 'true') {
        const check = await verifyCode(unlockVal, testId);
        if (check.ok) {
          unlock(testId, session, unlockVal);
        }
      }
      history.replaceState(null, '', `${location.pathname}?t=${testId}&p=${platform}`);
    }

    restore();
    if (previewResult && test.results[previewResult]) renderResult();
    else if (!state.started) renderStart();
    else if (state.index >= test.questions.length) renderResult();
    else renderQuestion(false);
  })
  .catch(() => {
    app.innerHTML = '<div class="loading">题目加载失败，请用 npm start 启动本地服务后访问。</div>';
  });
