package com.koka.app.notifications

import android.Manifest
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import android.content.pm.PackageManager
import android.net.Uri
import android.os.Build
import androidx.core.app.NotificationCompat
import androidx.core.app.NotificationManagerCompat
import androidx.core.content.ContextCompat
import com.koka.app.MainActivity
import com.koka.app.R
import com.koka.app.web.KokaSiteConfig

object KokaNotificationHelper {
    const val CHANNEL_ID: String = "koka_airing_alerts"

    fun ensureChannel(context: Context) {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            val channel = NotificationChannel(
                CHANNEL_ID,
                context.getString(R.string.notif_channel_airing_name),
                NotificationManager.IMPORTANCE_DEFAULT,
            ).apply {
                description = context.getString(R.string.notif_channel_airing_desc)
                enableVibration(true)
            }
            val manager = context.getSystemService(Context.NOTIFICATION_SERVICE) as? NotificationManager
            manager?.createNotificationChannel(channel)
        }
    }

    fun hasPermission(context: Context): Boolean {
        return if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            ContextCompat.checkSelfPermission(
                context,
                Manifest.permission.POST_NOTIFICATIONS,
            ) == PackageManager.PERMISSION_GRANTED
        } else {
            NotificationManagerCompat.from(context).areNotificationsEnabled()
        }
    }

    fun showNotification(
        context: Context,
        title: String,
        body: String,
        tag: String?,
        targetUrl: String?,
    ) {
        if (!hasPermission(context)) return
        ensureChannel(context)

        val resolvedUrl = when {
            targetUrl.isNullOrBlank() -> KokaSiteConfig.HOME_URL
            targetUrl.startsWith("http://") || targetUrl.startsWith("https://") -> targetUrl
            targetUrl.startsWith("/") -> "${KokaSiteConfig.HOME_URL}$targetUrl"
            else -> "${KokaSiteConfig.HOME_URL}/$targetUrl"
        }

        val tapIntent = Intent(Intent.ACTION_VIEW, Uri.parse(resolvedUrl), context, MainActivity::class.java).apply {
            flags = Intent.FLAG_ACTIVITY_SINGLE_TOP or Intent.FLAG_ACTIVITY_CLEAR_TOP
        }

        val notifId = if (!tag.isNullOrBlank()) {
            tag.hashCode()
        } else {
            (title + body).hashCode()
        }

        val pendingIntent = PendingIntent.getActivity(
            context,
            notifId,
            tapIntent,
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE,
        )

        val notification = NotificationCompat.Builder(context, CHANNEL_ID)
            .setSmallIcon(R.drawable.ic_notification_koka)
            .setColor(0xFFD66879.toInt())
            .setContentTitle(title.ifBlank { context.getString(R.string.app_name) })
            .setContentText(body)
            .setStyle(NotificationCompat.BigTextStyle().bigText(body))
            .setPriority(NotificationCompat.PRIORITY_DEFAULT)
            .setAutoCancel(true)
            .setContentIntent(pendingIntent)
            .build()

        runCatching {
            NotificationManagerCompat.from(context).notify(notifId, notification)
        }
    }
}
