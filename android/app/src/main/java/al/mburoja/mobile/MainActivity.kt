package al.mburoja.mobile

import android.content.Intent
import android.graphics.Color
import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.SystemBarStyle
import androidx.activity.compose.setContent
import androidx.activity.enableEdgeToEdge
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.ExperimentalLayoutApi
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.consumeWindowInsets
import androidx.compose.foundation.layout.imePadding
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.outlined.History
import androidx.compose.material.icons.outlined.Home
import androidx.compose.material.icons.outlined.Settings
import androidx.compose.material.icons.outlined.Shield
import androidx.compose.material.icons.outlined.Translate
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.NavigationBar
import androidx.compose.material3.NavigationBarItem
import androidx.compose.material3.NavigationBarItemDefaults
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.lifecycle.ViewModelProvider
import androidx.navigation.NavGraph.Companion.findStartDestination
import androidx.navigation.NavHostController
import androidx.navigation.compose.NavHost
import androidx.navigation.compose.composable
import androidx.navigation.compose.rememberNavController
import al.mburoja.mobile.ui.BrandBar
import al.mburoja.mobile.ui.Copy
import al.mburoja.mobile.ui.FeedScreen
import al.mburoja.mobile.ui.HistoryScreen
import al.mburoja.mobile.ui.HomeScreen
import al.mburoja.mobile.ui.MburojaTheme
import al.mburoja.mobile.ui.Palette
import al.mburoja.mobile.ui.QrScreen
import al.mburoja.mobile.ui.ResultScreen
import al.mburoja.mobile.ui.SettingsScreen
import al.mburoja.mobile.ui.TrackScreen

class MainActivity : ComponentActivity() {
    private val model by lazy { ViewModelProvider(this)[AppModel::class.java] }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        enableEdgeToEdge(SystemBarStyle.dark(Color.TRANSPARENT), SystemBarStyle.dark(Color.TRANSPARENT))
        model.reloadHistory()
        readShare(intent)
        setContent { MburojaTheme { Shell(model) } }
    }

    override fun onResume() {
        super.onResume()
        model.reloadHistory()
    }

    override fun onNewIntent(intent: Intent) {
        super.onNewIntent(intent)
        setIntent(intent)
        readShare(intent)
    }

    private fun readShare(intent: Intent?) {
        if (intent?.action == Intent.ACTION_SEND) model.acceptShare(intent.getStringExtra(Intent.EXTRA_TEXT))
    }
}

private data class Tab(val route: String, val label: String, val icon: ImageVector)

/** Bottom-bar navigation: one back stack per tab, and the start tab is never stacked twice. */
private fun NavHostController.openTab(route: String) = navigate(route) {
    popUpTo(graph.findStartDestination().id) { saveState = true }
    launchSingleTop = true
    restoreState = true
}

@OptIn(ExperimentalLayoutApi::class)
@Composable
private fun Shell(model: AppModel) {
    val nav = rememberNavController()
    val prefs by model.prefs.collectAsState()
    val incoming by model.incoming.collectAsState()
    val copy = Copy.of(prefs.locale)
    var tab by rememberSaveable { mutableStateOf("home") }
    val tabs = listOf(
        Tab("home", copy.check, Icons.Outlined.Home),
        Tab("feed", copy.threats, Icons.Outlined.Shield),
        Tab("history", copy.history, Icons.Outlined.History),
        Tab("settings", copy.settings, Icons.Outlined.Settings),
    )
    val go = { route: String ->
        if (tab == route) nav.popBackStack(route, inclusive = false) else nav.openTab(route)
        tab = route
    }
    LaunchedEffect(incoming) {
        if (incoming == null) return@LaunchedEffect
        model.incoming.value = null
        go("home")
        nav.popBackStack("home", inclusive = false)
    }

    Scaffold(
        containerColor = Palette.Background,
        topBar = {
            BrandBar {
                TextButton(onClick = { model.saveLocale(if (prefs.locale == "en") "sq" else "en") }) {
                    Icon(Icons.Outlined.Translate, contentDescription = copy.language, tint = Palette.Foreground, modifier = Modifier.size(18.dp))
                    Spacer(Modifier.width(6.dp))
                    Text(prefs.locale.uppercase(), style = MaterialTheme.typography.labelMedium, fontWeight = FontWeight.Bold, color = Palette.Foreground)
                }
            }
        },
        bottomBar = {
            Column {
                HorizontalDivider(color = Palette.Border)
                NavigationBar(containerColor = Palette.Bar, tonalElevation = 0.dp) {
                    tabs.forEach { item ->
                        NavigationBarItem(
                            selected = tab == item.route,
                            onClick = { go(item.route) },
                            icon = { Icon(item.icon, contentDescription = null) },
                            label = { Text(item.label, style = MaterialTheme.typography.labelMedium) },
                            colors = NavigationBarItemDefaults.colors(
                                selectedIconColor = Palette.Primary,
                                selectedTextColor = Palette.Foreground,
                                indicatorColor = Palette.Primary.copy(alpha = 0.14f),
                                unselectedIconColor = Palette.MutedText,
                                unselectedTextColor = Palette.MutedText,
                            ),
                        )
                    }
                }
            }
        },
    ) { padding ->
        NavHost(nav, startDestination = "home", modifier = Modifier.padding(padding).consumeWindowInsets(padding).imePadding()) {
            composable("home") {
                HomeScreen(model, copy, onResult = { nav.navigate("result") }, onQr = { nav.navigate("qr") }, onTrack = { nav.navigate("track") })
            }
            composable("result") {
                ResultScreen(
                    model,
                    copy,
                    onShare = { intent -> nav.context.startActivity(Intent.createChooser(intent, copy.shareWarning)) },
                    onReset = {
                        go("home")
                        nav.popBackStack("home", inclusive = false)
                    },
                )
            }
            composable("feed") { FeedScreen(model, copy) }
            composable("history") { HistoryScreen(model, copy) { nav.navigate("result") } }
            composable("settings") { SettingsScreen(model, copy) }
            composable("track") { TrackScreen(model, copy) }
            composable("qr") {
                QrScreen(copy, onBack = { nav.popBackStack() }) { text -> model.acceptShare(text) }
            }
        }
    }
}
