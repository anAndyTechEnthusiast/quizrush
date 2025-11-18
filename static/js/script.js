﻿// ================= Chart.js 插件注册 =================
// 注册注解插件
if (typeof Chart !== "undefined") {
  // 检查注解插件是否可用
  if (typeof Chart.registry !== "undefined") {
    // 如果插件已经自动注册，就不需要手动注册
    console.log("✅ Chart.js 和注解插件已就绪");
  } else {
    console.warn("Chart.js 注解插件需要手动注册");
  }
} else {
  console.error("Chart.js 未正确加载");
}
// ================= 配置常量 =================
const COOLDOWN_TIME = 15; // 冷却时间（秒）

// ================= 注册验证功能 =================
let isUsernameValid = false;
let isPasswordValid = false;

// ================= 数据与状态 =================
let questions = [];
let currentQ = null;
let score = 0,
  streak = 0,
  mistake = 0,
  answered = 0,
  level = 0;
let consecutiveWrong = 0,
  totalWrong = 0;
let totalCorrect = 0,
  totalWrongOverall = 0;
let maxStreakDuringGame = 0; // 游戏过程中的最高连对

// 封顶状态相关变量
let isScoreCapped = false; // 是否处于分数封顶状态
let cappedScoreStart = 0; // 封顶开始时的分数
let maxCappedBonus = 50; // 封顶状态下最多可获得的额外分数
let hasShownCappedWarning = false; // 是否已显示封顶提示
let pendingUpgradeLevel = null; // 可以升级但未升级的目标等级

// 当前题目索引和洗牌状态
let currentQuestionIndex = 0;
let isQuestionsShuffled = false;

let allowReset = false; // 控制重置按钮是否可点击

let isProcessing = false,
  locked = true,
  isFetching = false;
let questionStartTime = null; // 当前题目开始作答的时间

let timerInterval = null,
  cooldownInterval = null;

// ================= 用户管理功能 =================
let currentUser = null;

// --- DOM refs ---
const qEl = document.getElementById("question");
const optsEl = document.getElementById("options");
const mathInputEl = document.getElementById("mathInput");
const answerInput = document.getElementById("answerInput");
const startBtn = document.getElementById("startBtn");
const continueBtn = document.getElementById("continueBtn");
const resetBtn = document.getElementById("resetBtn");
const messageEl = document.getElementById("message");
const progressBar = document.getElementById("progress");
const cooldownBar = document.getElementById("cooldown");

const upgradeBtn = document.createElement("button");
upgradeBtn.textContent = "升级";
upgradeBtn.className = "small";
upgradeBtn.style.display = "none"; // 初始隐藏
document.querySelector(".controls").appendChild(upgradeBtn);
const downgradeBtn = document.createElement("button");
downgradeBtn.textContent = "降级";
downgradeBtn.className = "small";
downgradeBtn.style.display = "none"; // 初始隐藏
document.querySelector(".controls").appendChild(downgradeBtn);

// ================= 更新记录显示 =================
function updateRecordsDisplay() {
  //  更新我的当前记录（实时游戏数据）
  document.getElementById("userCurrentScore").textContent = score;
  document.getElementById("userMaxStreak").textContent = maxStreakDuringGame;

  //  计算当前正确率（基于本轮答题）
  const currentAccuracy =
    answered > 0 ? ((totalCorrect / answered) * 100).toFixed(1) : "0.0";
  document.getElementById("userCurrentAccuracy").textContent =
    currentAccuracy + "%";

  console.log("📊 更新当前记录:", {
    分数: score,
    最高连对: maxStreakDuringGame,
    正确率: currentAccuracy + "%",
    答题数: answered,
    答对数: totalCorrect,
  });
}

// ================= 从排行榜获取全局最高记录 =================
function fetchGlobalRecordsFromLeaderboard() {
  console.log("🔄 从排行榜获取全局最高记录");

  // 并行获取三个榜单的第一名
  Promise.all([
    fetch("/api/leaderboard/score?limit=1").then((r) => r.json()),
    fetch("/api/leaderboard/streak?limit=1").then((r) => r.json()),
    fetch("/api/leaderboard/accuracy?limit=1").then((r) => r.json()),
  ])
    .then(([scoreData, streakData, accuracyData]) => {
      let globalMaxScore = 0;
      let globalMaxStreak = 0;
      let globalMaxAccuracy = 0;

      // 提取分数榜最高分
      if (scoreData && scoreData.length > 0) {
        globalMaxScore = scoreData[0].value || 0;
      }

      // 提取连对榜最高连对
      if (streakData && streakData.length > 0) {
        globalMaxStreak = streakData[0].value || 0;
      }

      // 提取正确率榜最高正确率
      if (accuracyData && accuracyData.length > 0) {
        globalMaxAccuracy = accuracyData[0].value || 0;
      }

      // 更新全局显示
      document.getElementById("globalMaxScore").textContent = globalMaxScore;
      document.getElementById("globalMaxStreak").textContent = globalMaxStreak;
      document.getElementById("globalMaxAccuracy").textContent =
        globalMaxAccuracy.toFixed(1) + "%";

      console.log("✅ 全局最高记录更新完成:", {
        最高分数: globalMaxScore,
        最高连对: globalMaxStreak,
        最高正确率: globalMaxAccuracy.toFixed(1) + "%",
      });
    })
    .catch((error) => {
      console.error("❌ 获取全局最高记录失败:", error);
      // 失败时显示默认值
      document.getElementById("globalMaxScore").textContent = 0;
      document.getElementById("globalMaxStreak").textContent = 0;
      document.getElementById("globalMaxAccuracy").textContent = "0%";
    });
}
// ================= 注册/登录功能 =================
// 实时验证用户名
function validateUsername() {
  const username = document.getElementById("regUsername").value.trim();
  const errorDiv = document.getElementById("usernameError");
  const registerBtn = document.getElementById("registerBtn");

  if (!errorDiv) {
    console.error("找不到usernameError元素");
    return;
  }

  if (username.length === 0) {
    errorDiv.textContent = "";
    isUsernameValid = false;
    updateRegisterButton();
    return;
  }

  if (username.length < 3) {
    errorDiv.textContent = "用户名至少3个字符";
    isUsernameValid = false;
  } else if (username.length > 20) {
    errorDiv.textContent = "用户名不能超过20个字符";
    isUsernameValid = false;
  } else {
    // 允许任何字符，包括中文、日文、特殊符号等
    errorDiv.textContent = "✓ 用户名格式正确";
    errorDiv.style.color = "green";
    isUsernameValid = true;
  }

  updateRegisterButton();
}
// 实时验证密码
function validatePassword() {
  const password = document.getElementById("regPassword").value;
  const errorDiv = document.getElementById("passwordError");
  const registerBtn = document.getElementById("registerBtn");

  if (!errorDiv) {
    console.error("找不到passwordError元素");
    return;
  }

  if (password.length === 0) {
    errorDiv.textContent = "";
    isPasswordValid = false;
    updateRegisterButton();
    return;
  }

  if (password.length < 8) {
    errorDiv.textContent = `密码长度: ${password.length}/8`;
    isPasswordValid = false;
  } else {
    errorDiv.textContent = "✓ 密码长度符合要求";
    errorDiv.style.color = "green";
    isPasswordValid = true;
  }

  updateRegisterButton();
}
// 显示注册模态框时重置状态
function showRegister() {
  const modal = document.getElementById("registerModal");
  if (!modal) {
    console.error("找不到registerModal元素");
    return;
  }

  modal.style.display = "block";
  // 重置验证状态
  isUsernameValid = false;
  isPasswordValid = false;

  // 安全地重置错误提示
  const usernameError = document.getElementById("usernameError");
  const passwordError = document.getElementById("passwordError");
  if (usernameError) {
    usernameError.textContent = "";
    usernameError.style.color = "red";
  }
  if (passwordError) {
    passwordError.textContent = "";
    passwordError.style.color = "red";
  }

  updateRegisterButton();
}
// 隐藏注册模态框
function hideRegister() {
  const modal = document.getElementById("registerModal");
  if (modal) {
    modal.style.display = "none";
  }

  document.getElementById("regUsername").value = "";
  document.getElementById("regPassword").value = "";
  document.getElementById("regEmail").value = "";

  // 安全地清空错误提示
  const usernameError = document.getElementById("usernameError");
  const passwordError = document.getElementById("passwordError");
  if (usernameError) usernameError.textContent = "";
  if (passwordError) passwordError.textContent = "";
}
// 更新注册按钮状态
function updateRegisterButton() {
  const registerBtn = document.getElementById("registerBtn");
  if (!registerBtn) {
    console.error("找不到registerBtn元素");
    return;
  }

  if (isUsernameValid && isPasswordValid) {
    registerBtn.disabled = false;
    registerBtn.innerHTML = "注册";
  } else {
    registerBtn.disabled = true;
    registerBtn.innerHTML = "请完成验证";
  }
}
// 修改注册函数，增强用户体验
function register() {
  const username = document.getElementById("regUsername").value.trim();
  const password = document.getElementById("regPassword").value;
  const email = document.getElementById("regEmail").value.trim();
  const registerBtn = document.getElementById("registerBtn");

  if (!registerBtn) {
    alert("系统错误：找不到注册按钮");
    return;
  }

  // 前端验证
  if (username.length < 3) {
    alert("用户名至少3个字符");
    return;
  }

  if (password.length < 8) {
    alert("密码至少8个字符");
    return;
  }

  // 禁用按钮防止重复提交
  registerBtn.disabled = true;
  registerBtn.innerHTML = "注册中...";

  fetch("/register", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username, password, email }),
  })
    .then((response) => response.json())
    .then((data) => {
      if (data.success) {
        alert("注册成功！请登录");
        hideRegister();

        // 自动填充登录表单
        document.getElementById("loginUsername").value = username;
        document.getElementById("loginPassword").value = "";
        document.getElementById("loginPassword").focus();
      } else {
        // 处理用户名重复等错误
        if (data.message.includes("已存在")) {
          const usernameError = document.getElementById("usernameError");
          if (usernameError) {
            usernameError.textContent = data.message;
            usernameError.style.color = "red";
          }
          isUsernameValid = false;
          updateRegisterButton();
          // 让用户修改用户名，保留密码
          document.getElementById("regUsername").focus();
          document.getElementById("regUsername").select();
        } else {
          alert("注册失败: " + data.message);
        }
      }
    })
    .catch((error) => {
      console.error("注册错误:", error);
      alert("注册失败，网络错误，请稍后重试");
    })
    .finally(() => {
      registerBtn.disabled = false;
      registerBtn.innerHTML = "注册";
    });
}

// 登录函数
function login() {
  const username = document.getElementById("loginUsername").value;
  const password = document.getElementById("loginPassword").value;

  if (!username || !password) {
    alert("请输入用户名和密码");
    return;
  }

  fetch("/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username, password }),
  })
    .then((response) => response.json())
    .then((data) => {
      if (data.success) {
        currentUser = data.user;
        showUserPanel(data.user);
        document.getElementById("loginUsername").value = "";
        document.getElementById("loginPassword").value = "";
        alert("登录成功！");

        // 登录成功后检查管理员状态
        setTimeout(checkAdminStatus, 500);
      } else {
        alert("登录失败: " + data.message);
      }
    })
    .catch((error) => {
      console.error("登录错误:", error);
      alert("登录失败，请稍后重试");
    });
}

// 退出登录
function logout() {
  fetch("/logout", { method: "POST" })
    .then((response) => response.json())
    .then((data) => {
      if (data.success) {
        currentUser = null;
        showGuestPanel();
        // 重置记录显示为0
        alert("已退出登录");
      }
    })
    .catch((error) => {
      console.error("退出登录错误:", error);
    });
}

// 页面加载时检查登录状态
function checkLoginStatus() {
  console.log("开始检查登录状态...");
  fetch("/get_current_user")
    .then((response) => response.json())
    .then((data) => {
      console.log("登录状态响应:", data);
      if (data.logged_in) {
        console.log("用户已登录:", data.user.username);
        currentUser = data.user;
        showUserPanel(data.user);

        // 登录状态检查后也检查管理员状态
        setTimeout(checkAdminStatus, 500);
      } else {
        console.log("用户未登录");
        showGuestPanel();
      }
    })
    .catch((error) => {
      console.error("检查登录状态失败:", error);
      showGuestPanel();
    });
}

// 显示用户面板
function showUserPanel(user) {
  console.log("显示用户面板:", user.username);

  const guestPanel = document.getElementById("guestPanel");
  const loggedInPanel = document.getElementById("loggedInPanel");
  const currentUsername = document.getElementById("currentUsername");

  if (guestPanel && loggedInPanel && currentUsername) {
    guestPanel.style.display = "none";
    loggedInPanel.style.display = "block";
    currentUsername.textContent = user.username;
    console.log("用户面板显示成功");

    // 显示用户面板后检查管理员状态
    setTimeout(checkAdminStatus, 100);
  } else {
    console.error("用户面板元素缺失");
  }
}

// 显示游客面板
function showGuestPanel() {
  console.log("显示游客面板");

  const guestPanel = document.getElementById("guestPanel");
  const loggedInPanel = document.getElementById("loggedInPanel");

  if (guestPanel && loggedInPanel) {
    guestPanel.style.display = "block";
    loggedInPanel.style.display = "none";
    console.log("游客面板显示成功");
  } else {
    console.error("游客面板元素缺失");
  }

  currentUser = null;
}

// =================== 洗牌函数 ===================
function shuffleArray(array) {
  console.log("🃏 开始洗牌，题目数量:", array.length);
  const shuffled = [...array];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  console.log("✅ 洗牌完成");
  return shuffled;
}

// ================= 辅助函数 =================
function message(txt, color) {
  if (messageEl) {
    messageEl.textContent = txt || "";
    messageEl.style.color = color || "black";
  }
}
function normalizeText(s) {
  if (!s) return "";
  try {
    s = s.normalize("NFKC");
  } catch (e) {}
  return String(s)
    .replace(/\u00A0/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}
function isChoiceCorrect(selectedIndex) {
  if (selectedIndex == null) return false; // 安全处理

  const dbAnsRaw = currentQ.a || "";
  const dbAns = dbAnsRaw.toString().trim();
  if (/^[A-Ea-e]$/.test(dbAns)) {
    const letter = String.fromCharCode(65 + selectedIndex);
    return dbAns.toUpperCase() === letter;
  }
  const selectedText = currentQ.opts[selectedIndex] || "";
  return normalizeText(selectedText) === normalizeText(dbAns);
}
function isMathCorrect(userInput) {
  const dbAnsRaw = (currentQ.a || "").toString().trim();
  const u = parseFloat(userInput.replace(/,/g, "")); // 去掉可能的逗号
  const d = parseFloat(dbAnsRaw.replace(/,/g, ""));

  if (!isNaN(u) && !isNaN(d)) {
    return Math.abs(u - d) < 1e-6; // 允许小误差
  }

  // 如果不是数字或 parse 失败，回退字符串比较
  return normalizeText(userInput) === normalizeText(dbAnsRaw);
}

// =================== 公式图片初始化 ===================
const formulaImages = [
  "/static1/pic1.png",
  "/static1/pic2.png",
  "/static1/pic3.png",
];
let formulaIndex = 0;
let formulaInterval = null;
// 创建左右图片元素
const leftFormula = document.getElementById("leftFormula");
const rightFormula = document.getElementById("rightFormula");
[leftFormula, rightFormula].forEach((img) => {
  img.className = "formula-img";
  img.style.opacity = "0";
});
document.body.appendChild(leftFormula);
document.body.appendChild(rightFormula); // 只 append 一次
leftFormula.style.left = "1vw";
leftFormula.style.transformOrigin = "left center";
rightFormula.style.right = "1vw";
rightFormula.style.transformOrigin = "right center";
// 显示/隐藏公式
function showFormulas() {
  if (formulaImages.length === 0) return;
  leftFormula.src = formulaImages[formulaIndex];
  rightFormula.src = formulaImages[(formulaIndex + 1) % formulaImages.length];
  leftFormula.style.opacity = "1";
  rightFormula.style.opacity = "1";
  if (formulaInterval) clearInterval(formulaInterval);
  formulaInterval = setInterval(() => {
    formulaIndex = (formulaIndex + 1) % formulaImages.length;
    leftFormula.src = formulaImages[formulaIndex];
    rightFormula.src = formulaImages[(formulaIndex + 1) % formulaImages.length];
  }, 5000);
}
function hideFormulas() {
  leftFormula.style.opacity = "0";
  rightFormula.style.opacity = "0";
  if (formulaInterval) {
    clearInterval(formulaInterval);
    formulaInterval = null;
  }
}

// ================= 下一题按钮 =================
const nextBtn = document.createElement("button");
nextBtn.textContent = "下一题";
nextBtn.className = "small";
nextBtn.style.display = "none";
document.querySelector(".controls").appendChild(nextBtn);
nextBtn.addEventListener("click", () => {
  nextQuestion(); // 统一在 nextQuestion 内处理 locked/isProcessing
});

// ================= 自动滚动到题目+答案位置 =================
function scrollToQuestion() {
  // 等待一小段时间确保DOM更新完成
  setTimeout(() => {
    const questionElement = document.getElementById("question");
    const messageElement = document.getElementById("message");
    const nextButton = document.querySelector(
      'button[style*="display: inline-block"]'
    );
    const statsButton = document.getElementById("showStatsBtn");

    if (questionElement) {
      // 计算一个能同时显示题目和答案区域的位置
      const currentScroll =
        window.pageYOffset || document.documentElement.scrollTop;
      const viewportHeight = window.innerHeight;

      // 找到所有相关元素的位置
      const questionPosition =
        questionElement.getBoundingClientRect().top + currentScroll;
      let targetBottomPosition = questionPosition;

      // 如果有消息区域，包含消息区域
      if (messageElement && messageElement.textContent) {
        const messagePosition =
          messageElement.getBoundingClientRect().bottom + currentScroll;
        targetBottomPosition = Math.max(targetBottomPosition, messagePosition);
      }

      // 如果有下一题按钮，包含下一题按钮
      if (nextButton) {
        const nextButtonPosition =
          nextButton.getBoundingClientRect().top + currentScroll;
        targetBottomPosition = Math.max(
          targetBottomPosition,
          nextButtonPosition
        );
      }

      // 如果有统计按钮，包含统计按钮
      if (statsButton) {
        const statsButtonPosition =
          statsButton.getBoundingClientRect().top + currentScroll;
        targetBottomPosition = Math.max(
          targetBottomPosition,
          statsButtonPosition
        );
      }

      // 计算滚动位置：确保题目在顶部，答案区域在视口中下部
      const scrollTarget = Math.max(0, questionPosition - 80);

      // 检查是否需要滚动（确保所有内容都在视口内）
      const needsScroll =
        targetBottomPosition - scrollTarget > viewportHeight ||
        Math.abs(currentScroll - scrollTarget) > 100;

      if (needsScroll) {
        window.scrollTo({
          top: scrollTarget,
          behavior: "smooth",
        });
        console.log("📜 自动滚动到题目+答案位置:", scrollTarget);
      } else {
        console.log("📜 题目和答案区域已在合适位置，无需滚动");
      }
    }
  }, 200);
}
// =================== 渲染题目 ===================
function renderQuestion(q) {
  currentQ = q;
  window.currentQuestion = q;
  clearUI();
  //  新题目开始时重置键盘状态
  if (window.keyboardController) {
    window.keyboardController.resetAnswerState();
    window.keyboardController.resetOptionSelection();
  }

  //  新题开始时统计按钮应该禁用，统计区域收起
  const showStatsBtn = document.getElementById("showStatsBtn");
  const statsSection = document.getElementById("statsSection");
  const statsResult = document.getElementById("statsResult");

  if (showStatsBtn && statsSection && statsResult) {
    showStatsBtn.disabled = true; // 新题开始时禁用
    showStatsBtn.style.pointerEvents = "none";
    showStatsBtn.style.cursor = "default";
    showStatsBtn.style.opacity = "0.6";
    showStatsBtn.style.display = "inline-block";
    showStatsBtn.innerHTML = "📊 查看本题统计"; //  重置按钮文字
    statsSection.style.display = "block";
    statsResult.style.display = "none"; //  新题开始时收起统计
    statsResult.innerHTML = ""; //  清空统计内容
    isStatsExpanded = false; //  重置展开状态

    //  立即清空上一题的统计结果
    document.getElementById("statsResult").innerHTML = "";
  }

  //  重置题目开始时间（所有题目都记录）
  questionStartTime = Date.now();
  console.log(
    `⏰ 开始新题目计时: ${new Date(questionStartTime).toLocaleTimeString()}`
  );

  mathInputEl.style.display = q.type === "math" ? "flex" : "none";
  if (q.type === "math") showFormulas();

  qEl.innerHTML = `[${q.difficulty.toUpperCase()}] ${q.q}`;

  if (q.type === "choice") {
    optsEl.innerHTML = "";
    q.opts.forEach((opt, i) => {
      if (!opt) return;
      const btn = document.createElement("button");
      //  这里也用 innerHTML 而不是 textContent
      btn.innerHTML = String.fromCharCode(65 + i) + ". " + opt;
      btn.addEventListener("click", () => submitAnswer(i));
      optsEl.appendChild(btn);
    });
  } else if (q.type === "math") {
    optsEl.innerHTML = "";
    mathInputEl.style.display = "flex";
    answerInput.value = "";
    answerInput.focus();
    showFormulas();
  }

  //  调用 MathJax 重新渲染公式
  if (window.MathJax && MathJax.typesetPromise) {
    MathJax.typesetPromise([qEl, optsEl]).then(() => {
      // MathJax渲染完成后延迟自动滚动
      setTimeout(() => {
        scrollToQuestion();
      }, 200);
    });
  } else {
    //  如果没有MathJax，延迟滚动
    setTimeout(() => {
      scrollToQuestion();
    }, 200);
  }
}

function clearUI() {
  Array.from(optsEl.querySelectorAll("button")).forEach((b) => {
    b.classList.remove("correct", "wrong", "disabled");
    b.disabled = false;
  });
  answerInput.disabled = false;
  nextBtn.style.display = "none";
  stopTimer();

  // 不要在这里重置统计按钮，在renderQuestion中单独处理
  questionStartTime = null;
}

function checkLevelChange() {
  let oldLevel = level;
  let newLevel = oldLevel;

  // 添加 SADISTIC 等级（300分及以上）
  if (score >= 300) newLevel = 3; // SADISTIC
  else if (score >= 200) newLevel = 2; // HARD
  else if (score >= 100) newLevel = 1; // MEDIUM
  else newLevel = 0; // EASY

  console.log(
    "🔍 等级检查: 当前等级",
    oldLevel,
    "新等级",
    newLevel,
    "分数",
    score,
    "封顶状态:",
    isScoreCapped
  );

  //  检查是否应该退出封顶状态（分数降到升级阈值以下）
  if (isScoreCapped && level < 3) {
    let threshold = 0;
    if (level === 0) threshold = 100; // EASY -> MEDIUM
    else if (level === 1) threshold = 200; // MEDIUM -> HARD
    else if (level === 2) threshold = 300; // HARD -> SADISTIC

    if (score < threshold) {
      // 分数降到升级阈值以下，退出封顶状态
      isScoreCapped = false;
      cappedScoreStart = 0;
      hasShownCappedWarning = false;
      console.log("🔄 分数降到升级阈值以下，退出封顶状态");
      message("🔄 封顶状态已重置，恢复正常加分机制", "blue");
    }
  }

  // 改为统一显示逻辑：
  upgradeBtn.style.display = "none";
  downgradeBtn.style.display = "none";
  nextBtn.style.display = "none";

  if (newLevel > oldLevel) {
    level = oldLevel; // 保持原等级，等待用户点击升级

    // 触发封顶状态（非SADISTIC难度）
    if (level < 3 && !isScoreCapped) {
      isScoreCapped = true;
      cappedScoreStart = score;
      hasShownCappedWarning = false;
      pendingUpgradeLevel = newLevel;
      console.log(
        `🎯 进入封顶状态: 起始分数=${cappedScoreStart}, 目标等级=${newLevel}`
      );
    }

    upgradeBtn.style.display = "inline-block";
    upgradeBtn.disabled = !!cooldownInterval;

    //   确保升级按钮可点击
    if (cooldownInterval) {
      console.log("⏳ 升级按钮在冷却中，暂时禁用");
    } else {
      upgradeBtn.disabled = false;
    }

    message(
      `⚡ 你可以升级到 ${
        ["EASY", "MEDIUM", "HARD", "SADISTIC"][newLevel]
      }！点击升级按钮`,
      "blue"
    );
    return "upgrade";
  }
  if (newLevel < oldLevel) {
    level = newLevel; // 立即降级

    // 降级时重置封顶状态
    if (isScoreCapped) {
      isScoreCapped = false;
      cappedScoreStart = 0;
      hasShownCappedWarning = false;
      pendingUpgradeLevel = null;
      console.log("🔄 降级，重置封顶状态");
    }

    downgradeBtn.style.display = "inline-block";
    downgradeBtn.disabled = !!cooldownInterval;

    //   确保降级按钮可点击
    if (cooldownInterval) {
      console.log("⏳ 降级按钮在冷却中，暂时禁用");
    } else {
      downgradeBtn.disabled = false;
    }

    message(
      `⚠ 你需要降级到 ${
        ["EASY", "MEDIUM", "HARD", "SADISTIC"][newLevel]
      }，点击降级按钮`,
      "orange"
    );
    return "downgrade";
  }

  upgradeBtn.style.display = "none";
  downgradeBtn.style.display = "none";
  return null;
}

// =================== 升级按钮点击事件 ===================
upgradeBtn.addEventListener("click", () => {
  //   添加多重保护，确保在任何情况下都能响应
  if (isProcessing || locked) {
    console.log(
      "❌ 升级被阻止：isProcessing=",
      isProcessing,
      "locked=",
      locked
    );
    return;
  }

  // 立即更新状态，防止重复点击
  isProcessing = true;
  locked = true;

  console.log("✅ 升级按钮被点击，当前等级:", level, "目标等级:", level + 1);

  //  升级时重置封顶状态
  if (isScoreCapped) {
    isScoreCapped = false;
    cappedScoreStart = 0;
    hasShownCappedWarning = false;
    pendingUpgradeLevel = null;
    console.log("🔄 升级，重置封顶状态");
  }

  level++; // 实际升级
  upgradeBtn.style.display = "none";
  upgradeBtn.disabled = true; //  立即禁用按钮防止重复点击

  message(
    `🎉 升级到 ${
      ["EASY", "MEDIUM", "HARD", "SADISTIC"][level]
    } 难度，正在加载题目...`,
    "green"
  );
  //  重置题目状态
  questions = [];
  currentQuestionIndex = 0;
  isQuestionsShuffled = false;

  //  确保统计按钮在难度变化时正确重置
  const showStatsBtn = document.getElementById("showStatsBtn");
  if (showStatsBtn) {
    showStatsBtn.disabled = true;
    showStatsBtn.style.pointerEvents = "none";
    showStatsBtn.style.cursor = "default";
    showStatsBtn.style.opacity = "0.6";
  }

  //  添加加载状态指示
  stopTimer();
  if (cooldownInterval) {
    clearInterval(cooldownInterval);
    cooldownInterval = null;
  }
  resetBars();

  // 确保在拉题完成后重置状态
  fetchQuestionsAndStart(() => {
    //  回调函数：题目加载完成后重置状态
    console.log("✅ 升级后题目加载完成，重置状态");
    isProcessing = false;
    locked = false;
    upgradeBtn.disabled = false;
  });
});

// =================== 降级按钮点击事件 - 同样修复 ===================
downgradeBtn.addEventListener("click", () => {
  // 添加多重保护
  if (isProcessing || locked) {
    console.log(
      "❌ 降级被阻止：isProcessing=",
      isProcessing,
      "locked=",
      locked
    );
    return;
  }

  // 立即更新状态
  isProcessing = true;
  locked = true;

  downgradeBtn.style.display = "none";
  downgradeBtn.disabled = true; //  立即禁用按钮

  message(
    `⚠ 降级到 ${
      ["EASY", "MEDIUM", "HARD", "SADISTIC"][level]
    } 难度，正在加载题目...`,
    "red"
  );
  //  重置题目状态
  questions = [];
  currentQuestionIndex = 0;
  isQuestionsShuffled = false;

  // 确保统计按钮在难度变化时正确重置
  const showStatsBtn = document.getElementById("showStatsBtn");
  if (showStatsBtn) {
    showStatsBtn.disabled = true;
    showStatsBtn.style.pointerEvents = "none";
    showStatsBtn.style.cursor = "default";
    showStatsBtn.style.opacity = "0.6";
  }

  // 添加加载状态指示
  stopTimer();
  if (cooldownInterval) {
    clearInterval(cooldownInterval);
    cooldownInterval = null;
  }
  resetBars();

  // 确保在拉题完成后重置状态
  fetchQuestionsAndStart(() => {
    console.log("✅ 降级后题目加载完成，重置状态");
    isProcessing = false;
    locked = false;
    downgradeBtn.disabled = false;
  });
});

// =================== 拉题/下一题 - 优化版本 ===================
function fetchQuestionsAndStart(callback) {
  if (isFetching) {
    console.log("❌ 拉题被阻止：正在拉题中");
    return;
  }

  isFetching = true;
  resetBtn.disabled = true;

  console.log("🔄 开始拉取题目，等级:", level, "分数:", score);

  fetch(`/get_questions?score=${score}&level=${level}`)
    .then((r) => {
      if (!r.ok) {
        throw new Error(`HTTP error! status: ${r.status}`);
      }
      return r.json();
    })
    .then((data) => {
      if (!data || !Array.isArray(data) || data.length === 0) {
        // 如果是SADISTIC难度没有题目，提示并降级
        if (level === 3) {
          message("📚 SADISTIC难度题库为空，自动降级到HARD难度", "orange");
          level = 2; // 降级到HARD

          isFetching = false;
          isProcessing = false;
          locked = false;

          fetchQuestionsAndStart(callback);
          return;
        }
        message("📚 当前难度题库已空，已结算本次成绩！", "red");
        finalizeAndReset();
        return;
      }

      // 每次拉取新题目都重新洗牌
      questions = shuffleArray(data);
      currentQuestionIndex = 0; // 重置索引
      isQuestionsShuffled = true;

      locked = false;
      isProcessing = false;

      console.log(`✅ 成功拉取${data.length}道题目，已洗牌，准备开始答题`);
      nextQuestion();

      if (callback) callback();
    })
    .catch((e) => {
      console.error("❌ 题库加载失败:", e);
      message("加载题库失败，请检查后端", "red");

      locked = false;
      isProcessing = false;

      if (callback) callback();
    })
    .finally(() => {
      isFetching = false;
    });
}

function nextQuestion() {
  resetBtn.disabled = true;
  allowReset = false;
  if (locked || isProcessing || questions.length === 0) return;

  //  检查是否需要重新拉题（题目快用完了）
  if (currentQuestionIndex >= questions.length - 10) {
    // 还剩10题时预加载
    console.log("🔄 题目即将用完，准备预加载新题目");
    // 这里可以添加预加载逻辑，但为了简单先不实现
  }

  //  如果所有题目都答过了，重新洗牌
  if (currentQuestionIndex >= questions.length) {
    console.log("🔄 所有题目已答完，重新洗牌");
    questions = shuffleArray(questions);
    currentQuestionIndex = 0;
  }

  locked = false;
  isProcessing = true;

  //  按洗牌后的顺序取题，确保不重复
  const q = questions[currentQuestionIndex];
  currentQuestionIndex++;

  console.log(
    `📖 取题: 第${currentQuestionIndex}/${questions.length}题, ID: ${q.id}`
  );

  // 确保统计区域在渲染新题前清空
  const statsResult = document.getElementById("statsResult");
  if (statsResult) {
    statsResult.innerHTML = "";
  }

  renderQuestion(q);
  resetBtn.disabled = true;

  startTimer(q.type === "math" ? 40 : 15);

  isProcessing = false;
  // 下一题时延迟自动滚动，确保DOM完全更新
  setTimeout(() => {
    scrollToQuestion();
  }, 300);
}

// ================= 修改游戏结束逻辑 =================
function finalizeAndReset() {
  //  禁用键盘控制
  if (window.keyboardController) {
    window.keyboardController.setEnabled(false);
  }

  //  结束排行榜会话
  if (window.leaderboardManager && window.leaderboardManager.isSessionActive) {
    window.leaderboardManager.endSession(true);
  }

  stopTimer();
  if (cooldownInterval) clearInterval(cooldownInterval);
  resetBars();

  //  游戏结束时刷新全局最高记录
  setTimeout(() => {
    fetchGlobalRecordsFromLeaderboard();
  }, 1000);

  //  重置游戏界面
  qEl.textContent = "🎉 本轮答题结束！请点击开始按钮重新挑战";
  optsEl.innerHTML = "";
  mathInputEl.style.display = "none";
  nextBtn.style.display = "none";
  resetBtn.disabled = false;
  messageEl.textContent = "";

  // 显示开始按钮，隐藏继续按钮
  startBtn.style.display = "inline-block";
  continueBtn.style.display = "none";

  //  重置统计按钮状态
  const statsSection = document.getElementById("statsSection");
  const showStatsBtn = document.getElementById("showStatsBtn");
  const statsResult = document.getElementById("statsResult");
  if (statsSection && showStatsBtn && statsResult) {
    statsSection.style.display = "none";
    showStatsBtn.disabled = true;
    statsResult.style.display = "none";
    statsResult.innerHTML = "";
    isStatsExpanded = false;
  }

  //  重置游戏状态
  questions = [];
  currentQ = null;
  score = 0;
  streak = 0;
  mistake = 0;
  answered = 0;
  level = 0;
  consecutiveWrong = 0;
  totalWrong = 0;
  totalCorrect = 0;
  totalWrongOverall = 0;
  maxStreakDuringGame = 0;

  //  重置封顶状态
  isScoreCapped = false;
  cappedScoreStart = 0;
  hasShownCappedWarning = false;
  pendingUpgradeLevel = null;

  //  重置题目索引
  currentQuestionIndex = 0;
  isQuestionsShuffled = false;

  //  重置右上角我的当前记录显示
  updateRecordsDisplay();

  locked = true;
  isProcessing = false;
}

// =================== 提交答案 ===================
async function submitAnswer(selectedIndex) {
  console.log("🔍 submitAnswer 被调用:", {
    locked: locked,
    currentQ: !!currentQ,
    answered: currentQ ? currentQ.answered : "no currentQ",
    selectedIndex: selectedIndex,
  });

  if (locked || (currentQ && currentQ.answered)) return;

  //  提交答案时短暂禁用键盘控制
  if (window.keyboardController) {
    window.keyboardController.setEnabled(false);
  }
  //  ：数学题提交后移除输入框焦点
  if (currentQ && currentQ.type === "math") {
    const answerInput = document.getElementById("answerInput");
    if (answerInput) {
      answerInput.blur(); // 移除焦点
      // 同时禁用输入框，防止再次输入
      answerInput.disabled = true;
    }
  }

  currentQ.answered = true;
  stopTimer();
  if (currentQ.type === "math") hideFormulas();
  answered++;

  //  调试信息 - 显示当前游戏状态
  console.log("🎮 当前游戏状态:", {
    score: score,
    maxStreakDuringGame: maxStreakDuringGame,
    answered: answered,
    totalCorrect: totalCorrect,
    streak: streak,
  });

  // 所有题目都记录答题时间，移除难度限制
  let answerTime = null;
  if (questionStartTime) {
    answerTime = parseFloat(
      ((Date.now() - questionStartTime) / 1000).toFixed(2)
    );
    console.log(
      `⏱️ 记录答题时间: ${answerTime}秒 (难度: ${currentQ.difficulty})`
    );
  }

  let selectedOption;
  if (currentQ.type === "choice") {
    selectedOption =
      selectedIndex != null
        ? String.fromCharCode(65 + selectedIndex)
        : "未选择";
  } else if (currentQ.type === "math") {
    let correct =
      currentQ.type === "math"
        ? isMathCorrect(answerInput.value.trim())
        : isChoiceCorrect(selectedIndex);
    selectedOption = answerInput.value.trim() || "空输入";
  } else {
    selectedOption = "未知类型";
  }

  const correct =
    currentQ.type === "math"
      ? isMathCorrect(answerInput.value.trim())
      : isChoiceCorrect(selectedIndex);

  let oldScore = score,
    change = 0;

  if (correct) {
    // 答对：立即启用
    setTimeout(() => {
      if (window.keyboardController) {
        window.keyboardController.setEnabled(true);
      }
    }, 500);
    //  触发键盘控制器检测下一题按钮
    if (window.keyboardController) {
      window.keyboardController.waitForNextQuestion();
    }
    streak++;
    mistake = 0;
    consecutiveWrong = 0;
    totalCorrect++;

    // 更新游戏过程中的最高连对
    if (streak > maxStreakDuringGame) {
      maxStreakDuringGame = streak;
      console.log(`🎯 更新最高连对: ${maxStreakDuringGame}`);
    }

    // 应用封顶加分规则
    if (isScoreCapped && level < 3) {
      // 封顶状态：每题只加1分，最多获得50分额外分数
      const cappedBonusEarned = score - cappedScoreStart;
      if (cappedBonusEarned < maxCappedBonus) {
        change = 1;
        score += change;

        // 首次进入封顶状态时显示提示
        if (!hasShownCappedWarning) {
          message(
            `📊 已达到升级标准！后续每题只加1分，最多可获得${maxCappedBonus}分`,
            "blue"
          );
          hasShownCappedWarning = true;
        } else {
          message(
            `✅ 答对！+1 (封顶状态: ${
              cappedBonusEarned + 1
            }/${maxCappedBonus})`,
            "green"
          );
        }

        // 检查是否达到50分上限
        if (cappedBonusEarned + 1 >= maxCappedBonus) {
          message(
            `🎯 已达到本难度${maxCappedBonus}分上限！请升级继续获得更多分数`,
            "orange"
          );
        }
      } else {
        // 已达到50分上限，不再加分
        change = 0;
        message(
          `🎯 已达到${maxCappedBonus}分上限！请升级继续获得更多分数`,
          "orange"
        );
      }
    } else {
      // 正常状态：使用连对加分机制
      change = streak;
      score += change;
      message(`✅ 答对！+${streak}`, "green");
    }

    updateStats(true, oldScore, change);
    checkLevelChange();
    nextBtn.style.display = "inline-block";

    //  答对时自动滚动到答案位置
    setTimeout(() => {
      scrollToQuestion();
    }, 200);

    unlockResetImmediate();

    //  答对时启用统计按钮
    enableStatsButton();
  } else {
    streak = 0;
    mistake++;
    consecutiveWrong++;
    totalWrong++;
    totalWrongOverall++;
    change = -(2 * mistake - 1);

    //  添加0分保护：分数不会低于0
    const newScore = score + change;
    if (newScore < 0) {
      change = -score; // 只扣到0分
      message(`❌ 答错！-${Math.abs(change)} (分数已为0，不再扣分)`, "orange");
    } else {
      message(`❌ 答错！-${Math.abs(change)}`, "orange");
    }

    score = Math.max(0, score + change); // 确保分数不为负

    //  触发键盘控制器检测下一题按钮（错误/超时情况）
    if (window.keyboardController) {
      window.keyboardController.waitForNextQuestion();
    }
    updateStats(true, oldScore, change);
    const levelChange = checkLevelChange();

    if (levelChange === "downgrade") {
      nextBtn.style.display = "none";
      downgradeBtn.style.display = "inline-block";
      const needCooldown = consecutiveWrong >= 3 || totalWrong >= 5;
      if (needCooldown) {
        downgradeBtn.disabled = true;
        // 降级且需要冷却时立即禁用重置
        resetBtn.disabled = true;
        allowReset = false;

        showCorrectAnswer(selectedIndex); //  立即显示正确答案
        startCooldown(COOLDOWN_TIME, "连续答错/超时，冷却中..."); //  立即开始冷却
      } else {
        // 降级但不需要冷却时使用延迟重置
        unlockResetAfterDelay(5000);
        // 确保下一题按钮显示
        nextBtn.style.display = "inline-block";
      }
      showCorrectAnswer(selectedIndex);

      // 降级分支启用统计按钮
      enableStatsButton();

      // 做错题时也要自动滚动到题目位置
      setTimeout(() => {
        scrollToQuestion();
      }, 300);
    } else if (levelChange === "upgrade") {
      nextBtn.style.display = "none";
      upgradeBtn.style.display = "inline-block";
      upgradeBtn.disabled = !!cooldownInterval;
      message(`⚡ 你可以升级到新难度！点击升级按钮`, "blue");
      unlockResetAfterDelay(5000);
      // 确保下一题按钮显示
      nextBtn.style.display = "inline-block";
      // 立即触发键盘控制器检测
      if (window.keyboardController) {
        window.keyboardController.waitForNextQuestion();
      }

      //升级分支启用统计按钮
      enableStatsButton();

      //做错题时也要自动滚动到题目位置
      setTimeout(() => {
        scrollToQuestion();
      }, 300);
    } else {
      // 普通答错情况确保下一题按钮显示
      showAnswerAndCooldown(selectedIndex);
      // 这里已经在 showAnswerAndCooldown 中处理了重置

      // 普通答错分支启用统计按钮
      enableStatsButton();

      //  做错题时也要自动滚动到题目位置
      setTimeout(() => {
        scrollToQuestion();
      }, 300);
    }
  }

  //更新全局状态供排行榜使用
  updateGlobalGameState();

  // 等待统计上报完成
  if (currentQ && currentQ.id) {
    const payload = {
      id: currentQ.id,
      correct: Boolean(correct),
      selected_option:
        typeof selectedOption !== "undefined" ? selectedOption : null,
      answer_time: answerTime,
    };

    console.log(
      `📊 上报题目统计: ID=${currentQ.id}, 用时=${answerTime}秒, 难度=${currentQ.difficulty}`
    );

    try {
      //使用 await 确保统计上报完成
      const response = await fetch("/update_question_stats", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await response.json();
      if (!data.success) {
        console.warn("题目统计上报失败:", data.message || data);
      } else {
        console.log("✅ 题目统计上报成功");
      }
    } catch (err) {
      console.error("题目统计更新错误:", err);
    }
  }
}

function showCorrectAnswer(selectedIndex) {
  if (!currentQ) return;

  if (currentQ.type === "choice") {
    Array.from(optsEl.querySelectorAll("button")).forEach((b) => {
      b.disabled = true;
      b.classList.add("disabled");
    });

    const dbAnsRaw = (currentQ.a || "").toString().trim();
    let correctIndex = -1;

    if (/^[A-Ea-e]$/.test(dbAnsRaw)) {
      correctIndex = dbAnsRaw.toUpperCase().charCodeAt(0) - 65;
    } else {
      const dbNorm = normalizeText(dbAnsRaw);
      currentQ.opts.forEach((opt, i) => {
        if (normalizeText(opt) === dbNorm) correctIndex = i;
      });
    }

    if (correctIndex >= 0 && optsEl.children[correctIndex]) {
      optsEl.children[correctIndex].classList.add("correct");
    }

    message(
      `❌ 正确答案: ${currentQ.opts[correctIndex] || dbAnsRaw}`,
      "orange"
    );

    //    选择题答错时也自动滚动到答案位置
    setTimeout(() => {
      scrollToQuestion();
    }, 300);
  } else if (currentQ.type === "math") {
    answerInput.value = currentQ.a || "";
    answerInput.disabled = true;

    //使用 MathJax 渲染数学答案
    const mathAnswer = renderMathAnswer(currentQ.a);
    message(`❌ 正确答案: ${mathAnswer}`, "orange");

    //重新渲染 MathJax 让数学公式显示正确
    if (window.MathJax && MathJax.typesetPromise) {
      MathJax.typesetPromise([messageEl]);
    }

    // 🆕 数学题答错时也自动滚动
    setTimeout(() => {
      scrollToQuestion();
    }, 300);
  }
}

// ================= 自动滚动到答案位置 =================
function scrollToAnswerPosition() {
  console.log("📜 scrollToAnswerPosition 被调用，重定向到 scrollToQuestion");
  scrollToQuestion(); // 直接调用主滚动函数确保一致性
}

function startCooldown(seconds, reason = "冷却中") {
  locked = true;
  isProcessing = true;
  resetBtn.disabled = true; //冷却开始时立即禁用重置按钮
  allowReset = false; //确保重置不被允许

  // 🆕 冷却期间禁用键盘控制
  if (window.keyboardController) {
    window.keyboardController.setEnabled(false);
  }
  // 禁用所有选项
  Array.from(optsEl.querySelectorAll("button")).forEach((b) => {
    b.disabled = true;
    b.classList.add("disabled");
  });

  // 隐藏所有控制按钮，但保护统计按钮
  nextBtn.style.display = "none";
  upgradeBtn.style.display = "none";
  downgradeBtn.style.display = "none";
  //不要隐藏统计按钮！

  cooldownBar.style.width = "100%";

  // 不要覆盖正确答案消息，而是在原有消息基础上添加冷却信息
  const currentMessage = messageEl.textContent;
  if (currentMessage && currentMessage.includes("正确答案")) {
    // 如果已经有正确答案消息，就保持它，只添加冷却提示
    messageEl.textContent = currentMessage + " | " + reason + "，请稍候...";
  } else {
    // 如果没有正确答案消息，就显示冷却信息
    message(reason + "，请稍候...", "red");
  }

  //冷却开始时确保界面在正确位置
  setTimeout(() => {
    scrollToQuestion();
  }, 100);

  if (cooldownInterval) clearInterval(cooldownInterval);

  let startC = Date.now();
  cooldownInterval = setInterval(() => {
    let elapsed = (Date.now() - startC) / 1000;
    let secLeft = Math.max(0, seconds - elapsed);
    const pct = (secLeft / seconds) * 100;
    cooldownBar.style.width = pct + "%";
    cooldownBar.textContent = Math.ceil(secLeft) + " s";

    if (secLeft <= 0) {
      clearInterval(cooldownInterval);
      cooldownInterval = null;
      cooldownBar.style.width = "0%";
      cooldownBar.textContent = "";

      // 🆕 冷却结束后启用键盘控制
      if (window.keyboardController) {
        window.keyboardController.setEnabled(true);
      }

      // 冷却结束后才允许重置
      allowReset = true;
      resetBtn.disabled = false;

      // 冷却结束后显示按钮，优先升级/降级，但保持统计按钮状态
      if (currentQ) {
        let levelChange = checkLevelChange(); // 再次确认等级变化
        if (levelChange === "upgrade") {
          upgradeBtn.style.display = "inline-block";
          upgradeBtn.disabled = false;
          message("⚡ 冷却结束，请点击升级按钮继续！", "blue");
          // 🆕  升级情况下也显示下一题按钮作为备选
          nextBtn.style.display = "inline-block";
        } else if (levelChange === "downgrade") {
          downgradeBtn.style.display = "inline-block";
          downgradeBtn.disabled = false;
          message("⚠ 冷却结束，请点击降级按钮继续！", "orange");
          // 🆕  升级情况下也显示下一题按钮作为备选
          nextBtn.style.display = "inline-block";
        } else {
          nextBtn.style.display = "inline-block";
          message("✅ 冷却结束，请点击下一题继续！", "green");
        }
        // 🆕  冷却结束后立即触发键盘控制器检测
        if (window.keyboardController) {
          window.keyboardController.waitForNextQuestion();
        }

        //新增：冷却结束后强制启用统计按钮并加载统计
        const showStatsBtn = document.getElementById("showStatsBtn");
        if (showStatsBtn && currentQ) {
          showStatsBtn.disabled = false;
          showStatsBtn.style.pointerEvents = "auto";
          showStatsBtn.style.cursor = "pointer";
          showStatsBtn.style.opacity = "1";
          showStatsBtn.style.display = "inline-block";

          console.log("✅ 冷却结束: 统计按钮已启用");
        }

        //冷却结束后再次确保界面位置正确
        setTimeout(() => {
          scrollToQuestion();
        }, 100);
      } else {
        nextBtn.style.display = "inline-block";
        message("✅ 冷却结束，请点击下一题继续！", "green");
        // 🆕  冷却结束后立即触发键盘控制器检测
        if (window.keyboardController) {
          window.keyboardController.waitForNextQuestion();
        }
      }

      resetBtn.disabled = false;
      isProcessing = false;
      locked = false;
    } else {
      //新增：冷却期间严格禁止重置
      resetBtn.disabled = true;
      allowReset = false;
    }
  }, 200);
}

// =================== 计时器 ===================
function startTimer(seconds) {
  let start = Date.now();
  questionStartTime = Date.now(); //新增：记录题目开始时间

  timerInterval = setInterval(() => {
    let elapsed = (Date.now() - start) / 1000;
    let secLeft = Math.max(0, seconds - elapsed);
    progressBar.style.width = (secLeft / seconds) * 100 + "%";
    progressBar.textContent = Math.ceil(secLeft) + " s";
    if (secLeft <= 0) {
      clearInterval(timerInterval);
      submitAnswer(null);
    }
  }, 200);
}

function stopTimer() {
  if (timerInterval) clearInterval(timerInterval);
  progressBar.style.width = "0%";
  progressBar.textContent = "";
  // ❌ 不要在这里重置 questionStartTime，因为 submitAnswer 还需要它
}

function resetBars() {
  progressBar.style.width = "0%";
  progressBar.textContent = "";
  cooldownBar.style.width = "0%";
  cooldownBar.textContent = "";
}

function showQuestionStats() {
  // 这个函数现在只用于确保数据加载，不控制显示
  const currentQuestion = currentQ || window.currentQuestion;

  if (!currentQuestion || !currentQuestion.id) {
    console.log("无法获取题目数据");
    return;
  }

  const qid = currentQuestion.id;
  console.log("自动加载题目统计，ID:", qid);

  // 使用独立的统计加载函数
  loadQuestionStats(qid);
}

// ================= 修改更新统计函数 =================
function updateStats(displayFullScore = false, oldScore = 0, change = 0) {
  if (displayFullScore) {
    document.getElementById("score").textContent = `${oldScore}${
      change > 0 ? "+" : ""
    }${change}=${score}`;
  } else {
    document.getElementById("score").textContent = score;
  }
  document.getElementById("streak").textContent = streak;
  document.getElementById("mistake").textContent = mistake;
  document.getElementById("answered").textContent = answered;
  document.getElementById("totalCorrect").textContent = totalCorrect;
  document.getElementById("totalWrongOverall").textContent = totalWrongOverall;

  let acc = answered > 0 ? ((totalCorrect / answered) * 100).toFixed(1) : "0.0";
  document.getElementById("accuracy").textContent = acc + "%";
  document.getElementById("level").textContent = "Lv." + level;

  // 🆕 更新右上角我的当前记录
  updateRecordsDisplay();

  // ⚡ 更新全局状态供排行榜使用
  updateGlobalGameState();
}

// ------------------ 重置进度 ------------------
function resetProgress() {
  // 清空所有状态变量
  questions = [];
  currentQ = null;
  score = 0;
  streak = 0;
  mistake = 0;
  answered = 0;
  level = 0;
  consecutiveWrong = 0;
  totalWrong = 0;
  totalCorrect = 0;
  totalWrongOverall = 0;

  // 清空计时器和冷却
  stopTimer();
  if (cooldownInterval) clearInterval(cooldownInterval);
  resetBars();

  // 清空 UI
  qEl.textContent = "";
  optsEl.innerHTML = "";
  mathInputEl.style.display = "none";
  messageEl.textContent = "";
  nextBtn.style.display = "none";
  resetBtn.disabled = false;

  //重置统计按钮状态
  const statsSection = document.getElementById("statsSection");
  const showStatsBtn = document.getElementById("showStatsBtn");
  if (statsSection && showStatsBtn) {
    statsSection.style.display = "none";
    showStatsBtn.disabled = true;
  }

  // 显示开始按钮，隐藏继续按钮
  startBtn.style.display = "inline-block";
  continueBtn.style.display = "none";
  locked = true; // 阻止答题，直到点击开始
}

// 重置游戏（不清最高）
resetBtn.addEventListener("click", () => {
  if (!allowReset) return; // 不允许就直接返回
  resetProgress();
});

let unlockResetTimer = null; // 用于存储定时器

function unlockResetAfterDelay(delay = 5000) {
  allowReset = false;
  resetBtn.disabled = true;

  // 如果之前有未完成的定时器，先清掉
  if (unlockResetTimer) clearTimeout(unlockResetTimer);

  unlockResetTimer = setTimeout(() => {
    allowReset = true;
    resetBtn.disabled = false;
    unlockResetTimer = null; // 清掉引用
  }, delay);
}

function unlockResetImmediate() {
  allowReset = true;
  resetBtn.disabled = false;

  // 如果之前有定时器，也清掉
  if (unlockResetTimer) {
    clearTimeout(unlockResetTimer);
    unlockResetTimer = null;
  }
}

// 在 startBtn 点击事件中启用键盘控制
startBtn.addEventListener("click", () => {
  startBtn.style.display = "none";
  continueBtn.style.display = "none";
  locked = false;

  // 🆕 启用键盘控制
  if (window.keyboardController) {
    window.keyboardController.setEnabled(true);
  }

  // 🆕 开始排行榜会话
  if (window.leaderboardManager) {
    window.leaderboardManager.startSession();
  }

  // 🆕 初始化全局游戏状态
  updateGlobalGameState();

  fetchQuestionsAndStart(() => {
    // 🆕 题目加载完成后延迟自动滚动
    setTimeout(() => {
      scrollToQuestion();
    }, 400);
  });
});

// continueBtn 只在非锁定状态下可点击
continueBtn.addEventListener("click", () => {
  if (!locked) {
    nextQuestion();
  }
});

// 回车提交数学题
answerInput.addEventListener("keydown", (e) => {
  if (e.key === "Enter" && currentQ && currentQ.type === "math") {
    submitAnswer(-1); // -1 表示数学题，避免 null 判断混乱
  }
});

// ================= 防作弊保护 =================
function initAntiCheat() {
  // 禁止右键菜单
  document.addEventListener("contextmenu", function (e) {
    const target = e.target || e.srcElement;
    if (target.closest && target.closest(".container")) {
      e.preventDefault();
      showTempMessage("❌ 禁止复制题目内容");
      return false;
    }
  });

  // 禁止选择文本
  document.addEventListener("selectstart", function (e) {
    const target = e.target || e.srcElement;
    if (
      target.closest &&
      (target.closest(".question") || target.closest(".options"))
    ) {
      e.preventDefault();
      return false;
    }
  });

  // 禁止复制快捷键（但允许在输入框内使用）
  document.addEventListener("keydown", function (e) {
    if ((e.ctrlKey || e.metaKey) && e.key === "c") {
      const activeElement = document.activeElement;
      const isInInput =
        activeElement &&
        activeElement.closest("input, textarea, [contenteditable]");
      if (!isInInput) {
        e.preventDefault();
        showTempMessage("❌ 禁止复制题目内容");
        return false;
      }
    }
  });

  // 禁止拖拽
  document.addEventListener("dragstart", function (e) {
    const target = e.target || e.srcElement;
    if (
      target.closest &&
      (target.closest(".question") || target.closest(".options"))
    ) {
      e.preventDefault();
      return false;
    }
  });
}

// 显示临时提示消息
function showTempMessage(text) {
  const tempMsg = document.createElement("div");
  tempMsg.textContent = text;
  tempMsg.style.cssText = `
        position: fixed;
        top: 50%;
        left: 50%;
        transform: translate(-50%, -50%);
        background: rgba(255,0,0,0.9);
        color: white;
        padding: 10px 20px;
        border-radius: 5px;
        z-index: 10000;
        font-size: 16px;
    `;
  document.body.appendChild(tempMsg);

  setTimeout(() => {
    document.body.removeChild(tempMsg);
  }, 2000);
}

// ================= 简化的数学答案渲染 =================
function renderMathAnswer(answer) {
  if (!answer) return "";

  // 如果是纯数字或简单表达式，直接返回
  if (/^[\d\s\.\+\-\*\/\(\)=,]+$/.test(answer)) {
    return answer;
  }

  // 对于包含数学符号的答案，用 MathJax 包装
  return `\\(${answer}\\)`;
}

// ================= 修改页面加载逻辑 =================
document.addEventListener("DOMContentLoaded", function () {
  console.log("DOMContentLoaded事件触发");

  // 添加全局错误监听
  window.addEventListener("error", function (e) {
    console.error("🛑 全局错误:", e.error);
  });

  // 1. 初始化游戏状态
  updateStats();
  locked = true;
  startBtn.style.display = "inline-block";
  continueBtn.style.display = "none";

  // 2. 检查用户登录状态
  checkLoginStatus();

  // 3. 初始化防作弊
  initAntiCheat();

  // 🆕 4. 从排行榜获取全局最高记录
  fetchGlobalRecordsFromLeaderboard();

  //5.  初始化统计按钮状态
  const statsSection = document.getElementById("statsSection");
  const showStatsBtn = document.getElementById("showStatsBtn");

  if (statsSection && showStatsBtn) {
    statsSection.style.display = "none";
    showStatsBtn.disabled = true;
    showStatsBtn.style.display = "inline-block";
    showStatsBtn.onclick = toggleStats;
    console.log("已绑定 showStatsBtn 点击事件到 toggleStats");
  } else {
    console.warn("未找到统计按钮相关元素");
  }

  initKeyboardController();

  console.log("所有初始化完成");

  // 🆕 延迟初始化排行榜，确保游戏状态变量已设置
  setTimeout(() => {
    if (window.leaderboardManager) {
      window.leaderboardManager.init();
      console.log("✅ 排行榜系统初始化完成");

      // 🆕 排行榜初始化后再次刷新全局记录
      setTimeout(() => {
        fetchGlobalRecordsFromLeaderboard();
      }, 1000);
    }
  }, 500);

  // 🆕 延迟检查管理员状态
  setTimeout(checkAdminStatus, 2000);
});

// ================= 导出全局变量供排行榜使用 =================
// 确保排行榜可以访问游戏状态变量
window.score = score;
window.maxStreakDuringGame = maxStreakDuringGame;
window.answered = answered;
window.totalCorrect = totalCorrect;

// 创建一个函数来更新这些全局变量（在游戏状态变化时调用）
function updateGlobalGameState() {
  window.score = score;
  window.maxStreakDuringGame = maxStreakDuringGame;
  window.answered = answered;
  window.totalCorrect = totalCorrect;
}

// 在 updateStats 函数中调用这个更新函数
const originalUpdateStats = updateStats;
updateStats = function (displayFullScore = false, oldScore = 0, change = 0) {
  originalUpdateStats(displayFullScore, oldScore, change);
  updateGlobalGameState(); // 更新全局状态
};

// 在游戏重置时也更新全局状态
const originalFinalizeAndReset = finalizeAndReset;
finalizeAndReset = function () {
  originalFinalizeAndReset();
  updateGlobalGameState(); // 重置后更新全局状态
};

// 初始导出
updateGlobalGameState();

// ================= 修复键盘控制器 =================
class KeyboardController {
  constructor() {
    this.isKeyboardEnabled = true;
    this.lastKeyPressTime = 0;
    this.keyPressCooldown = 100; // 🆕 减少冷却时间，让响应更快
    this.currentOptionIndex = -1;

    // 🆕  简化状态管理
    this.answerSubmitted = false;
    this.waitingForNext = false;
    this.lastEnterPressTime = 0;
    this.enterCooldown = 800; // 防连续回车

    this.init();
  }

  init() {
    document.addEventListener("keydown", (e) => this.handleKeyPress(e));
    console.log("🎮 键盘控制器已初始化");
  }

  handleKeyPress(event) {
    if (!this.isKeyboardEnabled) return;

    // 在选择题模式下阻止上下键的默认行为（滚动网页）
    if (
      event.key === "ArrowUp" ||
      event.key === "ArrowDown" ||
      event.key === "w" ||
      event.key === "W" ||
      event.key === "s" ||
      event.key === "S"
    ) {
      const options = document.getElementById("options");
      if (options && options.children.length > 0) {
        // 如果有选择题选项，阻止默认行为（防止滚动）
        event.preventDefault();
      }
    }

    // 移除方向键的冷却时间限制，让选择更流畅
    const isNavigationKey =
      event.key === "ArrowUp" ||
      event.key === "ArrowDown" ||
      event.key === "w" ||
      event.key === "W" ||
      event.key === "s" ||
      event.key === "S" ||
      event.key === "1" ||
      event.key === "2" ||
      event.key === "3" ||
      event.key === "4" ||
      event.key === "5";

    // 只有非导航键才检查冷却时间
    if (!isNavigationKey) {
      const currentTime = Date.now();
      if (currentTime - this.lastKeyPressTime < this.keyPressCooldown) {
        return;
      }
      this.lastKeyPressTime = currentTime;
    }

    // 检查是否在输入框中
    if (this.isInInputField(event.target)) {
      // 数学题输入框允许回车提交
      if (event.key === "Enter" && event.target.id === "answerInput") {
        return; // 让原生的数学题回车处理
      }
      return;
    }

    switch (event.key) {
      case "Enter":
        this.handleEnterKey(event);
        break;
      case "ArrowUp":
      case "w":
      case "W":
        this.handleUpKey();
        break;
      case "ArrowDown":
      case "s":
      case "S":
        this.handleDownKey();
        break;
      case "1":
      case "2":
      case "3":
      case "4":
      case "5":
        this.handleNumberKey(event.key);
        break;
    }

    // 🆕 导航键也需要更新时间戳，但不受冷却限制
    if (isNavigationKey) {
      this.lastKeyPressTime = Date.now();
    }
  }

  handleEnterKey(event) {
    const currentTime = Date.now();

    // 🆕  防连续回车检查
    if (currentTime - this.lastEnterPressTime < this.enterCooldown) {
      console.log("⏸️ 回车冷却中，忽略");
      return;
    }
    this.lastEnterPressTime = currentTime;

    console.log("⌨️ 回车键按下", {
      已提交答案: this.answerSubmitted,
      等待下一题: this.waitingForNext,
      游戏锁定: window.locked,
      处理中: window.isProcessing,
    });

    // 检查当前游戏状态
    if (window.locked || window.isProcessing) {
      console.log("⏸️ 游戏锁定或处理中，忽略回车");
      return;
    }

    // 🆕  使用多种方法查找下一题按钮
    let nextBtn = null;
    const allButtons = document.querySelectorAll("button");
    nextBtn = Array.from(allButtons).find(
      (btn) =>
        btn.textContent === "下一题" &&
        btn.style.display !== "none" &&
        !btn.disabled
    );

    // 🆕 优先检查下一题按钮（所有情况）
    if (nextBtn) {
      console.log("⏭️ 检测到下一题按钮，触发下一题");
      event.preventDefault();
      this.resetAnswerState();
      nextBtn.click();
      return;
    }

    // 🆕 第一阶段：提交答案（如果还没提交）
    if (!this.answerSubmitted && !this.waitingForNext) {
      const mathInput = document.getElementById("mathInput");
      const options = document.getElementById("options");
      const startBtn = document.getElementById("startBtn");

      // 数学题：直接提交答案
      if (mathInput && mathInput.style.display !== "none") {
        console.log("🧮 第一阶段：数学题回车提交");
        event.preventDefault();
        this.submitMathAnswer();
        return;
      }

      // 选择题：如果有选中的选项，提交答案
      if (options && this.currentOptionIndex >= 0) {
        console.log(
          "🔘 第一阶段：选择题回车提交选项:",
          this.currentOptionIndex
        );
        event.preventDefault();
        this.submitChoiceAnswer();
        return;
      }

      // 开始按钮
      if (startBtn && startBtn.style.display !== "none") {
        console.log("🎯 第一阶段：回车开始游戏");
        event.preventDefault();
        startBtn.click();
        return;
      }
    }

    console.log("❌ 回车键无可用操作");
  }

  handleUpKey() {
    console.log("⬆️ 上键按下");
    this.navigateOptions(-1);
  }

  handleDownKey() {
    console.log("⬇️ 下键按下");
    this.navigateOptions(1);
  }

  handleNumberKey(number) {
    const num = parseInt(number);
    console.log(`🔢 数字键 ${num} 按下`);

    const options = document.getElementById("options");
    if (!options) return;

    const optionButtons = options.querySelectorAll("button");
    if (num >= 1 && num <= optionButtons.length) {
      this.currentOptionIndex = num - 1;
      this.highlightCurrentOption();
    }
  }

  navigateOptions(direction) {
    const options = document.getElementById("options");
    if (!options) return;

    const optionButtons = options.querySelectorAll("button");
    if (optionButtons.length === 0) return;

    // 计算新的索引
    if (this.currentOptionIndex === -1) {
      this.currentOptionIndex = direction > 0 ? 0 : optionButtons.length - 1;
    } else {
      this.currentOptionIndex += direction;
      if (this.currentOptionIndex < 0)
        this.currentOptionIndex = optionButtons.length - 1;
      if (this.currentOptionIndex >= optionButtons.length)
        this.currentOptionIndex = 0;
    }

    this.highlightCurrentOption();
  }

  highlightCurrentOption() {
    const options = document.getElementById("options");
    if (!options) return;

    const optionButtons = options.querySelectorAll("button");

    // 移除所有高亮
    optionButtons.forEach((btn) => {
      btn.style.background = "";
      btn.style.borderColor = "";
      btn.style.fontWeight = "normal";
    });

    // 高亮当前选项
    if (
      this.currentOptionIndex >= 0 &&
      this.currentOptionIndex < optionButtons.length
    ) {
      const currentBtn = optionButtons[this.currentOptionIndex];
      currentBtn.style.background = "#e3f2fd";
      currentBtn.style.borderColor = "#2196F3";
      currentBtn.style.fontWeight = "bold";

      // 滚动到可见区域
      currentBtn.scrollIntoView({ behavior: "smooth", block: "nearest" });
    }
  }

  submitMathAnswer() {
    const answerInput = document.getElementById("answerInput");
    if (!answerInput) return;

    console.log("✅ 提交数学答案");

    // 🆕  立即设置提交状态，不要等待下一题检测
    this.answerSubmitted = true;

    if (window.submitAnswer) {
      window.submitAnswer(-1); // -1 表示数学题
    }

    // 🆕  立即开始等待下一题，不要延迟
    this.waitForNextQuestion();
  }

  submitChoiceAnswer() {
    const options = document.getElementById("options");
    if (!options) return;

    const optionButtons = options.querySelectorAll("button");
    if (
      this.currentOptionIndex >= 0 &&
      this.currentOptionIndex < optionButtons.length
    ) {
      console.log("✅ 提交选项:", this.currentOptionIndex);

      // 🆕 设置答案提交状态
      this.setAnswerSubmitted();

      optionButtons[this.currentOptionIndex].click();
    }
  }

  // 🆕 设置答案提交状态
  setAnswerSubmitted() {
    this.answerSubmitted = true;
    console.log("✅ 答案已提交，等待结果...");

    // 监听答案结果，当显示下一题按钮时进入等待下一题状态
    this.waitForNextQuestion();
  }

  // 🆕 等待下一题按钮出现（所有题目类型）
  waitForNextQuestion() {
    // 清除之前的检查
    if (this.nextCheckInterval) {
      clearInterval(this.nextCheckInterval);
    }

    console.log("⏳ 开始等待下一题按钮出现...");

    // 🆕  立即检查一次，避免延迟
    if (this.checkNextButton()) {
      return; // 如果立即找到了，就不需要设置间隔
    }

    this.nextCheckInterval = setInterval(() => {
      if (this.checkNextButton()) {
        clearInterval(this.nextCheckInterval);
        this.nextCheckInterval = null;
      }
    }, 100);
  }

  // 🆕 新增：检查下一题按钮的独立方法
  checkNextButton() {
    // 🆕  使用多种方法查找下一题按钮
    let nextBtn = null;

    // 方法1：通过样式查找
    nextBtn = document.querySelector('button[style*="display: inline-block"]');
    if (nextBtn && nextBtn.textContent === "下一题" && !nextBtn.disabled) {
      console.log("⏰ 下一题按钮出现（方法1），可以按回车继续");
      this.waitingForNext = true;
      this.answerSubmitted = false;

      // 🆕 添加视觉提示
      this.showNextPrompt();
      return true;
    }

    // 方法2：通过类名查找
    const allButtons = document.querySelectorAll("button");
    nextBtn = Array.from(allButtons).find(
      (btn) =>
        btn.textContent === "下一题" &&
        btn.style.display !== "none" &&
        !btn.disabled
    );

    if (nextBtn) {
      console.log("⏰ 下一题按钮出现（方法2），可以按回车继续");
      this.waitingForNext = true;
      this.answerSubmitted = false;

      // 🆕 添加视觉提示
      this.showNextPrompt();
      return true;
    }

    return false;
  }

  // 🆕 显示下一题提示
  showNextPrompt() {
    const nextBtn = document.querySelector(
      'button[style*="display: inline-block"]'
    );
    if (nextBtn && nextBtn.textContent === "下一题") {
      // 添加闪烁效果提示
      let blinkCount = 0;
      const originalBoxShadow = nextBtn.style.boxShadow;
      const blinkInterval = setInterval(() => {
        nextBtn.style.boxShadow =
          blinkCount % 2 === 0 ? "0 0 15px #4CAF50" : originalBoxShadow;
        blinkCount++;
        if (blinkCount >= 6) {
          // 闪烁3次
          clearInterval(blinkInterval);
          nextBtn.style.boxShadow = originalBoxShadow;
        }
      }, 300);
    }
  }

  // 🆕 重置答案状态（当开始新题目时调用）
  resetAnswerState() {
    this.answerSubmitted = false;
    this.waitingForNext = false;

    // 清除检查间隔
    if (this.nextCheckInterval) {
      clearInterval(this.nextCheckInterval);
      this.nextCheckInterval = null;
    }

    console.log("🔄 重置键盘状态，准备新题目");
  }

  // 🆕 重置选项选择（当新题目出现时调用）
  resetOptionSelection() {
    this.currentOptionIndex = -1;
    console.log("🔄 重置选项选择");
  }

  // 🆕 在游戏开始时重置状态
  setEnabled(enabled) {
    this.isKeyboardEnabled = enabled;
    if (enabled) {
      this.resetAnswerState(); // 游戏开始时重置状态
    }
    console.log(`🎮 键盘控制 ${enabled ? "启用" : "禁用"}`);
  }

  isInInputField(element) {
    return element.tagName === "INPUT" || element.tagName === "TEXTAREA";
  }
}

function initKeyboardController() {
  // 如果已经存在键盘控制器，就不重复创建
  if (window.keyboardController) {
    console.log("✅ 键盘控制器已存在");
    return;
  }

  window.keyboardController = new KeyboardController();
  console.log("✅ 键盘控制器初始化完成");

  // 初始状态：禁用（等待游戏开始）
  window.keyboardController.setEnabled(false);
}

// ================= 管理员功能 =================
// 显示/隐藏管理员图标
function checkAdminStatus() {
  const currentUsernameEl = document.getElementById("currentUsername");
  const currentUser = currentUsernameEl ? currentUsernameEl.textContent : "";
  const adminIcon = document.getElementById("adminIcon");

  // 与后端保持一致的管理员用户列表
  const adminUsers = ["admin", "administrator"];

  console.log("🔍 检查管理员状态:", {
    currentUser,
    isAdmin: adminUsers.includes(currentUser.toLowerCase()),
  });

  if (adminIcon && adminUsers.includes(currentUser.toLowerCase())) {
    adminIcon.style.display = "inline-block";
    console.log("✅ 显示管理员图标");
  } else if (adminIcon) {
    adminIcon.style.display = "none";
    console.log("❌ 隐藏管理员图标");
  }
}

// 显示管理员面板
function showAdminPanel() {
  const adminPanel = document.getElementById("adminPanel");
  const adminOverlay = document.getElementById("adminOverlay");
  if (adminPanel && adminOverlay) {
    adminPanel.style.display = "block";
    adminOverlay.style.display = "block";
    // 清空之前的结果
    const cleanupResult = document.getElementById("cleanupResult");
    if (cleanupResult) cleanupResult.textContent = "";
  }
}

// 隐藏管理员面板
function hideAdminPanel() {
  const adminPanel = document.getElementById("adminPanel");
  const adminOverlay = document.getElementById("adminOverlay");
  if (adminPanel && adminOverlay) {
    adminPanel.style.display = "none";
    adminOverlay.style.display = "none";
  }
}

// 清理排行榜函数
async function cleanupLeaderboard() {
  const resultEl = document.getElementById("cleanupResult");
  if (!resultEl) return;

  resultEl.textContent = "🔄 清理中...";
  resultEl.style.color = "blue";

  try {
    const response = await fetch("/admin/cleanup_leaderboard_manual");
    const data = await response.json();

    if (data.success) {
      resultEl.textContent = "✅ " + data.message;
      resultEl.style.color = "green";
    } else {
      resultEl.textContent = "❌ " + data.message;
      resultEl.style.color = "red";
    }
  } catch (error) {
    resultEl.textContent = "❌ 请求失败: " + error.message;
    resultEl.style.color = "red";
  }
}

// 保留前10名函数
async function keepTop10Only() {
  const resultEl = document.getElementById("cleanupResult");
  if (!resultEl) return;

  resultEl.textContent = "🔄 正在强制保留前10名记录...";
  resultEl.style.color = "blue";

  try {
    const response = await fetch("/admin/keep_top10_only");
    const data = await response.json();

    if (data.success) {
      resultEl.innerHTML = "✅ " + data.message;
      resultEl.style.color = "green";

      // 如果有详细信息，也显示出来
      if (data.details) {
        resultEl.innerHTML +=
          "<br><small>" + data.details.join(" | ") + "</small>";
      }
    } else {
      resultEl.textContent = "❌ " + data.message;
      resultEl.style.color = "red";
    }
  } catch (error) {
    resultEl.textContent = "❌ 请求失败: " + error.message;
    resultEl.style.color = "red";
  }
}

// 在 LeaderboardManager 类外添加
function updateAdminPanelWithNewCriteria() {
  const adminPanel = document.getElementById("adminPanel");
  if (!adminPanel) return;

  const cleanupBtn = adminPanel.querySelector(
    'button[onclick="cleanupLeaderboard()"]'
  );
  if (cleanupBtn && !adminPanel.querySelector(".admin-criteria-new")) {
    const criteriaHtml = `
            <div class="admin-criteria-new" style="
                background: #fff3cd;
                border-left: 4px solid #ffc107;
                padding: 12px;
                margin: 10px 0;
                font-size: 12px;
                border-radius: 4px;
                line-height: 1.4;
            ">
                <strong>📋 当前上榜标准（新）：</strong><br>
                • <strong>统一要求：答题数 ≥ 30</strong><br>
                • 分数榜：≥ 100分<br>
                • 连对榜：≥ 10连对<br>
                • 正确率榜：≥ 70%正确率
            </div>
        `;
    cleanupBtn.insertAdjacentHTML("beforebegin", criteriaHtml);
  }
}

// 修改显示管理员面板的函数
const originalShowAdminPanel = showAdminPanel;
showAdminPanel = function () {
  originalShowAdminPanel();
  setTimeout(updateAdminPanelWithNewCriteria, 100);
};
