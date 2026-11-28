package com.koka.app.ui

import android.view.ViewGroup
import android.webkit.WebView
import androidx.compose.animation.AnimatedVisibility
import androidx.compose.animation.core.FastOutSlowInEasing
import androidx.compose.animation.core.RepeatMode
import androidx.compose.animation.core.animateFloat
import androidx.compose.animation.core.infiniteRepeatable
import androidx.compose.animation.core.rememberInfiniteTransition
import androidx.compose.animation.core.tween
import androidx.compose.animation.fadeIn
import androidx.compose.animation.fadeOut
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.WindowInsets
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.safeDrawing
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.layout.widthIn
import androidx.compose.foundation.layout.windowInsetsPadding
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.rounded.CloudOff
import androidx.compose.material.icons.rounded.Refresh
import androidx.compose.material.icons.rounded.WifiOff
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.Icon
import androidx.compose.material3.LinearProgressIndicator
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableFloatStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberUpdatedState
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.layout.onSizeChanged
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.compose.ui.viewinterop.AndroidView
import androidx.swiperefreshlayout.widget.SwipeRefreshLayout
import com.koka.app.R
import com.koka.app.ui.theme.KokaBootDarkBg
import com.koka.app.ui.theme.SoraFontFamily
import com.koka.app.web.KokaPageState
import com.koka.app.web.KokaUiState

@Composable
fun KokaShellScreen(
    uiState: KokaUiState,
    webViewProvider: () -> WebView,
    onRefresh: () -> Unit,
    onRetry: () -> Unit,
    onOpenInBrowser: (String) -> Unit,
    modifier: Modifier = Modifier,
) {
    val latestCanPull = rememberUpdatedState(uiState.canPullToRefresh)
    val isBooting = uiState.pageState is KokaPageState.InitialLoading
    val bgColor = if (isBooting) KokaBootDarkBg else Color(uiState.syncedTheme.backgroundArgb)

    Box(
        modifier = modifier
            .fillMaxSize()
            .background(bgColor)
            .windowInsetsPadding(WindowInsets.safeDrawing),
    ) {
        AndroidView(
            modifier = Modifier
                .fillMaxSize()
                .testTag("koka_webview_container"),
            factory = { context ->
                val webView = webViewProvider()
                (webView.parent as? ViewGroup)?.removeView(webView)

                SwipeRefreshLayout(context).apply {
                    layoutParams = ViewGroup.LayoutParams(
                        ViewGroup.LayoutParams.MATCH_PARENT,
                        ViewGroup.LayoutParams.MATCH_PARENT,
                    )
                    setBackgroundColor(uiState.syncedTheme.backgroundArgb)
                    setProgressBackgroundColorSchemeColor(uiState.syncedTheme.surfaceArgb)
                    setColorSchemeColors(uiState.syncedTheme.primaryArgb)
                    setOnChildScrollUpCallback { _, _ ->
                        !latestCanPull.value || webView.scrollY > 0
                    }
                    setOnRefreshListener {
                        onRefresh()
                    }
                    addView(webView)
                }
            },
            update = { swipeLayout ->
                swipeLayout.setBackgroundColor(uiState.syncedTheme.backgroundArgb)
                swipeLayout.setProgressBackgroundColorSchemeColor(uiState.syncedTheme.surfaceArgb)
                swipeLayout.setColorSchemeColors(uiState.syncedTheme.primaryArgb)

                val childWebView = swipeLayout.getChildAt(0) as? WebView
                childWebView?.setBackgroundColor(uiState.syncedTheme.backgroundArgb)

                if (swipeLayout.isRefreshing != uiState.isRefreshing) {
                    swipeLayout.isRefreshing = uiState.isRefreshing
                }
                swipeLayout.isEnabled = uiState.pageState !is KokaPageState.Error
            },
        )

        if (uiState.pageState is KokaPageState.Loaded && uiState.loadProgress in 1..99 && !uiState.isRefreshing) {
            LinearProgressIndicator(
                progress = { uiState.loadProgress / 100f },
                modifier = Modifier
                    .fillMaxWidth()
                    .height(2.dp)
                    .align(Alignment.TopCenter)
                    .testTag("page_load_progress"),
                color = MaterialTheme.colorScheme.primary,
                trackColor = Color.Transparent,
            )
        }

        AnimatedVisibility(
            visible = isBooting,
            enter = fadeIn(animationSpec = tween(durationMillis = 150)),
            exit = fadeOut(animationSpec = tween(durationMillis = 500)),
        ) {
            KokaBootOverlay()
        }

        val errorState = uiState.pageState as? KokaPageState.Error
        AnimatedVisibility(
            visible = errorState != null,
            enter = fadeIn(),
            exit = fadeOut(),
        ) {
            if (errorState != null) {
                KokaOfflineScreen(
                    isOffline = errorState.isOffline,
                    onRetry = onRetry,
                    onOpenInBrowser = { onOpenInBrowser(errorState.failingUrl) },
                )
            }
        }
    }
}

@Composable
private fun KokaBootOverlay() {
    val infiniteTransition = rememberInfiniteTransition(label = "koka_splash")

    val shineProgress by infiniteTransition.animateFloat(
        initialValue = -0.6f,
        targetValue = 1.6f,
        animationSpec = infiniteRepeatable(
            animation = tween(durationMillis = 1100, easing = FastOutSlowInEasing),
            repeatMode = RepeatMode.Restart,
        ),
        label = "splash_shine_sweep",
    )

    val pulseAlpha by infiniteTransition.animateFloat(
        initialValue = 0.15f,
        targetValue = 0.06f,
        animationSpec = infiniteRepeatable(
            animation = tween(durationMillis = 1000, easing = FastOutSlowInEasing),
            repeatMode = RepeatMode.Reverse,
        ),
        label = "splash_line_pulse",
    )

    var textWidthPx by remember { mutableFloatStateOf(400f) }
    val width = textWidthPx.coerceAtLeast(1f)
    val bandWidth = width * 0.45f
    val centerX = width * shineProgress

    val shineBrush = Brush.linearGradient(
        colorStops = arrayOf(
            0.0f to Color(0xFF4A4A4A),
            0.35f to Color(0xFF4A4A4A),
            0.50f to Color(0xFFFFFFFF),
            0.65f to Color(0xFF4A4A4A),
            1.0f to Color(0xFF4A4A4A),
        ),
        start = Offset(centerX - bandWidth, 0f),
        end = Offset(centerX + bandWidth, width * 0.176f),
    )

    Box(
        modifier = Modifier
            .fillMaxSize()
            .background(KokaBootDarkBg)
            .testTag("koka_boot_overlay"),
        contentAlignment = Alignment.Center,
    ) {
        Column(
            horizontalAlignment = Alignment.CenterHorizontally,
            verticalArrangement = Arrangement.spacedBy(16.dp),
        ) {
            Text(
                text = "KOKA",
                modifier = Modifier.onSizeChanged { size ->
                    if (size.width > 0) textWidthPx = size.width.toFloat()
                },
                style = TextStyle(
                    fontFamily = SoraFontFamily,
                    fontWeight = FontWeight.SemiBold,
                    fontSize = 48.sp,
                    letterSpacing = 9.6.sp,
                    brush = shineBrush,
                ),
            )
            Box(
                modifier = Modifier
                    .width(96.dp)
                    .height(1.dp)
                    .background(Color.White.copy(alpha = pulseAlpha)),
            )
        }
    }
}

@Composable
private fun KokaOfflineScreen(
    isOffline: Boolean,
    onRetry: () -> Unit,
    onOpenInBrowser: () -> Unit,
) {
    Box(
        modifier = Modifier
            .fillMaxSize()
            .background(MaterialTheme.colorScheme.background)
            .padding(horizontal = 24.dp)
            .testTag("koka_offline_screen"),
        contentAlignment = Alignment.Center,
    ) {
        Column(
            modifier = Modifier.widthIn(max = 320.dp),
            horizontalAlignment = Alignment.CenterHorizontally,
        ) {
            Box(
                modifier = Modifier
                    .size(56.dp)
                    .background(
                        color = MaterialTheme.colorScheme.surface,
                        shape = RoundedCornerShape(16.dp),
                    ),
                contentAlignment = Alignment.Center,
            ) {
                Icon(
                    imageVector = if (isOffline) Icons.Rounded.WifiOff else Icons.Rounded.CloudOff,
                    contentDescription = stringResource(R.string.cd_offline_icon),
                    tint = MaterialTheme.colorScheme.primary,
                    modifier = Modifier.size(28.dp),
                )
            }

            Spacer(modifier = Modifier.height(20.dp))

            Text(
                text = stringResource(if (isOffline) R.string.offline_title else R.string.error_title),
                style = MaterialTheme.typography.headlineSmall,
                color = MaterialTheme.colorScheme.onBackground,
                textAlign = TextAlign.Center,
            )

            Spacer(modifier = Modifier.height(8.dp))

            Text(
                text = stringResource(if (isOffline) R.string.offline_subtitle else R.string.error_subtitle),
                style = MaterialTheme.typography.bodyMedium,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
                textAlign = TextAlign.Center,
            )

            Spacer(modifier = Modifier.height(24.dp))

            Button(
                onClick = onRetry,
                shape = RoundedCornerShape(999.dp),
                colors = ButtonDefaults.buttonColors(
                    containerColor = MaterialTheme.colorScheme.primary,
                    contentColor = MaterialTheme.colorScheme.onPrimary,
                ),
                modifier = Modifier
                    .fillMaxWidth()
                    .heightIn(min = 48.dp)
                    .testTag("retry_button"),
            ) {
                Icon(
                    imageVector = Icons.Rounded.Refresh,
                    contentDescription = stringResource(R.string.cd_retry_icon),
                    modifier = Modifier.size(18.dp),
                )
                Spacer(modifier = Modifier.width(8.dp))
                Text(
                    text = stringResource(R.string.action_retry),
                    style = MaterialTheme.typography.labelLarge,
                )
            }

            Spacer(modifier = Modifier.height(8.dp))

            TextButton(
                onClick = onOpenInBrowser,
                modifier = Modifier
                    .heightIn(min = 48.dp)
                    .testTag("open_browser_button"),
            ) {
                Text(
                    text = stringResource(R.string.action_open_browser),
                    style = MaterialTheme.typography.labelLarge,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                )
            }
        }
    }
}
