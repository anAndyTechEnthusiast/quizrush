// =================== 排行榜系统 ===================
class LeaderboardManager {
  constructor() {
    this.currentSessionId = null;
    this.isSessionActive = false;
    this.inactivityTimer = null;
    this.currentActiveTab = "score";
  }

  // 初始化排行榜系统
  init() {
    console.log("🎮 初始化排行榜系统");
    this.createLeaderboardButton();
    this.initSessionManagement();
    this.modifyResetButton();
  }

  // 创建排行榜按钮
  createLeaderboardButton() {
    // 找到标题容器
    const header = document.querySelector(".container h1");
    if (!header) {
      console.error("找不到标题元素");
      return;
    }

    // 设置标题容器为flex布局
    header.style.display = "flex";
    header.style.justifyContent = "center"; // 文字居中
    header.style.alignItems = "center";
    header.style.position = "relative"; // 相对定位

    // 创建排行榜按钮
    const leaderboardBtn = document.createElement("button");
    leaderboardBtn.innerHTML = "🏆 排行榜";
    leaderboardBtn.className = "small";
    leaderboardBtn.style.position = "absolute"; //  绝对定位
    leaderboardBtn.style.right = "0"; // 靠右对齐
    leaderboardBtn.onclick = () => this.showLeaderboard();

    // 插入按钮
    header.appendChild(leaderboardBtn);

    console.log("✅ 排行榜按钮创建成功");
  }

  // 初始化会话管理
  initSessionManagement() {
    // 尝试从 localStorage 恢复 session_id
    const savedSessionId = localStorage.getItem("currentSessionId");

    if (savedSessionId && this.validateSessionId(savedSessionId)) {
      this.currentSessionId = savedSessionId;
      console.log("🔄 恢复之前的会话ID:", this.currentSessionId);
    } else {
      // 生成新的会话ID
      this.currentSessionId =
        "session_" + Date.now() + "_" + Math.random().toString(36).substr(2, 9);
      localStorage.setItem("currentSessionId", this.currentSessionId);
      console.log("🆔 生成新会话ID:", this.currentSessionId);
    }

    // 监听用户活动
    this.setupActivityListeners();
  }

  // 设置活动监听器（用于自动结束）
  setupActivityListeners() {
    const activities = ["click", "keypress", "mousemove", "scroll"];
    activities.forEach((event) => {
      document.addEventListener(event, () => this.resetInactivityTimer());
    });

    // 初始启动计时器
    this.resetInactivityTimer();
  }

  // 重置无活动计时器
  resetInactivityTimer() {
    if (this.inactivityTimer) {
      clearTimeout(this.inactivityTimer);
    }

    // 10分钟无活动自动结束
    this.inactivityTimer = setTimeout(() => {
      if (this.isSessionActive) {
        console.log("⏰ 10分钟无活动，自动结束游戏");
        this.autoEndSession();
      }
    }, 10 * 60 * 1000); // 10分钟
  }

  // ================= 添加上榜标准说明 =================
  addLeaderboardCriteria() {
    const content = document.getElementById("leaderboardContent");
    if (!content) return;

    //   先移除可能存在的旧标准说明
    const existingCriteria = content.querySelector(".leaderboard-criteria");
    if (existingCriteria) {
      existingCriteria.remove();
    }

    const activeTab = this.getActiveTabType();
    let criteriaText = "";
    let criteriaDetails = "";

    switch (activeTab) {
      case "score":
        criteriaText = "🎯 上榜标准：答题数 ≥ 30 且 分数 ≥ 100分";
        criteriaDetails = "• 必须完成至少30题<br>• 分数达到100分以上";
        break;
      case "streak":
        criteriaText = "🎯 上榜标准：答题数 ≥ 30 且 最高连对 ≥ 10";
        criteriaDetails = "• 必须完成至少30题<br>• 最高连对达到10次以上";
        break;
      case "accuracy":
        criteriaText = "🎯 上榜标准：答题数 ≥ 30 且 正确率 ≥ 70%";
        criteriaDetails = "• 必须完成至少30题<br>• 正确率达到70%以上";
        break;
    }

    const criteriaHtml = `
        <div class="leaderboard-criteria" style="
            background: #f8f9fa;
            border-left: 4px solid #4CAF50;
            padding: 12px;
            margin: 10px 0;
            border-radius: 6px;
            font-size: 13px;
            line-height: 1.4;
        ">
            <div style="font-weight: bold; margin-bottom: 5px; color: #2c3e50;">
                ${criteriaText}
            </div>
            <div style="color: #666; font-size: 12px;">
                ${criteriaDetails}
            </div>
        </div>
    `;

    // 插入到排行榜表格之前
    const table = content.querySelector("table");
    if (table) {
      table.insertAdjacentHTML("beforebegin", criteriaHtml);
    } else {
      // 如果没有表格，插入到内容顶部
      content.insertAdjacentHTML("afterbegin", criteriaHtml);
    }
  }

  getActiveTabType() {
    //   直接返回存储的类型
    return this.currentActiveTab || "score";
  }

  // 开始游戏会话
  async startSession() {
    if (this.isSessionActive) return;

    try {
      //   调试：检查游戏状态
      console.log("🎮 开始会话前的游戏状态:", {
        score: window.score,
        streak: window.streak,
        answered: window.answered,
        totalCorrect: window.totalCorrect,
        maxStreak: window.maxStreakDuringGame, //    改为 maxStreakDuringGame
      });

      const response = await fetch("/api/session/start", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ session_id: this.currentSessionId }),
      });

      const data = await response.json();
      if (data.success) {
        this.isSessionActive = true;
        console.log("🎯 游戏会话开始:", this.currentSessionId);

        // 更新question_stats记录，关联session_id
        this.patchQuestionStatsAPI();
      }
    } catch (error) {
      console.error("❌ 开始会话失败:", error);
    }
  }

  // 修补question_stats API以包含session_id
  patchQuestionStatsAPI() {
    const originalFetch = window.fetch;
    window.fetch = function (...args) {
      if (args[0] === "/update_question_stats" && args[1]?.method === "POST") {
        try {
          const body = JSON.parse(args[1].body);
          body.session_id = window.leaderboardManager.currentSessionId;
          args[1].body = JSON.stringify(body);
          console.log("📝 更新题目统计，添加session_id:", body.session_id);
        } catch (e) {
          console.error("修补请求失败:", e);
        }
      }
      return originalFetch.apply(this, args);
    };
  }

  // 自动结束会话
  async autoEndSession() {
    if (!this.isSessionActive) return;

    console.log("🤖 自动结束会话");
    await this.endSession(true);

    // 显示提示
    if (window.message) {
      window.message("⏰ 长时间无操作，游戏已自动结束并记录成绩", "orange");
    }
  }

  // 手动结束会话
  async manualEndSession() {
    return new Promise((resolve) => {
      // 显示确认对话框
      const confirmed = confirm(
        "确定要结束本轮游戏吗？成绩将被记录并参与排行榜排名"
      );
      if (confirmed) {
        console.log("👤 用户手动结束会话");
        this.endSession(false).then((success) => {
          if (success) {
            //    只有成功结束后才重置游戏
            console.log("✅ 会话成功结束，准备重置游戏");
            if (window.finalizeAndReset) {
              window.finalizeAndReset();
            }
            resolve(true);
          } else {
            //    结束失败时不清除游戏状态
            console.log("❌ 结束会话失败，保持游戏状态");
            if (window.message) {
              window.message("❌ 成绩提交失败，游戏继续", "red");
            }
            resolve(false);
          }
        });
      } else {
        console.log("👤 用户取消结束会话");
        //    用户取消时，什么都不做，保持当前游戏状态
        if (window.message) {
          window.message("⏸️ 取消结束，游戏继续", "blue");
        }
        resolve(false);
      }
    });
  }

  // 结束会话（修复数据传递问题）
  async endSession(isAuto = false) {
    if (!this.isSessionActive) {
      console.log("⚠️ 会话未激活，无需结束");
      return false;
    }

    try {
      //  添加数据完整性检查
      if (!this.validateGameData()) {
        throw new Error("游戏数据不完整，无法提交排行榜");
      }
      //    确保全局变量存在且有默认值
      const gameState = {
        score: typeof window.score !== "undefined" ? window.score : 0,
        maxStreakDuringGame:
          typeof window.maxStreakDuringGame !== "undefined"
            ? window.maxStreakDuringGame
            : 0,
        answered: typeof window.answered !== "undefined" ? window.answered : 0,
        totalCorrect:
          typeof window.totalCorrect !== "undefined" ? window.totalCorrect : 0,
      };

      const gameData = {
        session_id: this.currentSessionId,
        final_score: parseInt(gameState.score) || 0,
        max_streak: parseInt(gameState.maxStreakDuringGame) || 0,
        total_answered: parseInt(gameState.answered) || 0,
        total_correct: parseInt(gameState.totalCorrect) || 0,
      };

      console.log("📊 提交成绩数据:", gameData);
      console.log("🎯 游戏状态调试:", gameState);

      //   添加数据验证
      if (
        isNaN(gameData.final_score) ||
        isNaN(gameData.max_streak) ||
        isNaN(gameData.total_answered) ||
        isNaN(gameData.total_correct)
      ) {
        throw new Error("游戏数据格式错误，请重新开始游戏");
      }

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 10000);

      console.log("🔄 发送请求到 /api/session/end");
      const response = await fetch("/api/session/end", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(gameData),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      console.log("📨 收到响应，状态:", response.status);

      if (!response.ok) {
        let errorDetail = "";
        try {
          const errorData = await response.json();
          errorDetail = errorData.message || `HTTP ${response.status}`;
          console.log("❌ 服务器返回错误:", errorData);
        } catch {
          errorDetail = `HTTP ${response.status}: ${response.statusText}`;
        }
        throw new Error(errorDetail);
      }

      const data = await response.json();
      console.log("✅ 服务器响应数据:", data);

      if (data.success) {
        this.isSessionActive = false;
        console.log("✅ 成绩提交成功");

        //  会话结束后清理本地存储
        localStorage.removeItem("currentSessionId");
        console.log("🗑️ 清理本地会话存储");

        if (!isAuto && window.message) {
          window.message("✅ 成绩已记录！可以去排行榜查看排名", "green");
        }
        return true;
      } else {
        throw new Error(data.message || "服务器返回失败状态");
      }
    } catch (error) {
      console.error("❌ 结束会话失败:", error);

      let errorMsg = "成绩提交失败，请重试";
      if (error.name === "AbortError") {
        errorMsg = "请求超时，请检查网络连接";
      } else if (error.message.includes("404")) {
        errorMsg = "服务器接口不存在";
      } else if (error.message.includes("500")) {
        errorMsg = "服务器内部错误";
      } else if (error.message.includes("NetworkError")) {
        errorMsg = "网络连接失败";
      } else {
        errorMsg = `提交失败: ${error.message}`;
      }

      console.error("🔍 详细错误:", errorMsg);

      if (!isAuto && window.message) {
        window.message(`❌ ${errorMsg}`, "red");
      }

      return false;
    }
  }

  // 验证会话ID格式
  validateSessionId(sessionId) {
    return (
      sessionId && sessionId.startsWith("session_") && sessionId.length > 20
    );
  }
  // 验证游戏数据的完整性
  validateGameData() {
    const gameState = {
      score: typeof window.score !== "undefined" ? window.score : 0,
      maxStreakDuringGame:
        typeof window.maxStreakDuringGame !== "undefined"
          ? window.maxStreakDuringGame
          : 0,
      answered: typeof window.answered !== "undefined" ? window.answered : 0,
      totalCorrect:
        typeof window.totalCorrect !== "undefined" ? window.totalCorrect : 0,
    };

    // 确保关键数据有效
    return (
      !isNaN(gameState.score) &&
      !isNaN(gameState.maxStreakDuringGame) &&
      !isNaN(gameState.answered) &&
      !isNaN(gameState.totalCorrect)
    );
  }
  //--------------------------------------------------------------------------

  // 显示排行榜模态框
  async showLeaderboard(type = "score") {
    console.log("📊 显示排行榜:", type);

    // 创建模态框
    const modal = this.createLeaderboardModal();

    //    等待模态框完全添加到DOM后再加载数据
    document.body.appendChild(modal);

    setTimeout(() => {
      this.loadLeaderboardData(type);
    }, 100);
  }

  // 创建排行榜模态框
  createLeaderboardModal() {
    // 移除已存在的模态框
    const existingModal = document.getElementById("leaderboardModal");
    if (existingModal) {
      document.body.removeChild(existingModal);
    }

    const modal = document.createElement("div");
    modal.id = "leaderboardModal";
    modal.style.cssText = `
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background: rgba(0,0,0,0.8);
            display: flex;
            justify-content: center;
            align-items: center;
            z-index: 10000;
        `;

    const modalContent = document.createElement("div");
    modalContent.style.cssText = `
            background: white;
            padding: 20px;
            border-radius: 10px;
            width: 80%;
            max-width: 600px;
            max-height: 80vh;
            overflow: hidden;
            position: relative;
        `;

    // 在标题下方添加总体说明
    const overallCriteria = document.createElement("div");
    overallCriteria.style.cssText = `
        text-align: center;
        color: #666;
        font-size: 13px;
        margin: -10px 0 15px 0;
        padding: 8px;
        background: #f8f9fa;
        border-radius: 4px;
        border: 1px solid #e9ecef;
    `;
    overallCriteria.innerHTML = `
        <strong>📋 所有榜单统一要求：完成至少30题</strong>
    `;

    // 关闭按钮
    const closeBtn = document.createElement("button");
    closeBtn.innerHTML = "×";
    closeBtn.style.cssText = `
            position: absolute;
            top: 10px;
            right: 15px;
            background: none;
            border: none;
            font-size: 24px;
            cursor: pointer;
            color: #666;
        `;
    closeBtn.onclick = () => document.body.removeChild(modal);

    // 标题
    const title = document.createElement("h2");
    title.textContent = "🏆 排行榜";
    title.style.textAlign = "center";
    title.style.marginBottom = "20px";

    // 标签页
    const tabs = this.createLeaderboardTabs();

    // 内容区域
    const content = document.createElement("div");
    content.id = "leaderboardContent";
    content.style.cssText = `
            max-height: 50vh;
            overflow-y: auto;
            margin-top: 15px;
        `;

    // 组装
    modalContent.appendChild(closeBtn);
    modalContent.appendChild(title);
    modalContent.appendChild(overallCriteria);
    modalContent.appendChild(tabs);
    modalContent.appendChild(content);
    modal.appendChild(modalContent);

    return modal;
  }

  // ================= 更好的方法：直接在点击时记录类型 =================
  // 修改 createLeaderboardTabs 方法，添加数据属性
  createLeaderboardTabs() {
    const tabsContainer = document.createElement("div");
    tabsContainer.style.cssText = `
        display: flex;
        border-bottom: 2px solid #eee;
        margin-bottom: 15px;
    `;

    const tabConfig = [
      { type: "score", label: "💯 最高分数" },
      { type: "streak", label: "🔥 最高连对" },
      { type: "accuracy", label: "🎯 最高正确率" },
    ];

    //   存储当前激活的类型
    this.currentActiveTab = "score";

    tabConfig.forEach((tab, index) => {
      const tabElement = document.createElement("button");
      tabElement.textContent = tab.label;
      tabElement.setAttribute("data-tab-type", tab.type); //   添加数据属性
      tabElement.style.cssText = `
            flex: 1;
            padding: 10px;
            border: none;
            background: ${index === 0 ? "#f0f0f0" : "white"};
            cursor: pointer;
            font-size: 14px;
            border-radius: 5px 5px 0 0;
            font-weight: ${index === 0 ? "bold" : "normal"};
        `;

      tabElement.onclick = () => {
        // 更新标签样式
        tabsContainer.querySelectorAll("button").forEach((btn) => {
          btn.style.background = "white";
          btn.style.fontWeight = "normal";
        });
        tabElement.style.background = "#f0f0f0";
        tabElement.style.fontWeight = "bold";

        //   更新当前激活的类型
        this.currentActiveTab = tab.type;

        // 加载数据
        this.loadLeaderboardData(tab.type);
      };

      tabsContainer.appendChild(tabElement);
    });

    return tabsContainer;
  }

  // 加载排行榜数据
  async loadLeaderboardData(type, modal = null) {
    const content = document.getElementById("leaderboardContent");
    if (!content) {
      console.error("❌ 找不到leaderboardContent元素");
      return;
    }

    console.log(`🔄 加载排行榜数据: ${type}`);

    // 显示加载状态
    content.innerHTML =
      '<div style="text-align: center; padding: 20px; color: #666;">加载中...</div>';

    try {
      console.log(`📡 请求URL: /api/leaderboard/${type}`);
      const response = await fetch(`/api/leaderboard/${type}`);

      console.log("📨 响应状态:", response.status);
      if (!response.ok) {
        const errorText = await response.text();
        console.error("❌ 响应错误:", errorText);
        throw new Error(`HTTP ${response.status}: ${errorText}`);
      }

      const data = await response.json();
      console.log("✅ 获取到排行榜数据:", data);

      this.renderLeaderboard(content, data, type);
    } catch (error) {
      console.error("❌ 加载排行榜失败:", error);
      content.innerHTML = `
            <div style="text-align: center; padding: 20px; color: red;">
                ❌ 加载失败，请刷新重试<br>
                <small>${error.message}</small>
            </div>
        `;
    }
  }

  // 渲染排行榜
  renderLeaderboard(container, data, type) {
    if (!container) {
      console.error("❌ 渲染排行榜失败: container为空");
      return;
    }

    console.log(
      `🎨 渲染排行榜: 类型=${type}, 数据量=${data ? data.length : 0}`
    );

    if (!data || data.length === 0) {
      container.innerHTML = `
            <div style="text-align: center; padding: 40px; color: #666;">
                📝 暂无记录<br>
                <small>成为第一个上榜的玩家吧！</small>
            </div>
        `;
      return;
    }

    let html = `
        <div style="font-size: 12px; color: #666; margin-bottom: 10px;">
            排行榜前10名
        </div>
        <table style="width: 100%; border-collapse: collapse;">
            <thead>
                <tr style="background: #f5f5f5;">
                    <th style="padding: 8px; text-align: center; width: 60px;">排名</th>
                    <th style="padding: 8px; text-align: left;">玩家</th>
                    <th style="padding: 8px; text-align: right;">成绩</th>
                </tr>
            </thead>
            <tbody>
    `;

    data.forEach((item, index) => {
      const isCurrentUser = item.is_current_user;
      const isPlaceholder = item.is_placeholder;

      //   设置行样式
      let rowStyle = "";
      if (isCurrentUser) {
        rowStyle = "background: #e3f2fd; font-weight: bold;";
      } else if (isPlaceholder) {
        rowStyle = "background: #f9f9f9; color: #999; font-style: italic;";
      }

      let valueDisplay = "";
      let usernameDisplay = "";

      if (isPlaceholder) {
        //   占位记录的显示
        usernameDisplay = item.placeholder_text || "等待挑战";
        valueDisplay = item.value_display || "--";
      } else {
        // 实际数据的显示
        usernameDisplay = item.username;

        if (type === "score") {
          valueDisplay = item.value + " 分";
        } else if (type === "streak") {
          valueDisplay = item.value + " 连对";
        } else if (type === "accuracy") {
          valueDisplay = item.value.toFixed(1) + "%";
          if (item.total_answered) {
            valueDisplay += ` (${item.total_answered}题)`;
          }
        }

        // 标记当前用户
        if (isCurrentUser) {
          usernameDisplay += ' <span style="color: #2196F3;">(我)</span>';
        }
      }

      html += `
            <tr style="${rowStyle}">
                <td style="padding: 8px; text-align: center; border-bottom: 1px solid #eee;">
                    ${item.rank}
                </td>
                <td style="padding: 8px; border-bottom: 1px solid #eee;">
                    ${usernameDisplay}
                </td>
                <td style="padding: 8px; text-align: right; border-bottom: 1px solid #eee;">
                    ${valueDisplay}
                </td>
            </tr>
        `;
    });

    html += `
            </tbody>
        </table>
        <div style="margin-top: 10px; font-size: 12px; color: #666; text-align: center;">
            ${
              type === "score"
                ? "💯 分数越高越厉害"
                : type === "streak"
                ? "🔥 连续答对越多越强"
                : "🎯 正确率越高越稳定"
            }
        </div>
    `;

    container.innerHTML = html;
    // 在渲染完成后添加标准说明
    setTimeout(() => {
      this.addLeaderboardCriteria();
    }, 50);

    console.log("✅ 排行榜渲染完成");
  }

  // 修改重置按钮
  modifyResetButton() {
    const resetBtn = document.getElementById("resetBtn");
    if (resetBtn) {
      // 修改文本
      resetBtn.textContent = "结束本轮";

      //    先移除所有现有的事件监听器
      const newResetBtn = resetBtn.cloneNode(true);
      resetBtn.parentNode.replaceChild(newResetBtn, resetBtn);

      // 添加新的事件处理
      newResetBtn.addEventListener("click", async () => {
        if (window.locked || window.isProcessing) {
          if (window.message) {
            window.message("请等待当前操作完成", "orange");
          }
          return;
        }

        //    使用手动结束会话，取消时不会重置
        await this.manualEndSession();
      });

      console.log("✅ 重置按钮已修改为结束按钮");
    }
  }
}

window.leaderboardManager = new LeaderboardManager();
