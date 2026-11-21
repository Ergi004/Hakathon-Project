package al.mburoja.mobile.ui

import androidx.compose.animation.core.Animatable
import androidx.compose.animation.core.FastOutSlowInEasing
import androidx.compose.animation.core.tween
import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.Canvas
import androidx.compose.foundation.Image
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.ColumnScope
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.RowScope
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxHeight
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.statusBarsPadding
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.selection.selectable
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.outlined.HelpOutline
import androidx.compose.material.icons.outlined.AlternateEmail
import androidx.compose.material.icons.outlined.CheckCircle
import androidx.compose.material.icons.outlined.Dangerous
import androidx.compose.material.icons.outlined.Description
import androidx.compose.material.icons.outlined.ErrorOutline
import androidx.compose.material.icons.outlined.Gavel
import androidx.compose.material.icons.outlined.GppMaybe
import androidx.compose.material.icons.outlined.Info
import androidx.compose.material.icons.outlined.Link
import androidx.compose.material.icons.outlined.Sms
import androidx.compose.material.icons.outlined.VerifiedUser
import androidx.compose.material.icons.outlined.Visibility
import androidx.compose.material.icons.outlined.WarningAmber
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.OutlinedTextFieldDefaults
import androidx.compose.material3.Switch
import androidx.compose.material3.SwitchDefaults
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.geometry.Size
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.Path
import androidx.compose.ui.graphics.StrokeCap
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.KeyboardCapitalization
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import al.mburoja.mobile.R
import al.mburoja.mobile.data.ReasonDto

fun flagIcon(flag: String): ImageVector = when (flag) {
    "green" -> Icons.Outlined.VerifiedUser
    "yellow" -> Icons.Outlined.ErrorOutline
    "orange" -> Icons.Outlined.WarningAmber
    "red" -> Icons.Outlined.GppMaybe
    "darkred" -> Icons.Outlined.Dangerous
    else -> Icons.AutoMirrored.Outlined.HelpOutline
}

private fun groupIcon(group: String): ImageVector = when (group) {
    "links" -> Icons.Outlined.Link
    "content" -> Icons.Outlined.Sms
    "sender" -> Icons.Outlined.AlternateEmail
    "attachments" -> Icons.Outlined.Description
    else -> Icons.Outlined.GppMaybe
}

/** Logo and wordmark, like the website header. */
@Composable
fun BrandBar(trailing: @Composable RowScope.() -> Unit = {}) {
    Column(Modifier.fillMaxWidth().background(Palette.Background).statusBarsPadding()) {
        Row(
            Modifier.fillMaxWidth().height(56.dp).padding(start = 16.dp, end = 8.dp),
            verticalAlignment = Alignment.CenterVertically,
        ) {
            Image(painterResource(R.drawable.ic_logo), contentDescription = null, modifier = Modifier.size(28.dp))
            Spacer(Modifier.width(8.dp))
            Text("Mburoja", fontFamily = Display, fontWeight = FontWeight.Bold, fontSize = 18.sp, letterSpacing = (-0.3).sp)
            Spacer(Modifier.weight(1f))
            trailing()
        }
        HorizontalDivider(color = Palette.Border)
    }
}

@Composable
fun PageTitle(title: String, description: String? = null) {
    Column(verticalArrangement = Arrangement.spacedBy(6.dp)) {
        Text(title, style = MaterialTheme.typography.headlineLarge)
        if (description != null) Text(description, style = MaterialTheme.typography.bodyLarge, color = Palette.MutedText)
    }
}

/** The website's glass card: rounded, 1 px border, card colour at 70%. */
@Composable
fun Panel(
    modifier: Modifier = Modifier,
    radius: Dp = 20.dp,
    border: Color = Palette.Border,
    background: Color = Palette.Card.copy(alpha = 0.7f),
    padding: Dp = 16.dp,
    spacing: Dp = 12.dp,
    content: @Composable ColumnScope.() -> Unit,
) {
    val shape = RoundedCornerShape(radius)
    Column(
        modifier.fillMaxWidth().clip(shape).background(background).border(1.dp, border, shape).padding(padding),
        verticalArrangement = Arrangement.spacedBy(spacing),
        content = content,
    )
}

@Composable
fun PrimaryButton(
    text: String,
    onClick: () -> Unit,
    modifier: Modifier = Modifier,
    icon: ImageVector? = null,
    enabled: Boolean = true,
    busy: Boolean = false,
) {
    Button(
        onClick = onClick,
        modifier = modifier.fillMaxWidth().heightIn(min = 48.dp),
        enabled = enabled && !busy,
        shape = RoundedCornerShape(8.dp),
        colors = ButtonDefaults.buttonColors(
            containerColor = Palette.Primary,
            contentColor = Palette.OnPrimary,
            disabledContainerColor = Palette.Primary.copy(alpha = if (busy) 0.7f else 0.35f),
            disabledContentColor = Palette.OnPrimary.copy(alpha = 0.75f),
        ),
    ) {
        if (busy) {
            CircularProgressIndicator(Modifier.size(16.dp), color = Palette.OnPrimary, strokeWidth = 2.dp)
            Spacer(Modifier.width(10.dp))
        } else if (icon != null) {
            Icon(icon, contentDescription = null, modifier = Modifier.size(18.dp))
            Spacer(Modifier.width(8.dp))
        }
        Text(text, style = MaterialTheme.typography.labelLarge, fontWeight = FontWeight.SemiBold)
    }
}

@Composable
fun OutlineButton(
    text: String,
    onClick: () -> Unit,
    modifier: Modifier = Modifier,
    icon: ImageVector? = null,
    enabled: Boolean = true,
) {
    OutlinedButton(
        onClick = onClick,
        modifier = modifier.fillMaxWidth().heightIn(min = 46.dp),
        enabled = enabled,
        shape = RoundedCornerShape(8.dp),
        border = BorderStroke(1.dp, Palette.Input),
        colors = ButtonDefaults.outlinedButtonColors(
            containerColor = Palette.Field,
            contentColor = Palette.Foreground,
            disabledContentColor = Palette.MutedText,
        ),
    ) {
        if (icon != null) {
            Icon(icon, contentDescription = null, modifier = Modifier.size(17.dp))
            Spacer(Modifier.width(8.dp))
        }
        Text(text, style = MaterialTheme.typography.labelLarge, fontWeight = FontWeight.SemiBold)
    }
}

@Composable
fun GhostButton(text: String, onClick: () -> Unit, modifier: Modifier = Modifier) {
    TextButton(onClick = onClick, modifier = modifier, shape = RoundedCornerShape(8.dp)) {
        Text(text, style = MaterialTheme.typography.labelLarge, fontWeight = FontWeight.SemiBold, color = Palette.Foreground)
    }
}

@Composable
fun Field(
    value: String,
    onChange: (String) -> Unit,
    label: String?,
    modifier: Modifier = Modifier,
    placeholder: String? = null,
    mono: Boolean = false,
    minLines: Int = 1,
    keyboardType: KeyboardType = KeyboardType.Text,
    capitalization: KeyboardCapitalization = KeyboardCapitalization.None,
) {
    val family = if (mono) Mono else Sans
    Column(modifier.fillMaxWidth(), verticalArrangement = Arrangement.spacedBy(6.dp)) {
        if (label != null) Text(label, style = MaterialTheme.typography.labelLarge)
        OutlinedTextField(
            value = value,
            onValueChange = onChange,
            modifier = Modifier.fillMaxWidth(),
            textStyle = MaterialTheme.typography.bodyLarge.copy(fontFamily = family, fontSize = if (mono) 15.sp else 16.sp),
            placeholder = placeholder?.let {
                { Text(it, fontFamily = family, fontSize = if (mono) 15.sp else 16.sp, color = Palette.MutedText.copy(alpha = 0.7f), maxLines = 1, overflow = TextOverflow.Ellipsis) }
            },
            minLines = minLines,
            singleLine = minLines == 1,
            shape = RoundedCornerShape(8.dp),
            keyboardOptions = KeyboardOptions(capitalization = capitalization, keyboardType = keyboardType),
            colors = OutlinedTextFieldDefaults.colors(
                focusedBorderColor = Palette.Primary,
                unfocusedBorderColor = Palette.Input,
                focusedContainerColor = Palette.Field,
                unfocusedContainerColor = Palette.Field,
                cursorColor = Palette.Primary,
            ),
        )
    }
}

/** A selectable tile, used for the check type grid and the language choice. */
@Composable
fun ChoiceTile(label: String, selected: Boolean, onClick: () -> Unit, modifier: Modifier = Modifier, icon: ImageVector? = null) {
    val shape = RoundedCornerShape(10.dp)
    Row(
        modifier
            .heightIn(min = 48.dp)
            .clip(shape)
            .background(if (selected) Palette.Primary.copy(alpha = 0.10f) else Palette.Background.copy(alpha = 0.5f))
            .border(1.dp, if (selected) Palette.Primary.copy(alpha = 0.6f) else Palette.Border, shape)
            .selectable(selected = selected, onClick = onClick, role = Role.Tab)
            .padding(horizontal = 14.dp, vertical = 10.dp),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(10.dp),
    ) {
        if (icon != null) Icon(icon, contentDescription = null, modifier = Modifier.size(18.dp), tint = if (selected) Palette.Primary else Palette.MutedText)
        Text(label, style = MaterialTheme.typography.labelLarge, fontWeight = FontWeight.SemiBold)
    }
}

@Composable
fun InfoNote(text: String, icon: ImageVector = Icons.Outlined.Info, tint: Color = Palette.Primary) {
    Row(
        Modifier.fillMaxWidth().clip(RoundedCornerShape(10.dp)).background(Palette.Muted.copy(alpha = 0.6f)).padding(12.dp),
        horizontalArrangement = Arrangement.spacedBy(10.dp),
    ) {
        Icon(icon, contentDescription = null, modifier = Modifier.size(16.dp).padding(top = 1.dp), tint = tint)
        Text(text, style = MaterialTheme.typography.bodySmall.copy(fontSize = 13.sp, lineHeight = 18.sp), color = Palette.MutedText)
    }
}

@Composable
fun AlertBox(text: String, color: Color = Palette.Destructive) {
    val shape = RoundedCornerShape(10.dp)
    Row(
        Modifier.fillMaxWidth().clip(shape).background(color.copy(alpha = 0.10f)).border(1.dp, color.copy(alpha = 0.4f), shape).padding(12.dp),
        horizontalArrangement = Arrangement.spacedBy(10.dp),
    ) {
        Icon(Icons.Outlined.ErrorOutline, contentDescription = null, modifier = Modifier.size(18.dp), tint = color)
        Text(text, style = MaterialTheme.typography.bodyMedium)
    }
}

@Composable
fun EmptyState(icon: ImageVector, title: String, body: String? = null) {
    Panel(spacing = 8.dp, padding = 24.dp) {
        Box(Modifier.fillMaxWidth(), contentAlignment = Alignment.Center) {
            Box(Modifier.size(44.dp).clip(RoundedCornerShape(12.dp)).background(Palette.Muted), contentAlignment = Alignment.Center) {
                Icon(icon, contentDescription = null, tint = Palette.MutedText)
            }
        }
        Text(title, style = MaterialTheme.typography.titleMedium, textAlign = TextAlign.Center, modifier = Modifier.fillMaxWidth())
        if (body != null) Text(body, style = MaterialTheme.typography.bodyMedium, color = Palette.MutedText, textAlign = TextAlign.Center, modifier = Modifier.fillMaxWidth())
    }
}

@Composable
fun Loading(text: String) {
    Row(Modifier.fillMaxWidth().padding(vertical = 24.dp), horizontalArrangement = Arrangement.Center, verticalAlignment = Alignment.CenterVertically) {
        CircularProgressIndicator(Modifier.size(18.dp), color = Palette.Primary, strokeWidth = 2.dp)
        Spacer(Modifier.width(10.dp))
        Text(text, color = Palette.MutedText)
    }
}

@Composable
fun SwitchRow(label: String, checked: Boolean, onChange: (Boolean) -> Unit, icon: ImageVector) {
    Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(12.dp)) {
        Icon(icon, contentDescription = null, tint = Palette.Primary, modifier = Modifier.size(20.dp))
        Text(label, style = MaterialTheme.typography.titleSmall, modifier = Modifier.weight(1f))
        Switch(
            checked = checked,
            onCheckedChange = onChange,
            colors = SwitchDefaults.colors(
                checkedThumbColor = Palette.OnPrimary,
                checkedTrackColor = Palette.Primary,
                uncheckedThumbColor = Palette.MutedText,
                uncheckedTrackColor = Palette.Muted,
                uncheckedBorderColor = Palette.Input,
            ),
        )
    }
}

@Composable
fun SectionHeader(icon: ImageVector, title: String) {
    Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(12.dp)) {
        Icon(icon, contentDescription = null, tint = Palette.Primary, modifier = Modifier.size(20.dp))
        Text(title, style = MaterialTheme.typography.titleSmall)
    }
}

/** Pill with icon, word and score. Colour is never the only signal. */
@Composable
fun FlagBadge(copy: Copy, flag: String, score: Int?, modifier: Modifier = Modifier) {
    val color = flagColor(flag)
    Pill(color, modifier) {
        Icon(flagIcon(flag), contentDescription = null, modifier = Modifier.size(14.dp), tint = color)
        Text(copy.flag(flag), style = MaterialTheme.typography.labelMedium)
        if (flag != "grey" && score != null) {
            Text("·", style = MaterialTheme.typography.labelMedium, color = Palette.MutedText)
            Text("$score", fontFamily = Mono, fontSize = 12.sp, fontWeight = FontWeight.Medium)
        }
    }
}

@Composable
fun StatusBadge(copy: Copy, status: String) {
    val (icon, color) = when (status) {
        "confirmed" -> Icons.Outlined.GppMaybe to FlagRed
        "takedown_in_progress" -> Icons.Outlined.Gavel to FlagOrange
        "resolved" -> Icons.Outlined.CheckCircle to FlagGreen
        else -> Icons.Outlined.Visibility to FlagGrey
    }
    Pill(color) {
        Icon(icon, contentDescription = null, modifier = Modifier.size(13.dp), tint = color)
        Text(copy.campaignStatus(status), style = MaterialTheme.typography.labelSmall)
    }
}

@Composable
fun Chip(text: String) {
    Text(
        text,
        style = MaterialTheme.typography.labelSmall,
        modifier = Modifier.clip(CircleShape).border(1.dp, Palette.Border, CircleShape).padding(horizontal = 10.dp, vertical = 3.dp),
    )
}

@Composable
private fun Pill(color: Color, modifier: Modifier = Modifier, content: @Composable RowScope.() -> Unit) {
    Row(
        modifier
            .clip(CircleShape)
            .background(color.copy(alpha = 0.13f))
            .border(1.dp, color.copy(alpha = 0.45f), CircleShape)
            .padding(horizontal = 10.dp, vertical = 3.dp),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(6.dp),
        content = content,
    )
}

/** 0-100 ring in the flag colour with the number in the centre. */
@Composable
fun ScoreRing(copy: Copy, score: Int?, flag: String, size: Dp = 168.dp, stroke: Dp = 10.dp) {
    val color = flagColor(flag)
    val shown = if (flag == "grey") null else score?.coerceIn(0, 100)
    val sweep = remember(flag, shown) { Animatable(0f) }
    LaunchedEffect(flag, shown) { sweep.animateTo((shown ?: 0) / 100f, tween(900, easing = FastOutSlowInEasing)) }
    val label = if (shown == null) copy.flag("grey") else "${copy.flag(flag)}. ${copy.scaleExplain(shown)}"
    Box(Modifier.size(size).semantics { contentDescription = label }, contentAlignment = Alignment.Center) {
        Box(
            Modifier.size(size - 16.dp).clip(CircleShape)
                .background(Brush.radialGradient(listOf(color.copy(alpha = 0.28f), Color.Transparent))),
        )
        Canvas(Modifier.size(size)) {
            val width = stroke.toPx()
            val topLeft = Offset(width / 2, width / 2)
            val arc = Size(this.size.width - width, this.size.height - width)
            drawArc(Palette.Muted, 0f, 360f, false, topLeft, arc, style = Stroke(width))
            if (sweep.value > 0f) drawArc(color, -90f, 360f * sweep.value, false, topLeft, arc, style = Stroke(width, cap = StrokeCap.Round))
        }
        Column(horizontalAlignment = Alignment.CenterHorizontally) {
            Text(shown?.toString() ?: "–", fontFamily = Display, fontWeight = FontWeight.Bold, fontSize = 46.sp, lineHeight = 48.sp)
            Icon(flagIcon(flag), contentDescription = null, tint = color, modifier = Modifier.size(20.dp))
        }
    }
}

private val BANDS = listOf("green", "yellow", "orange", "red", "darkred")

/** 0-100 bar split at the verdict thresholds, with a marker at the score. */
@Composable
fun RiskScale(copy: Copy, score: Int, flag: String) {
    val pos = score.coerceIn(0, 100) / 100f
    Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
        Row {
            Text(copy.scaleTitle, style = MaterialTheme.typography.labelLarge, fontWeight = FontWeight.SemiBold)
            Spacer(Modifier.width(12.dp))
            Text(copy.scaleExplain(score), style = MaterialTheme.typography.bodySmall.copy(fontSize = 13.sp, lineHeight = 18.sp), color = Palette.MutedText, modifier = Modifier.weight(1f))
        }
        Column(verticalArrangement = Arrangement.spacedBy(3.dp)) {
            Canvas(Modifier.fillMaxWidth().height(9.dp)) {
                val half = 7.dp.toPx()
                val x = (size.width * pos).coerceIn(half, size.width - half)
                drawPath(Path().apply { moveTo(x - half, 0f); lineTo(x + half, 0f); lineTo(x, size.height); close() }, Palette.Foreground)
            }
            Row(Modifier.fillMaxWidth().height(10.dp).clip(CircleShape), horizontalArrangement = Arrangement.spacedBy(2.dp)) {
                BANDS.forEach { band ->
                    Box(Modifier.weight(1f).fillMaxHeight().background(flagColor(band).copy(alpha = if (band == flag) 1f else 0.3f)))
                }
            }
        }
        Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(2.dp)) {
            BANDS.forEach { band ->
                Text(if (band == flag) copy.flag(band) else "", style = MaterialTheme.typography.labelSmall, textAlign = TextAlign.Center, modifier = Modifier.weight(1f))
            }
        }
        Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) {
            Text(copy.scaleLow, style = MaterialTheme.typography.labelSmall, color = Palette.MutedText)
            Text(copy.scaleHigh, style = MaterialTheme.typography.labelSmall, color = Palette.MutedText)
        }
    }
}

@Composable
private fun ListCard(content: @Composable RowScope.() -> Unit) {
    val shape = RoundedCornerShape(10.dp)
    Row(
        Modifier.fillMaxWidth().clip(shape).background(Palette.Card.copy(alpha = 0.6f)).border(1.dp, Palette.Border, shape).padding(12.dp),
        horizontalArrangement = Arrangement.spacedBy(12.dp),
        content = content,
    )
}

/** Top reasons first, the rest behind a toggle. */
@Composable
fun ReasonList(copy: Copy, reasons: List<ReasonDto>, initial: Int = 3) {
    var all by rememberSaveable { mutableStateOf(false) }
    val lines = reasons.filter { copy.text(it.textSq, it.textEn).isNotBlank() }
    val rest = lines.size - initial
    Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
        (if (all) lines else lines.take(initial)).forEach { reason ->
            ListCard {
                Box(Modifier.size(28.dp).clip(RoundedCornerShape(6.dp)).background(Palette.Muted), contentAlignment = Alignment.Center) {
                    Icon(groupIcon(reason.group), contentDescription = null, modifier = Modifier.size(16.dp), tint = Palette.MutedText)
                }
                Column(Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(2.dp)) {
                    Text(copy.text(reason.textSq, reason.textEn), style = MaterialTheme.typography.bodyMedium)
                    copy.reasonGroup(reason.group)?.let { Text(it, style = MaterialTheme.typography.bodySmall, color = Palette.MutedText) }
                }
            }
        }
        if (rest > 0) GhostButton(if (all) copy.showLess else copy.showMore(rest), { all = !all })
    }
}

@Composable
fun TodoList(items: List<String>, flag: String) {
    val color = flagColor(flag)
    Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
        items.forEachIndexed { i, item ->
            ListCard {
                Box(Modifier.size(28.dp).clip(CircleShape).background(color.copy(alpha = 0.14f)), contentAlignment = Alignment.Center) {
                    if (flag == "green") Icon(Icons.Outlined.CheckCircle, contentDescription = null, modifier = Modifier.size(16.dp), tint = color)
                    else Text("${i + 1}", style = MaterialTheme.typography.labelMedium, fontWeight = FontWeight.SemiBold, color = color)
                }
                Text(item, style = MaterialTheme.typography.bodyMedium, modifier = Modifier.weight(1f).padding(top = 4.dp))
            }
        }
    }
}

/** What was checked, defanged, in a mono box. */
@Composable
fun InputPreview(value: String, icon: ImageVector) {
    Row(
        Modifier.fillMaxWidth().clip(RoundedCornerShape(10.dp)).background(Palette.Muted.copy(alpha = 0.6f)).padding(12.dp),
        horizontalArrangement = Arrangement.spacedBy(10.dp),
    ) {
        Icon(icon, contentDescription = null, modifier = Modifier.size(16.dp).padding(top = 2.dp), tint = Palette.MutedText)
        Text(defangText(value.take(400)), fontFamily = Mono, fontSize = 13.sp, lineHeight = 19.sp, maxLines = 6, overflow = TextOverflow.Ellipsis)
    }
}
