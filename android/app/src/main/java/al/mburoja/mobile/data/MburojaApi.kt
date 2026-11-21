package al.mburoja.mobile.data

import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import kotlinx.serialization.encodeToString
import kotlinx.serialization.json.Json
import okhttp3.MediaType.Companion.toMediaType
import okhttp3.OkHttpClient
import okhttp3.Request
import okhttp3.RequestBody.Companion.toRequestBody
import java.util.concurrent.TimeUnit

class MburojaApi {
    private val json = Json { ignoreUnknownKeys = true; encodeDefaults = true; explicitNulls = false }
    private val client = OkHttpClient.Builder()
        .connectTimeout(20, TimeUnit.SECONDS)
        .readTimeout(60, TimeUnit.SECONDS)
        .build()
    private val media = "application/json; charset=utf-8".toMediaType()

    suspend fun register(server: String, installHash: String): String {
        val body = json.encodeToString(RegisterBody(installHash, VERSION))
        val res = call(server, "/api/v1/extension/register", body, token = null)
        return json.decodeFromString<RegisterResponse>(res).installToken
    }

    suspend fun scan(server: String, token: String, body: ScanBody): ScanResultDto {
        val raw = call(server, "/api/v1/scan", json.encodeToString(body), token)
        return json.decodeFromString(raw)
    }

    suspend fun submitMessage(server: String, token: String, text: String, sender: String?, locale: String): String {
        val payload = buildString {
            append("""{"channel":"SMS","source":"manual_input","message":{"text":""")
            append(json.encodeToString(text))
            if (!sender.isNullOrBlank()) {
                append(""","sender":""")
                append(json.encodeToString(sender.take(64)))
            }
            append("""},"options":{"locale":""")
            append(json.encodeToString(locale))
            append(""","useVirusTotal":true,"aiMode":"hybrid","allowCloudAnalysis":true,"threatAttribution":true}}""")
        }
        val raw = call(server, "/api/phishing-intelligence/scan", payload, token)
        return json.decodeFromString<SubmitResponse>(raw).scanId
    }

    suspend fun scanStatus(server: String, token: String, scanId: String): ScanStatusDto {
        val raw = call(server, "/api/phishing-intelligence/scans/$scanId", body = null, token = token, method = "GET")
        return json.decodeFromString(raw)
    }

    suspend fun report(server: String, token: String, scanId: String): PiReportDto {
        val raw = call(server, "/api/phishing-intelligence/reports/$scanId", body = null, token = token, method = "GET")
        return json.decodeFromString(raw)
    }

    suspend fun submitSignal(server: String, token: String, signals: SignalBody): ReportResponse {
        val raw = call(server, "/api/v1/extension/reports", json.encodeToString(ReportRequest(signals)), token)
        return json.decodeFromString(raw)
    }

    suspend fun deleteSignal(server: String, token: String, reportId: String) {
        call(server, "/api/v1/extension/reports/$reportId", body = null, token = token, method = "DELETE")
    }

    suspend fun feed(server: String): List<FeedItemDto> {
        val raw = call(server, "/api/v1/feed", body = null, token = null, method = "GET")
        return json.decodeFromString<FeedResponse>(raw).data
    }

    suspend fun track(server: String, protocol: String, token: String): TimelineDto {
        val url = server.trimEnd('/') + "/api/v1/reports/" + java.net.URLEncoder.encode(protocol, "UTF-8").replace("+", "%20")
        val req = Request.Builder().url(url).header("X-Tracking-Token", token).header("Accept", "application/json").get().build()
        return json.decodeFromString(execute(req))
    }

    private suspend fun call(server: String, path: String, body: String?, token: String?, method: String = if (body == null) "GET" else "POST"): String {
        val builder = Request.Builder()
            .url(server.trimEnd('/') + path)
            .header("Accept", "application/json")
        if (token != null) builder.header("Authorization", "Bearer $token")
        when (method) {
            "GET" -> builder.get()
            "DELETE" -> builder.delete()
            else -> builder.post((body ?: "").toRequestBody(media))
        }
        return execute(builder.build())
    }

    // Android forbids network calls on the main thread, so every request runs on the IO pool.
    private suspend fun execute(req: Request): String = withContext(Dispatchers.IO) {
        client.newCall(req).execute().use { res ->
            val text = res.body?.string().orEmpty()
            if (res.isSuccessful) return@use text.ifBlank { "{}" }
            val err = runCatching { json.decodeFromString<ApiErrorBody>(text).error }.getOrNull()
            throw ApiException(res.code, err?.code ?: "http_error", err?.message ?: "HTTP ${res.code}")
        }
    }

    companion object {
        const val VERSION = "0.1.0"
    }
}
