package com.koka.app.web

import android.net.Uri

object KokaSiteConfig {
    const val HOME_URL: String = "https://koka.pages.dev"
    const val PRIMARY_HOST: String = "koka.pages.dev"
    const val JS_BRIDGE_NAME: String = "KokaBridge"
}

sealed interface LinkAction {

    data object Internal : LinkAction

    data class ExternalBrowser(val url: String) : LinkAction

    data class SystemIntent(val url: String) : LinkAction

    data object Ignore : LinkAction
}

object LinkPolicy {
    private val PASS_THROUGH_SCHEMES = setOf("about", "data", "blob", "javascript")

    private val INTERNAL_AUTH_HOSTS = setOf(
        "challenges.cloudflare.com",
        "cloudflare.com",
    )

    fun decide(url: String, isMainFrame: Boolean): LinkAction {
        if (!isMainFrame) return LinkAction.Internal
        val uri = runCatching { Uri.parse(url) }.getOrNull() ?: return LinkAction.Ignore
        val scheme = uri.scheme?.lowercase() ?: return LinkAction.Ignore

        if (scheme in PASS_THROUGH_SCHEMES) return LinkAction.Internal
        if (scheme != "http" && scheme != "https") {
            return LinkAction.SystemIntent(url)
        }

        val host = uri.host?.lowercase() ?: return LinkAction.Ignore
        if (isKokaHost(host) || isCloudflareChallengeHost(host)) {
            return LinkAction.Internal
        }

        return LinkAction.ExternalBrowser(url)
    }

    fun isKokaHost(host: String): Boolean {
        return host == KokaSiteConfig.PRIMARY_HOST ||
            host.endsWith(".${KokaSiteConfig.PRIMARY_HOST}")
    }

    private fun isCloudflareChallengeHost(host: String): Boolean {
        return host in INTERNAL_AUTH_HOSTS || host.endsWith(".cloudflare.com")
    }
}
