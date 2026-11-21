package al.mburoja.mobile

import android.content.Intent
import android.graphics.Color
import android.net.Uri
import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.SystemBarStyle
import androidx.activity.compose.setContent
import androidx.activity.enableEdgeToEdge
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.navigationBarsPadding
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.outlined.OpenInNew
import androidx.compose.material.icons.outlined.Link
import androidx.compose.material.icons.outlined.Refresh
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.produceState
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.unit.dp
import androidx.lifecycle.ViewModelProvider
import al.mburoja.mobile.data.Prefs
import al.mburoja.mobile.data.SettingsStore
import al.mburoja.mobile.ui.AlertBox
import al.mburoja.mobile.ui.BrandBar
import al.mburoja.mobile.ui.Copy
import al.mburoja.mobile.ui.InputPreview
import al.mburoja.mobile.ui.Loading
import al.mburoja.mobile.ui.MburojaTheme
import al.mburoja.mobile.ui.OutlineButton
import al.mburoja.mobile.ui.PageTitle
import al.mburoja.mobile.ui.Palette
import al.mburoja.mobile.ui.PrimaryButton
import al.mburoja.mobile.ui.ResultCard
import al.mburoja.mobile.ui.otherBrowserIntent
import al.mburoja.mobile.ui.shareWarning
import kotlinx.coroutines.flow.first

class LinkGateActivity : ComponentActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        val uri = intent?.data
        if (uri == null || uri.scheme !in setOf("http", "https")) {
            finish()
            return
        }
        enableEdgeToEdge(SystemBarStyle.dark(Color.TRANSPARENT), SystemBarStyle.dark(Color.TRANSPARENT))
        setContent {
            val loaded by produceState<Prefs?>(null) { value = SettingsStore(applicationContext).prefs.first() }
            MburojaTheme {
                Column(Modifier.fillMaxSize().background(Palette.Background)) {
                    BrandBar()
                    val prefs = loaded
                    when {
                        prefs == null -> Loading(Copy.of("sq").checking)
                        !prefs.linkCheck -> HandOff(this@LinkGateActivity, uri, Copy.of(prefs.locale))
                        else -> Gate(ViewModelProvider(this@LinkGateActivity)[AppModel::class.java], uri, Copy.of(prefs.locale))
                    }
                }
            }
        }
    }
}

@Composable
private fun HandOff(activity: ComponentActivity, uri: Uri, copy: Copy) {
    LaunchedEffect(uri) {
        val next = otherBrowserIntent(activity, uri)
        if (next != null) {
            activity.startActivity(next)
            activity.finish()
        }
    }
    if (otherBrowserIntent(activity, uri) == null) {
        Column(Modifier.padding(16.dp), verticalArrangement = Arrangement.spacedBy(16.dp)) {
            PageTitle(copy.linkCheckOff, copy.noOtherBrowser)
            InputPreview(uri.toString(), Icons.Outlined.Link)
            PrimaryButton(copy.close, { activity.finish() })
        }
    }
}

@Composable
private fun Gate(model: AppModel, uri: Uri, copy: Copy) {
    val context = LocalContext.current
    val busy by model.busy.collectAsState()
    val error by model.error.collectAsState()
    val outcome by model.outcome.collectAsState()
    val link = uri.toString()
    LaunchedEffect(link) { if (model.outcome.value?.input != link) model.check(CheckKind.LINK, link, null) }
    val item = outcome?.takeIf { it.input == link }
    val elsewhere = otherBrowserIntent(context, uri)
    val close = { (context as? android.app.Activity)?.finish() }
    Column(
        Modifier.fillMaxSize().verticalScroll(rememberScrollState()).padding(16.dp).navigationBarsPadding(),
        verticalArrangement = Arrangement.spacedBy(16.dp),
    ) {
        PageTitle(copy.checkingLink, copy.openConfirm)
        InputPreview(link, Icons.Outlined.Link)
        when {
            item != null -> ResultCard(
                copy = copy,
                item = item,
                busy = busy,
                error = error,
                onReport = { model.report(item) },
                onUndo = { model.undo(item) },
                onShare = { context.startActivity(Intent.createChooser(shareWarning(copy, item), copy.shareWarning)) },
            ) {
                OutlineButton(
                    if (elsewhere == null) copy.noOtherBrowser else copy.openAnyway,
                    { if (elsewhere != null) context.startActivity(elsewhere) },
                    icon = Icons.AutoMirrored.Outlined.OpenInNew,
                    enabled = elsewhere != null,
                )
                PrimaryButton(copy.close, { close() })
            }
            busy || error == null -> Loading(copy.checking)
            else -> {
                AlertBox(error ?: copy.checkError)
                OutlineButton(copy.retry, { model.check(CheckKind.LINK, link, null) }, icon = Icons.Outlined.Refresh)
                PrimaryButton(copy.close, { close() })
            }
        }
    }
}
