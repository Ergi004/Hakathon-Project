package al.mburoja.mobile.ui

import android.content.Context
import android.content.Intent
import android.content.pm.PackageManager
import android.net.Uri
import android.os.Build
import androidx.activity.ComponentActivity
import androidx.activity.result.ActivityResultLauncher
import android.app.role.RoleManager

fun otherBrowserIntent(context: Context, uri: Uri): Intent? {
    val probe = Intent(Intent.ACTION_VIEW, uri).addCategory(Intent.CATEGORY_BROWSABLE)
    val found = context.packageManager.queryIntentActivities(probe, PackageManager.MATCH_ALL)
        .firstOrNull { it.activityInfo.packageName != context.packageName }
        ?: return null
    return Intent(Intent.ACTION_VIEW, uri).apply {
        setClassName(found.activityInfo.packageName, found.activityInfo.name)
        addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
    }
}

fun requestBrowserRole(activity: ComponentActivity, launcher: ActivityResultLauncher<Intent>) {
    if (Build.VERSION.SDK_INT < Build.VERSION_CODES.Q) return
    val roles = activity.getSystemService(RoleManager::class.java) ?: return
    if (!roles.isRoleAvailable(RoleManager.ROLE_BROWSER) || roles.isRoleHeld(RoleManager.ROLE_BROWSER)) return
    launcher.launch(roles.createRequestRoleIntent(RoleManager.ROLE_BROWSER))
}
