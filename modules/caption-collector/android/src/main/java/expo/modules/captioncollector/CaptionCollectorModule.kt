package expo.modules.captioncollector

import android.util.Log
import com.yausername.youtubedl_android.YoutubeDL
import com.yausername.youtubedl_android.YoutubeDLRequest
import expo.modules.kotlin.exception.CodedException
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition
import java.io.File

class CaptionCollectorModule : Module() {
  private var initialized = false

  override fun definition() = ModuleDefinition {
    Name("CaptionCollector")

    // 반환: { source: "manual" | "auto-orig" | "auto", json3: "<자막 json3 원문>" }
    // 실패 코드: NO_CAPTION / VIDEO_UNAVAILABLE / RATE_LIMITED / FAILED
    AsyncFunction("collect") { videoId: String -> collect(videoId) }

    AsyncFunction("updateYtDlp") { -> update() }
  }

  private fun context() =
    appContext.reactContext?.applicationContext
      ?: throw CodedException("FAILED", "Android context is not available", null)

  @Synchronized
  private fun ensureInit() {
    if (initialized) return
    try {
      YoutubeDL.getInstance().init(context())
      initialized = true
    } catch (e: Exception) {
      throw initializationFailed(e)
    } catch (e: LinkageError) {
      throw initializationFailed(e)
    }
  }

  private fun initializationFailed(error: Throwable): CodedException {
    Log.e("CaptionCollector", "yt-dlp initialization failed (${error.javaClass.simpleName})")
    return CodedException("INITIALIZATION_FAILED", "Caption collector initialization failed", null)
  }

  private fun update(): String {
    ensureInit()
    return try {
      YoutubeDL.getInstance().updateYoutubeDL(context(), YoutubeDL.UpdateChannel.STABLE)?.toString() ?: "UNKNOWN"
    } catch (e: Exception) {
      throw CodedException("FAILED", e.message, e)
    }
  }

  private fun collect(videoId: String): Map<String, String> {
    // 옵션 주입 방지: 영상 ID 형식만 허용
    if (!Regex("^[A-Za-z0-9_-]{6,20}$").matches(videoId)) {
      throw CodedException("VIDEO_UNAVAILABLE", "Invalid video id", null)
    }
    ensureInit()
    val dir = File(context().cacheDir, "captions/$videoId")
    dir.deleteRecursively()
    dir.mkdirs()
    try {
      // 1) 수동 한국어 자막
      run(videoId, dir, auto = false)
      read(dir, videoId, "ko")?.let { return mapOf("source" to "manual", "json3" to it) }

      // 2) 자동 자막: ko-orig 우선, 없으면 ko
      run(videoId, dir, auto = true)
      read(dir, videoId, "ko-orig")?.let { return mapOf("source" to "auto-orig", "json3" to it) }
      read(dir, videoId, "ko")?.let { return mapOf("source" to "auto", "json3" to it) }

      throw CodedException("NO_CAPTION", "No Korean captions", null)
    } finally {
      dir.deleteRecursively()
    }
  }

  private fun read(dir: File, videoId: String, lang: String): String? {
    val f = File(dir, "$videoId.$lang.json3")
    return if (f.exists() && f.length() > 0) f.readText() else null
  }

  private fun run(videoId: String, dir: File, auto: Boolean) {
    val req = YoutubeDLRequest("https://www.youtube.com/watch?v=$videoId")
    req.addOption("--skip-download")
    req.addOption("--no-playlist")
    if (auto) {
      req.addOption("--write-auto-subs")
      req.addOption("--sub-langs", "ko-orig,ko")
    } else {
      req.addOption("--write-subs")
      req.addOption("--sub-langs", "ko")
    }
    req.addOption("--sub-format", "json3")
    req.addOption("-o", File(dir, "%(id)s.%(ext)s").absolutePath)
    try {
      YoutubeDL.getInstance().execute(req)
    } catch (e: Exception) {
      throw classify(e)
    }
  }

  private fun classify(e: Exception): CodedException {
    val msg = (e.message ?: "").lowercase()
    val code = when {
      "429" in msg || "too many requests" in msg || "not a bot" in msg || "confirm you" in msg -> "RATE_LIMITED"
      "video unavailable" in msg || "private video" in msg || "has been removed" in msg ||
        "members-only" in msg || "not available" in msg -> "VIDEO_UNAVAILABLE"
      else -> "FAILED"
    }
    return CodedException(code, e.message, e)
  }
}
