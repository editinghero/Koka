package com.koka.app.notifications

import android.content.Context
import androidx.work.Constraints
import androidx.work.CoroutineWorker
import androidx.work.ExistingPeriodicWorkPolicy
import androidx.work.NetworkType
import androidx.work.PeriodicWorkRequestBuilder
import androidx.work.WorkManager
import androidx.work.WorkerParameters
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import org.json.JSONArray
import org.json.JSONObject
import java.io.OutputStreamWriter
import java.net.HttpURLConnection
import java.net.URL
import java.util.concurrent.TimeUnit

class AiringCheckWorker(
    appContext: Context,
    params: WorkerParameters,
) : CoroutineWorker(appContext, params) {

    override suspend fun doWork(): Result = withContext(Dispatchers.IO) {
        if (!KokaNotificationHelper.hasPermission(applicationContext)) {
            return@withContext Result.success()
        }

        val store = AiringSyncStore(applicationContext)
        val snapshot = store.readSnapshot()

        val pendingObj = runCatching { JSONObject(snapshot.pendingJson) }.getOrElse { JSONObject() }
        if (pendingObj.length() == 0) {
            return@withContext Result.success()
        }

        val notifiedSet = linkedSetOf<String>()
        runCatching {
            val arr = JSONArray(snapshot.notifiedJson)
            for (i in 0 until arr.length()) {
                val key = arr.optString(i)
                if (key.isNotBlank()) notifiedSet.add(key)
            }
        }

        val bgNotifiedSet = linkedSetOf<String>()
        runCatching {
            val arr = JSONArray(snapshot.bgNotifiedJson)
            for (i in 0 until arr.length()) {
                val key = arr.optString(i)
                if (key.isNotBlank()) bgNotifiedSet.add(key)
            }
        }

        val titleByAnimeId = mutableMapOf<Int, String>()
        val iter = pendingObj.keys()
        while (iter.hasNext()) {
            val k = iter.next()
            val entry = pendingObj.optJSONObject(k) ?: continue
            val id = entry.optInt("id", 0)
            val title = entry.optString("title", "")
            if (id > 0 && title.isNotBlank()) {
                titleByAnimeId[id] = title
            }
        }

        val nowSec = System.currentTimeMillis() / 1000L
        if (titleByAnimeId.isNotEmpty()) {
            val freshEpisodes = fetchFreshAiringEpisodes(titleByAnimeId.keys.take(50))
            for ((animeId, epInfo) in freshEpisodes) {
                val key = "$animeId:${epInfo.first}"
                if (key !in notifiedSet && nowSec - epInfo.second <= MAX_AGE_SEC) {
                    val obj = JSONObject().apply {
                        put("id", animeId)
                        put("episode", epInfo.first)
                        put("airingAt", epInfo.second)
                        put("title", titleByAnimeId[animeId] ?: "Koka")
                    }
                    pendingObj.put(key, obj)
                }
            }
        }

        val keysToRemove = mutableListOf<String>()
        val scanKeys = pendingObj.keys()
        while (scanKeys.hasNext()) {
            val key = scanKeys.next()
            val entry = pendingObj.optJSONObject(key) ?: continue
            val id = entry.optInt("id", 0)
            val episode = entry.optInt("episode", 0)
            val airingAt = entry.optLong("airingAt", 0L)
            val title = entry.optString("title", "Koka")

            if (airingAt <= 0L || airingAt > nowSec) continue

            keysToRemove.add(key)
            val age = nowSec - airingAt
            if (age > MAX_AGE_SEC || key in notifiedSet) continue

            notifiedSet.add(key)
            bgNotifiedSet.add(key)

            KokaNotificationHelper.showNotification(
                context = applicationContext,
                title = title,
                body = "Episode $episode ${agoText(age)}",
                tag = "aired:$key",
                targetUrl = "/anime/$id",
            )
        }

        for (k in keysToRemove) {
            pendingObj.remove(k)
        }

        val cappedNotified = notifiedSet.toList().takeLast(MAX_NOTIFIED)
        val notifiedArr = JSONArray().apply { cappedNotified.forEach { put(it) } }
        val bgNotifiedArr = JSONArray().apply { bgNotifiedSet.toList().takeLast(MAX_NOTIFIED).forEach { put(it) } }

        store.saveFromWorker(
            pendingJson = pendingObj.toString(),
            notifiedJson = notifiedArr.toString(),
            bgNotifiedJson = bgNotifiedArr.toString(),
        )

        Result.success()
    }

    private fun fetchFreshAiringEpisodes(ids: List<Int>): Map<Int, Pair<Int, Long>> {
        val result = mutableMapOf<Int, Pair<Int, Long>>()
        if (ids.isEmpty()) return result

        runCatching {
            val conn = (URL(ANILIST_URL).openConnection() as HttpURLConnection).apply {
                requestMethod = "POST"
                connectTimeout = 10_000
                readTimeout = 10_000
                doOutput = true
                setRequestProperty("Content-Type", "application/json")
                setRequestProperty("Accept", "application/json")
            }

            val variables = JSONObject().apply {
                put("ids", JSONArray(ids))
            }
            val payload = JSONObject().apply {
                put(
                    "query",
                    "query (\$ids: [Int]) { Page(page: 1, perPage: 50) { media(id_in: \$ids, type: ANIME) { id nextAiringEpisode { episode airingAt } } } }",
                )
                put("variables", variables)
            }

            OutputStreamWriter(conn.outputStream).use { writer ->
                writer.write(payload.toString())
                writer.flush()
            }

            if (conn.responseCode in 200..299) {
                val body = conn.inputStream.bufferedReader().use { it.readText() }
                val mediaArr = JSONObject(body)
                    .optJSONObject("data")
                    ?.optJSONObject("Page")
                    ?.optJSONArray("media")

                if (mediaArr != null) {
                    for (i in 0 until mediaArr.length()) {
                        val m = mediaArr.optJSONObject(i) ?: continue
                        val id = m.optInt("id", 0)
                        val next = m.optJSONObject("nextAiringEpisode") ?: continue
                        val ep = next.optInt("episode", 0)
                        val airingAt = next.optLong("airingAt", 0L)
                        if (id > 0 && ep > 0 && airingAt > 0L) {
                            result[id] = ep to airingAt
                        }
                    }
                }
            }
            conn.disconnect()
        }
        return result
    }

    private fun agoText(seconds: Long): String {
        if (seconds < 90L) return "just aired"
        val mins = ((seconds + 30L) / 60L).toInt()
        if (mins < 90) return "aired $mins min ago"
        val hrs = ((mins + 30) / 60)
        return "aired ${hrs}h ago"
    }

    companion object {
        private const val WORK_NAME = "koka_airing_check_3h"
        private const val ANILIST_URL = "https://graphql.anilist.co"
        private const val MAX_AGE_SEC = 12L * 3600L
        private const val MAX_NOTIFIED = 400

        fun schedulePeriodic(context: Context) {
            val constraints = Constraints.Builder()
                .setRequiredNetworkType(NetworkType.CONNECTED)
                .build()

            val request = PeriodicWorkRequestBuilder<AiringCheckWorker>(3, TimeUnit.HOURS)
                .setConstraints(constraints)
                .build()

            WorkManager.getInstance(context.applicationContext).enqueueUniquePeriodicWork(
                WORK_NAME,
                ExistingPeriodicWorkPolicy.KEEP,
                request,
            )
        }
    }
}
