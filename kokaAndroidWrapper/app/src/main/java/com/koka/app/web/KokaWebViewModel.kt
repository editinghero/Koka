package com.koka.app.web

import android.app.Application
import androidx.lifecycle.AndroidViewModel
import androidx.lifecycle.viewModelScope
import kotlinx.coroutines.flow.MutableSharedFlow
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.SharedFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asSharedFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.drop
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch

sealed interface KokaPageState {
    data object InitialLoading : KokaPageState
    data object Loaded : KokaPageState
    data class Error(
        val isOffline: Boolean,
        val failingUrl: String,
    ) : KokaPageState
}

data class KokaUiState(
    val syncedTheme: SyncedKokaTheme = SyncedKokaTheme(),
    val pageState: KokaPageState = KokaPageState.InitialLoading,
    val loadProgress: Int = 0,
    val canPullToRefresh: Boolean = true,
    val isRefreshing: Boolean = false,
    val isOnline: Boolean = true,
    val currentUrl: String = KokaSiteConfig.HOME_URL,
)

class KokaWebViewModel(application: Application) : AndroidViewModel(application) {
    private val themeStore = ThemeSyncStore(application)
    private val connectivityMonitor = ConnectivityMonitor(application)

    private val _uiState = MutableStateFlow(
        KokaUiState(isOnline = connectivityMonitor.checkCurrentlyOnline())
    )
    val uiState: StateFlow<KokaUiState> = _uiState.asStateFlow()

    private val _autoReloadEvents = MutableSharedFlow<Unit>(extraBufferCapacity = 1)
    val autoReloadEvents: SharedFlow<Unit> = _autoReloadEvents.asSharedFlow()

    init {
        connectivityMonitor.start()

        viewModelScope.launch {
            themeStore.syncedThemeFlow.collect { savedTheme ->
                _uiState.update { current ->
                    if (current.pageState is KokaPageState.InitialLoading) {
                        current.copy(syncedTheme = savedTheme)
                    } else {
                        current
                    }
                }
            }
        }

        viewModelScope.launch {
            connectivityMonitor.isOnline.collect { online ->
                val wasError = _uiState.value.pageState is KokaPageState.Error
                _uiState.update { it.copy(isOnline = online) }
                if (online && wasError) {
                    _autoReloadEvents.tryEmit(Unit)
                }
            }
        }

        viewModelScope.launch {
            connectivityMonitor.isOnline.drop(1).collect { online ->
                if (!online && _uiState.value.pageState is KokaPageState.InitialLoading) {
                    _uiState.update {
                        it.copy(
                            pageState = KokaPageState.Error(
                                isOffline = true,
                                failingUrl = it.currentUrl,
                            ),
                            isRefreshing = false,
                        )
                    }
                }
            }
        }
    }

    fun onThemeSynced(bgHex: String?, surfaceHex: String?, primaryHex: String?, isDark: Boolean) {
        val current = _uiState.value.syncedTheme
        val updated = SyncedKokaTheme(
            backgroundArgb = ThemeSyncStore.parseHexOrDefault(bgHex, current.backgroundArgb),
            surfaceArgb = ThemeSyncStore.parseHexOrDefault(surfaceHex, current.surfaceArgb),
            primaryArgb = ThemeSyncStore.parseHexOrDefault(primaryHex, current.primaryArgb),
            isDark = isDark,
        )
        if (updated != current) {
            _uiState.update { it.copy(syncedTheme = updated) }
            viewModelScope.launch {
                themeStore.save(updated)
            }
        }
    }

    private val bootStartTimeMs = android.os.SystemClock.elapsedRealtime()
    private var pendingLoadedReveal = false

    fun onProgressChanged(progress: Int) {
        val clamped = progress.coerceIn(0, 100)
        _uiState.update { it.copy(loadProgress = clamped) }
        if (clamped >= 70 && _uiState.value.pageState is KokaPageState.InitialLoading) {
            scheduleRevealAfterMinSplash()
        }
    }

    fun onPageStarted(url: String?) {
        _uiState.update { state ->
            state.copy(
                currentUrl = url?.takeIf { it.startsWith("http") } ?: state.currentUrl,
                loadProgress = if (state.loadProgress == 0) 10 else state.loadProgress,
            )
        }
    }

    fun onPageVisibleOrFinished(url: String?) {
        val keepError = _uiState.value.pageState is KokaPageState.Error && !connectivityMonitor.checkCurrentlyOnline()
        val wasBooting = _uiState.value.pageState is KokaPageState.InitialLoading
        _uiState.update { state ->
            state.copy(
                currentUrl = url?.takeIf { it.startsWith("http") } ?: state.currentUrl,
                pageState = if (keepError || wasBooting) state.pageState else KokaPageState.Loaded,
                loadProgress = 100,
                isRefreshing = false,
            )
        }
        if (wasBooting && !keepError) {
            scheduleRevealAfterMinSplash()
        }
    }

    private fun scheduleRevealAfterMinSplash() {
        if (pendingLoadedReveal) return
        pendingLoadedReveal = true
        val elapsed = android.os.SystemClock.elapsedRealtime() - bootStartTimeMs
        val remainingMs = (650L - elapsed).coerceAtLeast(0L)
        viewModelScope.launch {
            if (remainingMs > 0L) {
                kotlinx.coroutines.delay(remainingMs)
            }
            _uiState.update { state ->
                if (state.pageState is KokaPageState.InitialLoading) {
                    state.copy(pageState = KokaPageState.Loaded)
                } else {
                    state
                }
            }
        }
    }

    fun onMainFrameError(failingUrl: String?) {
        val online = connectivityMonitor.checkCurrentlyOnline()
        _uiState.update { state ->
            state.copy(
                pageState = KokaPageState.Error(
                    isOffline = !online,
                    failingUrl = failingUrl ?: state.currentUrl,
                ),
                isRefreshing = false,
                loadProgress = 0,
            )
        }
    }

    fun onPullToRefreshGateChanged(canPull: Boolean) {
        _uiState.update { it.copy(canPullToRefresh = canPull) }
    }

    fun onRefreshTriggered() {
        _uiState.update { state ->
            state.copy(
                isRefreshing = true,
                pageState = if (state.pageState is KokaPageState.Error) {
                    KokaPageState.InitialLoading
                } else {
                    state.pageState
                },
            )
        }
    }

    fun onRetryClicked() {
        pendingLoadedReveal = false
        _uiState.update { state ->
            state.copy(
                pageState = KokaPageState.InitialLoading,
                loadProgress = 12,
                isRefreshing = false,
            )
        }
    }

    override fun onCleared() {
        connectivityMonitor.stop()
        super.onCleared()
    }
}
