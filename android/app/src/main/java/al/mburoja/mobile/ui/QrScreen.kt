package al.mburoja.mobile.ui

import android.Manifest
import android.content.pm.PackageManager
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
import androidx.camera.core.ImageAnalysis
import androidx.camera.core.ImageProxy
import androidx.camera.core.Preview
import androidx.camera.lifecycle.ProcessCameraProvider
import androidx.camera.view.PreviewView
import androidx.compose.foundation.border
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.aspectRatio
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.outlined.ArrowBack
import androidx.compose.material.icons.outlined.PhotoCamera
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.DisposableEffect
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.unit.dp
import androidx.compose.ui.viewinterop.AndroidView
import androidx.core.content.ContextCompat
import androidx.lifecycle.compose.LocalLifecycleOwner
import com.google.zxing.BinaryBitmap
import com.google.zxing.MultiFormatReader
import com.google.zxing.PlanarYUVLuminanceSource
import com.google.zxing.common.HybridBinarizer
import java.util.concurrent.Executors

@Composable
fun QrScreen(copy: Copy, onBack: () -> Unit, onLink: (String) -> Unit) {
    val context = LocalContext.current
    var granted by remember {
        mutableStateOf(ContextCompat.checkSelfPermission(context, Manifest.permission.CAMERA) == PackageManager.PERMISSION_GRANTED)
    }
    val ask = rememberLauncherForActivityResult(ActivityResultContracts.RequestPermission()) { granted = it }
    LaunchedEffect(Unit) { if (!granted) ask.launch(Manifest.permission.CAMERA) }
    Column(Modifier.fillMaxSize().padding(16.dp), verticalArrangement = Arrangement.spacedBy(16.dp)) {
        Row(verticalAlignment = Alignment.CenterVertically) {
            IconButton(onClick = onBack) { Icon(Icons.AutoMirrored.Outlined.ArrowBack, contentDescription = copy.back) }
            Text(copy.qrTitle, style = MaterialTheme.typography.headlineSmall)
        }
        InfoNote(copy.howToQr)
        if (granted) {
            val shape = RoundedCornerShape(20.dp)
            Box(Modifier.fillMaxWidth().aspectRatio(0.8f).clip(shape).border(1.dp, Palette.Border, shape), contentAlignment = Alignment.Center) {
                CameraPreview(onLink)
                Box(Modifier.size(220.dp).border(2.dp, Palette.Primary, RoundedCornerShape(16.dp)))
            }
        } else {
            EmptyState(Icons.Outlined.PhotoCamera, copy.cameraNeeded)
            PrimaryButton(copy.allowCamera, { ask.launch(Manifest.permission.CAMERA) }, icon = Icons.Outlined.PhotoCamera)
        }
    }
}

@Composable
private fun CameraPreview(onLink: (String) -> Unit) {
    val context = LocalContext.current
    val owner = LocalLifecycleOwner.current
    val executor = remember { Executors.newSingleThreadExecutor() }
    DisposableEffect(Unit) { onDispose { executor.shutdown() } }
    AndroidView(
        factory = { PreviewView(it).apply { implementationMode = PreviewView.ImplementationMode.COMPATIBLE } },
        modifier = Modifier.fillMaxSize(),
    ) { preview ->
        val future = ProcessCameraProvider.getInstance(context)
        future.addListener({
            val camera = future.get()
            val view = Preview.Builder().build().also { it.surfaceProvider = preview.surfaceProvider }
            val analysis = ImageAnalysis.Builder().build().also { use ->
                use.setAnalyzer(executor) { image ->
                    val text = readQr(image)
                    image.close()
                    if (text != null) {
                        use.clearAnalyzer()
                        preview.post { onLink(text) }
                    }
                }
            }
            camera.unbindAll()
            camera.bindToLifecycle(owner, androidx.camera.core.CameraSelector.DEFAULT_BACK_CAMERA, view, analysis)
        }, ContextCompat.getMainExecutor(context))
    }
}

private fun readQr(image: ImageProxy): String? {
    val plane = image.planes.firstOrNull() ?: return null
    val buffer = plane.buffer
    val rowStride = plane.rowStride
    val pixels = ByteArray(image.width * image.height)
    val bytes = ByteArray(buffer.remaining())
    buffer.get(bytes)
    var pos = 0
    for (row in 0 until image.height) {
        val start = row * rowStride
        if (start + image.width > bytes.size) return null
        System.arraycopy(bytes, start, pixels, pos, image.width)
        pos += image.width
    }
    return runCatching {
        val source = PlanarYUVLuminanceSource(pixels, image.width, image.height, 0, 0, image.width, image.height, false)
        MultiFormatReader().decode(BinaryBitmap(HybridBinarizer(source))).text
    }.getOrNull()
}
