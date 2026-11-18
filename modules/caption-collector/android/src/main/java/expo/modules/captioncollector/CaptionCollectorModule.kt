package expo.modules.captioncollector

import expo.modules.kotlin.exception.CodedException
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition

class CaptionCollectorModule : Module() {
  private val engine by lazy { CaptionCollectorEngine(context()) }

  override fun definition() = ModuleDefinition {
    Name("CaptionCollector")
    AsyncFunction("collect") { videoId: String ->
      synchronized(LocalAnalysisWorker.collectionLock) { engine.collect(videoId) }
    }
    AsyncFunction("updateYtDlp") { ->
      synchronized(LocalAnalysisWorker.collectionLock) { engine.update() }
    }
    AsyncFunction("startLocalAnalysis") { batchId: String, baseUrl: String, collect: Boolean ->
      LocalAnalysisWorker.enqueue(context(), batchId, baseUrl, collect)
    }
    AsyncFunction("resumeLocalAnalysis") { batchId: String, baseUrl: String ->
      LocalAnalysisWorker.enqueue(context(), batchId, baseUrl, true, true)
    }
    AsyncFunction("localAnalysisState") { batchId: String ->
      LocalAnalysisWorker.state(context(), batchId)
    }
  }

  private fun context() =
    appContext.reactContext?.applicationContext
      ?: throw CodedException("FAILED", "Android context is not available", null)
}
