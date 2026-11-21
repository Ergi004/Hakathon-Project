package al.mburoja.mobile.ui

import android.app.Activity
import android.content.Intent
import android.util.Log
import androidx.activity.ComponentActivity
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.IntrinsicSize
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxHeight
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.outlined.OpenInNew
import androidx.compose.material.icons.outlined.CalendarToday
import androidx.compose.material.icons.outlined.ChatBubbleOutline
import androidx.compose.material.icons.outlined.Check
import androidx.compose.material.icons.outlined.Dns
import androidx.compose.material.icons.outlined.Flag
import androidx.compose.material.icons.outlined.Gavel
import androidx.compose.material.icons.outlined.History
import androidx.compose.material.icons.outlined.Language
import androidx.compose.material.icons.outlined.MonitorHeart
import androidx.compose.material.icons.outlined.NotificationsActive
import androidx.compose.material.icons.outlined.OpenInBrowser
import androidx.compose.material.icons.outlined.Refresh
import androidx.compose.material.icons.outlined.Shield
import androidx.compose.material.icons.outlined.TrackChanges
import androidx.compose.material.icons.outlined.Translate
import androidx.compose.material.icons.outlined.VerifiedUser
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.KeyboardCapitalization
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import al.mburoja.mobile.AppModel
import al.mburoja.mobile.data.ApiException
import al.mburoja.mobile.data.FeedItemDto
import al.mburoja.mobile.data.HistoryItem
import al.mburoja.mobile.data.MburojaApi
import al.mburoja.mobile.data.TimelineDto
import kotlinx.coroutines.delay

private val SCREEN = PaddingValues(start = 16.dp, end = 16.dp, top = 20.dp, bottom = 24.dp)

@Composable
fun HistoryScreen(model: AppModel, copy: Copy, onOpen: () -> Unit) {
    val history by model.history.collectAsState()
    LazyColumn(Modifier.fillMaxSize(), contentPadding = SCREEN, verticalArrangement = Arrangement.spacedBy(10.dp)) {
        item { Box(Modifier.padding(bottom = 6.dp)) { PageTitle(copy.historyTitle, copy.historyDescription) } }
        if (history.isEmpty()) {
            item { EmptyState(Icons.Outlined.History, copy.emptyHistory, copy.emptyHistoryBody) }
        }
        items(history, key = { it.checkedAt }) { item ->
            HistoryCard(copy, item) {
                model.show(item)
                onOpen()
            }
        }
    }
}

@Composable
private fun HistoryCard(copy: Copy, item: HistoryItem, onClick: () -> Unit) {
    StripeCard(flagColor(item.flag), onClick) {
        Row(verticalAlignment = Alignment.CenterVertically) {
            FlagBadge(copy, item.flag, item.score)
            Spacer(Modifier.weight(1f))
            Text(fmtDateTime(item.checkedAt, copy.locale), style = MaterialTheme.typography.bodySmall, color = Palette.MutedText)
        }
        Text(defangText(item.input), fontFamily = Mono, fontSize = 13.sp, lineHeight = 19.sp, maxLines = 2, overflow = TextOverflow.Ellipsis)
        if (item.protocol != null && !item.reportDeleted) {
            Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                Icon(Icons.Outlined.Flag, contentDescription = null, tint = Palette.MutedText, modifier = Modifier.size(14.dp))
                Text(copy.reportedAs(item.protocol), style = MaterialTheme.typography.bodySmall, color = Palette.MutedText)
            }
        }
    }
}

/** Card with a coloured left edge, like the website's campaign cards. */
@Composable
private fun StripeCard(stripe: Color?, onClick: (() -> Unit)? = null, content: @Composable () -> Unit) {
    val shape = RoundedCornerShape(12.dp)
    Row(
        Modifier
            .fillMaxWidth()
            .height(IntrinsicSize.Min)
            .clip(shape)
            .background(Palette.Card)
            .border(1.dp, Palette.Border, shape)
            .then(if (onClick != null) Modifier.clickable(onClick = onClick) else Modifier),
    ) {
        Box(Modifier.width(4.dp).fillMaxHeight().background(stripe ?: Color.Transparent))
        Column(Modifier.weight(1f).padding(16.dp), verticalArrangement = Arrangement.spacedBy(10.dp)) { content() }
    }
}

@Composable
fun FeedScreen(model: AppModel, copy: Copy) {
    val prefs by model.prefs.collectAsState()
    var items by remember { mutableStateOf<List<FeedItemDto>?>(null) }
    var failed by remember { mutableStateOf(false) }
    var attempt by remember { mutableIntStateOf(0) }
    LaunchedEffect(prefs.server, attempt) {
        failed = false
        try {
            items = MburojaApi().feed(prefs.server)
        } catch (e: Exception) {
            Log.w("Mburoja", "feed failed", e)
            failed = true
        }
    }
    val list = items
    LazyColumn(Modifier.fillMaxSize(), contentPadding = SCREEN, verticalArrangement = Arrangement.spacedBy(12.dp)) {
        item { Box(Modifier.padding(bottom = 4.dp)) { PageTitle(copy.threatsTitle, copy.threatsDescription) } }
        when {
            failed && list == null -> item {
                Column(verticalArrangement = Arrangement.spacedBy(12.dp)) {
                    AlertBox(copy.feedError)
                    OutlineButton(copy.retry, { attempt++ }, icon = Icons.Outlined.Refresh)
                }
            }
            list == null -> item { Loading(copy.trackLoading) }
            else -> {
                item { Stats(copy, list) }
                item { Text(copy.campaignCount(list.size), style = MaterialTheme.typography.labelLarge, color = Palette.MutedText, modifier = Modifier.padding(top = 8.dp)) }
                if (list.isEmpty()) item { EmptyState(Icons.Outlined.Shield, copy.emptyFeed) }
                items(list, key = { it.code }) { CampaignCard(copy, it) }
                item { Text(copy.feedNote, style = MaterialTheme.typography.bodySmall, color = Palette.MutedText, modifier = Modifier.padding(top = 4.dp)) }
            }
        }
    }
}

@Composable
private fun Stats(copy: Copy, list: List<FeedItemDto>) {
    Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
        Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
            Stat(Icons.Outlined.MonitorHeart, Palette.Primary, list.size, copy.statTotal, Modifier.weight(1f))
            Stat(Icons.Outlined.NotificationsActive, FlagRed, list.count { it.status == "confirmed" }, copy.statActive, Modifier.weight(1f))
        }
        Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
            Stat(Icons.Outlined.Gavel, FlagOrange, list.count { it.status == "takedown_in_progress" }, copy.statTakedown, Modifier.weight(1f))
            Stat(Icons.Outlined.VerifiedUser, FlagGreen, list.count { it.status == "resolved" }, copy.statResolved, Modifier.weight(1f))
        }
    }
}

@Composable
private fun Stat(icon: ImageVector, tint: Color, value: Int, label: String, modifier: Modifier) {
    val shape = RoundedCornerShape(12.dp)
    Row(
        modifier.clip(shape).background(Palette.Card).border(1.dp, Palette.Border, shape).padding(14.dp),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(12.dp),
    ) {
        Box(Modifier.size(36.dp).clip(RoundedCornerShape(10.dp)).background(tint.copy(alpha = 0.12f)), contentAlignment = Alignment.Center) {
            Icon(icon, contentDescription = null, tint = tint, modifier = Modifier.size(18.dp))
        }
        Column {
            Text("$value", fontFamily = Display, fontWeight = FontWeight.Bold, fontSize = 22.sp, lineHeight = 26.sp)
            Text(label, style = MaterialTheme.typography.bodySmall, color = Palette.MutedText, maxLines = 1, overflow = TextOverflow.Ellipsis)
        }
    }
}

@Composable
private fun CampaignCard(copy: Copy, c: FeedItemDto) {
    StripeCard(if (c.status != "resolved") FlagRed.copy(alpha = 0.7f) else null) {
        Row(verticalAlignment = Alignment.Top, horizontalArrangement = Arrangement.spacedBy(8.dp)) {
            Column(Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(2.dp)) {
                Text(c.code, fontFamily = Mono, fontSize = 12.sp, color = Palette.MutedText)
                Text(c.imitatedName.ifBlank { copy.unknown }, style = MaterialTheme.typography.titleLarge.copy(fontSize = 18.sp, lineHeight = 23.sp))
            }
            if (c.status.isNotBlank()) StatusBadge(copy, c.status)
        }
        Column(verticalArrangement = Arrangement.spacedBy(6.dp)) {
            Meta(Icons.Outlined.TrackChanges, c.tactic.replace('_', ' ').replaceFirstChar { it.uppercase() })
            val dates = copy.since(fmtDate(c.firstSeen, copy.locale)) + (c.lastSeen?.let { " " + copy.until(fmtDate(it, copy.locale)) } ?: "")
            Meta(Icons.Outlined.CalendarToday, dates)
            Meta(Icons.Outlined.ChatBubbleOutline, copy.messages(c.messageCount))
        }
        if (c.domains.isNotEmpty()) {
            Column(
                Modifier.fillMaxWidth().clip(RoundedCornerShape(8.dp)).background(Palette.Muted.copy(alpha = 0.6f)).padding(10.dp),
                verticalArrangement = Arrangement.spacedBy(4.dp),
            ) {
                c.domains.take(2).forEach { domain ->
                    Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                        Icon(Icons.Outlined.Language, contentDescription = null, tint = Palette.MutedText, modifier = Modifier.size(14.dp))
                        Text(domain, fontFamily = Mono, fontSize = 12.sp, maxLines = 1, overflow = TextOverflow.Ellipsis)
                    }
                }
                if (c.domains.size > 2) {
                    Text(copy.domains(c.domains.size), style = MaterialTheme.typography.bodySmall, color = Palette.MutedText, modifier = Modifier.padding(start = 22.dp))
                }
            }
        }
    }
}

@Composable
private fun Meta(icon: ImageVector, text: String) {
    Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(8.dp)) {
        Icon(icon, contentDescription = null, tint = Palette.MutedText, modifier = Modifier.size(16.dp))
        Text(text, style = MaterialTheme.typography.bodyMedium, color = Palette.MutedText, maxLines = 1, overflow = TextOverflow.Ellipsis)
    }
}

private val ORDER = listOf("received", "under_review", "confirmed", "takedown_requested", "taken_down")

@Composable
fun TrackScreen(model: AppModel, copy: Copy) {
    val prefs by model.prefs.collectAsState()
    var protocol by rememberSaveable { mutableStateOf("") }
    var token by rememberSaveable { mutableStateOf("") }
    var result by remember { mutableStateOf<TimelineDto?>(null) }
    var error by remember { mutableStateOf<String?>(null) }
    var running by remember { mutableStateOf(false) }
    LaunchedEffect(running) {
        if (!running) return@LaunchedEffect
        try {
            result = MburojaApi().track(prefs.server, protocol.trim(), token.trim())
            error = null
        } catch (e: Exception) {
            Log.w("Mburoja", "track failed", e)
            result = null
            error = when {
                e is ApiException && e.status == 429 -> copy.rateLimited
                e is ApiException -> copy.trackNotFound
                else -> copy.checkError
            }
        } finally {
            running = false
        }
    }
    Column(
        Modifier.fillMaxSize().verticalScroll(rememberScrollState()).padding(SCREEN),
        verticalArrangement = Arrangement.spacedBy(16.dp),
    ) {
        PageTitle(copy.trackTitle, copy.trackDescription)
        Panel(spacing = 14.dp) {
            Field(protocol, { protocol = it.uppercase() }, copy.protocol, placeholder = copy.trackProtocolPlaceholder, mono = true, capitalization = KeyboardCapitalization.Characters)
            Field(token, { token = it.trim() }, copy.trackToken, mono = true, keyboardType = KeyboardType.Password)
            PrimaryButton(
                text = if (running) copy.trackLoading else copy.trackSubmit,
                onClick = { running = true },
                enabled = protocol.isNotBlank() && token.isNotBlank(),
                busy = running,
            )
        }
        error?.let { AlertBox(it) }
        result?.let { Timeline(copy, it) }
        Text(copy.trackHelp, style = MaterialTheme.typography.bodySmall, color = Palette.MutedText)
    }
}

@Composable
private fun Timeline(copy: Copy, data: TimelineDto) {
    Panel(spacing = 16.dp) {
        Column(verticalArrangement = Arrangement.spacedBy(2.dp)) {
            Text(data.protocol, fontFamily = Mono, fontSize = 13.sp, color = Palette.MutedText)
            Text("${copy.trackStatus}: ${copy.reportStatus(data.status)}", style = MaterialTheme.typography.titleLarge)
            Text(copy.trackReceived(fmtDateTime(data.createdAt, copy.locale)), style = MaterialTheme.typography.bodySmall, color = Palette.MutedText)
        }
        if (data.status == "not_scam" || data.status == "duplicate") {
            InfoNote(if (data.status == "not_scam") copy.trackNotScam else copy.trackDuplicate)
        } else {
            val reached = data.steps.associate { it.status to it.at }
            val current = ORDER.indexOf(data.status)
            Column {
                ORDER.forEachIndexed { i, step ->
                    val state = when {
                        current == -1 -> if (i == 0) "done" else "skipped"
                        i < current -> "done"
                        i == current -> if (step == "taken_down") "done" else "current"
                        else -> "pending"
                    }
                    Step(copy.reportStatus(step), reached[step]?.let { fmtDateTime(it, copy.locale) }, state, last = i == ORDER.lastIndex)
                }
            }
        }
        data.campaignCode?.let { Text(copy.trackCampaign(it), style = MaterialTheme.typography.labelLarge, color = Palette.Primary) }
    }
}

@Composable
private fun Step(label: String, at: String?, state: String, last: Boolean) {
    Row(Modifier.fillMaxWidth().height(IntrinsicSize.Min)) {
        Column(Modifier.fillMaxHeight(), horizontalAlignment = Alignment.CenterHorizontally) {
            val dot = Modifier.size(22.dp).clip(CircleShape)
            when (state) {
                "done" -> Box(dot.background(Palette.Primary), contentAlignment = Alignment.Center) {
                    Icon(Icons.Outlined.Check, contentDescription = null, tint = Palette.OnPrimary, modifier = Modifier.size(14.dp))
                }
                "current" -> Box(dot.border(2.dp, Palette.Primary, CircleShape), contentAlignment = Alignment.Center) {
                    Box(Modifier.size(8.dp).clip(CircleShape).background(Palette.Primary))
                }
                else -> Box(dot.border(2.dp, Palette.Input, CircleShape))
            }
            if (!last) Box(Modifier.width(2.dp).weight(1f).background(if (state == "done") Palette.Primary.copy(alpha = 0.5f) else Palette.Border))
        }
        Column(Modifier.padding(start = 12.dp, bottom = if (last) 0.dp else 18.dp), verticalArrangement = Arrangement.spacedBy(2.dp)) {
            Text(
                label,
                style = MaterialTheme.typography.bodyMedium,
                fontWeight = if (state == "current") FontWeight.SemiBold else FontWeight.Normal,
                color = if (state == "pending" || state == "skipped") Palette.MutedText else Palette.Foreground,
            )
            if (at != null) Text(at, style = MaterialTheme.typography.bodySmall, color = Palette.MutedText)
        }
    }
}

@Composable
fun SettingsScreen(model: AppModel, copy: Copy) {
    val prefs by model.prefs.collectAsState()
    val context = LocalContext.current
    val launcher = rememberLauncherForActivityResult(ActivityResultContracts.StartActivityForResult()) {}
    var server by remember(prefs.server) { mutableStateOf(prefs.server) }
    var savedAt by remember { mutableIntStateOf(0) }
    LaunchedEffect(savedAt) {
        if (savedAt > 0) {
            delay(2000)
            savedAt = 0
        }
    }
    Column(
        Modifier.fillMaxSize().verticalScroll(rememberScrollState()).padding(SCREEN),
        verticalArrangement = Arrangement.spacedBy(16.dp),
    ) {
        PageTitle(copy.settingsTitle)
        Panel {
            SectionHeader(Icons.Outlined.Translate, copy.language)
            Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                ChoiceTile(copy.albanian, prefs.locale != "en", { model.saveLocale("sq") }, Modifier.weight(1f))
                ChoiceTile(copy.english, prefs.locale == "en", { model.saveLocale("en") }, Modifier.weight(1f))
            }
        }
        Panel {
            SwitchRow(copy.linkCheck, prefs.linkCheck, { model.saveLinkCheck(it) }, Icons.Outlined.Shield)
            Text(copy.linkCheckBody, style = MaterialTheme.typography.bodySmall.copy(fontSize = 13.sp, lineHeight = 18.sp), color = Palette.MutedText)
            if (prefs.linkCheck) {
                OutlineButton(copy.makeDefault, {
                    (context as? Activity)?.let { requestBrowserRole(it as ComponentActivity, launcher) }
                }, icon = Icons.Outlined.OpenInBrowser)
            }
        }
        Panel {
            SwitchRow(copy.autoSubmit, prefs.autoSubmit, { model.saveAutoSubmit(it) }, Icons.Outlined.Flag)
            Text(copy.autoSubmitBody, style = MaterialTheme.typography.bodySmall.copy(fontSize = 13.sp, lineHeight = 18.sp), color = Palette.MutedText)
        }
        Panel {
            SectionHeader(Icons.Outlined.Dns, copy.server)
            Field(server, { server = it.trim() }, label = null, mono = true, keyboardType = KeyboardType.Uri)
            Text(copy.serverHelp, style = MaterialTheme.typography.bodySmall.copy(fontSize = 13.sp, lineHeight = 18.sp), color = Palette.MutedText)
            PrimaryButton(
                text = if (savedAt > 0) copy.saved else copy.save,
                onClick = {
                    model.saveServer(server)
                    savedAt++
                },
                icon = if (savedAt > 0) Icons.Outlined.Check else null,
                enabled = server.isNotBlank() && server != prefs.server || savedAt > 0,
            )
        }
        OutlineButton(copy.website, {
            val page = android.net.Uri.parse(prefs.server.trimEnd('/') + "/" + prefs.locale + "/citizen")
            context.startActivity(otherBrowserIntent(context, page) ?: Intent(Intent.ACTION_VIEW, page))
        }, icon = Icons.AutoMirrored.Outlined.OpenInNew)
        Text(
            "Mburoja · " + copy.version(MburojaApi.VERSION),
            style = MaterialTheme.typography.bodySmall,
            color = Palette.MutedText,
            textAlign = TextAlign.Center,
            modifier = Modifier.fillMaxWidth(),
        )
    }
}
