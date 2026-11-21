package al.mburoja.mobile.data

import kotlinx.serialization.SerialName
import kotlinx.serialization.Serializable

@Serializable
data class ScanBody(
    val kind: String,
    val channel: String,
    val locale: String,
    val text: String? = null,
    val urls: List<String>? = null,
    val sender: String? = null,
)

@Serializable
data class ReasonDto(
    val code: String = "",
    val group: String = "",
    val weight: Double = 0.0,
    @SerialName("text_sq") val textSq: String = "",
    @SerialName("text_en") val textEn: String = "",
)

@Serializable
data class InstitutionDto(val id: String = "", val name: String = "")

@Serializable
data class CampaignRefDto(val code: String? = null, val matchType: String = "")

@Serializable
data class IocDto(
    val type: String = "",
    val value: String = "",
)

@Serializable
data class ScanResultDto(
    val score: Double = 0.0,
    val flag: String = "grey",
    val verdict: String = "",
    val reasons: List<ReasonDto> = emptyList(),
    val checkId: String? = null,
    val explanation: String? = null,
    val iocs: List<IocDto> = emptyList(),
    val matchedInstitution: InstitutionDto? = null,
    val campaign: CampaignRefDto? = null,
)

@Serializable
data class RegisterBody(val installHash: String, val version: String)

@Serializable
data class RegisterResponse(val installToken: String)

@Serializable
data class ApiErrorBody(val error: ApiErrorDetail? = null)

@Serializable
data class ApiErrorDetail(val code: String = "", val message: String = "")

@Serializable
data class SubmitResponse(val scanId: String, val status: String = "")

@Serializable
data class ScanStatusDto(
    val scanId: String = "",
    val status: String = "",
    val progress: Double = 0.0,
    val riskScore: Double? = null,
    val verdict: String = "",
)

@Serializable
data class ActionDto(val sq: String = "", val en: String = "")

@Serializable
data class EngineReasonDto(
    val code: String = "",
    val group: String = "",
    val weight: Double = 0.0,
    @SerialName("text_sq") val textSq: String = "",
    @SerialName("text_en") val textEn: String = "",
)

@Serializable
data class EvidenceDto(
    val engineReasons: List<EngineReasonDto> = emptyList(),
    val sms: SmsEvidence? = null,
    val email: EmailEvidence? = null,
)

@Serializable
data class SmsEvidence(val sender: String? = null, val excerpt: String = "")

@Serializable
data class EmailEvidence(val subject: String? = null, val excerpt: String? = null, val from: String? = null)

@Serializable
data class PiReportDto(
    val verdict: String = "",
    val riskScore: Double = 0.0,
    val recommendedActions: List<ActionDto> = emptyList(),
    val evidence: EvidenceDto = EvidenceDto(),
    val iocs: List<IocDto> = emptyList(),
)

@Serializable
data class SignalBody(
    val subject: String? = null,
    val bodyExcerpt: String? = null,
    val urls: List<String> = emptyList(),
    val senderDomain: String? = null,
    val score: Int,
    val flag: String,
    val reasonCodes: List<String> = emptyList(),
    val version: String,
    val indicatorsOnly: Boolean? = null,
    val channel: String? = null,
    val attachments: List<AttachmentName> = emptyList(),
)

@Serializable
data class AttachmentName(val name: String, val mime: String)

@Serializable
data class ReportRequest(val signals: SignalBody, val consent: Boolean = true)

@Serializable
data class ReportResponse(val reportId: String, val protocol: String, val deleteUntil: String)

@Serializable
data class FeedResponse(val data: List<FeedItemDto> = emptyList())

@Serializable
data class FeedItemDto(
    val code: String = "",
    val tactic: String = "",
    @SerialName("imitated_name") val imitatedName: String = "",
    val status: String = "",
    val domains: List<String> = emptyList(),
    @SerialName("message_count") val messageCount: Int = 0,
    @SerialName("first_seen") val firstSeen: String? = null,
    @SerialName("last_seen") val lastSeen: String? = null,
)

@Serializable
data class TimelineDto(
    val protocol: String = "",
    val status: String = "",
    val createdAt: String = "",
    val steps: List<TimelineStep> = emptyList(),
    val campaignCode: String? = null,
)

@Serializable
data class TimelineStep(val status: String = "", val at: String = "")

data class CheckOutcome(
    val input: String,
    val score: Int,
    val flag: String,
    val verdict: String,
    val reasons: List<ReasonDto>,
    val actions: List<String>,
    val explanation: String?,
    val urls: List<String>,
    val excerpt: String?,
    val senderDomain: String?,
    val channel: String,
    val checkedAt: Long = System.currentTimeMillis(),
    val reportId: String? = null,
    val protocol: String? = null,
    val deleteUntil: String? = null,
    val reportDeleted: Boolean = false,
    val institution: String? = null,
    val campaignCode: String? = null,
)

@Serializable
data class HistoryItem(
    val input: String,
    val score: Int,
    val flag: String,
    val verdict: String,
    val reasonCodes: List<String>,
    val reasonSq: List<String>,
    val reasonEn: List<String>,
    val reasonGroups: List<String> = emptyList(),
    val actions: List<String>,
    val explanation: String? = null,
    val urls: List<String>,
    val excerpt: String? = null,
    val senderDomain: String? = null,
    val channel: String,
    val checkedAt: Long,
    val reportId: String? = null,
    val protocol: String? = null,
    val deleteUntil: String? = null,
    val reportDeleted: Boolean = false,
    val institution: String? = null,
    val campaignCode: String? = null,
)

fun CheckOutcome.toHistory() = HistoryItem(
    input = input,
    score = score,
    flag = flag,
    verdict = verdict,
    reasonCodes = reasons.map { it.code },
    reasonSq = reasons.map { it.textSq },
    reasonEn = reasons.map { it.textEn },
    reasonGroups = reasons.map { it.group },
    actions = actions,
    explanation = explanation,
    urls = urls,
    excerpt = excerpt,
    senderDomain = senderDomain,
    channel = channel,
    checkedAt = checkedAt,
    reportId = reportId,
    protocol = protocol,
    deleteUntil = deleteUntil,
    reportDeleted = reportDeleted,
    institution = institution,
    campaignCode = campaignCode,
)

fun HistoryItem.toOutcome() = CheckOutcome(
    input = input,
    score = score,
    flag = flag,
    verdict = verdict,
    reasons = reasonCodes.indices.map { i ->
        ReasonDto(
            code = reasonCodes[i],
            group = reasonGroups.getOrElse(i) { "" },
            textSq = reasonSq.getOrElse(i) { "" },
            textEn = reasonEn.getOrElse(i) { "" },
        )
    },
    actions = actions,
    explanation = explanation,
    urls = urls,
    excerpt = excerpt,
    senderDomain = senderDomain,
    channel = channel,
    checkedAt = checkedAt,
    reportId = reportId,
    protocol = protocol,
    deleteUntil = deleteUntil,
    reportDeleted = reportDeleted,
    institution = institution,
    campaignCode = campaignCode,
)

class ApiException(val status: Int, val code: String, message: String) : Exception(message)
