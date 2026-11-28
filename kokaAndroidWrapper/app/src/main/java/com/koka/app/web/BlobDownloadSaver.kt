package com.koka.app.web

import android.content.ContentValues
import android.content.Context
import android.os.Build
import android.os.Environment
import android.provider.MediaStore
import android.util.Base64
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import java.io.File

object BlobDownloadSaver {

    suspend fun saveBase64File(
        context: Context,
        rawFileName: String,
        mimeType: String,
        base64Payload: String,
    ): Result<String> = withContext(Dispatchers.IO) {
        runCatching {
            val safeName = sanitizeFileName(rawFileName, mimeType)
            val bytes = Base64.decode(base64Payload, Base64.DEFAULT)

            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
                val values = ContentValues().apply {
                    put(MediaStore.Downloads.DISPLAY_NAME, safeName)
                    put(MediaStore.Downloads.MIME_TYPE, mimeType.ifBlank { "application/octet-stream" })
                    put(MediaStore.Downloads.RELATIVE_PATH, "${Environment.DIRECTORY_DOWNLOADS}/Koka")
                    put(MediaStore.Downloads.IS_PENDING, 1)
                }
                val resolver = context.contentResolver
                val uri = resolver.insert(MediaStore.Downloads.EXTERNAL_CONTENT_URI, values)
                    ?: error("Could not create MediaStore download entry")
                try {
                    resolver.openOutputStream(uri)?.use { stream ->
                        stream.write(bytes)
                        stream.flush()
                    } ?: error("Could not open output stream")
                    values.clear()
                    values.put(MediaStore.Downloads.IS_PENDING, 0)
                    resolver.update(uri, values, null, null)
                } catch (e: Throwable) {
                    resolver.delete(uri, null, null)
                    throw e
                }
            } else {
                val downloadsDir = context.getExternalFilesDir(Environment.DIRECTORY_DOWNLOADS)
                    ?: context.filesDir
                val targetDir = File(downloadsDir, "Koka").apply { mkdirs() }
                val targetFile = File(targetDir, safeName)
                targetFile.writeBytes(bytes)
            }
            safeName
        }
    }

    private fun sanitizeFileName(raw: String, mimeType: String): String {
        val base = raw
            .substringAfterLast('/')
            .substringAfterLast('\\')
            .replace(Regex("[^a-zA-Z0-9._-]"), "_")
            .trim('.')
            .ifBlank { "koka-export-${System.currentTimeMillis()}" }

        if ('.' in base) return base

        val ext = when {
            mimeType.contains("json", ignoreCase = true) -> "json"
            mimeType.contains("csv", ignoreCase = true) -> "csv"
            mimeType.contains("html", ignoreCase = true) -> "html"
            mimeType.contains("png", ignoreCase = true) -> "png"
            mimeType.contains("jpeg", ignoreCase = true) || mimeType.contains("jpg", ignoreCase = true) -> "jpg"
            mimeType.contains("xml", ignoreCase = true) -> "xml"
            else -> "txt"
        }
        return "$base.$ext"
    }
}
