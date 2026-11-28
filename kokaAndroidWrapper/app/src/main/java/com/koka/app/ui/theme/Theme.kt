package com.koka.app.ui.theme

import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.darkColorScheme
import androidx.compose.material3.lightColorScheme
import androidx.compose.runtime.Composable
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.luminance
import com.koka.app.web.SyncedKokaTheme

@Composable
fun KokaTheme(
    syncedTheme: SyncedKokaTheme = SyncedKokaTheme(),
    content: @Composable () -> Unit,
) {
    val bgColor = Color(syncedTheme.backgroundArgb)
    val surfaceColor = Color(syncedTheme.surfaceArgb)
    val primaryColor = Color(syncedTheme.primaryArgb)
    val onPrimary = if (primaryColor.luminance() > 0.5f) KokaPaperOnLight else KokaUmeOnDark

    val colorScheme = if (syncedTheme.isDark) {
        darkColorScheme(
            primary = primaryColor,
            onPrimary = onPrimary,
            background = bgColor,
            onBackground = KokaUmeOnDark,
            surface = surfaceColor,
            onSurface = KokaUmeOnDark,
            onSurfaceVariant = KokaUmeMutedDark,
            outline = Color(0xFF332A2C),
        )
    } else {
        lightColorScheme(
            primary = primaryColor,
            onPrimary = onPrimary,
            background = bgColor,
            onBackground = KokaPaperOnLight,
            surface = surfaceColor,
            onSurface = KokaPaperOnLight,
            onSurfaceVariant = KokaPaperMutedLight,
            outline = Color(0xFFE0DCDD),
        )
    }

    MaterialTheme(
        colorScheme = colorScheme,
        typography = KokaTypography,
        content = content,
    )
}
