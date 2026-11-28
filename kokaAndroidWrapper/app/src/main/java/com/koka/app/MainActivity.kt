package com.koka.app

import android.Manifest
import android.content.Intent
import android.net.Uri
import android.os.Build
import android.os.Bundle
import android.webkit.CookieManager
import android.webkit.ValueCallback
import android.webkit.WebChromeClient
import android.webkit.WebView
import android.widget.Toast
import androidx.activity.ComponentActivity
import androidx.activity.SystemBarStyle
import androidx.activity.compose.BackHandler
import androidx.activity.compose.setContent
import androidx.activity.enableEdgeToEdge
import androidx.activity.result.contract.ActivityResultContracts
import androidx.activity.viewModels
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.core.view.WindowCompat
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import androidx.lifecycle.lifecycleScope
import com.koka.app.notifications.AiringCheckWorker
import com.koka.app.notifications.AiringSyncStore
import com.koka.app.notifications.KokaNotificationHelper
import com.koka.app.ui.KokaShellScreen
import com.koka.app.ui.theme.KokaTheme
import com.koka.app.web.BlobDownloadSaver
import com.koka.app.web.KokaPageState
import com.koka.app.web.KokaSiteConfig
import com.koka.app.web.KokaWebEngine
import com.koka.app.web.KokaWebViewModel
import com.koka.app.web.LinkPolicy
import kotlinx.coroutines.launch
import kotlinx.coroutines.runBlocking

class MainActivity : ComponentActivity() {

    private val viewModel: KokaWebViewModel by viewModels()

    private var webView: WebView? = null
    private lateinit var webEngine: KokaWebEngine
    private lateinit var airingSyncStore: AiringSyncStore

    private var pendingFileCallback: ValueCallback<Array<Uri>>? = null
    private var pendingNotifPermReqId: String? = null
    @Volatile
    private var notifPermissionRequestedBefore: Boolean = false

    private val singleFilePickerLauncher =
        registerForActivityResult(ActivityResultContracts.OpenDocument()) { uri ->
            val callback = pendingFileCallback
            pendingFileCallback = null
            callback?.onReceiveValue(if (uri != null) arrayOf(uri) else null)
        }

    private val multiFilePickerLauncher =
        registerForActivityResult(ActivityResultContracts.OpenMultipleDocuments()) { uris ->
            val callback = pendingFileCallback
            pendingFileCallback = null
            callback?.onReceiveValue(if (uris.isNotEmpty()) uris.toTypedArray() else null)
        }

    private val notifPermissionLauncher =
        registerForActivityResult(ActivityResultContracts.RequestPermission()) { granted ->
            notifPermissionRequestedBefore = true
            lifecycleScope.launch { airingSyncStore.markPermissionRequested() }
            val status = if (granted || KokaNotificationHelper.hasPermission(this)) "granted" else "denied"
            if (status == "granted") {
                KokaNotificationHelper.ensureChannel(this)
                AiringCheckWorker.schedulePeriodic(this)
            }
            val reqId = pendingNotifPermReqId
            pendingNotifPermReqId = null
            if (!reqId.isNullOrBlank()) {
                webEngine.resolveNotificationPermission(webView, reqId, status)
            }
        }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)

        enableEdgeToEdge(
            statusBarStyle = SystemBarStyle.dark(android.graphics.Color.TRANSPARENT),
            navigationBarStyle = SystemBarStyle.dark(android.graphics.Color.TRANSPARENT),
        )

        airingSyncStore = AiringSyncStore(applicationContext)
        KokaNotificationHelper.ensureChannel(this)
        AiringCheckWorker.schedulePeriodic(this)

        lifecycleScope.launch {
            notifPermissionRequestedBefore = airingSyncStore.readSnapshot().permissionRequested
        }

        webEngine = KokaWebEngine(
            context = this,
            onThemeChanged = { bg, surface, primary, isDark ->
                viewModel.onThemeSynced(bg, surface, primary, isDark)
            },
            onPullGateChanged = { canPull ->
                viewModel.onPullToRefreshGateChanged(canPull)
            },
            onBlobDownload = { fileName, mimeType, base64 ->
                handleBlobDownload(fileName, mimeType, base64)
            },
            getNotificationPermission = {
                resolveCurrentNotificationPermission()
            },
            requestNotificationPermission = { reqId ->
                handleNotificationPermissionRequest(reqId)
            },
            showNotification = { title, body, tag, url ->
                KokaNotificationHelper.showNotification(
                    context = this,
                    title = title,
                    body = body,
                    tag = tag,
                    targetUrl = url,
                )
            },
            onSyncAiringData = { pendingJson, notifiedJson ->
                lifecycleScope.launch {
                    airingSyncStore.saveFromWeb(pendingJson, notifiedJson)
                    if (KokaNotificationHelper.hasPermission(this@MainActivity)) {
                        AiringCheckWorker.schedulePeriodic(this@MainActivity)
                    }
                }
            },
            consumeBgNotifiedKeys = {
                runBlocking { airingSyncStore.consumeBackgroundNotifiedJson() }
            },
            onProgressChanged = { progress ->
                viewModel.onProgressChanged(progress)
            },
            onPageStarted = { url ->
                viewModel.onPageStarted(url)
            },
            onPageVisibleOrFinished = { url ->
                viewModel.onPageVisibleOrFinished(url)
            },
            onMainFrameError = { failingUrl ->
                viewModel.onMainFrameError(failingUrl)
            },
            onOpenExternalUrl = { url ->
                KokaWebEngine.openCustomTab(
                    context = this,
                    url = url,
                    toolbarArgb = viewModel.uiState.value.syncedTheme.backgroundArgb,
                )
            },
            onOpenSystemIntent = { url ->
                KokaWebEngine.openSystemIntent(this, url)
            },
            onShowFileChooser = { callback, params ->
                launchSafFilePicker(callback, params)
            },
        )

        val initialUrl = extractKokaDeepLink(intent) ?: KokaSiteConfig.HOME_URL
        val createdWebView = getOrCreateWebView()
        if (savedInstanceState != null) {
            createdWebView.restoreState(savedInstanceState)
            if (createdWebView.url.isNullOrBlank()) {
                createdWebView.loadUrl(initialUrl)
            }
        } else {
            createdWebView.loadUrl(initialUrl)
        }

        setContent {
            val uiState by viewModel.uiState.collectAsStateWithLifecycle()

            val isBooting = uiState.pageState is KokaPageState.InitialLoading
            LaunchedEffect(uiState.syncedTheme, isBooting) {
                val bgArgb = if (isBooting) 0xFF141414.toInt() else uiState.syncedTheme.backgroundArgb
                val isLight = if (isBooting) false else !uiState.syncedTheme.isDark
                window.decorView.setBackgroundColor(bgArgb)
                val insetsController = WindowCompat.getInsetsController(window, window.decorView)
                insetsController.isAppearanceLightStatusBars = isLight
                insetsController.isAppearanceLightNavigationBars = isLight
            }

            LaunchedEffect(Unit) {
                viewModel.autoReloadEvents.collect {
                    retryLoad()
                }
            }

            BackHandler(enabled = true) {
                webEngine.handleSmartBack(
                    webView = webView,
                    onExitApp = { finish() },
                )
            }

            KokaTheme(syncedTheme = uiState.syncedTheme) {
                KokaShellScreen(
                    uiState = uiState,
                    webViewProvider = { getOrCreateWebView() },
                    onRefresh = {
                        viewModel.onRefreshTriggered()
                        webView?.reload()
                    },
                    onRetry = {
                        retryLoad()
                    },
                    onOpenInBrowser = { url ->
                        KokaWebEngine.openCustomTab(
                            context = this@MainActivity,
                            url = url,
                            toolbarArgb = uiState.syncedTheme.backgroundArgb,
                        )
                    },
                )
            }
        }
    }

    private fun resolveCurrentNotificationPermission(): String {
        if (KokaNotificationHelper.hasPermission(this)) return "granted"
        return if (notifPermissionRequestedBefore) "denied" else "default"
    }

    private fun handleNotificationPermissionRequest(reqId: String) {
        if (KokaNotificationHelper.hasPermission(this)) {
            KokaNotificationHelper.ensureChannel(this)
            AiringCheckWorker.schedulePeriodic(this)
            webEngine.resolveNotificationPermission(webView, reqId, "granted")
            return
        }
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            pendingNotifPermReqId = reqId
            notifPermissionLauncher.launch(Manifest.permission.POST_NOTIFICATIONS)
        } else {
            val status = if (KokaNotificationHelper.hasPermission(this)) "granted" else "denied"
            webEngine.resolveNotificationPermission(webView, reqId, status)
        }
    }

    private fun getOrCreateWebView(): WebView {
        val existing = webView
        if (existing != null) return existing
        val created = webEngine.createWebView(viewModel.uiState.value.syncedTheme.backgroundArgb)
        webView = created
        return created
    }

    private fun retryLoad() {
        viewModel.onRetryClicked()
        val target = webView ?: return
        val url = viewModel.uiState.value.currentUrl.ifBlank { KokaSiteConfig.HOME_URL }
        if (target.url.isNullOrBlank() || target.url == "about:blank") {
            target.loadUrl(url)
        } else {
            target.reload()
        }
    }

    private fun launchSafFilePicker(
        callback: ValueCallback<Array<Uri>>,
        params: WebChromeClient.FileChooserParams,
    ): Boolean {
        pendingFileCallback?.onReceiveValue(null)
        pendingFileCallback = callback

        val acceptTypes = params.acceptTypes
            ?.filter { it.isNotBlank() }
            ?.map { type ->
                when {
                    type.startsWith(".") -> "*/*"
                    type.contains("/") -> type
                    else -> "*/*"
                }
            }
            ?.distinct()
            ?.toTypedArray()
            ?.takeIf { it.isNotEmpty() }
            ?: arrayOf("*/*")

        val isMultiple = params.mode == WebChromeClient.FileChooserParams.MODE_OPEN_MULTIPLE
        return runCatching {
            if (isMultiple) {
                multiFilePickerLauncher.launch(acceptTypes)
            } else {
                singleFilePickerLauncher.launch(acceptTypes)
            }
            true
        }.getOrElse {
            pendingFileCallback?.onReceiveValue(null)
            pendingFileCallback = null
            false
        }
    }

    private fun handleBlobDownload(fileName: String, mimeType: String, base64: String) {
        lifecycleScope.launch {
            val result = BlobDownloadSaver.saveBase64File(
                context = this@MainActivity,
                rawFileName = fileName,
                mimeType = mimeType,
                base64Payload = base64,
            )
            val message = if (result.isSuccess) {
                "${getString(R.string.download_saved)}: ${result.getOrNull()}"
            } else {
                getString(R.string.download_failed)
            }
            Toast.makeText(this@MainActivity, message, Toast.LENGTH_SHORT).show()
        }
    }

    override fun onNewIntent(intent: Intent) {
        super.onNewIntent(intent)
        setIntent(intent)
        val deepLinkUrl = extractKokaDeepLink(intent)
        if (!deepLinkUrl.isNullOrBlank()) {
            webView?.loadUrl(deepLinkUrl)
        }
    }

    private fun extractKokaDeepLink(intent: Intent?): String? {
        val data = intent?.data ?: return null
        val host = data.host?.lowercase() ?: return null
        return if (LinkPolicy.isKokaHost(host)) data.toString() else null
    }

    override fun onSaveInstanceState(outState: Bundle) {
        super.onSaveInstanceState(outState)
        webView?.saveState(outState)
    }

    override fun onResume() {
        super.onResume()
        webView?.onResume()
    }

    override fun onPause() {
        runCatching { CookieManager.getInstance().flush() }
        webView?.onPause()
        super.onPause()
    }

    override fun onDestroy() {
        pendingFileCallback?.onReceiveValue(null)
        pendingFileCallback = null
        webView?.let { wv ->
            wv.stopLoading()
            wv.removeJavascriptInterface(KokaSiteConfig.JS_BRIDGE_NAME)
            wv.destroy()
        }
        webView = null
        super.onDestroy()
    }
}
