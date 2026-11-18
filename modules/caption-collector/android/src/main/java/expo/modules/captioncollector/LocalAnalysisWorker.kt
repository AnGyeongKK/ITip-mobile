package expo.modules.captioncollector

import android.annotation.SuppressLint
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.app.ActivityManager
import android.app.ForegroundServiceStartNotAllowedException
import android.content.Context
import android.content.Intent
import android.content.pm.ServiceInfo
import android.net.Uri
import android.util.Log
import androidx.core.app.NotificationCompat
import androidx.core.app.NotificationManagerCompat
import androidx.work.*
import expo.modules.kotlin.exception.CodedException
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.delay
import kotlinx.coroutines.withContext
import org.json.JSONArray
import org.json.JSONObject
import org.json.JSONException
import java.io.File
import java.io.IOException
import java.net.HttpURLConnection
import java.net.URL
import java.time.Instant
import java.util.UUID
import java.util.concurrent.TimeUnit

/** 로컬 시연 전용. React 화면 수명과 독립적으로 수집·업로드·상태 조회를 진행한다. */
class LocalAnalysisWorker(context: Context, parameters: WorkerParameters) : CoroutineWorker(context, parameters) {
  private val prefs = context.getSharedPreferences("itip-local-analysis", Context.MODE_PRIVATE)
  private val batchId = inputData.getString("batchId")!!
  private val baseUrl = inputData.getString("baseUrl")!!
  private val engine = CaptionCollectorEngine(context)

  override suspend fun doWork(): Result = withContext(Dispatchers.IO) {
    val manager = applicationContext.getSystemService(NotificationManager::class.java)
    manager.createNotificationChannel(NotificationChannel("analysis", "분석 완료 알림", NotificationManager.IMPORTANCE_HIGH))
    manager.createNotificationChannel(NotificationChannel("analysis-progress", "분석 진행 상태", NotificationManager.IMPORTANCE_LOW))
    val progress = NotificationCompat.Builder(applicationContext, "analysis-progress")
      .setSmallIcon(android.R.drawable.stat_sys_download)
      .setContentTitle("영상 분석을 진행하고 있어요")
      .setContentText("자막 수집과 로컬 서버 처리를 기다리고 있어요.")
      .setOngoing(true).setContentIntent(openBatch()).build()
    val process = ActivityManager.RunningAppProcessInfo()
    ActivityManager.getMyMemoryState(process)
    var foreground = false
    if (process.importance == ActivityManager.RunningAppProcessInfo.IMPORTANCE_FOREGROUND) {
      try {
        setForeground(ForegroundInfo(batchId.hashCode() and Int.MAX_VALUE, progress, ServiceInfo.FOREGROUND_SERVICE_TYPE_DATA_SYNC))
        foreground = true
      } catch (_: ForegroundServiceStartNotAllowedException) {
        // 화면 종료와 시작이 겹치면 일반 WorkManager 실행 시간 안에서 처리한다.
      }
    }
    val runStarted = System.currentTimeMillis()
    val started = prefs.getLong("started-$batchId", System.currentTimeMillis())
    prefs.edit().putLong("started-$batchId", started).apply()
    try {
      while (!isStopped && System.currentTimeMillis() - started < TimeUnit.HOURS.toMillis(1)) {
        if (!foreground && System.currentTimeMillis() - runStarted > TimeUnit.MINUTES.toMillis(8)) {
          return@withContext Result.retry()
        }
        val batch = api("GET", "/api/v1/analysis-batches/$batchId")
        setState("PROCESSING")
        if (batch.getString("status") in setOf("COMPLETED", "PARTIALLY_FAILED", "FAILED")) {
          complete(batch)
          return@withContext Result.success()
        }
        val items = batch.getJSONArray("items")
        for (index in 0 until items.length()) {
          if (isStopped) return@withContext Result.retry()
          val item = items.getJSONObject(index)
          if (item.getString("status") != "AWAITING_UPLOAD") continue
          if (!prefs.getBoolean("allow-$batchId", false) || prefs.getBoolean("blocked", false)) continue
          if (!Instant.parse(item.getString("uploadDeadlineAt")).isAfter(Instant.now())) continue
          synchronized(collectionLock) {
            if (!prefs.getBoolean("blocked", false)) collectAndSubmit(item)
          }
        }
        prefs.edit().remove("network-failures-$batchId").apply()
        delay(batch.optLong("nextPollAfterMs", 3000).coerceIn(3000, 15000))
      }
      pause()
      Result.failure()
    } catch (error: ApiFailure) {
      Log.w("ITipLocalAnalysis", "batchId=$batchId httpStatus=${error.status}")
      if (error.status in setOf(401, 403, 404)) {
        pause()
        Result.failure()
      } else retryNetwork()
    } catch (error: IOException) {
      Log.w("ITipLocalAnalysis", "batchId=$batchId network=${error.javaClass.simpleName}")
      retryNetwork()
    } catch (error: JSONException) {
      Log.w("ITipLocalAnalysis", "batchId=$batchId invalidResponse")
      pause()
      Result.failure()
    }
  }

  private fun retryNetwork(): Result {
    val failures = prefs.getInt("network-failures-$batchId", 0) + 1
    prefs.edit().putInt("network-failures-$batchId", failures).commit()
    if (failures < 3) {
      setState("RETRY_WAIT")
      return Result.retry()
    }
    pause()
    return Result.failure()
  }

  private fun pause() {
    prefs.edit().putBoolean("allow-$batchId", false).putBoolean("halted-$batchId", true).commit()
    setState("PAUSED")
  }

  private fun collectAndSubmit(item: JSONObject) {
    val itemId = item.getString("itemId")
    val videoId = item.getString("videoId")
    val file = File(applicationContext.filesDir, "local-analysis/$batchId/$itemId.json")
    var uploadId = prefs.getString("upload-$itemId", null)
    try {
      if (uploadId == null) {
        val duration = item.optJSONObject("video")?.optLong("durationMs", -1) ?: -1
        if (duration > 3_600_000) {
          reportFailure(itemId, "DURATION_EXCEEDED")
          return
        }
        setState("COLLECTING", itemId)
        if (!file.exists()) {
          if (!updatedCollector) {
            try { engine.update() } catch (_: CodedException) { /* 기존 설치 버전으로 수집한다. */ }
            updatedCollector = true
          }
          val raw = try {
            engine.collect(videoId).getValue("json3")
          } catch (error: CodedException) {
            if (error.code != "FAILED") throw error
            engine.collect(videoId).getValue("json3")
          }
          val caption = caption(raw, videoId, duration)
          file.parentFile!!.mkdirs()
          val temporary = File(file.parentFile, "$itemId.tmp")
          temporary.writeText(caption.toString())
          if (!temporary.renameTo(file)) throw IOException("Caption cache commit failed")
        }
        setState("UPLOADING", itemId)
        val body = file.readBytes()
        var ticket = issueUpload(itemId, videoId, body.size)
        try {
          upload(ticket, body)
        } catch (expired: ApiFailure) {
          if (expired.status != 403) throw expired
          ticket = issueUpload(itemId, videoId, body.size)
          upload(ticket, body)
        }
        uploadId = ticket.getString("uploadId")
        prefs.edit().putString("upload-$itemId", uploadId).commit()
      }
      val key = UUID.nameUUIDFromBytes("local-$itemId-$uploadId".toByteArray()).toString()
      api("POST", "/api/v1/analysis-jobs", JSONObject()
        .put("batchId", batchId).put("batchItemId", itemId).put("uploadId", uploadId),
        mapOf("Idempotency-Key" to key))
      file.delete()
      prefs.edit().remove("upload-$itemId").apply()
      setState("PROCESSING")
    } catch (failure: CodedException) {
      Log.w("ITipLocalAnalysis", "batchId=$batchId itemId=$itemId captionCode=${failure.code} reason=${failure.message?.replace(Regex("https?://\\S+"), "[url]")?.take(300)}")
      val code = when (failure.code) {
        "RATE_LIMITED" -> "COLLECTION_RATE_LIMITED"
        "NO_CAPTION" -> "KOREAN_CAPTION_NOT_FOUND"
        "VIDEO_UNAVAILABLE" -> "VIDEO_UNAVAILABLE"
        else -> "UPLOAD_FAILED"
      }
      if (code == "COLLECTION_RATE_LIMITED") prefs.edit().putBoolean("blocked", true).putBoolean("allow-$batchId", false).commit()
      setState(if (code == "COLLECTION_RATE_LIMITED") "RATE_LIMITED" else "PROCESSING")
      reportFailure(itemId, code)
    } catch (failure: ApiFailure) {
      Log.w("ITipLocalAnalysis", "batchId=$batchId itemId=$itemId uploadOrSubmitStatus=${failure.status}")
      if (failure.status >= 500) throw failure
      if (failure.status != 409) reportFailure(itemId, "UPLOAD_FAILED")
      setState("PROCESSING")
    } catch (_: JSONException) {
      reportFailure(itemId, "UPLOAD_FAILED")
      setState("PROCESSING")
    }
  }

  private fun caption(raw: String, videoId: String, duration: Long): JSONObject {
    val events = JSONObject(raw).getJSONArray("events")
    val segments = JSONArray()
    var previous = 0L
    for (index in 0 until events.length()) {
      val event = events.getJSONObject(index)
      val parts = event.optJSONArray("segs") ?: continue
      val text = (0 until parts.length()).joinToString("") { parts.getJSONObject(it).optString("utf8", "") }
      if (text.isBlank()) continue
      val start = event.getLong("tStartMs")
      val rawEnd = start + event.getLong("dDurationMs")
      if (start < previous || start < 0 || rawEnd <= start) {
        throw CodedException("FAILED", "Invalid caption timestamps start=$start end=$rawEnd previous=$previous duration=$duration", null)
      }
      if (duration >= 0 && start >= duration) continue
      val end = if (duration >= 0) minOf(rawEnd, duration) else rawEnd
      if (end != rawEnd) Log.i("ITipLocalAnalysis", "batchId=$batchId clippedCaptionEnd=$rawEnd videoDuration=$duration")
      segments.put(JSONObject().put("startMs", start).put("endMs", end).put("text", text))
      previous = start
    }
    if (segments.length() == 0) throw CodedException("NO_CAPTION", "No Korean captions", null)
    return JSONObject().put("videoId", videoId).put("language", "ko").put("segments", segments)
  }

  private fun issueUpload(itemId: String, videoId: String, size: Int) =
    api("POST", "/api/v1/caption-uploads", JSONObject().put("batchId", batchId)
      .put("batchItemId", itemId).put("videoId", videoId).put("contentType", "application/json").put("sizeBytes", size))

  private fun upload(ticket: JSONObject, body: ByteArray) {
    val headers = ticket.getJSONObject("headers")
    val values = headers.keys().asSequence().associateWith { headers.getString(it) }
    request(URL(ticket.getString("uploadUrl")), "PUT", body, values)
  }

  private fun reportFailure(itemId: String, code: String) {
    try {
      api("PATCH", "/api/v1/analysis-batches/$batchId/items/$itemId",
        JSONObject().put("collectionFailure", JSONObject().put("code", code)))
    } catch (conflict: ApiFailure) {
      if (conflict.status != 409) throw conflict
    }
  }

  private fun api(method: String, path: String, body: JSONObject? = null, headers: Map<String, String> = emptyMap()): JSONObject {
    val bytes = request(URL(baseUrl + path), method, body?.toString()?.toByteArray(),
      mapOf("Content-Type" to "application/json", "Accept" to "application/json") + headers)
    return JSONObject(bytes.toString(Charsets.UTF_8)).optJSONObject("data") ?: JSONObject()
  }

  private fun request(url: URL, method: String, body: ByteArray?, headers: Map<String, String>): ByteArray {
    val connection = url.openConnection() as HttpURLConnection
    try {
      connection.requestMethod = method
      connection.connectTimeout = 15000
      connection.readTimeout = 30000
      connection.instanceFollowRedirects = false
      headers.forEach { (name, value) -> connection.setRequestProperty(name, value) }
      if (body != null) {
        connection.doOutput = true
        connection.setFixedLengthStreamingMode(body.size)
        connection.outputStream.use { it.write(body) }
      }
      val status = connection.responseCode
      if (status !in 200..299) throw ApiFailure(status)
      return connection.inputStream.use { it.readBytes() }
    } finally {
      connection.disconnect()
    }
  }

  @SuppressLint("MissingPermission")
  private fun complete(batch: JSONObject) {
    val counts = batch.getJSONObject("counts")
    val items = batch.getJSONArray("items")
    val only = if (items.length() == 1) items.getJSONObject(0) else null
    val analysisId = only?.optString("analysisId")?.takeIf { it != "null" && it.isNotBlank() }
    val route = if (analysisId != null) "result/$analysisId" else "analyze/$batchId"
    val notification = NotificationCompat.Builder(applicationContext, "analysis")
      .setSmallIcon(android.R.drawable.stat_sys_download_done)
      .setContentTitle("영상 처리가 끝났어요")
      .setContentText("성공 ${counts.getInt("completed")}개, 실패 ${counts.getInt("failed")}개")
      .setContentIntent(openRoute(route)).setAutoCancel(true).setOnlyAlertOnce(true).build()
    if (NotificationManagerCompat.from(applicationContext).areNotificationsEnabled()) {
      NotificationManagerCompat.from(applicationContext).notify(batchId, 1, notification)
    }
    setState("COMPLETED")
    prefs.edit().putBoolean("finished-$batchId", true).apply()
    Log.i("ITipLocalAnalysis", "batchId=$batchId completed=${counts.getInt("completed")} failed=${counts.getInt("failed")}")
  }

  private fun openBatch() = openRoute("analyze/$batchId")
  private fun openRoute(route: String): PendingIntent {
    val intent = Intent(Intent.ACTION_VIEW, Uri.parse("itipmobile:///$route"))
      .setPackage(applicationContext.packageName).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_SINGLE_TOP)
    return PendingIntent.getActivity(applicationContext, 0, intent, PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE)
  }

  private fun setState(phase: String, itemId: String? = null) {
    prefs.edit().putString("state-$batchId", JSONObject().put("phase", phase).put("itemId", itemId).toString()).apply()
  }

  private class ApiFailure(val status: Int) : IOException()

  companion object {
    internal val collectionLock = Any()
    private var updatedCollector = false
    fun enqueue(context: Context, batchId: String, baseUrl: String, collect: Boolean, resume: Boolean = false) {
      UUID.fromString(batchId)
      val url = URL(baseUrl)
      require(url.protocol in setOf("http", "https") && url.userInfo == null && url.query == null && url.ref == null)
      val prefs = context.getSharedPreferences("itip-local-analysis", Context.MODE_PRIVATE)
      if (prefs.getBoolean("finished-$batchId", false)) return
      if (resume) {
        prefs.edit().putBoolean("allow-$batchId", true).putBoolean("blocked", false)
          .remove("halted-$batchId").remove("started-$batchId").remove("network-failures-$batchId")
          .putString("state-$batchId", JSONObject().put("phase", "PROCESSING").toString()).commit()
      } else if (collect && !prefs.getBoolean("blocked", false) && !prefs.getBoolean("halted-$batchId", false)) {
        prefs.edit().putBoolean("allow-$batchId", true).commit()
      }
      if (prefs.getBoolean("halted-$batchId", false)) return
      val work = OneTimeWorkRequestBuilder<LocalAnalysisWorker>()
        .setInputData(workDataOf("batchId" to batchId, "baseUrl" to baseUrl.trimEnd('/')))
        .setConstraints(Constraints.Builder().setRequiredNetworkType(NetworkType.CONNECTED).build())
        .setBackoffCriteria(BackoffPolicy.EXPONENTIAL, 10, TimeUnit.SECONDS).build()
      WorkManager.getInstance(context).enqueueUniqueWork("itip-local-$batchId", ExistingWorkPolicy.KEEP, work)
    }

    fun state(context: Context, batchId: String): String {
      val prefs = context.getSharedPreferences("itip-local-analysis", Context.MODE_PRIVATE)
      if (prefs.getBoolean("blocked", false)) return JSONObject().put("phase", "RATE_LIMITED").toString()
      return prefs.getString("state-$batchId", "{}")!!
    }
  }
}
