package al.mburoja.mobile.ui

import java.time.Instant
import java.time.LocalDate
import java.time.OffsetDateTime
import java.time.ZoneId
import java.time.ZonedDateTime

/** App strings. Wording follows client/messages/{sq,en}.json so the app reads like the website. */
class Copy private constructor(val locale: String) {
    private fun t(sq: String, en: String) = if (locale == "en") en else sq

    fun text(sq: String, en: String) = if (locale == "en") en.ifBlank { sq } else sq.ifBlank { en }

    val check = t("Kontrollo", "Check")
    val threats = t("Kërcënimet", "Threats")
    val history = t("Historia", "History")
    val settings = t("Cilësimet", "Settings")
    val language = t("Gjuha", "Language")

    val checkTitle = t("Kontrollo një link ose mesazh", "Check a link or message")
    val checkDescription = t(
        "Ngjit një link, një SMS ose email, një numër telefoni ose skano një kod QR. Të tregojmë sa i rrezikshëm duket dhe çfarë të bësh.",
        "Paste a link, an SMS or email, a phone number, or scan a QR code. We show how risky it looks and what to do.",
    )
    val trust = listOf(
        t("Nuk e hapim kurrë lidhjen që dërgoni", "We never open the link you send"),
        t("Nuk nevojitet llogari", "No account needed"),
        t("Ruajmë një gjurmë, jo tekstin tuaj", "We keep a fingerprint, not your text"),
    )
    val askTitle = t("Çfarë doni të kontrolloni?", "What do you want to check?")
    val tabLink = "Link"
    val tabMessage = t("Mesazh", "Message")
    val tabPhone = t("Telefon", "Phone")
    val tabQr = t("Kod QR", "QR code")
    val howToLink = t(
        "Mbani shtypur lidhjen, zgjidhni Kopjo lidhjen dhe ngjiteni këtu. Ne nuk e hapim kurrë.",
        "Press and hold the link, choose Copy link, then paste it here. We never open it.",
    )
    val howToMessage = t(
        "Kopjoni të gjithë mesazhin, bashkë me lidhjen nëse ka. Shtoni dërguesin nëse e dini.",
        "Copy the whole message, including any link. Add the sender if you know it.",
    )
    val howToPhone = t(
        "Shkruajeni numrin siç e patë, me prefiksin e shtetit nëse kishte.",
        "Type the number as you saw it, with the country code if there was one.",
    )
    val howToQr = t(
        "Drejtojeni kamerën te kodi. Lexohet në pajisjen tuaj dhe nuk ngarkohet kurrë.",
        "Point the camera at the code. It is read on your device and never uploaded.",
    )
    val labelLink = t("Lidhja që dyshon", "The link you are unsure about")
    val labelMessage = t("Teksti i mesazhit", "Message text")
    val labelPhone = t("Numri i telefonit", "Phone number")
    val labelSender = t("Dërguesi (opsional)", "Sender (optional)")
    val placeholderLink = t("p.sh. hxxps://pagesa-gjoba[.]al[.]example", "e.g. hxxps://pay-fine[.]al[.]example")
    val placeholderMessage = t("Ngjit këtu SMS-in ose email-in e plotë…", "Paste the full SMS or email here…")
    val placeholderPhone = t("p.sh. 069 123 4567", "e.g. 069 123 4567")
    val placeholderSender = t("p.sh. Posta ose +355…", "e.g. Posta or +355…")
    val submit = t("Kontrollo", "Check")
    val checking = t("Duke kontrolluar…", "Checking…")
    val openCamera = t("Hap kamerën", "Open the camera")
    val privacyNote = t("Ne ruajmë një gjurmë të asaj që kontrollon, jo tekstin.", "We store a fingerprint of what you check, not the text.")
    val checkError = t("Nuk arritëm ta kontrollojmë tani. Provo përsëri pas pak.", "We could not check it right now. Try again shortly.")
    val rateLimited = t(
        "Ke bërë shumë kontrolle në pak kohë. Provo përsëri pas disa minutash.",
        "You made many checks in a short time. Try again in a few minutes.",
    )
    val reportError = t("Nuk arritëm ta dërgojmë raportin. Provo përsëri pas pak.", "We could not send the report. Try again shortly.")
    val helpTitle = t("Keni paguar ose keni ndarë të dhënat e kartës?", "Already paid or shared your card details?")
    val helpBody = t(
        "Telefononi menjëherë bankën për të bllokuar kartën dhe ndryshoni fjalëkalimet. Pastaj raportoni mashtrimin që të paralajmërohen edhe të tjerët.",
        "Call your bank right away to block the card and change your passwords. Then report the scam so others are warned.",
    )

    val resultTitle = t("Rezultati i kontrollit", "Check result")
    fun checkedAt(date: String) = t("Kontrolluar më $date", "Checked on $date")
    fun flag(flag: String) = when (flag) {
        "green" -> t("I sigurt", "Safe")
        "yellow" -> t("Kujdes", "Careful")
        "orange" -> t("I dyshimtë", "Suspicious")
        "red" -> t("Ka gjasa mashtrim", "Likely scam")
        "darkred" -> t("Mashtrim i njohur", "Known scam")
        else -> t("I paskanuar", "Not scanned")
    }
    fun headline(flag: String) = when (flag) {
        "green" -> t("Nuk gjetëm shenja mashtrimi", "We found no signs of a scam")
        "yellow" -> t("Ki kujdes", "Be careful")
        "orange" -> t("Duket i dyshimtë", "This looks suspicious")
        "red" -> t("Ka shumë gjasa të jetë mashtrim", "This is very likely a scam")
        "darkred" -> t("Ky është mashtrim i njohur", "This is a known scam")
        else -> t("Nuk mundëm ta analizojmë", "We could not analyse it")
    }
    fun lead(flag: String) = when (flag) {
        "green" -> t(
            "Kjo nuk do të thotë se është 100% i sigurt. Nëse të kërkon para ose kode, verifiko me institucionin.",
            "That does not mean it is 100% safe. If it asks for money or codes, verify with the institution.",
        )
        "yellow" -> t(
            "Disa shenja kërkojnë vëmendje. Mos jep të dhëna personale pa verifikuar.",
            "Some signs need attention. Do not share personal details without checking.",
        )
        "orange" -> t(
            "Gjetëm disa shenja paralajmëruese. Mos kliko dhe mos paguaj.",
            "We found several warning signs. Do not click and do not pay.",
        )
        "red" -> t("Mos kliko, mos paguaj dhe mos jep asnjë të dhënë.", "Do not click, do not pay and do not share any details.")
        "darkred" -> t(
            "Ky link ose mesazh është pjesë e një fushate mashtrimi të njohur.",
            "This link or message is part of a known scam campaign.",
        )
        else -> t(
            "Nuk kishte mjaftueshëm përmbajtje. Provo me tekstin e plotë ose me lidhjen.",
            "There was not enough content. Try again with the full text or the link.",
        )
    }
    val scaleTitle = t("Rreziku", "Risk score")
    fun scaleExplain(score: Int) = t(
        "$score nga 100. Sa më i lartë rezultati, aq më e mundshme që të jetë mashtrim.",
        "$score out of 100. The higher the score, the more likely it is a scam.",
    )
    val scaleLow = t("Rrezik i ulët", "Low risk")
    val scaleHigh = t("Rrezik i lartë", "High risk")
    val reasonsTitle = t("Pse e vlerësuam kështu", "Why we rated it this way")
    fun showMore(count: Int) = t("Shfaq $count arsye të tjera", "Show $count more reasons")
    val showLess = t("Shfaq më pak", "Show less")
    fun reasonGroup(group: String): String? = when (group) {
        "links" -> t("Lidhjet", "Links")
        "content" -> t("Përmbajtja", "Content")
        "sender" -> t("Dërguesi", "Sender")
        "attachments" -> t("Bashkëngjitjet", "Attachments")
        "reputation" -> t("Reputacioni", "Reputation")
        else -> null
    }
    val todoTitle = t("Çfarë të bësh tani", "What to do now")
    fun todo(flag: String): List<String> = when (flag) {
        "green" -> listOf(
            t("Nëse të kërkohet pagesë, hyr vetë në faqen zyrtare (mos përdor lidhjen).", "If a payment is requested, go to the official site yourself (do not use the link)."),
            t("Kontrollo dërguesin te lista e institucioneve.", "Check the sender in the institutions list."),
            t("Nëse ke dyshime, raportoje gjithsesi.", "If in doubt, report it anyway."),
        )
        "yellow" -> listOf(
            t("Mos kliko lidhjen derisa ta verifikosh.", "Do not click the link until you have verified it."),
            t("Telefono institucionin në numrin zyrtar.", "Call the institution on its official number."),
            t("Mos jep kode, fjalëkalime ose të dhëna karte.", "Never share codes, passwords or card details."),
        )
        "orange" -> listOf(
            t("Mos kliko dhe mos u përgjigj.", "Do not click and do not reply."),
            t("Fshije mesazhin pasi ta raportosh.", "Delete the message after reporting it."),
            t("Paralajmëro të afërmit nëse kanë marrë të njëjtin mesazh.", "Warn family if they received the same message."),
        )
        "red" -> listOf(
            t("Mos kliko, mos paguaj, mos u përgjigj.", "Do not click, pay or reply."),
            t("Raportoje këtu që ta bllokojmë.", "Report it here so we can block it."),
            t("Nëse ke dhënë të dhëna karte, telefono menjëherë bankën.", "If you shared card details, call your bank right away."),
        )
        "darkred" -> listOf(
            t("Mos kliko, mos paguaj, mos u përgjigj.", "Do not click, pay or reply."),
            t("Nëse ke paguar ose ke dhënë të dhëna, telefono bankën dhe policinë.", "If you paid or shared details, call your bank and the police."),
            t("Raportoje që ta lidhim me fushatën.", "Report it so we can link it to the campaign."),
        )
        else -> listOf(
            t("Ngjit tekstin e plotë të mesazhit.", "Paste the full text of the message."),
            t("Ose ngjit vetëm lidhjen që përmban.", "Or paste only the link it contains."),
            t("Nëse ke dyshime, raportoje gjithsesi.", "If in doubt, report it anyway."),
        )
    }
    fun campaign(code: String) = t("Lidhur me fushatën $code", "Linked to campaign $code")
    fun imitates(name: String) = t("Imiton: $name", "Imitates: $name")
    val reportThis = t("Raporto këtë", "Report this")
    val reporting = t("Duke raportuar…", "Reporting…")
    val reported = t("Faleminderit! Raporti u dërgua.", "Thank you! Your report was sent.")
    val protocol = t("Numri i protokollit", "Protocol number")
    val undo = t("Zhbëj raportin", "Undo report")
    fun undoUntil(time: String) = t("Mund ta zhbësh deri në $time.", "You can undo it until $time.")
    val reportWithdrawn = t("Raporti u zhbë.", "The report was withdrawn.")
    val shareWarning = t("Ndaj paralajmërimin", "Share warning")
    fun shareText(flag: String, score: Int) = t(
        "Kujdes! Mburoja e vlerësoi këtë mesazh si „$flag” ($score/100). Mos kliko dhe mos paguaj.",
        "Warning! Mburoja rated this message \"$flag\" ($score/100). Do not click and do not pay.",
    )
    val checkAnother = t("Kontrollo diçka tjetër", "Check something else")

    val threatsTitle = t("Kërcënimet aktive", "Active threats")
    val threatsDescription = t(
        "Fushata mashtrimi të konfirmuara nga ekipi i SOC. Domenet shfaqen të çaktivizuara për siguri.",
        "Scam campaigns confirmed by the SOC team. Domains are shown defanged for safety.",
    )
    val statTotal = t("Fushata", "Campaigns")
    val statActive = t("Aktive tani", "Active now")
    val statTakedown = t("Në heqje", "Being taken down")
    val statResolved = t("Të zgjidhura", "Resolved")
    fun campaignCount(count: Int) = t("$count fushata", "$count campaigns")
    val feedNote = t("Të dhënat vijnë nga furnizimi publik dhe përditësohen çdo minutë.", "Data comes from the public feed and refreshes every minute.")
    val emptyFeed = t("Nuk ka fushata publike për momentin.", "No public campaigns right now.")
    val feedError = t("Nuk arritëm të marrim kërcënimet. Provo përsëri pas pak.", "We could not load the threats. Try again shortly.")
    fun campaignStatus(status: String) = when (status) {
        "monitoring" -> t("Në monitorim", "Monitoring")
        "confirmed" -> t("E konfirmuar", "Confirmed")
        "takedown_in_progress" -> t("Bllokim në proces", "Takedown in progress")
        "resolved" -> t("E zgjidhur", "Resolved")
        else -> status
    }
    fun messages(count: Int) = t("$count mesazhe", "$count messages")
    fun domains(count: Int) = t("$count domene", "$count domains")
    fun since(date: String) = t("Nga $date", "From $date")
    fun until(date: String) = t("deri $date", "to $date")
    val unknown = t("I panjohur", "Unknown")

    val historyTitle = t("Historia", "History")
    val historyDescription = t(
        "Kontrollet e fundit në këtë telefon. Ruhen vetëm në pajisjen tuaj.",
        "Your recent checks on this phone. They stay on this device.",
    )
    val emptyHistory = t("Ende nuk ke asnjë kontroll.", "No checks yet.")
    val emptyHistoryBody = t("Kontrollo një link ose mesazh dhe do ta shohësh këtu.", "Check a link or message and it will show up here.")
    fun reportedAs(protocol: String) = t("Raportuar · $protocol", "Reported · $protocol")

    val trackTitle = t("Ndiq raportin", "Track a report")
    val trackDescription = t(
        "Shkruaj numrin e protokollit dhe kodin privat që more kur raportove.",
        "Enter the protocol number and the private code you got when you reported.",
    )
    val trackProtocolPlaceholder = "SOC-2026/000123"
    val trackToken = t("Kodi privat", "Private code")
    val trackSubmit = t("Shiko statusin", "See status")
    val trackLoading = t("Duke kërkuar…", "Looking up…")
    val trackNotFound = t(
        "Nuk gjetëm raport me këto të dhëna. Kontrollo protokollin dhe kodin.",
        "We found no report with these details. Check the protocol and the code.",
    )
    val trackStatus = t("Statusi", "Status")
    fun trackReceived(date: String) = t("Marrë më $date", "Received $date")
    val trackNotScam = t(
        "Ekipi e shqyrtoi dhe nuk e konsideroi mashtrim. Faleminderit që raportove.",
        "The team reviewed it and did not consider it a scam. Thank you for reporting.",
    )
    val trackDuplicate = t(
        "Ky raport u bashkua me një raport tjetër për të njëjtën gjë.",
        "This report was merged with another report about the same thing.",
    )
    fun trackCampaign(code: String) = t("Lidhur me fushatën publike $code", "Linked to public campaign $code")
    val trackHelp = t(
        "Ke humbur kodin? Nuk mund ta rikthejmë, por mund ta raportosh përsëri.",
        "Lost your code? We cannot recover it, but you can report again.",
    )
    fun reportStatus(status: String) = when (status) {
        "received" -> t("U mor", "Received")
        "under_review" -> t("Në shqyrtim", "Under review")
        "confirmed" -> t("Mashtrim i konfirmuar", "Confirmed scam")
        "not_scam" -> t("Nuk është mashtrim", "Not a scam")
        "takedown_requested" -> t("U kërkua bllokimi", "Takedown requested")
        "taken_down" -> t("U bllokua", "Taken down")
        "duplicate" -> t("Dublikatë", "Duplicate")
        else -> status
    }

    val settingsTitle = t("Cilësimet", "Settings")
    val albanian = "Shqip"
    val english = "English"
    val linkCheck = t("Kontrollo lidhjet që hapen në shfletues", "Check links that open in the browser")
    val linkCheckBody = t(
        "Kjo punon vetëm kur një aplikacion ia jep lidhjen shfletuesit të sistemit. Aplikacionet që e hapin lidhjen në faqen e tyre, si Instagram, Facebook, Messenger dhe TikTok, nuk e dërgojnë kurrë te Mburoja. Për ato, ndaje ose ngjite mesazhin.",
        "This only covers apps that hand the address to the system browser. Apps that open links on their own page, such as Instagram, Facebook, Messenger and TikTok, never send the tap to Mburoja. For those, share or paste the message.",
    )
    val makeDefault = t("Caktoje Mburojën si shfletues", "Set Mburoja as the browser")
    val autoSubmit = t("Dërgo automatikisht te SOC", "Send to the SOC automatically")
    val autoSubmitBody = t(
        "E fikur derisa ta aktivizosh. Pastaj portokallia, e kuqja dhe e kuqja e errët dërgojnë një raport të maskuar. E verdha dërgon vetëm treguesit. E gjelbra dhe e paanalizuara nuk dërgojnë asgjë. Butoni Raporto dërgon një raport edhe pa këtë.",
        "Off until you turn it on. Then orange, red and dark red send a masked report. Yellow sends indicators only. Green and not analysed send nothing. The Report button sends one report even when this is off.",
    )
    val server = t("Adresa e platformës", "Platform address")
    val serverHelp = t(
        "Për emulatorin, 10.0.2.2 është kompjuteri yt. Në telefon vendos adresën e rrjetit.",
        "On the emulator, 10.0.2.2 is your computer. On a phone, use the computer's network address.",
    )
    val save = t("Ruaj", "Save")
    val saved = t("U ruajt", "Saved")
    val website = t("Hap faqen në ueb", "Open the website")
    fun version(value: String) = t("Versioni $value", "Version $value")

    val checkingLink = t("Duke kontrolluar lidhjen para se të hapet", "Checking the link before it opens")
    val openConfirm = t("Faqja hapet vetëm nëse e zgjedh ti.", "The page opens only if you choose to continue.")
    val linkCheckOff = t("Kontrolli i lidhjeve është i fikur. Po e kaloj te shfletuesi tjetër.", "Link checking is off. Handing this to another browser.")
    val noOtherBrowser = t("Nuk ka shfletues tjetër ku të hapet kjo faqe.", "There is no other browser to open this page.")
    val openAnyway = t("Hape gjithsesi", "Open anyway")
    val close = t("Mbyll", "Close")
    val retry = t("Provo përsëri", "Try again")

    val qrTitle = t("Skano kodin QR", "Scan the QR code")
    val cameraNeeded = t("Lejo kamerën që të lexojmë kodin QR.", "Allow the camera so we can read the QR code.")
    val allowCamera = t("Lejo kamerën", "Allow the camera")
    val back = t("Kthehu", "Back")

    companion object {
        private val SQ = Copy("sq")
        private val EN = Copy("en")
        fun of(locale: String): Copy = if (locale == "en") EN else SQ
    }
}

fun defang(value: String): String = value
    .replace("https://", "hxxps://")
    .replace("http://", "hxxp://")
    .replace(".", "[.]")

private val ADDRESS = Regex("""(?i)\b(?:https?://)?(?:[a-z0-9-]+\.)+[a-z]{2,}(?:[/?#]\S*)?""")

/** Defangs only the addresses inside free text, so a message stays readable. */
fun defangText(value: String): String = ADDRESS.replace(value) { defang(it.value) }

fun flagForScore(score: Int): String = when {
    score >= 80 -> "darkred"
    score >= 60 -> "red"
    score >= 40 -> "orange"
    score >= 20 -> "yellow"
    else -> "green"
}

fun maskExcerpt(value: String): String = value
    .replace(Regex("[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\\.[A-Za-z]{2,}"), "[email]")
    .replace(Regex("\\+?\\d[\\d\\s().-]{7,}\\d"), "[phone]")
    .take(600)

private val MONTHS_SQ = listOf("Jan", "Shk", "Mar", "Pri", "Maj", "Qer", "Kor", "Gus", "Sht", "Tet", "Nën", "Dhj")
private val MONTHS_EN = listOf("Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec")

private fun zoned(value: String): ZonedDateTime? {
    val zone = ZoneId.systemDefault()
    return runCatching { if (value.length == 10) LocalDate.parse(value).atStartOfDay(zone) else OffsetDateTime.parse(value).atZoneSameInstant(zone) }.getOrNull()
        ?: runCatching { Instant.parse(value).atZone(zone) }.getOrNull()
}

private fun day(d: ZonedDateTime, locale: String) =
    "${d.dayOfMonth} ${(if (locale == "en") MONTHS_EN else MONTHS_SQ)[d.monthValue - 1]} ${d.year}"

private fun clock(d: ZonedDateTime) = "%02d:%02d".format(d.hour, d.minute)

fun fmtDate(value: String?, locale: String): String = value?.let(::zoned)?.let { day(it, locale) } ?: "—"

fun fmtDateTime(value: String?, locale: String): String = value?.let(::zoned)?.let { "${day(it, locale)}, ${clock(it)}" } ?: "—"

fun fmtDateTime(millis: Long, locale: String): String {
    val d = Instant.ofEpochMilli(millis).atZone(ZoneId.systemDefault())
    return "${day(d, locale)}, ${clock(d)}"
}

fun fmtClock(value: String?): String? = value?.let(::zoned)?.let(::clock)
