package com.koka.app.web

import android.annotation.SuppressLint
import android.content.Context
import android.content.Intent
import android.graphics.Bitmap
import android.net.Uri
import android.os.Handler
import android.os.Looper
import android.os.Message
import android.view.ViewGroup
import android.webkit.CookieManager
import android.webkit.JavascriptInterface
import android.webkit.ValueCallback
import android.webkit.WebChromeClient
import android.webkit.WebResourceError
import android.webkit.WebResourceRequest
import android.webkit.WebSettings
import android.webkit.WebView
import android.webkit.WebViewClient
import androidx.browser.customtabs.CustomTabColorSchemeParams
import androidx.browser.customtabs.CustomTabsIntent
import androidx.webkit.WebViewCompat
import androidx.webkit.WebViewFeature
import org.json.JSONObject

class KokaJsBridge(
    private val onThemeChangedCallback: (bgHex: String?, surfaceHex: String?, primaryHex: String?, isDark: Boolean) -> Unit,
    private val onPullGateChangedCallback: (canPull: Boolean) -> Unit,
    private val onBlobDownloadCallback: (fileName: String, mimeType: String, base64: String) -> Unit,
    private val getNotificationPermissionCallback: () -> String,
    private val requestNotificationPermissionCallback: (reqId: String) -> Unit,
    private val showNotificationCallback: (title: String, body: String, tag: String?, url: String?) -> Unit,
    private val onSyncAiringDataCallback: (pendingJson: String, notifiedJson: String) -> Unit,
    private val consumeBgNotifiedCallback: () -> String,
) {
    @JavascriptInterface
    fun onThemeChanged(bgHex: String?, surfaceHex: String?, primaryHex: String?, isDark: Boolean) {
        onThemeChangedCallback(bgHex, surfaceHex, primaryHex, isDark)
    }

    @JavascriptInterface
    fun onPullToRefreshGateChanged(canPull: Boolean) {
        onPullGateChangedCallback(canPull)
    }

    @JavascriptInterface
    fun onBlobDownload(fileName: String?, mimeType: String?, base64Payload: String?) {
        if (base64Payload.isNullOrBlank()) return
        onBlobDownloadCallback(
            fileName ?: "koka-export",
            mimeType ?: "application/octet-stream",
            base64Payload,
        )
    }

    @JavascriptInterface
    fun getNotificationPermission(): String = getNotificationPermissionCallback()

    @JavascriptInterface
    fun requestNotificationPermission(reqId: String?) {
        if (reqId.isNullOrBlank()) return
        requestNotificationPermissionCallback(reqId)
    }

    @JavascriptInterface
    fun showNotification(title: String?, body: String?, tag: String?, url: String?) {
        showNotificationCallback(
            title ?: "Koka",
            body ?: "",
            tag,
            url,
        )
    }

    @JavascriptInterface
    fun onSyncAiringData(pendingJson: String?, notifiedJson: String?) {
        onSyncAiringDataCallback(
            pendingJson ?: "{}",
            notifiedJson ?: "[]",
        )
    }

    @JavascriptInterface
    fun consumeBackgroundNotifiedKeys(): String = consumeBgNotifiedCallback()
}

class KokaWebEngine(
    private val context: Context,
    private val onThemeChanged: (bgHex: String?, surfaceHex: String?, primaryHex: String?, isDark: Boolean) -> Unit,
    private val onPullGateChanged: (canPull: Boolean) -> Unit,
    private val onBlobDownload: (fileName: String, mimeType: String, base64: String) -> Unit,
    private val getNotificationPermission: () -> String,
    private val requestNotificationPermission: (reqId: String) -> Unit,
    private val showNotification: (title: String, body: String, tag: String?, url: String?) -> Unit,
    private val onSyncAiringData: (pendingJson: String, notifiedJson: String) -> Unit,
    private val consumeBgNotifiedKeys: () -> String,
    private val onProgressChanged: (Int) -> Unit,
    private val onPageStarted: (String?) -> Unit,
    private val onPageVisibleOrFinished: (String?) -> Unit,
    private val onMainFrameError: (String?) -> Unit,
    private val onOpenExternalUrl: (String) -> Unit,
    private val onOpenSystemIntent: (String) -> Unit,
    private val onShowFileChooser: (
        filePathCallback: ValueCallback<Array<Uri>>,
        fileChooserParams: WebChromeClient.FileChooserParams,
    ) -> Boolean,
) {
    private val mainHandler = Handler(Looper.getMainLooper())

    private val earlyJs: String by lazy {
        runCatching {
            context.assets.open("inject/koka_early.js").bufferedReader().use { it.readText() }
        }.getOrDefault("")
    }

    private val injectedCss: String by lazy {
        runCatching {
            context.assets.open("inject/koka_inject.css").bufferedReader().use { it.readText() }
        }.getOrDefault("")
    }

    private val injectedJs: String by lazy {
        runCatching {
            context.assets.open("inject/koka_inject.js").bufferedReader().use { it.readText() }
        }.getOrDefault("")
    }

    @SuppressLint("SetJavaScriptEnabled")
    fun createWebView(initialBgArgb: Int): WebView {
        val webView = WebView(context).apply {
            layoutParams = ViewGroup.LayoutParams(
                ViewGroup.LayoutParams.MATCH_PARENT,
                ViewGroup.LayoutParams.MATCH_PARENT,
            )
            setBackgroundColor(initialBgArgb)
            isVerticalScrollBarEnabled = false
            isHorizontalScrollBarEnabled = false
            overScrollMode = WebView.OVER_SCROLL_NEVER
        }

        val settings = webView.settings
        settings.javaScriptEnabled = true
        settings.domStorageEnabled = true
        settings.databaseEnabled = true
        settings.allowFileAccess = false
        settings.allowContentAccess = true
        settings.javaScriptCanOpenWindowsAutomatically = true
        settings.setSupportMultipleWindows(true)
        settings.mediaPlaybackRequiresUserGesture = false
        settings.useWideViewPort = true
        settings.loadWithOverviewMode = true
        settings.cacheMode = WebSettings.LOAD_DEFAULT
        settings.mixedContentMode = WebSettings.MIXED_CONTENT_COMPATIBILITY_MODE
        settings.builtInZoomControls = false
        settings.displayZoomControls = false
        settings.setSupportZoom(false)

        val defaultUa = settings.userAgentString.orEmpty()
        settings.userAgentString = defaultUa.replace("; wv)", ")").replace("Version/4.0 ", "")

        val cookieManager = CookieManager.getInstance()
        cookieManager.setAcceptCookie(true)
        cookieManager.setAcceptThirdPartyCookies(webView, true)

        val bridge = KokaJsBridge(
            onThemeChangedCallback = onThemeChanged,
            onPullGateChangedCallback = onPullGateChanged,
            onBlobDownloadCallback = onBlobDownload,
            getNotificationPermissionCallback = getNotificationPermission,
            requestNotificationPermissionCallback = { reqId ->
                mainHandler.post { requestNotificationPermission(reqId) }
            },
            showNotificationCallback = { title, body, tag, url ->
                mainHandler.post { showNotification(title, body, tag, url) }
            },
            onSyncAiringDataCallback = onSyncAiringData,
            consumeBgNotifiedCallback = consumeBgNotifiedKeys,
        )
        webView.addJavascriptInterface(bridge, KokaSiteConfig.JS_BRIDGE_NAME)

        if (earlyJs.isNotBlank() && WebViewFeature.isFeatureSupported(WebViewFeature.DOCUMENT_START_SCRIPT)) {
            runCatching {
                WebViewCompat.addDocumentStartJavaScript(
                    webView,
                    earlyJs,
                    setOf(KokaSiteConfig.HOME_URL),
                )
            }
        }

        webView.setDownloadListener { url, _, _, _, _ ->
            if (!url.isNullOrBlank() && (url.startsWith("http://") || url.startsWith("https://"))) {
                mainHandler.post { onOpenExternalUrl(url) }
            }
        }

        webView.webViewClient = object : WebViewClient() {
            override fun shouldOverrideUrlLoading(
                view: WebView?,
                request: WebResourceRequest?,
            ): Boolean {
                val url = request?.url?.toString() ?: return false
                return handleNavigation(url, request.isForMainFrame)
            }

            override fun onPageStarted(view: WebView?, url: String?, favicon: Bitmap?) {
                super.onPageStarted(view, url, favicon)
                if (view != null && isKokaPage(url) && earlyJs.isNotBlank()) {
                    view.evaluateJavascript(earlyJs, null)
                }
                onPageStarted(url)
            }

            override fun onPageCommitVisible(view: WebView?, url: String?) {
                super.onPageCommitVisible(view, url)
                if (view != null && isKokaPage(url)) {
                    injectAssets(view)
                }
            }

            override fun onPageFinished(view: WebView?, url: String?) {
                super.onPageFinished(view, url)
                if (view != null && isKokaPage(url)) {
                    injectAssets(view)
                }
                runCatching { CookieManager.getInstance().flush() }
                onPageVisibleOrFinished(url)
            }

            override fun onReceivedError(
                view: WebView?,
                request: WebResourceRequest?,
                error: WebResourceError?,
            ) {
                super.onReceivedError(view, request, error)
                if (request?.isForMainFrame == true) {
                    val code = error?.errorCode ?: 0
                    if (code != ERROR_UNSUPPORTED_SCHEME && code != -3) {
                        onMainFrameError(request.url?.toString())
                    }
                }
            }
        }

        webView.webChromeClient = object : WebChromeClient() {
            override fun onProgressChanged(view: WebView?, newProgress: Int) {
                super.onProgressChanged(view, newProgress)
                onProgressChanged(newProgress)
            }

            override fun onShowFileChooser(
                webView: WebView?,
                filePathCallback: ValueCallback<Array<Uri>>?,
                fileChooserParams: FileChooserParams?,
            ): Boolean {
                if (filePathCallback == null || fileChooserParams == null) return false
                return onShowFileChooser(filePathCallback, fileChooserParams)
            }

            override fun onCreateWindow(
                view: WebView?,
                isDialog: Boolean,
                isUserGesture: Boolean,
                resultMsg: Message?,
            ): Boolean {
                val parentWebView = view ?: return false
                val transport = resultMsg?.obj as? WebView.WebViewTransport ?: return false

                val tempWebView = WebView(parentWebView.context)
                tempWebView.webViewClient = object : WebViewClient() {
                    override fun shouldOverrideUrlLoading(
                        popupView: WebView?,
                        request: WebResourceRequest?,
                    ): Boolean {
                        val targetUrl = request?.url?.toString()
                        if (!targetUrl.isNullOrBlank()) {
                            when (val action = LinkPolicy.decide(targetUrl, isMainFrame = true)) {
                                LinkAction.Internal -> parentWebView.loadUrl(targetUrl)
                                is LinkAction.ExternalBrowser -> onOpenExternalUrl(action.url)
                                is LinkAction.SystemIntent -> onOpenSystemIntent(action.url)
                                LinkAction.Ignore -> Unit
                            }
                        }
                        popupView?.destroy()
                        return true
                    }

                    override fun onPageStarted(popupView: WebView?, url: String?, favicon: Bitmap?) {
                        if (!url.isNullOrBlank() && url != "about:blank") {
                            when (val action = LinkPolicy.decide(url, isMainFrame = true)) {
                                LinkAction.Internal -> parentWebView.loadUrl(url)
                                is LinkAction.ExternalBrowser -> onOpenExternalUrl(action.url)
                                is LinkAction.SystemIntent -> onOpenSystemIntent(action.url)
                                LinkAction.Ignore -> Unit
                            }
                            popupView?.stopLoading()
                            popupView?.destroy()
                        }
                    }
                }
                transport.webView = tempWebView
                resultMsg.sendToTarget()
                return true
            }
        }

        return webView
    }

    private fun handleNavigation(url: String, isMainFrame: Boolean): Boolean {
        return when (val action = LinkPolicy.decide(url, isMainFrame)) {
            LinkAction.Internal -> false
            is LinkAction.ExternalBrowser -> {
                mainHandler.post { onOpenExternalUrl(action.url) }
                true
            }
            is LinkAction.SystemIntent -> {
                mainHandler.post { onOpenSystemIntent(action.url) }
                true
            }
            LinkAction.Ignore -> true
        }
    }

    private fun isKokaPage(url: String?): Boolean {
        if (url.isNullOrBlank()) return false
        val host = runCatching { Uri.parse(url).host?.lowercase() }.getOrNull() ?: return false
        return LinkPolicy.isKokaHost(host)
    }

    fun injectAssets(webView: WebView) {
        if (earlyJs.isNotBlank()) {
            webView.evaluateJavascript(earlyJs, null)
        }
        if (injectedCss.isNotBlank()) {
            val quotedCss = JSONObject.quote(injectedCss)
            val cssScript = """
                (function(){
                  var id='koka-native-css';
                  var el=document.getElementById(id);
                  if(!el){
                    el=document.createElement('style');
                    el.id=id;
                    (document.head||document.documentElement).appendChild(el);
                  }
                  el.textContent=$quotedCss;
                })();
            """.trimIndent()
            webView.evaluateJavascript(cssScript, null)
        }
        if (injectedJs.isNotBlank()) {
            webView.evaluateJavascript(injectedJs, null)
        }
    }

    fun resolveNotificationPermission(webView: WebView?, reqId: String, status: String) {
        val safeId = JSONObject.quote(reqId)
        val safeStatus = JSONObject.quote(status)
        webView?.evaluateJavascript(
            "if(typeof window.__kokaResolveNotifPermission==='function'){window.__kokaResolveNotifPermission($safeId,$safeStatus);}",
            null,
        )
    }

    fun handleSmartBack(webView: WebView?, onExitApp: () -> Unit) {
        if (webView == null) {
            onExitApp()
            return
        }
        webView.evaluateJavascript(
            "(function(){ return typeof window.__kokaHandleBack === 'function' ? window.__kokaHandleBack() : 'NO_OVERLAY'; })();",
        ) { rawResult ->
            val result = rawResult?.trim('"') ?: "NO_OVERLAY"
            if (result == "DISMISSED_OVERLAY") {
                return@evaluateJavascript
            }
            if (webView.canGoBack()) {
                webView.goBack()
            } else {
                onExitApp()
            }
        }
    }

    companion object {
        fun openCustomTab(context: Context, url: String, toolbarArgb: Int) {
            val uri = runCatching { Uri.parse(url) }.getOrNull() ?: return
            val launchedCustomTab = runCatching {
                val colorParams = CustomTabColorSchemeParams.Builder()
                    .setToolbarColor(toolbarArgb)
                    .setNavigationBarColor(toolbarArgb)
                    .build()
                val customTabsIntent = CustomTabsIntent.Builder()
                    .setDefaultColorSchemeParams(colorParams)
                    .setShowTitle(true)
                    .build()
                customTabsIntent.launchUrl(context, uri)
            }.isSuccess

            if (!launchedCustomTab) {
                openSystemIntent(context, url)
            }
        }

        fun openSystemIntent(context: Context, url: String) {
            runCatching {
                val intent = Intent(Intent.ACTION_VIEW, Uri.parse(url)).apply {
                    addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
                }
                context.startActivity(intent)
            }
        }
    }
}
