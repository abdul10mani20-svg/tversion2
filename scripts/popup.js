/**
 * Trivis Dev — Extension Popup Controller v3.2.0
 *
 * Responsibilities:
 *  1. Read chrome.storage.local to determine current state
 *  2. Show the correct UI panel: loading → login | dashboard | locked | banned | update
 *  3. Handle license activation (POST to background via TRIVIS_VALIDATE_KEY)
 *  4. Handle logout (TRIVIS_LOGOUT message)
 *  5. Apply localization (preserved from v3.1.0)
 */
(function () {
  "use strict";

  /* ═══════════════════════════════════════════════════════
     I18N TABLE (all original languages preserved)
     ═══════════════════════════════════════════════════════ */
  const I18N_POPUP = {
    en: {
      brandSub: "QUANTUM ACCELERATOR", online: "ONLINE",
      coreTitle: "NEURAL CORE STATUS",
      lblPlatform: "TARGET PLATFORM", lblPipeline: "TASK PIPELINE",
      valPipeline: "ARMED & SYNCED",
      lblEncryption: "ENCRYPTION", lblLatency: "INJECTION LATENCY",
      valLatency: "0.02ms (ULTRA)",
      launchBtn: "INITIALIZE LOVABLE MATRIX",
      dirDockTitle: "FLOATING HUD DOCK",
      dirDockDesc: "On lovable.dev, a sleek obsidian dock appears at the bottom. Drag anywhere on screen.",
      dirTaskTitle: "NEURAL TASK PIPELINE",
      dirTaskDesc: "Send prompts seamlessly via auto-generated encrypted task files with instant execution.",
      dirDevTitle: "DEV MODES & EXPORT",
      dirDevDesc: "Switch between Plan and Build modes, or download full source with single click.",
      loginDesc: "Enter your Trivis license key to activate quantum acceleration.",
      activateBtn: "ACTIVATE LICENSE",
      signOut: "SIGN OUT",
    },
    hi: {
      brandSub: "क्वांटम त्वरक", online: "ऑनलाइन",
      coreTitle: "न्यूरल कोर स्थिति",
      lblPlatform: "टारगेट प्लेटफॉर्म", lblPipeline: "टास्क पाइपलाइन",
      valPipeline: "तैयार और सिंक",
      lblEncryption: "एन्क्रिप्शन", lblLatency: "इंजेक्शन लेटेंसी",
      valLatency: "0.02ms (अल्ट्रा)",
      launchBtn: "लवेबल मैट्रिक्स शुरू करें",
      dirDockTitle: "फ्लोटिंग HUD डॉक",
      dirDockDesc: "lovable.dev पर नीचे एक प्रीमियम ओब्सीडियन डॉक दिखाई देगा। इसे कहीं भी खींचें।",
      dirTaskTitle: "न्यूरल टास्क पाइपलाइन",
      dirTaskDesc: "एन्क्रिप्टेड टास्क फाइलों के माध्यम से तुरंत प्रॉम्ट भेजें।",
      dirDevTitle: "डेव मोड्स और एक्सपोर्ट",
      dirDevDesc: "प्लान और बिल्ड मोड के बीच स्विच करें, या एक क्लिक में पूरा सोर्स कोड डाउनलोड करें।",
      loginDesc: "क्वांटम त्वरण सक्रिय करने के लिए अपनी Trivis लाइसेंस कुंजी दर्ज करें।",
      activateBtn: "लाइसेंस सक्रिय करें",
      signOut: "साइन आउट",
    },
    es: {
      brandSub: "ACELERADOR CUÁNTICO", online: "EN LÍNEA",
      coreTitle: "ESTADO DEL NÚCLEO NEURAL",
      lblPlatform: "PLATAFORMA DESTINO", lblPipeline: "TUBERÍA DE TAREAS",
      valPipeline: "ARMADO Y SINCRONIZADO",
      lblEncryption: "CIFRADO", lblLatency: "LATENCIA DE INYECCIÓN",
      valLatency: "0.02ms (ULTRA)",
      launchBtn: "INICIALIZAR MATRIZ LOVABLE",
      dirDockTitle: "DOCK HUD FLOTANTE",
      dirDockDesc: "En lovable.dev, aparece un elegante dock de obsidiana en la parte inferior. Arrástralo a cualquier lugar.",
      dirTaskTitle: "TUBERÍA DE TAREAS NEURAL",
      dirTaskDesc: "Envía prompts sin problemas mediante archivos de tareas encriptados generados automáticamente.",
      dirDevTitle: "MODOS DEV Y EXPORTACIÓN",
      dirDevDesc: "Cambia entre los modos Plan y Build, o descarga el código fuente completo con un solo clic.",
      loginDesc: "Ingresa tu clave de licencia Trivis para activar la aceleración cuántica.",
      activateBtn: "ACTIVAR LICENCIA",
      signOut: "CERRAR SESIÓN",
    },
    pt: {
      brandSub: "ACELERADOR QUÂNTICO", online: "ONLINE",
      coreTitle: "STATUS DO NÚCLEO NEURAL",
      lblPlatform: "PLATAFORMA ALVO", lblPipeline: "PIPELINE DE TAREFAS",
      valPipeline: "ARMADO E SINCRONIZADO",
      lblEncryption: "CRIPTOGRAFIA", lblLatency: "LATÊNCIA DE INJEÇÃO",
      valLatency: "0.02ms (ULTRA)",
      launchBtn: "INICIALIZAR MATRIZ LOVABLE",
      dirDockTitle: "DOCK HUD FLUTUANTE",
      dirDockDesc: "No lovable.dev, um dock elegante aparece na parte inferior. Arraste para qualquer lugar.",
      dirTaskTitle: "PIPELINE DE TAREFAS NEURAL",
      dirTaskDesc: "Envie prompts facilmente por meio de arquivos de tarefas criptografados com execução instantânea.",
      dirDevTitle: "MODOS DEV E EXPORTAÇÃO",
      dirDevDesc: "Alterne entre os modos Plan e Build, ou baixe o código fonte completo com um clique.",
      loginDesc: "Insira sua chave de licença Trivis para ativar a aceleração quântica.",
      activateBtn: "ATIVAR LICENÇA",
      signOut: "SAIR",
    },
    ar: {
      brandSub: "المسرع الكمي", online: "متصل",
      coreTitle: "حالة النواة العصبية",
      lblPlatform: "المنصة المستهدفة", lblPipeline: "خط أنابيب المهام",
      valPipeline: "جاهز ومتزامن",
      lblEncryption: "التشفير", lblLatency: "زمن استجابة الحقن",
      valLatency: "0.02ms (فائق السرعة)",
      launchBtn: "بدء مصفوفة لوفابل",
      dirDockTitle: "قاعدة تحكم عائمة",
      dirDockDesc: "على lovable.dev، تظهر قاعدة تحكم سفلية أنيقة. اسحبها إلى أي مكان على الشاشة.",
      dirTaskTitle: "خط المهام العصبي",
      dirTaskDesc: "أرسل التوجيهات بسلاسة عبر ملفات مهام مشفرة ومؤتمتة مع تنفيذ فوري.",
      dirDevTitle: "أوضاع التطوير والتصدير",
      dirDevDesc: "بدّل بين وضعي التخطيط والبناء، أو حمّل الكود المصدري بالكامل بنقرة واحدة.",
      loginDesc: "أدخل مفتاح ترخيص Trivis الخاص بك لتفعيل التسارع الكمي.",
      activateBtn: "تفعيل الترخيص",
      signOut: "تسجيل الخروج",
    },
    id: {
      brandSub: "AKSELERATOR KUANTUM", online: "ONLINE",
      coreTitle: "STATUS INTI NEURAL",
      lblPlatform: "PLATFORM TARGET", lblPipeline: "PIPELINE TUGAS",
      valPipeline: "SIAP & TERSINKRON",
      lblEncryption: "ENKRIPSI", lblLatency: "LATENSI INJEKSI",
      valLatency: "0.02ms (ULTRA)",
      launchBtn: "INISIALISASI MATRIKS LOVABLE",
      dirDockTitle: "DOCK HUD MENGAMBANG",
      dirDockDesc: "Di lovable.dev, dock obsidian ramping muncul di bagian bawah. Geser ke mana saja di layar.",
      dirTaskTitle: "PIPELINE TUGAS NEURAL",
      dirTaskDesc: "Kirim prompt dengan lancar melalui file tugas terenkripsi dengan eksekusi instan.",
      dirDevTitle: "MODE DEV & EKSPOR",
      dirDevDesc: "Beralih antara mode Plan dan Build, atau unduh kode sumber lengkap dengan satu klik.",
      loginDesc: "Masukkan kunci lisensi Trivis Anda untuk mengaktifkan akselerasi kuantum.",
      activateBtn: "AKTIFKAN LISENSI",
      signOut: "KELUAR",
    },
    fr: {
      brandSub: "ACCÉLÉRATEUR QUANTIQUE", online: "EN LIGNE",
      coreTitle: "ÉTAT DU CŒUR NEURAL",
      lblPlatform: "PLATEFORME CIBLE", lblPipeline: "PIPELINE DE TÂCHES",
      valPipeline: "ARMÉ & SYNCHRONISÉ",
      lblEncryption: "CHIFFREMENT", lblLatency: "LATENCE D'INJECTION",
      valLatency: "0.02ms (ULTRA)",
      launchBtn: "INITIALISER LA MATRICE LOVABLE",
      dirDockTitle: "DOCK HUD FLOTTANT",
      dirDockDesc: "Sur lovable.dev, un dock obsidienne élégant apparaît en bas. Glissez-le n'importe où.",
      dirTaskTitle: "PIPELINE DE TÂCHES NEURAL",
      dirTaskDesc: "Envoyez des prompts de manière transparente via des fichiers de tâches chiffrés exécutés instantanément.",
      dirDevTitle: "MODES DEV & EXPORT",
      dirDevDesc: "Basculez entre les modes Plan et Build, ou téléchargez le code source complet en un clic.",
      loginDesc: "Entrez votre clé de licence Trivis pour activer l'accélération quantique.",
      activateBtn: "ACTIVER LA LICENCE",
      signOut: "SE DÉCONNECTER",
    },
    de: {
      brandSub: "QUANTEN-BESCHLEUNIGER", online: "ONLINE",
      coreTitle: "NEURALER KERN-STATUS",
      lblPlatform: "ZIELPLATTFORM", lblPipeline: "AUFGABEN-PIPELINE",
      valPipeline: "BEREIT & SYNCHRONISIERT",
      lblEncryption: "VERSCHLÜSSELUNG", lblLatency: "INJEKTIONS-LATENZ",
      valLatency: "0.02ms (ULTRA)",
      launchBtn: "LOVABLE MATRIX STARTEN",
      dirDockTitle: "SCHWEBENDES HUD-DOCK",
      dirDockDesc: "Auf lovable.dev erscheint unten ein elegantes Obsidian-Dock. Ziehen Sie es an eine beliebige Stelle.",
      dirTaskTitle: "NEURALE AUFGABEN-PIPELINE",
      dirTaskDesc: "Senden Sie Prompts nahtlos über automatisch generierte, verschlüsselte Aufgabendateien.",
      dirDevTitle: "DEV-MODI & EXPORT",
      dirDevDesc: "Wechseln Sie zwischen Plan- und Build-Modus oder laden Sie den gesamten Quellcode mit einem Klick herunter.",
      loginDesc: "Geben Sie Ihren Trivis-Lizenzschlüssel ein, um die Quantenbeschleunigung zu aktivieren.",
      activateBtn: "LIZENZ AKTIVIEREN",
      signOut: "ABMELDEN",
    },
    ru: {
      brandSub: "КВАНТОВЫЙ АКСЕЛЕРАТОР", online: "ОНЛАЙН",
      coreTitle: "СТАТУС НЕЙРОЯДРА",
      lblPlatform: "ЦЕЛЕВАЯ ПЛАТФОРМА", lblPipeline: "ПАЙПЛАЙН ЗАДАЧ",
      valPipeline: "ГОТОВ И СИНХРОНИЗИРОВАН",
      lblEncryption: "ШИФРОВАНИЕ", lblLatency: "ЗАДЕРЖКА ИНЪЕКЦИИ",
      valLatency: "0.02мс (УЛЬТРА)",
      launchBtn: "ЗАПУСТИТЬ МАТРИЦУ LOVABLE",
      dirDockTitle: "ПЛАВАЮЩИЙ HUD-ДОК",
      dirDockDesc: "На lovable.dev внизу появляется стильный dok. Перетаскивайте его в любое место на экране.",
      dirTaskTitle: "НЕЙРОПАЙПЛАЙН ЗАДАЧ",
      dirTaskDesc: "Отправляйте промпты через автоматически сгенерированные зашифрованные файлы задач с мгновенным выполнением.",
      dirDevTitle: "РЕЖИМЫ DEV И ЭКСПОРТ",
      dirDevDesc: "Переключайтесь между режимами Plan и Build или скачивайте полный исходный код в один клик.",
      loginDesc: "Введите ваш лицензионный ключ Trivis для активации квантового ускорения.",
      activateBtn: "АКТИВИРОВАТЬ ЛИЦЕНЗИЮ",
      signOut: "ВЫЙТИ",
    },
    zh: {
      brandSub: "量子加速器", online: "在线",
      coreTitle: "神经核心状态",
      lblPlatform: "目标平台", lblPipeline: "任务流水线",
      valPipeline: "已就绪并同步",
      lblEncryption: "加密方式", lblLatency: "注入延迟",
      valLatency: "0.02ms (超低延迟)",
      launchBtn: "启动 LOVABLE 矩阵",
      dirDockTitle: "悬浮 HUD 扩展坞",
      dirDockDesc: "在 lovable.dev 底部将显示精致的黑曜石底座，可随意拖动至屏幕任意位置。",
      dirTaskTitle: "神经任务流水线",
      dirTaskDesc: "通过自动生成的加密任务文件无缝发送提示词，享受即时极速执行体验。",
      dirDevTitle: "开发模式与源码导出",
      dirDevDesc: "在计划（Plan）和构建（Build）模式之间自由切换，或一键打包下载完整源码。",
      loginDesc: "输入您的 Trivis 许可证密钥以激活量子加速。",
      activateBtn: "激活许可证",
      signOut: "退出登录",
    },
    ja: {
      brandSub: "量子アクセラレーター", online: "オンライン",
      coreTitle: "ニューラルコア状態",
      lblPlatform: "対象プラットフォーム", lblPipeline: "タスクパイプライン",
      valPipeline: "待機＆同期完了",
      lblEncryption: "暗号化", lblLatency: "インジェクション遅延",
      valLatency: "0.02ms (超低遅延)",
      launchBtn: "LOVABLE マトリックスを起動",
      dirDockTitle: "フローティング HUD ドック",
      dirDockDesc: "lovable.dev の下部に洗練されたドックが表示されます。画面上のどこへでも自由にドラッグできます。",
      dirTaskTitle: "ニューラルタスクパイプライン",
      dirTaskDesc: "自動生成された暗号化タスクファイルを介して、プロンプトを即時実行します。",
      dirDevTitle: "開発モード＆書き出し",
      dirDevDesc: "PlanとBuildモードを瞬時に切り替え、またはワンクリックで完全なソースコードをダウンロードできます。",
      loginDesc: "量子加速を有効にするには、Trivis ライセンスキーを入力してください。",
      activateBtn: "ライセンスを有効化",
      signOut: "サインアウト",
    },
    ko: {
      brandSub: "양자 가속기", online: "온라인",
      coreTitle: "뉴럴 코어 상태",
      lblPlatform: "대상 플랫폼", lblPipeline: "작업 파이프라인",
      valPipeline: "준비 및 동기화됨",
      lblEncryption: "암호화", lblLatency: "주입 지연 시간",
      valLatency: "0.02ms (초저지연)",
      launchBtn: "LOVABLE 매트릭스 시작",
      dirDockTitle: "플로팅 HUD 독",
      dirDockDesc: "lovable.dev 하단에 세련된 흑요석 독이 나타납니다. 화면 어디로든 드래그하여 배치할 수 있습니다.",
      dirTaskTitle: "뉴럴 작업 파이프라인",
      dirTaskDesc: "자동 생성된 암호화 작업 파일을 통해 즉시 실행되는 프롬프트를 원활하게 전송합니다.",
      dirDevTitle: "개발 모드 및 내보내기",
      dirDevDesc: "Plan 및 Build 모드를 전환하거나 한 번의 클릭으로 전체 소스 코드를 다운로드하세요.",
      loginDesc: "양자 가속을 활성화하려면 Trivis 라이선스 키를 입력하세요.",
      activateBtn: "라이선스 활성화",
      signOut: "로그아웃",
    },
  };

  let currentLang = "en";

  /* ═══════════════════════════════════════════════════════
     HELPERS
     ═══════════════════════════════════════════════════════ */

  const $ = (id) => document.getElementById(id);
  const setTxt = (id, text) => { const el = $(id); if (el && text !== undefined) el.textContent = text; };

  const STATES = ["loading", "login", "dashboard", "locked", "banned", "update"];

  function showState(name) {
    STATES.forEach((s) => {
      const el = $("trivis-state-" + s);
      if (el) el.style.display = s === name ? "" : "none";
    });
  }

  const KEY_RE = /^LXC-[A-Z0-9]{5}-[A-Z0-9]{5}-[A-Z0-9]{5}-[A-Z0-9]{5}$/i;

  /* ═══════════════════════════════════════════════════════
     LANGUAGE
     ═══════════════════════════════════════════════════════ */
  function applyLanguage(lang) {
    if (!I18N_POPUP[lang]) lang = "en";
    currentLang = lang;
    const d = I18N_POPUP[lang] || I18N_POPUP.en;

    setTxt("sp-brand-sub",       d.brandSub);
    setTxt("sp-online-tag",      d.online);
    setTxt("sp-core-title",      d.coreTitle);
    setTxt("sp-lbl-platform",    d.lblPlatform);
    setTxt("sp-launch-txt",      d.launchBtn);
    setTxt("sp-dir-dock-title",  d.dirDockTitle);
    setTxt("sp-dir-dock-desc",   d.dirDockDesc);
    setTxt("sp-dir-task-title",  d.dirTaskTitle);
    setTxt("sp-dir-task-desc",   d.dirTaskDesc);
    setTxt("sp-dir-dev-title",   d.dirDevTitle);
    setTxt("sp-dir-dev-desc",    d.dirDevDesc);
    setTxt("sp-login-desc",      d.loginDesc);
    setTxt("trivis-activate-label", d.activateBtn);
    setTxt("trivis-logout-btn",  d.signOut);

    const sel = $("sp-lang-select");
    if (sel && sel.value !== lang) sel.value = lang;
  }

  /* ═══════════════════════════════════════════════════════
     STATE RENDER
     ═══════════════════════════════════════════════════════ */
  function renderDashboard(data) {
    const userName   = data.trivis_user_name   || data.user_name  || "—";
    const plan       = data.trivis_plan        || data.plan       || "PRO";
    const expiresAt  = data.trivis_expires_at  || data.expires_at || null;
    const prompts    = data.trivis_total_prompts !== undefined ? data.trivis_total_prompts : "—";

    setTxt("sp-val-user",    userName);
    setTxt("sp-val-prompts", String(prompts));
    setTxt("sp-plan-tag",    String(plan).toUpperCase() + " v3.2.0");

    if (expiresAt) {
      try {
        const d = new Date(expiresAt);
        setTxt("sp-val-expires", isNaN(d) ? expiresAt : d.toLocaleDateString());
      } catch (_) {
        setTxt("sp-val-expires", expiresAt);
      }
    } else {
      setTxt("sp-val-expires", "∞ LIFETIME");
    }
  }

  function renderLocked(data) {
    const msg = data.trivis_lock_message || data.lock_message || "Your device has been locked by the administrator.";
    setTxt("trivis-lock-msg", msg);
  }

  function renderBanned(data) {
    const msg = data.trivis_ban_notice || "Your license has been revoked. Contact support.";
    setTxt("trivis-ban-msg", msg);
  }

  function renderUpdate(data) {
    const notice = data.trivis_update_notice;
    if (notice && typeof notice === "object") {
      setTxt("trivis-update-msg", notice.description || "A new version of Trivis is available.");
      const cv = notice.current_version || "";
      const lv = notice.latest_version  || data.trivis_latest_version || "";
      setTxt("trivis-update-version", cv && lv ? `v${cv} → v${lv}` : (lv ? `Latest: v${lv}` : ""));
      const link = $("trivis-update-link");
      if (link && notice.download_url) link.href = notice.download_url;
    } else {
      setTxt("trivis-update-msg", "A new version of Trivis is available. Update to continue.");
    }
  }

  /* ═══════════════════════════════════════════════════════
     STATE MACHINE — read storage and decide what to show
     ═══════════════════════════════════════════════════════ */
  function resolveState(data) {
    const hasKey    = !!(data.trivis_license_key);
    const isOk      = data.trivis_lic_ok === true || data.trivis_lic_ok === "1";
    const isBanned  = data.trivis_is_banned === true;
    const expiresAt = data.trivis_expires_at || null;

    if (!hasKey || !isOk) return "login";

    // Check expiry
    if (expiresAt) {
      const t = Date.parse(expiresAt);
      if (t && Date.now() > t) return "login";
    }

    if (isBanned) return "banned";
    return "dashboard";
  }

  function loadAndRender() {
    try {
      chrome.storage.local.get(null, (data) => {
        data = data || {};
        // Auto-heal any stale lock flags in local storage
        if (data.trivis_is_locked || data.trivis_extension_locked || data.zokys_extension_locked || data.trivis_update_required) {
          chrome.storage.local.set({
            trivis_is_locked: false,
            zokys_is_locked: false,
            trivis_extension_locked: false,
            zokys_extension_locked: false,
            trivis_update_required: false,
            trivis_lock_message: "",
            zokys_lock_message: ""
          });
          data.trivis_is_locked = false;
          data.trivis_extension_locked = false;
          data.zokys_extension_locked = false;
          data.trivis_update_required = false;
        }

        const state = resolveState(data);
        switch (state) {
          case "dashboard":
            renderDashboard(data);
            showState("dashboard");
            break;
          case "banned":
            renderBanned(data);
            showState("banned");
            break;
          default:
            showState("login");
            break;
        }
        // Also kick version check in background
        try {
          chrome.runtime.sendMessage({ type: "TRIVIS_CHECK_VERSION" }, () => {});
        } catch (_) {}
      });
    } catch (_) {
      showState("login");
    }
  }

  /* ═══════════════════════════════════════════════════════
     LICENSE ACTIVATION
     ═══════════════════════════════════════════════════════ */
  function setActivatingState(busy) {
    const btn   = $("trivis-activate-btn");
    const label = $("trivis-activate-label");
    const input = $("trivis-key-input");
    const d     = I18N_POPUP[currentLang] || I18N_POPUP.en;
    if (btn)   btn.disabled   = busy;
    if (input) input.disabled  = busy;
    if (label) label.textContent = busy ? "ACTIVATING..." : d.activateBtn;
  }

  function showLoginError(msg) {
    const el = $("trivis-login-error");
    if (!el) return;
    el.textContent = msg || "Activation failed. Please try again.";
    el.style.display = "block";
  }

  function clearLoginError() {
    const el = $("trivis-login-error");
    if (el) { el.textContent = ""; el.style.display = "none"; }
  }

  async function handleActivate() {
    clearLoginError();
    const input = $("trivis-key-input");
    if (!input) return;
    const raw = String(input.value || "").trim().toUpperCase().replace(/[^A-Z0-9-]/g, "");
    if (!KEY_RE.test(raw)) {
      showLoginError("Invalid key format. Expected: LXC-XXXXX-XXXXX-XXXXX-XXXXX");
      return;
    }
    setActivatingState(true);

    try {
      chrome.runtime.sendMessage(
        { type: "TRIVIS_VALIDATE_KEY", key: raw, source: "popup" },
        (resp) => {
          setActivatingState(false);
          if (chrome.runtime.lastError) {
            showLoginError("Extension error. Try reloading.");
            return;
          }
          if (!resp) {
            showLoginError("No response from extension core.");
            return;
          }
          if (resp.ok) {
            loadAndRender(); // reload state from storage
          } else {
            const reason = resp.reason || resp.error || "";
            let msg = "Activation failed.";
            if (reason === "invalid")             msg = "Invalid license key.";
            else if (reason === "expired")        msg = "License has expired.";
            else if (reason === "revoked")        msg = "License has been revoked.";
            else if (reason === "device_limit_exceeded" || reason === "max_devices_reached")
                                                  msg = "Device limit reached. Deactivate another device.";
            else if (reason === "banned")         msg = "This license is banned.";
            else if (reason === "network")        msg = "Cannot reach server. Check your connection.";
            else if (resp.error)                  msg = resp.error;
            showLoginError(msg);
          }
        }
      );
    } catch (e) {
      setActivatingState(false);
      showLoginError("Extension bridge error: " + (e && e.message || e));
    }
  }

  /* ═══════════════════════════════════════════════════════
     EVENT BINDING
     ═══════════════════════════════════════════════════════ */
  function bindEvents() {
    // Language selector
    const sel = $("sp-lang-select");
    if (sel) {
      sel.addEventListener("change", () => {
        const next = sel.value;
        if (I18N_POPUP[next]) {
          currentLang = next;
          applyLanguage(next);
          try { chrome.storage.local.set({ trivis_ui_lang: next }); } catch (_) {}
          try { localStorage.setItem("trivis_ui_lang", next); } catch (_) {}
        }
      });
    }

    // Activate button
    const activateBtn = $("trivis-activate-btn");
    if (activateBtn) activateBtn.addEventListener("click", handleActivate);

    // Enter key in input
    const keyInput = $("trivis-key-input");
    if (keyInput) {
      keyInput.addEventListener("keydown", (e) => {
        if (e.key === "Enter") handleActivate();
      });
      // Auto-uppercase + format as LXC-XXXXX-XXXXX-XXXXX-XXXXX
      keyInput.addEventListener("input", () => {
        let v = String(keyInput.value || "").toUpperCase().replace(/[^A-Z0-9-]/g, "");
        // Auto-insert dashes at correct positions
        const parts = v.replace(/-/g, "");
        if (parts.length <= 3)       v = parts.slice(0, 3);
        else if (parts.length <= 8)  v = parts.slice(0, 3) + "-" + parts.slice(3, 8);
        else if (parts.length <= 13) v = parts.slice(0, 3) + "-" + parts.slice(3, 8) + "-" + parts.slice(8, 13);
        else if (parts.length <= 18) v = parts.slice(0, 3) + "-" + parts.slice(3, 8) + "-" + parts.slice(8, 13) + "-" + parts.slice(13, 18);
        else                          v = parts.slice(0, 3) + "-" + parts.slice(3, 8) + "-" + parts.slice(8, 13) + "-" + parts.slice(13, 18) + "-" + parts.slice(18, 23);
        if (keyInput.value !== v) keyInput.value = v;
        clearLoginError();
      });
    }

    // Logout button
    const logoutBtn = $("trivis-logout-btn");
    if (logoutBtn) {
      logoutBtn.addEventListener("click", () => {
        try {
          chrome.runtime.sendMessage({ type: "TRIVIS_LOGOUT" }, () => {
            showState("login");
            const ki = $("trivis-key-input");
            if (ki) ki.value = "";
            clearLoginError();
          });
        } catch (_) {
          showState("login");
        }
      });
    }

    // Banned: clear + re-enter
    const banClearBtn = $("trivis-ban-clear-btn");
    if (banClearBtn) {
      banClearBtn.addEventListener("click", () => {
        try {
          chrome.runtime.sendMessage({ type: "TRIVIS_LOGOUT" }, () => {
            showState("login");
          });
        } catch (_) {
          showState("login");
        }
      });
    }
  }

  /* ═══════════════════════════════════════════════════════
     INIT
     ═══════════════════════════════════════════════════════ */
  function init() {
    showState("loading");
    bindEvents();

    // Load saved language
    try {
      if (typeof chrome !== "undefined" && chrome.storage && chrome.storage.local) {
        chrome.storage.local.get(["trivis_ui_lang"], (res) => {
          const lang = (res && res.trivis_ui_lang) || "en";
          applyLanguage(I18N_POPUP[lang] ? lang : "en");
        });
        // Live updates while popup is open
        chrome.storage.onChanged.addListener((changes, area) => {
          if (area !== "local") return;
          if (changes.trivis_ui_lang && changes.trivis_ui_lang.newValue) {
            applyLanguage(changes.trivis_ui_lang.newValue);
          }
          // Re-render if license/lock state changes mid-session
          const watchKeys = [
            "trivis_lic_ok", "trivis_is_banned", "trivis_is_locked",
            "trivis_extension_locked", "trivis_update_required",
          ];
          if (watchKeys.some((k) => k in changes)) {
            loadAndRender();
          }
        });
      } else {
        applyLanguage("en");
      }
    } catch (_) {
      applyLanguage("en");
    }

    // Load state (show login or dashboard etc)
    setTimeout(loadAndRender, 80); // slight delay ensures storage is ready
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
