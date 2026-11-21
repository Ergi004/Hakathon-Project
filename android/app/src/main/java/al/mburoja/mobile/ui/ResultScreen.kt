package al.mburoja.mobile.ui

import android.content.Intent
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.ColumnScope
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.outlined.Undo
import androidx.compose.material.icons.outlined.AutoAwesome
import androidx.compose.material.icons.outlined.CheckCircle
import androidx.compose.material.icons.outlined.Flag
import androidx.compose.material.icons.outlined.History
import androidx.compose.material.icons.outlined.Link
import androidx.compose.material.icons.outlined.Share
import androidx.compose.material.icons.outlined.Sms
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import al.mburoja.mobile.AppModel
import al.mburoja.mobile.data.CheckOutcome
import java.time.Instant

@Composable
fun ResultScreen(model: AppModel, copy: Copy, onShare: (Intent) -> Unit, onReset: () -> Unit) {
    val outcome by model.outcome.collectAsState()
    val busy by model.busy.collectAsState()
    val error by model.error.collectAsState()
    val item = outcome
    Column(
        Modifier.fillMaxSize().verticalScroll(rememberScrollState()).padding(16.dp),
        verticalArrangement = Arrangement.spacedBy(16.dp),
    ) {
        if (item == null) {
            EmptyState(Icons.Outlined.History, copy.emptyHistory, copy.emptyHistoryBody)
            return@Column
        }
        Column(verticalArrangement = Arrangement.spacedBy(4.dp)) {
            Text(copy.resultTitle, style = MaterialTheme.typography.headlineSmall)
            Text(copy.checkedAt(fmtDateTime(item.checkedAt, copy.locale)), style = MaterialTheme.typography.bodySmall, color = Palette.MutedText)
        }
        InputPreview(item.input, if (item.channel == "web" || item.excerpt == null) Icons.Outlined.Link else Icons.Outlined.Sms)
        ResultCard(
            copy = copy,
            item = item,
            busy = busy,
            error = error,
            onReport = { model.report(item) },
            onUndo = { model.undo(item) },
            onShare = { onShare(shareWarning(copy, item)) },
            onReset = {
                model.clearDraft()
                onReset()
            },
        )
    }
}

/** The website's check result: ring, badge, headline, scale, reasons, what to do, actions. */
@Composable
fun ResultCard(
    copy: Copy,
    item: CheckOutcome,
    busy: Boolean,
    error: String?,
    onReport: (() -> Unit)? = null,
    onUndo: (() -> Unit)? = null,
    onShare: (() -> Unit)? = null,
    onReset: (() -> Unit)? = null,
    extra: @Composable ColumnScope.() -> Unit = {},
) {
    val color = flagColor(item.flag)
    val grey = item.flag == "grey"
    val shape = RoundedCornerShape(24.dp)
    val until = item.deleteUntil?.let { runCatching { Instant.parse(it).toEpochMilli() }.getOrNull() } ?: 0L
    val canUndo = onUndo != null && item.reportId != null && !item.reportDeleted && until > System.currentTimeMillis()
    Column(
        Modifier.fillMaxWidth().clip(shape).background(Palette.Card.copy(alpha = 0.7f)).border(2.dp, color.copy(alpha = 0.45f), shape),
    ) {
        Column(
            Modifier.fillMaxWidth().background(color.copy(alpha = 0.12f)).padding(horizontal = 20.dp, vertical = 24.dp),
            horizontalAlignment = Alignment.CenterHorizontally,
            verticalArrangement = Arrangement.spacedBy(12.dp),
        ) {
            ScoreRing(copy, if (grey) null else item.score, item.flag)
            FlagBadge(copy, item.flag, if (grey) null else item.score)
            Text(copy.headline(item.flag), style = MaterialTheme.typography.headlineMedium, textAlign = TextAlign.Center)
            Text(copy.lead(item.flag), style = MaterialTheme.typography.bodyLarge, color = Palette.Foreground.copy(alpha = 0.8f), textAlign = TextAlign.Center)
            item.campaignCode?.let { Chip(copy.campaign(it)) }
            item.institution?.let { Chip(copy.imitates(it)) }
        }
        Column(Modifier.padding(20.dp), verticalArrangement = Arrangement.spacedBy(24.dp)) {
            if (!grey) RiskScale(copy, item.score, item.flag)
            if (!grey && !item.explanation.isNullOrBlank()) {
                Row(
                    Modifier.fillMaxWidth().clip(RoundedCornerShape(12.dp)).background(Palette.Muted.copy(alpha = 0.6f)).padding(16.dp),
                    horizontalArrangement = Arrangement.spacedBy(12.dp),
                ) {
                    Icon(Icons.Outlined.AutoAwesome, contentDescription = null, tint = Palette.Primary, modifier = Modifier.size(16.dp).padding(top = 2.dp))
                    Text(item.explanation, style = MaterialTheme.typography.bodyMedium)
                }
            }
            if (item.reasons.isNotEmpty()) {
                Column(verticalArrangement = Arrangement.spacedBy(12.dp)) {
                    Text(copy.reasonsTitle, style = MaterialTheme.typography.titleMedium)
                    ReasonList(copy, item.reasons)
                }
            }
            Column(verticalArrangement = Arrangement.spacedBy(12.dp)) {
                Text(copy.todoTitle, style = MaterialTheme.typography.titleMedium)
                TodoList(item.actions.ifEmpty { copy.todo(item.flag) }, item.flag)
            }
            if (item.protocol != null && !item.reportDeleted) ReportedBox(copy, item.protocol, if (canUndo) fmtClock(item.deleteUntil) else null)
            if (item.reportDeleted) InfoNote(copy.reportWithdrawn)
            Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                if (onReport != null && !grey && item.reportId == null) {
                    if (item.flag == "green") OutlineButton(copy.reportThis, onReport, icon = Icons.Outlined.Flag, enabled = !busy)
                    else PrimaryButton(if (busy) copy.reporting else copy.reportThis, onReport, icon = Icons.Outlined.Flag, busy = busy)
                }
                if (canUndo) OutlineButton(copy.undo, { onUndo?.invoke() }, icon = Icons.AutoMirrored.Outlined.Undo, enabled = !busy)
                if (onShare != null && !grey) OutlineButton(copy.shareWarning, onShare, icon = Icons.Outlined.Share)
                extra()
                if (onReset != null) GhostButton(copy.checkAnother, onReset, Modifier.fillMaxWidth())
                if (error != null) AlertBox(error)
            }
        }
    }
}

@Composable
private fun ReportedBox(copy: Copy, protocol: String, undoUntil: String?) {
    val shape = RoundedCornerShape(12.dp)
    Row(
        Modifier.fillMaxWidth().clip(shape).background(FlagGreen.copy(alpha = 0.10f)).border(1.dp, FlagGreen.copy(alpha = 0.4f), shape).padding(14.dp),
        horizontalArrangement = Arrangement.spacedBy(12.dp),
    ) {
        Icon(Icons.Outlined.CheckCircle, contentDescription = null, tint = FlagGreen, modifier = Modifier.size(20.dp))
        Column(verticalArrangement = Arrangement.spacedBy(4.dp)) {
            Text(copy.reported, style = MaterialTheme.typography.titleSmall)
            Text(copy.protocol, style = MaterialTheme.typography.bodySmall, color = Palette.MutedText)
            Text(protocol, fontFamily = Mono, fontSize = 15.sp, fontWeight = FontWeight.Medium)
            if (undoUntil != null) Text(copy.undoUntil(undoUntil), style = MaterialTheme.typography.bodySmall, color = Palette.MutedText)
        }
    }
}

fun shareWarning(copy: Copy, item: CheckOutcome): Intent = Intent(Intent.ACTION_SEND).apply {
    type = "text/plain"
    putExtra(Intent.EXTRA_TEXT, copy.shareText(copy.flag(item.flag), item.score) + "\n" + defangText(item.input.take(180)))
}
