package al.mburoja.mobile.ui

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.outlined.CenterFocusWeak
import androidx.compose.material.icons.outlined.Check
import androidx.compose.material.icons.outlined.Fingerprint
import androidx.compose.material.icons.outlined.Link
import androidx.compose.material.icons.outlined.Phone
import androidx.compose.material.icons.outlined.QrCode2
import androidx.compose.material.icons.outlined.QrCodeScanner
import androidx.compose.material.icons.outlined.Search
import androidx.compose.material.icons.outlined.Sms
import androidx.compose.material.icons.outlined.WarningAmber
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.drawBehind
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.drawscope.scale
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import al.mburoja.mobile.AppModel
import al.mburoja.mobile.CheckKind

@Composable
fun HomeScreen(model: AppModel, copy: Copy, onResult: () -> Unit, onQr: () -> Unit, onTrack: () -> Unit) {
    val busy by model.busy.collectAsState()
    val error by model.error.collectAsState()
    val draft by model.draft.collectAsState()
    LaunchedEffect(Unit) { model.finished.collect { onResult() } }

    Column(Modifier.fillMaxSize().verticalScroll(rememberScrollState())) {
        Hero(copy)
        Column(Modifier.padding(horizontal = 16.dp), verticalArrangement = Arrangement.spacedBy(16.dp)) {
            Panel {
                Text(copy.askTitle, style = MaterialTheme.typography.titleSmall)
                Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                    KindTile(copy.tabLink, Icons.Outlined.Link, CheckKind.LINK, draft.kind, model, Modifier.weight(1f))
                    KindTile(copy.tabMessage, Icons.Outlined.Sms, CheckKind.MESSAGE, draft.kind, model, Modifier.weight(1f))
                }
                Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                    KindTile(copy.tabPhone, Icons.Outlined.Phone, CheckKind.PHONE, draft.kind, model, Modifier.weight(1f))
                    KindTile(copy.tabQr, Icons.Outlined.QrCode2, CheckKind.QR, draft.kind, model, Modifier.weight(1f))
                }
                InfoNote(
                    when (draft.kind) {
                        CheckKind.LINK -> copy.howToLink
                        CheckKind.MESSAGE -> copy.howToMessage
                        CheckKind.PHONE -> copy.howToPhone
                        CheckKind.QR -> copy.howToQr
                    },
                )
                val edit = { text: String -> model.draft.value = model.draft.value.copy(value = text) }
                when (draft.kind) {
                    CheckKind.LINK -> Field(draft.value, edit, copy.labelLink, placeholder = copy.placeholderLink, mono = true, keyboardType = KeyboardType.Uri)
                    CheckKind.PHONE -> Field(draft.value, edit, copy.labelPhone, placeholder = copy.placeholderPhone, mono = true, keyboardType = KeyboardType.Phone)
                    CheckKind.MESSAGE -> {
                        Field(draft.value, edit, copy.labelMessage, placeholder = copy.placeholderMessage, minLines = 5)
                        Field(draft.sender, { model.draft.value = model.draft.value.copy(sender = it) }, copy.labelSender, placeholder = copy.placeholderSender)
                    }
                    CheckKind.QR -> Unit
                }
                if (draft.kind == CheckKind.QR) {
                    PrimaryButton(copy.openCamera, onQr, icon = Icons.Outlined.QrCodeScanner)
                } else {
                    PrimaryButton(
                        text = if (busy) copy.checking else copy.submit,
                        onClick = { model.check(draft.kind, draft.value, draft.sender) },
                        icon = Icons.Outlined.CenterFocusWeak,
                        enabled = draft.value.isNotBlank(),
                        busy = busy,
                    )
                }
                error?.let { AlertBox(it) }
                Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                    Icon(Icons.Outlined.Fingerprint, contentDescription = null, tint = Palette.MutedText, modifier = Modifier.size(14.dp).padding(top = 2.dp))
                    Text(copy.privacyNote, style = MaterialTheme.typography.bodySmall, color = Palette.MutedText)
                }
            }
            OutlineButton(copy.trackTitle, onTrack, icon = Icons.Outlined.Search)
            Panel(border = FlagRed.copy(alpha = 0.35f), background = FlagRed.copy(alpha = 0.07f)) {
                Row(horizontalArrangement = Arrangement.spacedBy(12.dp)) {
                    Icon(Icons.Outlined.WarningAmber, contentDescription = null, tint = FlagRed, modifier = Modifier.size(20.dp))
                    Column(verticalArrangement = Arrangement.spacedBy(4.dp)) {
                        Text(copy.helpTitle, style = MaterialTheme.typography.titleMedium)
                        Text(copy.helpBody, style = MaterialTheme.typography.bodyMedium, color = Palette.MutedText)
                    }
                }
            }
            Spacer(Modifier.height(8.dp))
        }
    }
}

@Composable
private fun Hero(copy: Copy) {
    Column(
        Modifier
            .fillMaxWidth()
            .drawBehind {
                val middle = Offset(size.width * 0.35f, size.height * 0.4f)
                val radius = size.height * 0.55f
                scale(scaleX = 1.6f, scaleY = 1f, pivot = middle) {
                    drawCircle(
                        Brush.radialGradient(listOf(Palette.Primary.copy(alpha = 0.15f), Color.Transparent), center = middle, radius = radius),
                        radius = radius,
                        center = middle,
                    )
                }
            }
            .padding(start = 20.dp, end = 20.dp, top = 28.dp, bottom = 20.dp),
        verticalArrangement = Arrangement.spacedBy(12.dp),
    ) {
        Text(copy.checkTitle, style = MaterialTheme.typography.headlineLarge.copy(fontSize = 32.sp, lineHeight = 38.sp))
        Text(copy.checkDescription, style = MaterialTheme.typography.bodyLarge, color = Palette.MutedText)
        Column(verticalArrangement = Arrangement.spacedBy(6.dp)) {
            copy.trust.forEach { line ->
                Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                    Icon(Icons.Outlined.Check, contentDescription = null, tint = FlagGreen, modifier = Modifier.size(16.dp).padding(top = 2.dp))
                    Text(line, style = MaterialTheme.typography.bodyMedium.copy(fontSize = 13.sp))
                }
            }
        }
    }
}

@Composable
private fun KindTile(label: String, icon: androidx.compose.ui.graphics.vector.ImageVector, kind: CheckKind, current: CheckKind, model: AppModel, modifier: Modifier) {
    ChoiceTile(label, kind == current, { model.draft.value = model.draft.value.copy(kind = kind) }, modifier, icon)
}
