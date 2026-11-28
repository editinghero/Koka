package com.koka.app.notifications

import android.content.Context
import androidx.datastore.preferences.core.booleanPreferencesKey
import androidx.datastore.preferences.core.edit
import androidx.datastore.preferences.core.stringPreferencesKey
import androidx.datastore.preferences.preferencesDataStore
import kotlinx.coroutines.flow.first

private val Context.kokaAiringDataStore by preferencesDataStore(name = "koka_airing_sync")

data class AiringSyncSnapshot(
    val pendingJson: String,
    val notifiedJson: String,
    val bgNotifiedJson: String,
    val permissionRequested: Boolean,
)

class AiringSyncStore(private val context: Context) {
    private object Keys {
        val PENDING_JSON = stringPreferencesKey("pending_json")
        val NOTIFIED_JSON = stringPreferencesKey("notified_json")
        val BG_NOTIFIED_JSON = stringPreferencesKey("bg_notified_json")
        val PERMISSION_REQUESTED = booleanPreferencesKey("permission_requested")
    }

    suspend fun readSnapshot(): AiringSyncSnapshot {
        val prefs = context.kokaAiringDataStore.data.first()
        return AiringSyncSnapshot(
            pendingJson = prefs[Keys.PENDING_JSON] ?: "{}",
            notifiedJson = prefs[Keys.NOTIFIED_JSON] ?: "[]",
            bgNotifiedJson = prefs[Keys.BG_NOTIFIED_JSON] ?: "[]",
            permissionRequested = prefs[Keys.PERMISSION_REQUESTED] ?: false,
        )
    }

    suspend fun saveFromWeb(pendingJson: String, notifiedJson: String) {
        context.kokaAiringDataStore.edit { prefs ->
            prefs[Keys.PENDING_JSON] = pendingJson
            prefs[Keys.NOTIFIED_JSON] = notifiedJson
        }
    }

    suspend fun saveFromWorker(
        pendingJson: String,
        notifiedJson: String,
        bgNotifiedJson: String,
    ) {
        context.kokaAiringDataStore.edit { prefs ->
            prefs[Keys.PENDING_JSON] = pendingJson
            prefs[Keys.NOTIFIED_JSON] = notifiedJson
            prefs[Keys.BG_NOTIFIED_JSON] = bgNotifiedJson
        }
    }

    suspend fun consumeBackgroundNotifiedJson(): String {
        var result = "[]"
        context.kokaAiringDataStore.edit { prefs ->
            result = prefs[Keys.BG_NOTIFIED_JSON] ?: "[]"
            prefs[Keys.BG_NOTIFIED_JSON] = "[]"
        }
        return result
    }

    suspend fun markPermissionRequested() {
        context.kokaAiringDataStore.edit { prefs ->
            prefs[Keys.PERMISSION_REQUESTED] = true
        }
    }
}
