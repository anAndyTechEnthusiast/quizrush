// =================== 图表模态框功能 - 修复用户用时显示 ===================
function createChartModal(chartData, qid) {
  console.log("🎨 创建图表模态框...");

  // 移除已存在的模态框
  const existingModal = document.getElementById("chartModal");
  if (existingModal) {
    console.log("🗑️ 移除已存在的模态框");
    document.body.removeChild(existingModal);
  }

  // 创建模态框
  const modal = document.createElement("div");
  modal.id = "chartModal";
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

  // 创建模态框内容
  const modalContent = document.createElement("div");
  modalContent.style.cssText = `
    background: white;
    padding: 15px;
    border-radius: 8px;
    width: 75vw;        /* 改为视口宽度 */
    height: 80vh;       /* 改为视口高度 */
    position: relative;
    display: flex;
    flex-direction: column;
    overflow: hidden;
`;

  // 创建关闭按钮
  const closeBtn = document.createElement("button");
  closeBtn.textContent = "×";
  closeBtn.style.cssText = `
        position: absolute;
        top: 10px;
        right: 15px;
        background: none;
        border: none;
        font-size: 24px;
        cursor: pointer;
        color: #666;
        z-index: 10001;
        width: 30px;
        height: 30px;
        display: flex;
        align-items: center;
        justify-content: center;
    `;
  closeBtn.onclick = closeChartModal;

  // 创建图表容器
  const chartContainer = document.createElement("div");
  chartContainer.style.cssText = `
        width: 100%;
        height: 50vh;
        margin-top: 20px;
    `;

  const canvas = document.createElement("canvas");
  chartContainer.appendChild(canvas);

  // 组装模态框
  modalContent.appendChild(closeBtn);

  // 添加标题和基本信息
  const title = document.createElement("h3");
  title.textContent = "题目统计图表";
  title.style.textAlign = "center";
  modalContent.appendChild(title);

  const infoDiv = document.createElement("div");
  infoDiv.style.cssText = `
        font-size: 14px;
        margin-bottom: 15px;
        text-align: center;
        color: #666;
    `;

  // 显示用户个人用时信息 - 添加详细调试
  console.log("🔍 用户数据调试:", {
    user_data: chartData.user_data,
    has_user_data: !!chartData.user_data,
    user_time: chartData.user_data?.answer_time,
    overall_avg_time: chartData.overall_avg_time,
  });

  let infoHTML = `<div>总作答人数: ${chartData.overall_stats.total} | 正确率: ${chartData.overall_stats.accuracy}%</div>`;

  // 确保正确显示用户个人用时
  if (
    chartData.user_data &&
    chartData.user_data.answer_time !== null &&
    chartData.user_data.answer_time !== undefined
  ) {
    const userTime = chartData.user_data.answer_time;
    const avgTime = chartData.overall_avg_time;

    console.log("⏱️ 显示用户用时:", { userTime, avgTime });

    infoHTML += `<div>你的用时: <strong>${userTime.toFixed(1)}秒</strong>`;

    if (avgTime && avgTime > 0) {
      const timeDiff = userTime - avgTime;
      const comparison =
        timeDiff > 0
          ? `<span style="color: orange;">比平均慢 ${Math.abs(timeDiff).toFixed(
              1
            )}秒</span>`
          : `<span style="color: green;">比平均快 ${Math.abs(timeDiff).toFixed(
              1
            )}秒</span>`;
      infoHTML += ` | ${comparison}`;
    }
    infoHTML += `</div>`;
  } else {
    console.log("❌ 无用户用时数据:", chartData.user_data);
    infoHTML += `<div>你的用时: <span style="color: #999;">暂无记录</span></div>`;
  }

  if (chartData.user_data && chartData.user_data.is_difficult) {
    infoHTML +=
      '<div style="color: red; font-weight: bold;">🔥 本题被标记为难题 </div>';
  }

  infoDiv.innerHTML = infoHTML;

  modalContent.appendChild(infoDiv);
  modalContent.appendChild(chartContainer);
  modal.appendChild(modalContent);
  document.body.appendChild(modal);

  console.log("✅ 模态框创建完成，开始渲染图表...");

  // 渲染图表
  try {
    renderChart(canvas, chartData);
    console.log("✅ 图表渲染完成");
  } catch (error) {
    console.error("❌ 图表渲染失败:", error);
    // 如果图表渲染失败，显示错误信息
    chartContainer.innerHTML =
      '<div style="color: red; text-align: center; padding: 20px;">图表渲染失败，请刷新页面重试</div>';
  }
}

function closeChartModal() {
  const modal = document.getElementById("chartModal");
  if (modal) {
    document.body.removeChild(modal);
  }
}

function renderChart(canvas, data) {
  const ctx = canvas.getContext("2d");

  // 确定选项标签
  let labels = [];
  if (data.question_type === "choice") {
    labels = ["A", "B", "C", "D", "E"];
  } else {
    labels = ["正确", "错误"];
  }

  // 准备数据
  const percentages = labels.map((label) =>
    data.option_stats[label] ? data.option_stats[label].percentage : 0
  );

  const optionTimes = labels.map((label) => {
    if (data.time_stats && data.time_stats[label] !== undefined) {
      return data.time_stats[label];
    }
    return 0;
  });

  // 确定柱状图颜色
  const backgroundColors = labels.map((label) => {
    if (!data.option_stats[label]) return "#9E9E9E";

    const percentage = data.option_stats[label].percentage;
    const isCorrect =
      data.question_type === "choice"
        ? label === data.correct_answer
        : label === "正确";

    if (isCorrect) return "#4CAF50";

    if (percentage >= 80) return "#F44336";
    if (percentage >= 65) return "#FF9800";
    if (percentage >= 50) return "#FFC107";
    return "#9E9E9E";
  });

  // 创建渐变颜色函数
  function createGradient(ctx, color, isCorrect = false) {
    const gradient = ctx.createLinearGradient(0, 0, 0, 400);
    if (isCorrect) {
      // 正确答案使用更亮的渐变
      gradient.addColorStop(0, color + "FF");
      gradient.addColorStop(0.7, color + "CC");
      gradient.addColorStop(1, color + "99");
    } else {
      gradient.addColorStop(0, color + "EE");
      gradient.addColorStop(0.5, color + "AA");
      gradient.addColorStop(1, color + "77");
    }
    return gradient;
  }

  // 创建数据集
  const datasets = [];

  // 1. 彩色柱状图 - 选择率（美化版）
  datasets.push({
    label: "选项选择率",
    data: percentages,
    backgroundColor: backgroundColors.map((color, index) => {
      const isCorrect =
        data.question_type === "choice"
          ? labels[index] === data.correct_answer
          : labels[index] === "正确";
      return createGradient(ctx, color, isCorrect);
    }),
    borderColor: backgroundColors.map((color) => color + "DD"),
    borderWidth: 2,
    borderRadius: 12, //  圆角柱状图
    borderSkipped: false,
    yAxisID: "y",
    order: 3,
    barPercentage: data.question_type === "choice" ? 0.65 : 0.5,
    categoryPercentage: 0.8,
    //  动画配置
    animation: {
      duration: 1500,
      easing: "easeOutQuart",
    },
    //  悬停效果
    hoverBackgroundColor: backgroundColors.map((color) => color + "FF"),
    hoverBorderColor: backgroundColors.map((color) => "#FFFFFF"),
    hoverBorderWidth: 3,
    hoverRadius: 8,
  });

  // 2. 只有选择题显示用时折线
  if (data.question_type === "choice") {
    datasets.push({
      label: "选项平均用时 (秒)",
      data: optionTimes,
      type: "line",
      borderColor: "#2196F3",
      backgroundColor: "rgba(33, 150, 243, 0.1)",
      borderWidth: 4, //  加粗折线
      borderDash: [],
      pointBackgroundColor: "#2196F3",
      pointBorderColor: "#FFFFFF",
      pointBorderWidth: 3, //  点边框加粗
      pointRadius: 8, //  点变大
      pointHoverRadius: 12, //  悬停时点更大
      pointHoverBackgroundColor: "#1976D2",
      pointHoverBorderColor: "#FFFFFF",
      pointHoverBorderWidth: 4,
      yAxisID: "y1",
      order: 2,
      fill: false,
      tension: 0.3, //  平滑曲线
      //  折线动画
      animation: {
        duration: 2000,
        easing: "easeOutQuart",
      },
    });
  }

  // 创建图表配置
  const chartConfig = {
    type: "bar",
    data: {
      labels: labels,
      datasets: datasets,
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      //  图表区域背景
      backgroundColor: "rgba(248, 249, 250, 0.3)",
      //  交互配置
      interaction: {
        mode: "nearest",
        intersect: false,
      },
      //  悬停效果
      hover: {
        animationDuration: 300,
        mode: "nearest",
        intersect: false,
      },
      //  动画配置
      animation: {
        duration: 1500,
        easing: "easeOutQuart",
        onProgress: function (animation) {
          // 生长动画效果
        },
        onComplete: function (animation) {
          // 动画完成后的效果
        },
      },
      scales: {
        x: {
          grid: {
            display: false,
            color: "rgba(0,0,0,0.05)",
          },
          offset: true,
          ticks: {
            color: "#666666",
            font: {
              size: 13,
              weight: "600",
            },
            padding: 8,
          },
        },
        y: {
          type: "linear",
          display: true,
          position: "left",
          title: {
            display: true,
            text: "选择率 (%)",
            color: "#666666",
            font: {
              size: 12,
              weight: "600",
            },
            padding: { top: 0, bottom: 10 },
          },
          min: 0,
          max: 100,
          ticks: {
            stepSize: 10,
            color: "#666666",
            font: {
              size: 11,
            },
            padding: 5,
          },
          grid: {
            color: "rgba(0,0,0,0.08)",
            lineWidth: 1,
            drawBorder: false,
          },
        },
        y1: {
          type: "linear",
          display: data.question_type === "choice",
          position: "right",
          title: {
            display: data.question_type === "choice",
            text: "用时 (秒)",
            color: "#666666",
            font: {
              size: 12,
              weight: "600",
            },
            padding: { top: 0, bottom: 10 },
          },
          min: 0,
          max: data.time_limit,
          grid: {
            drawOnChartArea: false,
            color: "rgba(0,0,0,0.05)",
          },
          ticks: {
            color: "#666666",
            font: {
              size: 11,
            },
          },
        },
      },
      plugins: {
        tooltip: {
          backgroundColor: "rgba(255, 255, 255, 0.95)",
          titleColor: "#333333",
          bodyColor: "#666666",
          borderColor: "rgba(0, 0, 0, 0.1)",
          borderWidth: 1,
          cornerRadius: 8,
          padding: 12,
          displayColors: false,
          callbacks: {
            label: function (context) {
              const label = context.dataset.label || "";
              const value = context.parsed.y;
              const index = context.dataIndex;
              const option = labels[index];

              if (context.dataset.label === "选项选择率") {
                const count = data.option_stats[option]
                  ? data.option_stats[option].count
                  : 0;
                return `选择率: ${value}% (${count}人)`;
              } else if (context.dataset.label === "选项平均用时 (秒)") {
                return `${label}: ${value.toFixed(1)}秒`;
              }
              return `${label}: ${value}`;
            },
          },
        },
        legend: {
          display: false,
        },
        //  总体平均用时虚线
        annotation:
          data.overall_avg_time && data.overall_avg_time > 0
            ? {
                annotations: {
                  overallAvgLine: {
                    type: "line",
                    yMin: data.overall_avg_time,
                    yMax: data.overall_avg_time,
                    borderColor: "#666666",
                    borderWidth: 2,
                    borderDash: [5, 5],
                    yScaleID: "y1",
                    xMin: -0.5,
                    xMax: labels.length - 0.5,
                    label: {
                      display: true,
                      content: `总体平均: ${data.overall_avg_time.toFixed(1)}s`,
                      position: "end",
                      backgroundColor: "rgba(255,255,255,0.9)",
                      borderColor: "rgba(0,0,0,0.1)",
                      borderWidth: 1,
                      borderRadius: 6,
                      font: {
                        size: 11,
                        weight: "600",
                      },
                      color: "#666666",
                      padding: 6,
                    },
                  },
                },
              }
            : {},
      },
      layout: {
        padding: {
          left: 15,
          right: 15,
          top: 20,
          bottom: 15,
        },
      },
    },
  };

  // 创建图表
  try {
    const chart = new Chart(ctx, chartConfig);

    //  在图表创建后，手动添加颜色说明
    addColorLegend(chart, data);

    console.log("✅ 图表创建成功");
    return chart;
  } catch (error) {
    console.error("❌ 图表创建失败:", error);
    canvas.parentElement.innerHTML =
      '<div style="color: red; text-align: center; padding: 20px;">图表渲染失败: ' +
      error.message +
      "</div>";
    throw error;
  }
}

// 新增：美化版颜色图例函数
function addColorLegend(chart, data) {
  const chartContainer = chart.canvas.parentElement;

  // 创建图例容器
  const legendContainer = document.createElement("div");
  legendContainer.style.cssText = `
        display: flex;
        flex-wrap: wrap;
        justify-content: center;
        gap: 12px;
        margin-bottom: 20px;
        padding: 12px;
        background: linear-gradient(135deg, #f8f9fa 0%, #e9ecef 100%);
        border-radius: 12px;
        border: 1px solid rgba(0,0,0,0.08);
        box-shadow: 0 2px 8px rgba(0,0,0,0.05);
    `;

  // 颜色说明配置
  const colorLegend = [
    { text: "正确答案", color: "#4CAF50", shape: "circle" },
    { text: "高错误选项 (≥80%)", color: "#F44336", shape: "circle" },
    { text: "中高错误选项 (65-79%)", color: "#FF9800", shape: "circle" },
    { text: "中等错误选项 (50-64%)", color: "#FFC107", shape: "circle" },
    { text: "低错误选项 (<50%)", color: "#9E9E9E", shape: "circle" },
  ];

  // 根据图表类型添加时间相关的图例
  if (data.question_type === "choice") {
    colorLegend.push({ text: "选项平均用时", color: "#2196F3", shape: "line" });
  }

  // 如果有总体平均时间，添加虚线图例
  if (data.overall_avg_time && data.overall_avg_time > 0) {
    colorLegend.push({
      text: "总体平均用时",
      color: "#666666",
      shape: "line-dash",
    });
  }

  // 创建每个图例项
  colorLegend.forEach((item) => {
    const legendItem = document.createElement("div");
    legendItem.style.cssText = `
            display: flex;
            align-items: center;
            gap: 8px;
            font-size: 12px;
            color: #444;
            font-weight: 500;
            padding: 4px 8px;
            background: rgba(255,255,255,0.7);
            border-radius: 6px;
            transition: all 0.2s ease;
        `;

    // 悬停效果
    legendItem.onmouseover = function () {
      this.style.background = "rgba(255,255,255,0.9)";
      this.style.transform = "translateY(-1px)";
      this.style.boxShadow = "0 2px 4px rgba(0,0,0,0.1)";
    };
    legendItem.onmouseout = function () {
      this.style.background = "rgba(255,255,255,0.7)";
      this.style.transform = "translateY(0)";
      this.style.boxShadow = "none";
    };

    // 创建形状指示器
    const shape = document.createElement("div");
    shape.style.cssText = `
            width: 14px;
            height: 14px;
            border-radius: ${item.shape === "circle" ? "50%" : "0"};
            background: ${
              item.shape === "circle"
                ? `linear-gradient(135deg, ${item.color} 0%, ${item.color}99 100%)`
                : "transparent"
            };
            border: ${
              item.shape === "circle"
                ? "2px solid " + item.color + "CC"
                : "none"
            };
            ${
              item.shape === "line"
                ? `
                border-bottom: 3px solid ${item.color};
                width: 18px;
            `
                : ""
            }
            ${
              item.shape === "line-dash"
                ? `
                border-bottom: 3px dashed ${item.color};
                width: 18px;
            `
                : ""
            }
            box-shadow: 0 1px 3px rgba(0,0,0,0.1);
        `;

    // 创建文本
    const text = document.createElement("span");
    text.textContent = item.text;

    legendItem.appendChild(shape);
    legendItem.appendChild(text);
    legendContainer.appendChild(legendItem);
  });

  // 将图例插入到图表前面
  chartContainer.insertBefore(legendContainer, chart.canvas);
}

// =================== 在 showAnswerAndCooldown 中确保冷却期间重置被禁用 ===================
function showAnswerAndCooldown(selectedIndex) {
  showCorrectAnswer(selectedIndex); //  立即显示正确答案

  let needCooldown = false,
    reason = "";
  if (consecutiveWrong >= 3) {
    needCooldown = true;
    reason = "连续答错/超时 3 题，冷却中...";
    consecutiveWrong = 0;
    totalWrong = 0;
  } else if (totalWrong >= 5) {
    needCooldown = true;
    reason = "累计答错/超时 5 题，冷却中...";
    consecutiveWrong = 0;
    totalWrong = 0;
  }

  if (needCooldown) {
    //  立即开始冷却，同时显示正确答案
    resetBtn.disabled = true;
    allowReset = false;
    startCooldown(COOLDOWN_TIME, reason); // ✅ 立即开始冷却

    //  做错题时自动滚动到题目+答案位置
    setTimeout(() => {
      scrollToQuestion();
    }, 300);
  } else {
    // 普通答错时也使用延迟重置
    unlockResetAfterDelay(5000);

    //  立即先滚动到题目+答案位置，不要等待5秒
    setTimeout(() => {
      scrollToQuestion();
    }, 300);

    setTimeout(() => {
      Array.from(optsEl.querySelectorAll("button")).forEach((b) => {
        b.classList.remove("wrong", "correct", "disabled");
        b.disabled = false;
      });

      //  数学题需要额外重置输入框
      if (currentQ && currentQ.type === "math") {
        answerInput.disabled = false;
        answerInput.classList.remove("disabled");
        answerInput.value = ""; // ✅ 清空输入框
      }

      message("");
      nextBtn.style.display = "inline-block";
      isProcessing = false;

      // 重新启用键盘控制
      if (window.keyboardController) {
        window.keyboardController.setEnabled(true);
        window.keyboardController.waitForNextQuestion();
      }

      //  强制确保统计按钮可用并加载统计
      const showStatsBtn = document.getElementById("showStatsBtn");
      if (showStatsBtn && currentQ) {
        showStatsBtn.disabled = false;
        showStatsBtn.style.pointerEvents = "auto";
        showStatsBtn.style.cursor = "pointer";
        showStatsBtn.style.opacity = "1";
        showStatsBtn.style.display = "inline-block";

        console.log("✅ showAnswerAndCooldown: 统计按钮已启用", {
          type: currentQ.type,
          disabled: showStatsBtn.disabled,
        });
      }
    }, 5000);
  }
}
// =================== 统计功能 ===================
function loadQuestionStats(qid) {
  if (!qid) {
    console.error("❌ loadQuestionStats: 缺少题目ID");
    return;
  }

  console.log(`📊 开始加载题目统计，ID: ${qid}`);

  fetch(`/get_question_chart_data/${qid}`)
    .then((response) => {
      if (!response.ok) {
        throw new Error(`HTTP错误: ${response.status}`);
      }
      return response.json();
    })
    .then((data) => {
      console.log("✅ 获取图表数据成功:", data);
      // 创建图表模态框
      createChartModal(data, qid);
    })
    .catch((error) => {
      console.error("❌ 获取图表数据失败:", error);
      // 回退到文字统计
      console.log("🔄 回退到文字统计...");
      fetch(`/get_question_stats/${qid}`)
        .then((response) => {
          if (!response.ok) {
            throw new Error(`HTTP错误: ${response.status}`);
          }
          return response.json();
        })
        .then((data) => {
          console.log("✅ 获取文字统计成功:", data);
          let html = `<div style="font-size: 12px; background: #f5f5f5; padding: 8px; border-radius: 4px;">`;
          html += `<strong>本题统计：</strong><br>`;
          html += `作答人数: ${data.total || 0}<br>`;
          html += `正确率: ${data.accuracy || 0}%<br>`;

          const currentQuestion = currentQ || window.currentQuestion;
          if (
            currentQuestion &&
            (currentQuestion.difficulty === "easy" ||
              currentQuestion.difficulty === "medium")
          ) {
            html += `平均用时: ${
              data.avg_time ? data.avg_time.toFixed(1) + "秒" : "暂无"
            }<br>`;
          }

          if (
            currentQuestion &&
            currentQuestion.type === "choice" &&
            data.option_stats &&
            Object.keys(data.option_stats).length > 0
          ) {
            html += `<br><strong>选项分布：</strong>`;
            for (const [option, count] of Object.entries(data.option_stats)) {
              const percentage = ((count / data.total) * 100).toFixed(1);
              html += `<br>${option}: ${count} 人 (${percentage}%)`;
            }
          }

          html += `</div>`;
          document.getElementById("statsResult").innerHTML = html;

          // 显示统计区域
          const statsResult = document.getElementById("statsResult");
          if (statsResult) {
            statsResult.style.display = "block";
          }
        })
        .catch((err) => {
          console.error("❌ 获取文字统计也失败:", err);
          document.getElementById("statsResult").innerHTML =
            '<span style="color: red;">获取统计失败，请稍后重试</span>';
        });
    });
}

// =================== 统计展开/收起功能 ===================
let isStatsExpanded = false;

function toggleStats() {
  console.log("🔄 toggleStats 被调用");

  const currentQuestion = currentQ || window.currentQuestion;

  if (!currentQuestion) {
    console.log("❌ 当前没有题目");
    message("请先开始答题", "orange");
    return;
  }

  if (!currentQuestion.id) {
    console.log("❌ 题目没有ID");
    message("题目数据不完整", "orange");
    return;
  }

  // 检查按钮状态
  const showStatsBtn = document.getElementById("showStatsBtn");
  if (showStatsBtn && showStatsBtn.disabled) {
    console.log("❌ 统计按钮被禁用");
    return;
  }

  console.log(`📊 加载题目统计图表，ID: ${currentQuestion.id}`);

  // 显示加载状态
  if (showStatsBtn) {
    showStatsBtn.innerHTML = "📊 加载中...";
    showStatsBtn.disabled = true;
  }

  // 直接显示图表模态框
  loadQuestionStats(currentQuestion.id);

  // 恢复按钮状态（在loadQuestionStats完成后）
  setTimeout(() => {
    if (showStatsBtn) {
      showStatsBtn.innerHTML = "📊 查看本题统计";
      showStatsBtn.disabled = false;
    }
  }, 1000);
}

// 只负责加载数据，不控制显示
function showQuestionStats() {
  //  强制确保按钮可点击
  const showStatsBtn = document.getElementById("showStatsBtn");
  if (showStatsBtn) {
    showStatsBtn.style.pointerEvents = "auto";
    showStatsBtn.style.cursor = "pointer";
    showStatsBtn.style.opacity = "1";
    showStatsBtn.disabled = false;
  }

  console.log("=== 统计按钮点击调试 ===");

  const currentQuestion = currentQ || window.currentQuestion;

  if (!currentQuestion || !currentQuestion.id) {
    console.log("无法获取题目数据，显示暂无数据");
    return;
  }

  const qid = currentQuestion.id;
  console.log("加载题目统计，ID:", qid);

  //  使用独立的统计加载函数
  loadQuestionStats(qid);
}

// 添加这个调试函数
function checkStatsButtonStatus() {
  const btn = document.getElementById("showStatsBtn");
  if (!btn) {
    console.log("❌ 统计按钮不存在");
    return;
  }

  const rect = btn.getBoundingClientRect();
  console.log("📊 统计按钮状态检查:", {
    exists: true,
    disabled: btn.disabled,
    display: btn.style.display,
    pointerEvents: btn.style.pointerEvents,
    opacity: btn.style.opacity,
    cursor: btn.style.cursor,
    visible: rect.width > 0 && rect.height > 0,
    dimensions: { width: rect.width, height: rect.height },
    position: { top: rect.top, left: rect.left },
    currentQuestion: currentQ ? { type: currentQ.type, id: currentQ.id } : null,
  });
}

// 统一的统计按钮启用函数
function enableStatsButton() {
  const showStatsBtn = document.getElementById("showStatsBtn");
  const statsSection = document.getElementById("statsSection");
  const statsResult = document.getElementById("statsResult");

  if (showStatsBtn && statsSection && statsResult) {
    showStatsBtn.disabled = false;
    showStatsBtn.style.pointerEvents = "auto";
    showStatsBtn.style.cursor = "pointer";
    showStatsBtn.style.opacity = "1";
    showStatsBtn.style.display = "inline-block";
    showStatsBtn.innerHTML = "📊 查看本题统计"; //  确保按钮文字正确
    statsSection.style.display = "block";
    statsResult.style.display = "none"; //  答题后不自动展开
    statsResult.innerHTML = ""; //  清空统计内容
    isStatsExpanded = false; //  重置展开状态

    // 添加多重保护
    setTimeout(() => {
      if (showStatsBtn && currentQ) {
        showStatsBtn.disabled = false;
        showStatsBtn.style.pointerEvents = "auto";
        showStatsBtn.style.cursor = "pointer";
        showStatsBtn.style.opacity = "1";
      }
    }, 100);
  }
}
