package al.mburoja.mobile.ui

import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Shapes
import androidx.compose.material3.Typography
import androidx.compose.material3.darkColorScheme
import androidx.compose.runtime.Composable
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.compositeOver
import androidx.compose.ui.text.ExperimentalTextApi
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.font.Font
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontVariation
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import al.mburoja.mobile.R

/** Dark tokens from client/src/app/globals.css (.dark), converted from OKLCH. */
object Palette {
    val Background = Color(0xFF080D16)
    val Foreground = Color(0xFFF3F5F9)
    val Card = Color(0xFF0F1621)
    val Bar = Color(0xFF0C121B)
    val Primary = Color(0xFF1AD1D1)
    val OnPrimary = Color(0xFF03141C)
    val Secondary = Color(0xFF1B2433)
    val Muted = Color(0xFF1D2430)
    val MutedText = Color(0xFF979FAB)
    val Destructive = Color(0xFFFD3A37)
    val Border = Color.White.copy(alpha = 0.10f)
    val Input = Color.White.copy(alpha = 0.14f)
    val Field = Color.White.copy(alpha = 0.04f)
}

val FlagGreen = Color(0xFF47C86E)
val FlagYellow = Color(0xFFF2CF3B)
val FlagOrange = Color(0xFFFF8F31)
val FlagRed = Color(0xFFFD3A37)
val FlagDark = Color(0xFFBE0025)
val FlagGrey = Color(0xFF95989F)

fun flagColor(flag: String): Color = when (flag) {
    "green" -> FlagGreen
    "yellow" -> FlagYellow
    "orange" -> FlagOrange
    "red" -> FlagRed
    "darkred" -> FlagDark
    else -> FlagGrey
}

@OptIn(ExperimentalTextApi::class)
private fun variable(res: Int, weight: Int) =
    Font(res, FontWeight(weight), variationSettings = FontVariation.Settings(FontVariation.weight(weight)))

val Display = FontFamily(variable(R.font.space_grotesk, 500), variable(R.font.space_grotesk, 700))
val Sans = FontFamily(
    variable(R.font.geist, 400),
    variable(R.font.geist, 500),
    variable(R.font.geist, 600),
    variable(R.font.geist, 700),
)
val Mono = FontFamily(variable(R.font.geist_mono, 400), variable(R.font.geist_mono, 500))

private val Type = Typography(
    displaySmall = TextStyle(fontFamily = Display, fontWeight = FontWeight.Bold, fontSize = 34.sp, lineHeight = 40.sp, letterSpacing = (-0.6).sp),
    headlineLarge = TextStyle(fontFamily = Display, fontWeight = FontWeight.Bold, fontSize = 30.sp, lineHeight = 36.sp, letterSpacing = (-0.5).sp),
    headlineMedium = TextStyle(fontFamily = Display, fontWeight = FontWeight.Bold, fontSize = 26.sp, lineHeight = 32.sp, letterSpacing = (-0.4).sp),
    headlineSmall = TextStyle(fontFamily = Display, fontWeight = FontWeight.Bold, fontSize = 22.sp, lineHeight = 28.sp, letterSpacing = (-0.3).sp),
    titleLarge = TextStyle(fontFamily = Display, fontWeight = FontWeight.Bold, fontSize = 20.sp, lineHeight = 26.sp),
    titleMedium = TextStyle(fontFamily = Display, fontWeight = FontWeight.Medium, fontSize = 17.sp, lineHeight = 24.sp),
    titleSmall = TextStyle(fontFamily = Sans, fontWeight = FontWeight.SemiBold, fontSize = 14.sp, lineHeight = 20.sp),
    bodyLarge = TextStyle(fontFamily = Sans, fontSize = 16.sp, lineHeight = 24.sp),
    bodyMedium = TextStyle(fontFamily = Sans, fontSize = 14.sp, lineHeight = 20.sp),
    bodySmall = TextStyle(fontFamily = Sans, fontSize = 12.sp, lineHeight = 17.sp),
    labelLarge = TextStyle(fontFamily = Sans, fontWeight = FontWeight.Medium, fontSize = 14.sp, lineHeight = 20.sp),
    labelMedium = TextStyle(fontFamily = Sans, fontWeight = FontWeight.Medium, fontSize = 12.sp, lineHeight = 16.sp),
    labelSmall = TextStyle(fontFamily = Sans, fontWeight = FontWeight.Medium, fontSize = 11.sp, lineHeight = 16.sp),
)

private val Corners = Shapes(
    extraSmall = RoundedCornerShape(6.dp),
    small = RoundedCornerShape(8.dp),
    medium = RoundedCornerShape(12.dp),
    large = RoundedCornerShape(16.dp),
    extraLarge = RoundedCornerShape(24.dp),
)

private val Colors = darkColorScheme(
    primary = Palette.Primary,
    onPrimary = Palette.OnPrimary,
    primaryContainer = Palette.Primary.copy(alpha = 0.16f).compositeOver(Palette.Background),
    onPrimaryContainer = Palette.Primary,
    secondary = Palette.Primary,
    onSecondary = Palette.OnPrimary,
    secondaryContainer = Palette.Primary.copy(alpha = 0.14f).compositeOver(Palette.Bar),
    onSecondaryContainer = Palette.Primary,
    tertiary = Palette.Primary,
    background = Palette.Background,
    onBackground = Palette.Foreground,
    surface = Palette.Background,
    onSurface = Palette.Foreground,
    surfaceVariant = Palette.Muted,
    onSurfaceVariant = Palette.MutedText,
    surfaceContainerLowest = Palette.Background,
    surfaceContainerLow = Palette.Card,
    surfaceContainer = Palette.Bar,
    surfaceContainerHigh = Palette.Card,
    surfaceContainerHighest = Palette.Secondary,
    outline = Palette.Input.compositeOver(Palette.Background),
    outlineVariant = Palette.Border.compositeOver(Palette.Background),
    error = Palette.Destructive,
    onError = Color.White,
    inverseSurface = Palette.Foreground,
    inverseOnSurface = Palette.Background,
)

@Composable
fun MburojaTheme(content: @Composable () -> Unit) {
    MaterialTheme(colorScheme = Colors, typography = Type, shapes = Corners, content = content)
}
