package al.mburoja.mobile

import android.app.Application
import androidx.lifecycle.AndroidViewModel
import androidx.lifecycle.viewModelScope
import al.mburoja.mobile.data.ApiException
import al.mburoja.mobile.data.CheckOutcome
import al.mburoja.mobile.data.HistoryItem
import al.mburoja.mobile.data.HistoryStore
import al.mburoja.mobile.data.MburojaApi
import al.mburoja.mobile.data.PiReportDto
import al.mburoja.mobile.data.Prefs
import al.mburoja.mobile.data.ReasonDto
import al.mburoja.mobile.data.ScanBody
import al.mburoja.mobile.data.ScanResultDto
import al.mburoja.mobile.data.SettingsStore
import al.mburoja.mobile.data.SignalBody
import al.mburoja.mobile.data.toHistory
import al.mburoja.mobile.data.toOutcome
import al.mburoja.mobile.ui.Copy
import al.mburoja.mobile.ui.flagForScore
import al.mburoja.mobile.ui.maskExcerpt
import android.util.Log
import kotlinx.coroutines.delay
import kotlinx.coroutines.flow.MutableSharedFlow
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.SharingStarted
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.first
import kotlinx.coroutines.flow.stateIn
import kotlinx.coroutines.launch
import java.net.URI
import kotlin.math.roundToInt

enum class CheckKind { LINK, MESSAGE, PHONE, QR }

data class Draft(val kind: CheckKind = CheckKind.LINK, val value: String = "", val sender: String = "")

class AppModel(app: Application) : AndroidViewModel(app) {
    private val settings = SettingsStore(app)
    private val historyStore = HistoryStore(app)
    private val api = MburojaApi()

    val prefs: StateFlow<Prefs> = settings.prefs.stateIn(viewModelScope, SharingStarted.Eagerly, Prefs())
    val history = MutableStateFlow(historyStore.read())
    val outcome = MutableStateFlow<CheckOutcome?>(null)
    val busy = MutableStateFlow(false)
    val error = MutableStateFlow<String?>(null)
    val incoming = MutableStateFlow<String?>(null)
    val draft = MutableStateFlow(Draft())
    val finished = MutableSharedFlow<Unit>(extraBufferCapacity = 1)

    fun acceptShare(text: String?) {
        val value = text?.trim().orEmpty()
        if (value.isEmpty()) return
        val link = value.startsWith("http://") || value.startsWith("https://") || value.startsWith("www.")
        draft.value = Draft(if (link) CheckKind.LINK else CheckKind.MESSAGE, value)
        incoming.value = value
    }

    fun clearDraft() {
        draft.value = Draft(kind = draft.value.kind)
        error.value = null
    }

    fun reloadHistory() {
        history.value = historyStore.read()
    }

    fun show(item: HistoryItem) {
        outcome.value = item.toOutcome()
        error.value = null
    }

    fun check(kind: CheckKind, value: String, sender: String?) {
        val text = value.trim()
        if (text.isEmpty()) return
        viewModelScope.launch {
            busy.value = true
            error.value = null
            try {
                val result = when (kind) {
                    CheckKind.LINK, CheckKind.QR -> quick(linkBody(text))
                    CheckKind.PHONE -> quick(ScanBody(kind = "phone", channel = "sms", locale = locale(), sender = text, text = text))
                    CheckKind.MESSAGE -> message(text, sender?.trim()?.takeIf { it.isNotEmpty() })
                }
                remember(result)
                finished.tryEmit(Unit)
                try {
                    maybeAutoReport(result)
                } catch (e: Exception) {
                    Log.w(TAG, "auto report failed", e)
                    error.value = copy().reportError
                }
            } catch (e: Exception) {
                Log.w(TAG, "check failed", e)
                error.value = if (e is ApiException && e.status == 429) copy().rateLimited else copy().checkError
            } finally {
                busy.value = false
            }
        }
    }

    fun report(target: CheckOutcome) {
        viewModelScope.launch {
            busy.value = true
            error.value = null
            try {
                val indicators = target.flag == "yellow"
                val sent = api.submitSignal(server(), token(), signal(target, indicators))
                remember(target.copy(reportId = sent.reportId, protocol = sent.protocol, deleteUntil = sent.deleteUntil, reportDeleted = false))
            } catch (e: Exception) {
                Log.w(TAG, "report failed", e)
                error.value = if (e is ApiException && e.status == 429) copy().rateLimited else copy().reportError
            } finally {
                busy.value = false
            }
        }
    }

    fun undo(target: CheckOutcome) {
        val id = target.reportId ?: return
        viewModelScope.launch {
            busy.value = true
            error.value = null
            try {
                api.deleteSignal(server(), token(), id)
                remember(target.copy(reportDeleted = true))
            } catch (e: Exception) {
                Log.w(TAG, "undo failed", e)
                error.value = copy().reportError
            } finally {
                busy.value = false
            }
        }
    }

    fun saveServer(value: String) = viewModelScope.launch { settings.setServer(value) }
    fun saveLocale(value: String) = viewModelScope.launch { settings.setLocale(value) }
    fun saveLinkCheck(value: Boolean) = viewModelScope.launch { settings.setLinkCheck(value) }
    fun saveAutoSubmit(value: Boolean) = viewModelScope.launch { settings.setAutoSubmit(value) }

    private suspend fun maybeAutoReport(result: CheckOutcome) {
        if (!current().autoSubmit) return
        val indicators = when (result.flag) {
            "orange", "red", "darkred" -> false
            "yellow" -> true
            else -> return
        }
        val sent = api.submitSignal(server(), token(), signal(result, indicators))
        remember(result.copy(reportId = sent.reportId, protocol = sent.protocol, deleteUntil = sent.deleteUntil))
    }

    private suspend fun message(text: String, sender: String?): CheckOutcome {
        return try {
            val id = withToken { api.submitMessage(server(), it, text.take(5000), sender, locale()) }
            val deadline = System.currentTimeMillis() + 90_000
            var status = "queued"
            while (System.currentTimeMillis() < deadline) {
                delay(1500)
                status = withToken { api.scanStatus(server(), it, id).status }
                if (status == "completed" || status == "partial" || status == "failed") break
            }
            if (status != "completed" && status != "partial") error("not_ready")
            fromReport(text, sender, withToken { api.report(server(), it, id) }, locale())
        } catch (e: ApiException) {
            if (e.status == 401) throw e
            quick(ScanBody(kind = "text", channel = "sms", locale = locale(), text = text.take(10_000), sender = sender))
        }
    }

    private suspend fun quick(body: ScanBody): CheckOutcome {
        val dto = withToken { api.scan(server(), it, body.copy(locale = locale())) }
        return fromScan(body.text ?: body.urls?.firstOrNull() ?: body.sender.orEmpty(), body.channel, dto)
    }

    private fun fromScan(input: String, channel: String, dto: ScanResultDto): CheckOutcome {
        val urls = dto.iocs.filter { it.type == "url" || it.type == "domain" }.map { it.value }.ifEmpty {
            if (channel == "web") listOf(input) else emptyList()
        }
        return CheckOutcome(
            input = input,
            score = dto.score.roundToInt(),
            flag = dto.flag.ifBlank { "grey" },
            verdict = dto.verdict,
            reasons = dto.reasons.take(8),
            actions = emptyList(),
            explanation = dto.explanation,
            urls = urls.take(50),
            excerpt = if (channel == "web") null else input.take(600),
            senderDomain = hostOf(urls.firstOrNull()),
            channel = if (channel == "sms") "sms" else "email",
            institution = dto.matchedInstitution?.name?.takeIf { it.isNotBlank() },
            campaignCode = dto.campaign?.code?.takeIf { it.isNotBlank() },
        )
    }

    private fun fromReport(input: String, sender: String?, report: PiReportDto, locale: String): CheckOutcome {
        val score = report.riskScore.roundToInt()
        val flag = flagForScore(score)
        val copy = Copy.of(locale)
        val reasons = report.evidence.engineReasons.map { ReasonDto(it.code, it.group, it.weight, it.textSq, it.textEn) }
        val urls = report.iocs.filter { it.type.equals("url", true) || it.type.equals("domain", true) }.map { it.value }
        val actions = report.recommendedActions.map { copy.text(it.sq, it.en) }.filter { it.isNotBlank() }
        return CheckOutcome(
            input = input,
            score = score,
            flag = flag,
            verdict = report.verdict,
            reasons = reasons.take(8),
            actions = actions,
            explanation = null,
            urls = urls.take(50),
            excerpt = report.evidence.sms?.excerpt ?: report.evidence.email?.excerpt ?: input.take(600),
            senderDomain = sender?.substringAfter('@', sender)?.takeIf { it.contains('.') } ?: hostOf(urls.firstOrNull()),
            channel = "sms",
        )
    }

    private fun signal(target: CheckOutcome, indicatorsOnly: Boolean) = SignalBody(
        bodyExcerpt = if (indicatorsOnly) null else target.excerpt?.let(::maskExcerpt)?.takeIf { it.isNotBlank() },
        urls = target.urls.take(50),
        senderDomain = target.senderDomain?.take(253),
        score = target.score.coerceIn(0, 100),
        flag = target.flag,
        reasonCodes = target.reasons.map { it.code }.filter { it.length in 1..64 }.distinct().take(20),
        version = MburojaApi.VERSION,
        indicatorsOnly = if (indicatorsOnly) true else null,
        channel = target.channel,
    )

    private fun remember(value: CheckOutcome) {
        outcome.value = value
        val next = listOf(value.toHistory()) + history.value.filter { it.checkedAt != value.checkedAt }
        history.value = next.take(20)
        historyStore.write(history.value)
    }

    private suspend fun <T> withToken(block: suspend (String) -> T): T {
        return try {
            block(token())
        } catch (e: ApiException) {
            if (e.status != 401) throw e
            settings.setToken(api.register(server(), settings.installHash()))
            block(token())
        }
    }

    private suspend fun token(): String {
        current().token?.let { return it }
        val fresh = api.register(server(), settings.installHash())
        settings.setToken(fresh)
        return fresh
    }

    private fun copy() = Copy.of(prefs.value.locale)
    private suspend fun current() = settings.prefs.first()
    private suspend fun server() = current().server.ifBlank { SettingsStore.DEFAULT_SERVER }
    private suspend fun locale() = current().locale

    private suspend fun linkBody(raw: String): ScanBody {
        val url = if (raw.startsWith("http://") || raw.startsWith("https://")) raw else "https://$raw"
        return ScanBody(kind = "url", channel = "web", locale = locale(), text = url, urls = listOf(url))
    }

    private fun hostOf(value: String?): String? {
        if (value.isNullOrBlank()) return null
        val host = runCatching { URI(if (value.contains("://")) value else "https://$value").host }.getOrNull() ?: return null
        return host.removePrefix("www.").lowercase().takeIf { it.length <= 253 }
    }

    private companion object {
        const val TAG = "Mburoja"
    }
}
