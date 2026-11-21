package al.mburoja.mobile.data

import android.content.Context
import androidx.datastore.preferences.core.booleanPreferencesKey
import androidx.datastore.preferences.core.edit
import androidx.datastore.preferences.core.stringPreferencesKey
import androidx.datastore.preferences.preferencesDataStore
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.map
import kotlinx.serialization.builtins.ListSerializer
import kotlinx.serialization.json.Json
import java.io.File
import java.security.SecureRandom

private val Context.store by preferencesDataStore("mburoja")

data class Prefs(
    val server: String = "http://10.0.2.2:3000",
    val locale: String = "sq",
    val linkCheck: Boolean = false,
    val autoSubmit: Boolean = false,
    val token: String? = null,
    val installHash: String? = null,
)

class SettingsStore(private val context: Context) {
    private val serverKey = stringPreferencesKey("server")
    private val localeKey = stringPreferencesKey("locale")
    private val linkKey = booleanPreferencesKey("link_check")
    private val autoKey = booleanPreferencesKey("auto_submit")
    private val tokenKey = stringPreferencesKey("token")
    private val hashKey = stringPreferencesKey("install_hash")

    val prefs: Flow<Prefs> = context.store.data.map { p ->
        Prefs(
            server = p[serverKey] ?: DEFAULT_SERVER,
            locale = p[localeKey] ?: "sq",
            linkCheck = p[linkKey] ?: false,
            autoSubmit = p[autoKey] ?: false,
            token = p[tokenKey],
            installHash = p[hashKey],
        )
    }

    suspend fun setServer(value: String) = context.store.edit { it[serverKey] = value.trim().trimEnd('/') }
    suspend fun setLocale(value: String) = context.store.edit { it[localeKey] = value }
    suspend fun setLinkCheck(value: Boolean) = context.store.edit { it[linkKey] = value }
    suspend fun setAutoSubmit(value: Boolean) = context.store.edit { it[autoKey] = value }
    suspend fun setToken(value: String) = context.store.edit { it[tokenKey] = value }

    suspend fun installHash(): String {
        var hash: String? = null
        context.store.edit { prefs ->
            hash = prefs[hashKey]
            if (hash == null) {
                val bytes = ByteArray(24)
                SecureRandom().nextBytes(bytes)
                hash = bytes.joinToString("") { "%02x".format(it) }
                prefs[hashKey] = hash!!
            }
        }
        return hash!!
    }

    companion object {
        const val DEFAULT_SERVER = "http://10.0.2.2:3000"
    }
}

class HistoryStore(private val context: Context) {
    private val json = Json { ignoreUnknownKeys = true }
    private val file = File(context.filesDir, "history.json")
    private val lock = Any()

    fun read(): List<HistoryItem> = synchronized(lock) {
        if (!file.exists()) return emptyList()
        runCatching { json.decodeFromString(ListSerializer(HistoryItem.serializer()), file.readText()) }.getOrDefault(emptyList())
    }

    fun write(items: List<HistoryItem>) = synchronized(lock) {
        file.writeText(json.encodeToString(ListSerializer(HistoryItem.serializer()), items.take(20)))
    }
}
