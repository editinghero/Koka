package com.koka.app.web

import android.content.Context
import android.graphics.Color as AndroidColor
import androidx.datastore.preferences.core.booleanPreferencesKey
import androidx.datastore.preferences.core.edit
import androidx.datastore.preferences.core.intPreferencesKey
import androidx.datastore.preferences.preferencesDataStore
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.map

private val Context.kokaThemeDataStore by preferencesDataStore(name = "koka_shell_theme")

data class SyncedKokaTheme(
    val backgroundArgb: Int = DEFAULT_BG_ARGB,
    val surfaceArgb: Int = DEFAULT_SURFACE_ARGB,
    val primaryArgb: Int = DEFAULT_PRIMARY_ARGB,
    val isDark: Boolean = true,
) {
    companion object {

        const val DEFAULT_BG_ARGB: Int = 0xFF141414.toInt()
        const val DEFAULT_SURFACE_ARGB: Int = 0xFF22191A.toInt()
        const val DEFAULT_PRIMARY_ARGB: Int = 0xFFD66879.toInt()
    }
}

class ThemeSyncStore(private val context: Context) {
    private object Keys {
        val BG = intPreferencesKey("bg_argb")
        val SURFACE = intPreferencesKey("surface_argb")
        val PRIMARY = intPreferencesKey("primary_argb")
        val IS_DARK = booleanPreferencesKey("is_dark")
    }

    val syncedThemeFlow: Flow<SyncedKokaTheme> = context.kokaThemeDataStore.data.map { prefs ->
        SyncedKokaTheme(
            backgroundArgb = prefs[Keys.BG] ?: SyncedKokaTheme.DEFAULT_BG_ARGB,
            surfaceArgb = prefs[Keys.SURFACE] ?: SyncedKokaTheme.DEFAULT_SURFACE_ARGB,
            primaryArgb = prefs[Keys.PRIMARY] ?: SyncedKokaTheme.DEFAULT_PRIMARY_ARGB,
            isDark = prefs[Keys.IS_DARK] ?: true,
        )
    }

    suspend fun save(theme: SyncedKokaTheme) {
        context.kokaThemeDataStore.edit { prefs ->
            prefs[Keys.BG] = theme.backgroundArgb
            prefs[Keys.SURFACE] = theme.surfaceArgb
            prefs[Keys.PRIMARY] = theme.primaryArgb
            prefs[Keys.IS_DARK] = theme.isDark
        }
    }

    companion object {
        fun parseHexOrDefault(hex: String?, fallback: Int): Int {
            if (hex.isNullOrBlank()) return fallback
            return runCatching { AndroidColor.parseColor(hex.trim()) }.getOrDefault(fallback)
        }
    }
}
