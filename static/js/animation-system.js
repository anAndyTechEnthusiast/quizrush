class ParticlesControlSystem {
  constructor() {
    this.particlesVisible = true;
    this.isUpdating = false;
    this.fps = 0;
    this.frameCount = 0;
    this.lastTime = performance.now();
    this.hoverLines = []; // 存储悬停连线
    this.customInteractionsEnabled = false;
    this.lastValues = {};

    // 新增：悬停连线状态标志
    this._hoverLinesEnabled = false;
    this._hoverLineHandlers = null;

    setTimeout(() => {
      this.init();
    }, 100);
  }

  init() {
    try {
      this.bindEvents();
      this.updateDisplayValues();
      this.startFPSCounter();
      console.log("粒子控制系统初始化成功");
    } catch (error) {
      console.error("粒子控制系统初始化失败:", error);
    }
  }

  // 启动FPS计数器
  startFPSCounter() {
    const updateFPS = () => {
      this.frameCount++;
      const currentTime = performance.now();
      if (currentTime >= this.lastTime + 1000) {
        this.fps = Math.round(
          (this.frameCount * 1000) / (currentTime - this.lastTime)
        );
        this.frameCount = 0;
        this.lastTime = currentTime;
        this.updateFPSDisplay();
      }
      requestAnimationFrame(updateFPS);
    };
    updateFPS();
  }

  // 更新FPS显示
  updateFPSDisplay() {
    const fpsElement = document.getElementById("fpsValue");
    if (fpsElement) {
      fpsElement.textContent = this.fps;

      // 根据FPS值设置颜色
      fpsElement.className = "";
      if (this.fps >= 50) {
        fpsElement.classList.add("fps-good");
      } else if (this.fps >= 30) {
        fpsElement.classList.add("fps-ok");
      } else {
        fpsElement.classList.add("fps-poor");
      }
    }
  }

  bindEvents() {
    // 面板展开/收起
    document
      .getElementById("toggleParticlesPanel")
      .addEventListener("click", (e) => {
        e.stopPropagation();
        this.togglePanel();
      });

    // 滑块控制 - 使用 input 事件实时响应
    const sliders = [
      "particlesNumber",
      "particlesSize",
      "particlesSpeed",
      "particlesOpacity",
      "lineDistance",
      "lineWidth",
    ];
    sliders.forEach((sliderId) => {
      const slider = document.getElementById(sliderId);
      if (slider) {
        slider.addEventListener("input", (e) => {
          this.updateDisplayValue(sliderId, e.target.value);
          this.updateParticlesConfig();
        });
      }
    });

    // 颜色选择
    const colorPickers = ["particlesColor", "lineColor"];
    colorPickers.forEach((pickerId) => {
      const picker = document.getElementById(pickerId);
      if (picker) {
        picker.addEventListener("input", () => {
          // 改为 input 事件实时响应
          this.updateParticlesConfig();
        });
      }
    });

    // 复选框
    const checkboxes = [
      "randomSize",
      "enableLines",
      "enableHover",
      "enableClick",
    ];
    checkboxes.forEach((checkboxId) => {
      const checkbox = document.getElementById(checkboxId);
      if (checkbox) {
        checkbox.addEventListener("change", () => {
          this.updateParticlesConfig();
        });
      }
    });

    // 选择框
    const modeSelect = document.getElementById("interactionMode");
    if (modeSelect) {
      modeSelect.addEventListener("change", () => {
        this.updateParticlesConfig();
      });
    }

    // 预设按钮
    document.querySelectorAll(".preset-btn").forEach((btn) => {
      btn.addEventListener("click", (e) => {
        this.applyPreset(e.target.dataset.preset);
      });
    });

    // 控制按钮
    const resetBtn = document.getElementById("resetParticles");
    if (resetBtn) {
      resetBtn.addEventListener("click", () => {
        this.resetToDefault();
      });
    }

    const toggleBtn = document.getElementById("toggleParticles");
    if (toggleBtn) {
      toggleBtn.addEventListener("click", () => {
        this.toggleParticlesVisibility();
      });
    }

    // 点击面板外部不收起
    const panel = document.querySelector(".particles-control-panel");
    if (panel) {
      panel.addEventListener("click", (e) => {
        e.stopPropagation();
      });
    }
    // 修复：悬停范围滑块显示
    const hoverDistanceSlider = document.getElementById("hoverDistance");
    if (hoverDistanceSlider) {
      hoverDistanceSlider.addEventListener("input", (e) => {
        this.updateDisplayValue("hoverDistance", e.target.value);
        this.updateParticlesConfig();
      });
    }

    // 新增：悬停连线开关
    const hoverLinesCheckbox = document.getElementById("enableHoverLines");
    if (hoverLinesCheckbox) {
      hoverLinesCheckbox.addEventListener("change", () => {
        this.updateParticlesConfig();
      });
    }

    // 新增：悬停连线颜色
    const hoverLineColor = document.getElementById("hoverLineColor");
    if (hoverLineColor) {
      hoverLineColor.addEventListener("input", () => {
        this.updateParticlesConfig();
      });
    }
  }

  togglePanel() {
    const panel = document.getElementById("particles-control-panel");
    const toggleBtn = document.getElementById("toggleParticlesPanel");

    if (panel && toggleBtn) {
      panel.classList.toggle("expanded");
      toggleBtn.textContent = panel.classList.contains("expanded") ? "▼" : "▲";
    }
  }

  updateDisplayValues() {
    const elements = {
      particlesNumber: "particlesValue",
      particlesSize: "sizeValue",
      particlesSpeed: "speedValue",
      particlesOpacity: "opacityValue",
      lineDistance: "distanceValue",
      lineWidth: "widthValue",
      hoverDistance: "hoverDistanceValue",
    };

    for (const [sliderId, displayId] of Object.entries(elements)) {
      const slider = document.getElementById(sliderId);
      const display = document.getElementById(displayId);
      if (slider && display) {
        display.textContent = slider.value;
      }
    }
  }

  updateDisplayValue(sliderId, value) {
    const displayMap = {
      particlesNumber: "particlesValue",
      particlesSize: "sizeValue",
      particlesSpeed: "speedValue",
      particlesOpacity: "opacityValue",
      lineDistance: "distanceValue",
      lineWidth: "widthValue",
      hoverDistance: "hoverDistanceValue",
    };

    const displayId = displayMap[sliderId];
    if (displayId) {
      const display = document.getElementById(displayId);
      if (display) {
        display.textContent = value;
      }
    }
  }

  updateParticlesConfig() {
    if (this.isUpdating) return;
    this.isUpdating = true;

    console.log(
      "更新粒子配置，悬停连线开关:",
      document.getElementById("enableHoverLines").checked
    );

    try {
      const config = this.getCurrentConfigFromUI();

      // 判断配置类型，决定是否重新初始化
      const configType = this.getConfigType(config);

      if (configType === "interactivity") {
        console.log("只更新交互配置");
        this.updateInteractivityOnly(config);
      } else {
        console.log("重新初始化粒子系统");
        this.optimizedReinitialize(config);
      }
    } catch (error) {
      console.error("粒子更新失败:", error);
    }

    setTimeout(() => {
      this.isUpdating = false;
    }, 100);
  }

  // 新增：判断配置类型
  getConfigType(config) {
    // 这些配置改变时需要重新初始化
    const reinitProps = [
      "particlesNumber",
      "particlesSize",
      "particlesOpacity",
      "lineDistance",
      "lineWidth",
      "enableLines",
      "randomSize",
      "particlesColor",
      "lineColor",
    ];

    // 这些配置改变时只需要更新交互设置
    const interactivityProps = [
      "enableHover",
      "enableClick",
      "interactionMode",
      "hoverDistance",
      "enableHoverLines",
      "hoverLineColor",
    ];

    // 检查当前改变的配置（简化逻辑，实际应该比较新旧配置）
    // 这里假设所有交互相关的配置都不需要重新初始化
    const hasInteractivityChange = interactivityProps.some((prop) => {
      const element = document.getElementById(this.camelToKebab(prop));
      return (
        element &&
        (element.type === "checkbox" ? element.checked : element.value) !==
          this.lastValues?.[prop]
      );
    });

    // 保存当前值用于下次比较
    this.lastValues = {};
    interactivityProps.forEach((prop) => {
      const element = document.getElementById(this.camelToKebab(prop));
      if (element) {
        this.lastValues[prop] =
          element.type === "checkbox" ? element.checked : element.value;
      }
    });

    return hasInteractivityChange ? "interactivity" : "particles";
  }

  // 新增：只更新交互配置，不重新初始化
  updateInteractivityOnly(config) {
    if (!window.pJSDom || !window.pJSDom[0]) return;

    const pJS = window.pJSDom[0].pJS;

    console.log("当前选择的模式:", config.interactivity.events.onhover.mode);
    console.log("pJS中的模式:", pJS.interactivity.events.onhover.mode);

    // 更新交互配置
    pJS.interactivity.detect_on = config.interactivity.detect_on;
    pJS.interactivity.events.onhover.enable =
      config.interactivity.events.onhover.enable;
    pJS.interactivity.events.onhover.mode =
      config.interactivity.events.onhover.mode; // 更新模式
    pJS.interactivity.events.onclick.enable =
      config.interactivity.events.onclick.enable;

    // 更新交互模式的距离设置
    if (pJS.interactivity.modes.repulse) {
      pJS.interactivity.modes.repulse.distance =
        config.interactivity.modes.repulse.distance;
    }
    if (pJS.interactivity.modes.bubble) {
      pJS.interactivity.modes.bubble.distance =
        config.interactivity.modes.bubble.distance;
    }

    console.log("交互配置已更新（不刷新布局）");

    this.setupCustomInteractions(config);
  }

  getCurrentConfigFromUI() {
    const enableHover = true;
    return {
      particles: {
        number: {
          value: parseInt(document.getElementById("particlesNumber").value),
          density: { enable: true, value_area: 800 },
        },
        color: { value: document.getElementById("particlesColor").value },
        shape: { type: "circle" },
        opacity: {
          value: parseFloat(document.getElementById("particlesOpacity").value),
          random: document.getElementById("randomSize").checked,
        },
        size: {
          value: parseFloat(document.getElementById("particlesSize").value),
          random: document.getElementById("randomSize").checked,
        },
        line_linked: {
          enable: document.getElementById("enableLines").checked,
          distance: parseInt(document.getElementById("lineDistance").value),
          color: document.getElementById("lineColor").value,
          opacity: 0.4,
          width: parseFloat(document.getElementById("lineWidth").value),
        },
        move: {
          enable: true,
          speed: parseFloat(document.getElementById("particlesSpeed").value),
          direction: "none",
          random: false,
          straight: false,
          out_mode: "out",
        },
      },
      interactivity: {
        detect_on: "canvas",
        events: {
          onhover: {
            enable: enableHover,
            mode: document.getElementById("interactionMode").value, // 这里使用下拉框的值
          },
          onclick: {
            enable: document.getElementById("enableClick").checked,
            mode: "push",
          },
          resize: true,
        },
        modes: {
          // 确保所有模式都有正确的配置
          bubble: {
            distance: parseInt(document.getElementById("hoverDistance").value),
            size: 40,
            duration: 2,
            opacity: 8,
            speed: 3,
          },
          repulse: {
            distance: parseInt(document.getElementById("hoverDistance").value),
            duration: 0.4,
          },
        },
      },
      // 自定义配置用于悬停连线
      custom: {
        enableHoverLines: document.getElementById("enableHoverLines").checked,
        hoverLineColor: document.getElementById("hoverLineColor").value,
        hoverDistance: parseInt(document.getElementById("hoverDistance").value),
      },
    };
  }

  optimizedReinitialize(config) {
    const container = document.getElementById("particles-js");
    if (!container) return;

    const scrollX = window.scrollX;
    const scrollY = window.scrollY;

    // 清理现有粒子
    if (window.pJSDom && window.pJSDom[0]) {
      const pJS = window.pJSDom[0].pJS;
      if (pJS.fn && pJS.fn.vendors && pJS.fn.vendors.destroypJS) {
        pJS.fn.vendors.destroypJS();
      }
      const canvas = container.querySelector("canvas");
      if (canvas) {
        canvas.remove();
      }
      window.pJSDom = [];
    }

    // 重新初始化
    particlesJS("particles-js", config);

    // 设置自定义交互
    this.setupCustomInteractions(config);

    window.scrollTo(scrollX, scrollY);
    console.log("粒子配置已更新");
  }

  // 设置自定义交互（悬停连线和吸引效果）
  setupCustomInteractions(config) {
    const container = document.getElementById("particles-js");
    if (!container) return;

    const canvas = container.querySelector("canvas");
    if (!canvas) return;

    console.log(
      "设置自定义交互，悬停连线状态:",
      config.custom.enableHoverLines
    );

    // 先清理之前的悬停连线
    this.disableCustomHoverLines();

    // 等待粒子系统完全初始化
    const checkInit = () => {
      if (window.pJSDom && window.pJSDom[0] && window.pJSDom[0].pJS) {
        console.log("粒子系统已初始化，准备设置悬停连线");
        if (config.custom.enableHoverLines) {
          this.enableCustomHoverLines(canvas, config);
        } else {
          console.log("悬停连线已禁用");
        }
      } else {
        console.log("等待粒子系统初始化...");
        setTimeout(checkInit, 100);
      }
    };

    checkInit();

    // 等待粒子系统初始化完成
    setTimeout(() => {
      // 如果选择吸引模式，启用自定义吸引效果
      if (document.getElementById("interactionMode").value === "attract") {
        this.enableAttractMode(canvas, config);
      }
    }, 500);
  }

  // 启用吸引模式
  enableAttractMode(canvas, config) {
    let mouseX = 0;
    let mouseY = 0;
    let isMouseOver = false;

    // 鼠标移动事件
    canvas.addEventListener("mousemove", (e) => {
      const rect = canvas.getBoundingClientRect();
      mouseX = e.clientX - rect.left;
      mouseY = e.clientY - rect.top;
      isMouseOver = true;
    });

    canvas.addEventListener("mouseleave", () => {
      isMouseOver = false;
    });

    // 修改粒子运动逻辑以实现吸引效果
    const pJS = window.pJSDom[0].pJS;
    const originalMove = pJS.fn.particlesUpdate;

    pJS.fn.particlesUpdate = () => {
      // 先执行原有的运动逻辑
      originalMove.call(pJS);

      // 如果鼠标悬停且是吸引模式，应用吸引效果
      if (
        isMouseOver &&
        document.getElementById("interactionMode").value === "attract"
      ) {
        const attractDistance = config.custom.hoverDistance;
        const attractStrength = 0.1; // 吸引强度

        pJS.particles.array.forEach((particle) => {
          const dx = mouseX - particle.x;
          const dy = mouseY - particle.y;
          const distance = Math.sqrt(dx * dx + dy * dy);

          if (distance < attractDistance && distance > 5) {
            // 计算吸引方向
            const angle = Math.atan2(dy, dx);
            const force = (1 - distance / attractDistance) * attractStrength;

            // 应用吸引力
            particle.vx += Math.cos(angle) * force;
            particle.vy += Math.sin(angle) * force;

            // 限制最大速度
            const speed = Math.sqrt(
              particle.vx * particle.vx + particle.vy * particle.vy
            );
            const maxSpeed = 3;
            if (speed > maxSpeed) {
              particle.vx = (particle.vx / speed) * maxSpeed;
              particle.vy = (particle.vy / speed) * maxSpeed;
            }
          }
        });
      }
    };
  }

  // 启用自定义悬停连线
  enableCustomHoverLines(canvas, config) {
    // 如果已经启用过悬停连线，先清理
    if (this._hoverLinesEnabled) {
      this.disableCustomHoverLines();
    }

    const ctx = canvas.getContext("2d");
    let mouseX = 0;
    let mouseY = 0;
    let isMouseOver = false;

    // 鼠标移动事件
    const mouseMoveHandler = (e) => {
      const rect = canvas.getBoundingClientRect();
      mouseX = e.clientX - rect.left;
      mouseY = e.clientY - rect.top;
      isMouseOver = true;
    };

    // 鼠标离开事件
    const mouseLeaveHandler = () => {
      isMouseOver = false;
      // 鼠标离开时强制重绘一次以清除连线
      if (window.pJSDom && window.pJSDom[0] && window.pJSDom[0].pJS) {
        window.pJSDom[0].pJS.fn.particlesRefresh();
      }
    };

    // 绑定事件
    canvas.addEventListener("mousemove", mouseMoveHandler);
    canvas.addEventListener("mouseleave", mouseLeaveHandler);

    // 保存原始绘制函数引用
    const pJS = window.pJSDom[0].pJS;
    if (!pJS.fn._originalCanvasPaint) {
      pJS.fn._originalCanvasPaint = pJS.fn.canvasPaint;
    }

    // 创建新的绘制函数
    const customCanvasPaint = () => {
      // 先执行原有的绘制逻辑
      pJS.fn._originalCanvasPaint.call(pJS);

      // 然后绘制悬停连线（在粒子之上）
      if (isMouseOver && config.custom.enableHoverLines) {
        this.drawHoverLines(ctx, mouseX, mouseY, config);
      }
    };

    // 应用新的绘制函数
    pJS.fn.canvasPaint = customCanvasPaint;

    // 保存引用以便清理
    this._hoverLinesEnabled = true;
    this._hoverLineHandlers = {
      mouseMoveHandler,
      mouseLeaveHandler,
      customCanvasPaint,
    };

    console.log("悬停连线已启用");
  }

  // 新增：禁用自定义悬停连线
  disableCustomHoverLines() {
    if (!this._hoverLinesEnabled) return;

    const canvas = document.querySelector("#particles-js canvas");
    if (canvas && this._hoverLineHandlers) {
      canvas.removeEventListener(
        "mousemove",
        this._hoverLineHandlers.mouseMoveHandler
      );
      canvas.removeEventListener(
        "mouseleave",
        this._hoverLineHandlers.mouseLeaveHandler
      );
    }

    // 恢复原始绘制函数
    if (window.pJSDom && window.pJSDom[0] && window.pJSDom[0].pJS) {
      const pJS = window.pJSDom[0].pJS;
      if (pJS.fn._originalCanvasPaint) {
        pJS.fn.canvasPaint = pJS.fn._originalCanvasPaint;
      }
    }

    this._hoverLinesEnabled = false;
    this._hoverLineHandlers = null;
  }

  // 绘制悬停连线
  drawHoverLines(ctx, mouseX, mouseY, config) {
    const pJS = window.pJSDom[0].pJS;
    if (!pJS || !pJS.particles || !pJS.particles.array) return;

    const hoverDistance = config.custom.hoverDistance || 200;

    ctx.save();

    // 使用更明显的样式确保可见
    ctx.strokeStyle = config.custom.hoverLineColor || "#ff4444";
    ctx.lineWidth = 2; // 增加线宽
    ctx.setLineDash([]); // 确保不是虚线
    ctx.globalAlpha = 0.8; // 增加透明度

    // 使用更高效的绘制方式
    pJS.particles.array.forEach((particle) => {
      const dx = particle.x - mouseX;
      const dy = particle.y - mouseY;
      const distance = Math.sqrt(dx * dx + dy * dy);

      if (distance < hoverDistance) {
        // 根据距离计算透明度，实现渐变效果
        const alpha = 0.8 * (1 - distance / hoverDistance);
        ctx.globalAlpha = alpha;

        ctx.beginPath();
        ctx.moveTo(mouseX, mouseY);
        ctx.lineTo(particle.x, particle.y);
        ctx.stroke();

        // 调试：在控制台输出连线信息
        if (distance < 50) {
          // 只输出近距离的调试信息
          console.log("绘制悬停连线:", {
            mouseX,
            mouseY,
            particleX: particle.x,
            particleY: particle.y,
            distance,
          });
        }
      }
    });

    ctx.restore();
  }

  applyPreset(presetName) {
    if (this.isUpdating) return;

    const presets = {
      default: {
        particlesNumber: 80,
        particlesSize: 3,
        particlesSpeed: 2,
        particlesOpacity: 0.5,
        lineDistance: 150,
        lineWidth: 1,
        particlesColor: "#ffffff",
        lineColor: "#ffffff",
        randomSize: true,
        enableLines: true,
        enableHover: true,
        enableClick: true,
        interactionMode: "repulse",
        hoverDistance: 200,
        enableHoverLines: true,
        hoverLineColor: "#ff4444",
      },
      stars: {
        particlesNumber: 160,
        particlesSize: 3,
        particlesSpeed: 1,
        particlesOpacity: 1,
        lineDistance: 200,
        lineWidth: 0,
        particlesColor: "#ffffff",
        lineColor: "#ffffff",
        randomSize: true,
        enableLines: false,
        enableHover: true,
        enableClick: true,
        interactionMode: "repulse",
        hoverDistance: 300,
        enableHoverLines: false,
        hoverLineColor: "#ff4444",
      },
      network: {
        particlesNumber: 60,
        particlesSize: 3,
        particlesSpeed: 1,
        particlesOpacity: 0.5,
        lineDistance: 120,
        lineWidth: 1,
        particlesColor: "#00ffff",
        lineColor: "#00ffff",
        randomSize: false,
        enableLines: true,
        enableHover: true,
        enableClick: true,
        interactionMode: "attract",
        hoverDistance: 150,
        enableHoverLines: true,
        hoverLineColor: "#00ffff",
      },
      // 新增吸引模式预设
      attract: {
        particlesNumber: 100,
        particlesSize: 4,
        particlesSpeed: 1,
        particlesOpacity: 0.6,
        lineDistance: 100,
        lineWidth: 1,
        particlesColor: "#ff6b6b",
        lineColor: "#ff6b6b",
        randomSize: true,
        enableLines: true,
        enableHover: true,
        enableClick: true,
        interactionMode: "bubble", // 使用bubble模式实现吸引效果
        hoverDistance: 250,
        enableHoverLines: true,
        hoverLineColor: "#ff6b6b",
      },
      snow: {
        particlesNumber: 200,
        particlesSize: 5,
        particlesSpeed: 1,
        particlesOpacity: 0.7,
        lineDistance: 0,
        lineWidth: 0,
        particlesColor: "#ffffff",
        lineColor: "#ffffff",
        randomSize: true,
        enableLines: false,
        enableHover: false,
        enableClick: false,
        interactionMode: "repulse",
        hoverDistance: 200,
        enableHoverLines: false,
        hoverLineColor: "#ffffff",
      },
      fireworks: {
        particlesNumber: 100,
        particlesSize: 4,
        particlesSpeed: 3,
        particlesOpacity: 0.8,
        lineDistance: 80,
        lineWidth: 2,
        particlesColor: "#ff4444",
        lineColor: "#ffaa00",
        randomSize: true,
        enableLines: true,
        enableHover: true,
        enableClick: true,
        interactionMode: "bubble",
        hoverDistance: 200,
        enableHoverLines: true,
        hoverLineColor: "#ffaa00",
      },
      disco: {
        particlesNumber: 120,
        particlesSize: 4,
        particlesSpeed: 4,
        particlesOpacity: 0.7,
        lineDistance: 100,
        lineWidth: 1.5,
        particlesColor: "#ff00ff",
        lineColor: "#00ffff",
        randomSize: true,
        enableLines: true,
        enableHover: true,
        enableClick: true,
        interactionMode: "repulse",
        hoverDistance: 180,
        enableHoverLines: true,
        hoverLineColor: "#00ffff",
      },
    };

    const preset = presets[presetName];
    if (preset) {
      for (const [key, value] of Object.entries(preset)) {
        const element = document.getElementById(this.camelToKebab(key));
        if (element) {
          if (element.type === "checkbox") {
            element.checked = value;
          } else if (element.type === "color") {
            element.value = value;
          } else {
            element.value = value;
          }
        }
      }

      this.updateDisplayValues();
      this.updateParticlesConfig();
    }
  }

  camelToKebab(str) {
    return str.replace(/([a-z0-9]|(?=[A-Z]))([A-Z])/g, "$1-$2").toLowerCase();
  }

  resetToDefault() {
    this.applyPreset("default");
  }

  toggleParticlesVisibility() {
    this.particlesVisible = !this.particlesVisible;
    const particlesContainer = document.getElementById("particles-js");
    const toggleBtn = document.getElementById("toggleParticles");

    if (particlesContainer && toggleBtn) {
      if (this.particlesVisible) {
        particlesContainer.style.display = "block";
        toggleBtn.textContent = "隐藏粒子";
        // 显示时重新初始化确保效果正常
        this.updateParticlesConfig();
      } else {
        particlesContainer.style.display = "none";
        toggleBtn.textContent = "显示粒子";
      }
    }
  }
}

// 初始化粒子控制系统
let particlesControlSystem;

// 在页面加载完成后初始化
document.addEventListener("DOMContentLoaded", function () {
  console.log("DOM加载完成，初始化粒子控制系统");
  particlesControlSystem = new ParticlesControlSystem();
});

window.addEventListener("beforeunload", () => {
  if (particlesControlSystem) {
    particlesControlSystem.disableCustomHoverLines();
  }
});
