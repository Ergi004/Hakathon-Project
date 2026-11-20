/**
 * Awareness guides for /learn (SPEC 7: 6 short guides with a masked example and
 * a 3-question quiz). Bilingual content lives here rather than in messages/*.json
 * because it is long-form copy, not UI strings. All examples are synthetic and
 * use .example domains.
 */
export type GuideSlug = "sms-fines" | "fake-bank" | "fake-jobs" | "parcel" | "e-albania" | "qr-codes";
type L = { sq: string; en: string };

export interface Guide {
  slug: GuideSlug;
  icon: "receipt" | "landmark" | "briefcase" | "package" | "id-card" | "qr";
  title: L;
  summary: L;
  example: { channel: "sms" | "email" | "social" | "qr"; sender: string; text: L };
  signs: L[];
  todo: L[];
  quiz: { q: L; options: L[]; answer: number; why: L }[];
}

export const GUIDES: Guide[] = [
  {
    slug: "sms-fines",
    icon: "receipt",
    title: { sq: "Gjoba të rreme me SMS", en: "Fake fines by SMS" },
    summary: {
      sq: "Mesazhe që thonë se ke një gjobë parkimi ose trafiku dhe të kërkojnë ta paguash menjëherë online.",
      en: "Messages saying you have a parking or traffic fine and asking you to pay it online right away.",
    },
    example: {
      channel: "sms",
      sender: "+355 69 [PHONE]",
      text: {
        sq: "Bashkia: Keni një gjobë parkimi të papaguar. Paguani sot brenda 24 orëve te hxxps://1ezhe-gov[.]al[.]example për të shmangur dyfishimin.",
        en: "Municipality: You have an unpaid parking fine. Pay today within 24 hours at hxxps://1ezhe-gov[.]al[.]example to avoid it doubling.",
      },
    },
    signs: [
      { sq: "Vjen nga një numër i zakonshëm celulari, jo nga dërguesi zyrtar.", en: "It comes from an ordinary mobile number, not the official sender." },
      { sq: "Të ngut: „sot”, „brenda 24 orëve”, „përndryshe dyfishohet”.", en: "It rushes you: “today”, “within 24 hours”, “or it doubles”." },
      { sq: "Domeni duket si i bashkisë, por ka shkronja të ndërruara (1 në vend të l).", en: "The domain looks like the municipality’s but has swapped letters (1 instead of l)." },
    ],
    todo: [
      { sq: "Mos kliko. Kontrollo gjobat vetëm në portalin zyrtar duke e shkruar vetë adresën.", en: "Do not click. Check fines only on the official portal by typing the address yourself." },
      { sq: "Kontrollo lidhjen këtu në Mburoja dhe raportoje.", en: "Check the link here on Mburoja and report it." },
    ],
    quiz: [
      {
        q: { sq: "Një SMS për gjobë vjen nga +355 69…. Çfarë do të thotë kjo?", en: "A fine SMS comes from +355 69…. What does that tell you?" },
        options: [
          { sq: "Është normale, bashkitë përdorin numra celularë", en: "It is normal, municipalities use mobile numbers" },
          { sq: "Është shenjë paralajmëruese: institucionet përdorin dërgues zyrtarë", en: "It is a warning sign: institutions use official senders" },
          { sq: "Do të thotë që gjoba është e vogël", en: "It means the fine is small" },
        ],
        answer: 1,
        why: { sq: "Institucionet dërgojnë nga dërgues të regjistruar. Kontrolloji te lista e institucioneve.", en: "Institutions send from registered senders. Check them in the institutions list." },
      },
      {
        q: { sq: "Cila adresë mund të jetë e rreme?", en: "Which address may be fake?" },
        options: [
          { sq: "lezhe.gov.al.example", en: "lezhe.gov.al.example" },
          { sq: "1ezhe-gov.al.example", en: "1ezhe-gov.al.example" },
          { sq: "Asnjëra", en: "Neither" },
        ],
        answer: 1,
        why: { sq: "„1ezhe” përdor numrin 1 në vend të shkronjës l dhe një vizë në vend të pikës.", en: "“1ezhe” uses the digit 1 instead of the letter l and a dash instead of a dot." },
      },
      {
        q: { sq: "Mesazhi thotë „paguaj sot ose gjoba dyfishohet”. Çfarë bën?", en: "The message says “pay today or the fine doubles”. What do you do?" },
        options: [
          { sq: "Paguaj shpejt për të kursyer", en: "Pay quickly to save money" },
          { sq: "Hyj vetë në portalin zyrtar dhe kontrolloj", en: "Go to the official portal myself and check" },
          { sq: "Përgjigjem me SMS për të pyetur", en: "Reply by SMS to ask" },
        ],
        answer: 1,
        why: { sq: "Nxitimi është taktikë mashtrimi. Verifiko gjithmonë vetë.", en: "Urgency is a scam tactic. Always verify yourself." },
      },
    ],
  },
  {
    slug: "fake-bank",
    icon: "landmark",
    title: { sq: "Banka e rreme", en: "Fake bank messages" },
    summary: {
      sq: "Email ose SMS që thonë se llogaria jote është bllokuar dhe të kërkojnë kodin OTP ose të dhënat e kartës.",
      en: "Emails or SMS saying your account is blocked and asking for your OTP code or card details.",
    },
    example: {
      channel: "email",
      sender: "Banka Shembull <siguria@bankashembull-verifiko.example>",
      text: {
        sq: "I nderuar [NAME], llogaria juaj u pezullua për arsye sigurie. Verifikoni identitetin dhe vendosni kodin OTP te hxxps://bankashembull-verifiko[.]example brenda sot.",
        en: "Dear [NAME], your account was suspended for security reasons. Verify your identity and enter the OTP code at hxxps://bankashembull-verifiko[.]example today.",
      },
    },
    signs: [
      { sq: "Kërkon kodin OTP, PIN-in ose numrin e kartës. Banka nuk i kërkon kurrë.", en: "It asks for your OTP code, PIN or card number. Banks never do." },
      { sq: "Adresa e dërguesit ka fjalë të shtuara si „verifiko” ose „siguria”.", en: "The sender address has extra words such as “verify” or “security”." },
      { sq: "Të kërcënon me bllokim të llogarisë.", en: "It threatens to block your account." },
    ],
    todo: [
      { sq: "Mos jep asnjë kod. Telefono bankën në numrin në pjesën e pasme të kartës.", en: "Share no codes. Call the bank on the number on the back of your card." },
      { sq: "Nëse ke dhënë të dhëna, blloko kartën menjëherë.", en: "If you shared details, block your card immediately." },
    ],
    quiz: [
      {
        q: { sq: "Kush mund të të kërkojë kodin OTP me SMS ose email?", en: "Who may ask for your OTP code by SMS or email?" },
        options: [
          { sq: "Banka jote", en: "Your bank" },
          { sq: "Askush", en: "Nobody" },
          { sq: "Policia", en: "The police" },
        ],
        answer: 1,
        why: { sq: "Kodi OTP është vetëm për ty. Kushdo që e kërkon është mashtrues.", en: "An OTP code is only for you. Anyone asking for it is a scammer." },
      },
      {
        q: { sq: "Email-i vjen nga „bankashembull-verifiko.example”. Është zyrtar?", en: "The email comes from “bankashembull-verifiko.example”. Is it official?" },
        options: [
          { sq: "Po, ka emrin e bankës", en: "Yes, it has the bank’s name" },
          { sq: "Jo, është emër me fjalë të shtuara", en: "No, it is the name with extra words" },
          { sq: "Varet nga logoja", en: "It depends on the logo" },
        ],
        answer: 1,
        why: { sq: "Mashtruesit shtojnë fjalë te emri i bankës. Krahasoje me listën e institucioneve.", en: "Scammers add words to the bank’s name. Compare it with the institutions list." },
      },
      {
        q: { sq: "Ke dhënë numrin e kartës. Çfarë bën së pari?", en: "You shared your card number. What do you do first?" },
        options: [
          { sq: "Pres të shoh nëse ndodh diçka", en: "Wait and see" },
          { sq: "Telefonoj bankën për ta bllokuar kartën", en: "Call the bank to block the card" },
          { sq: "Fshij email-in", en: "Delete the email" },
        ],
        answer: 1,
        why: { sq: "Sa më shpejt ta bllokosh, aq më pak dëm.", en: "The sooner you block it, the less damage." },
      },
    ],
  },
  {
    slug: "fake-jobs",
    icon: "briefcase",
    title: { sq: "Oferta pune të rreme", en: "Fake job offers" },
    summary: {
      sq: "Oferta me pagë shumë të lartë për pak punë, që të kërkojnë një tarifë regjistrimi ose dokumentet e tua.",
      en: "Offers with very high pay for little work that ask for a registration fee or your documents.",
    },
    example: {
      channel: "social",
      sender: "Rekrutim Online",
      text: {
        sq: "Punë nga shtëpia! Fitoni 3000 euro në muaj. Paguani vetëm 20 euro tarifë regjistrimi dhe dërgoni foton e kartës së identitetit te hxxps://pune-shpejt[.]xyz[.]example",
        en: "Work from home! Earn 3000 euros a month. Pay just a 20 euro registration fee and send a photo of your ID card at hxxps://pune-shpejt[.]xyz[.]example",
      },
    },
    signs: [
      { sq: "Paga duket shumë e mirë për të qenë e vërtetë.", en: "The pay looks too good to be true." },
      { sq: "Të kërkon para përpara se të fillosh.", en: "It asks you for money before you start." },
      { sq: "Kërkon foto të dokumentit të identitetit.", en: "It asks for a photo of your ID document." },
    ],
    todo: [
      { sq: "Mos paguaj tarifa dhe mos dërgo dokumente.", en: "Do not pay fees and do not send documents." },
      { sq: "Kërko kompaninë në regjistrin zyrtar të biznesit.", en: "Look the company up in the official business register." },
    ],
    quiz: [
      {
        q: { sq: "Një ofertë pune kërkon 20 euro tarifë. Çfarë bën?", en: "A job offer asks for a 20 euro fee. What do you do?" },
        options: [
          { sq: "Paguaj, është pak", en: "Pay, it is little" },
          { sq: "Nuk paguaj: punëdhënësit e vërtetë nuk marrin tarifa", en: "Do not pay: real employers do not charge fees" },
          { sq: "Paguaj gjysmën", en: "Pay half" },
        ],
        answer: 1,
        why: { sq: "Punëdhënësit të paguajnë ty, jo anasjelltas.", en: "Employers pay you, not the other way round." },
      },
      {
        q: { sq: "Pse është e rrezikshme të dërgosh foton e ID-së?", en: "Why is sending a photo of your ID risky?" },
        options: [
          { sq: "Mund të përdoret për të hapur llogari në emrin tënd", en: "It can be used to open accounts in your name" },
          { sq: "Nuk është e rrezikshme", en: "It is not risky" },
          { sq: "Sepse fotoja mund të jetë e paqartë", en: "Because the photo may be blurry" },
        ],
        answer: 0,
        why: { sq: "Dokumentet e vjedhura përdoren për vjedhje identiteti.", en: "Stolen documents are used for identity theft." },
      },
      {
        q: { sq: "Domeni mbaron me „.xyz”. Çfarë tregon?", en: "The domain ends in “.xyz”. What does that suggest?" },
        options: [
          { sq: "Asgjë", en: "Nothing" },
          { sq: "Është prapashtesë që mashtruesit përdorin shpesh", en: "It is an ending scammers often use" },
          { sq: "Është domen qeveritar", en: "It is a government domain" },
        ],
        answer: 1,
        why: { sq: "Disa prapashtesa të lira përdoren shpesh në fushata mashtrimi.", en: "Some cheap endings are often used in scam campaigns." },
      },
    ],
  },
  {
    slug: "parcel",
    icon: "package",
    title: { sq: "Pako dhe dërgesa", en: "Parcels and deliveries" },
    summary: {
      sq: "SMS që thonë se pakoja jote është ndalur dhe duhet të paguash një tarifë të vogël dërgese.",
      en: "SMS saying your parcel is held and you need to pay a small delivery fee.",
    },
    example: {
      channel: "sms",
      sender: "Posta",
      text: {
        sq: "Pakoja juaj nr. 4471 është ndalur në magazinë. Paguani 1.50 euro tarifë dërgese te hxxps://postashqiptare-dergesa[.]example/pagesa që ta merrni nesër.",
        en: "Your parcel no. 4471 is held at the warehouse. Pay a 1.50 euro delivery fee at hxxps://postashqiptare-dergesa[.]example/pagesa to receive it tomorrow.",
      },
    },
    signs: [
      { sq: "Tarifë shumë e vogël për të të bërë të mos dyshosh.", en: "A very small fee so you do not think twice." },
      { sq: "Nuk prisje asnjë pako.", en: "You were not expecting a parcel." },
      { sq: "Lidhja nuk është domeni zyrtar i postës.", en: "The link is not the post office’s official domain." },
    ],
    todo: [
      { sq: "Ndiq dërgesat vetëm në faqen zyrtare të postës.", en: "Track deliveries only on the post office’s official site." },
      { sq: "Mos fut të dhënat e kartës për „tarifa” me SMS.", en: "Do not enter card details for SMS “fees”." },
    ],
    quiz: [
      {
        q: { sq: "Tarifa është vetëm 1.50 euro. A është e sigurt?", en: "The fee is only 1.50 euros. Is it safe?" },
        options: [
          { sq: "Po, shuma është e vogël", en: "Yes, the amount is small" },
          { sq: "Jo, qëllimi është të marrin të dhënat e kartës", en: "No, the goal is to steal your card details" },
          { sq: "Varet nga dita", en: "It depends on the day" },
        ],
        answer: 1,
        why: { sq: "Shuma e vogël është karrem. Ata duan kartën tënde.", en: "The small amount is bait. They want your card." },
      },
      {
        q: { sq: "Ku duhet të ndjekësh një pako?", en: "Where should you track a parcel?" },
        options: [
          { sq: "Te lidhja në SMS", en: "At the link in the SMS" },
          { sq: "Në faqen zyrtare, duke shkruar vetë adresën", en: "On the official site, typing the address yourself" },
          { sq: "Duke u përgjigjur SMS-it", en: "By replying to the SMS" },
        ],
        answer: 1,
        why: { sq: "Shkruaje vetë adresën zyrtare. Mos u beso lidhjeve.", en: "Type the official address yourself. Do not trust links." },
      },
      {
        q: { sq: "Nuk prisje pako. Çfarë bën me SMS-in?", en: "You were not expecting a parcel. What do you do with the SMS?" },
        options: [
          { sq: "E raportoj dhe e fshij", en: "Report it and delete it" },
          { sq: "Klikoj për të parë çfarë është", en: "Click to see what it is" },
          { sq: "Ua dërgoj miqve", en: "Forward it to friends" },
        ],
        answer: 0,
        why: { sq: "Raportimi ndihmon të bllokojmë fushatën për të tjerët.", en: "Reporting helps us block the campaign for others." },
      },
    ],
  },
  {
    slug: "e-albania",
    icon: "id-card",
    title: { sq: "e-Albania e rreme", en: "Fake e-Albania" },
    summary: {
      sq: "Faqe që imitojnë portalin e shërbimeve publike për të vjedhur fjalëkalimin, NID-in ose të dhënat e kartës.",
      en: "Sites imitating the public services portal to steal your password, ID number or card details.",
    },
    example: {
      channel: "email",
      sender: "e-Albania <njoftime@e-albnia.al.example>",
      text: {
        sq: "Aplikimi juaj për rimbursim është miratuar. Hyni me fjalëkalimin tuaj te hxxps://e-albnia[.]al[.]example dhe konfirmoni numrin personal për të marrë 120 euro.",
        en: "Your refund application was approved. Log in with your password at hxxps://e-albnia[.]al[.]example and confirm your personal number to receive 120 euros.",
      },
    },
    signs: [
      { sq: "Adresa ka një shkronjë që mungon („albnia”).", en: "The address is missing a letter (“albnia”)." },
      { sq: "Premton para ose rimbursim që nuk e ke kërkuar.", en: "It promises money or a refund you did not ask for." },
      { sq: "Të kërkon të hysh përmes një lidhjeje në email.", en: "It asks you to log in through a link in an email." },
    ],
    todo: [
      { sq: "Hyr në portal vetëm duke shkruar vetë adresën zyrtare.", en: "Only open the portal by typing the official address yourself." },
      { sq: "Nëse ke futur fjalëkalimin, ndryshoje menjëherë.", en: "If you entered your password, change it immediately." },
    ],
    quiz: [
      {
        q: { sq: "„e-albnia.al.example” apo „e-albania.al.example”?", en: "“e-albnia.al.example” or “e-albania.al.example”?" },
        options: [
          { sq: "E para është zyrtare", en: "The first is official" },
          { sq: "E dyta është zyrtare, e para ka një gabim shkrimi", en: "The second is official, the first has a typo" },
          { sq: "Të dyja janë zyrtare", en: "Both are official" },
        ],
        answer: 1,
        why: { sq: "Një shkronjë e munguar mjafton për një domen të rremë.", en: "One missing letter is enough for a fake domain." },
      },
      {
        q: { sq: "Një email premton 120 euro rimbursim. Çfarë bën?", en: "An email promises a 120 euro refund. What do you do?" },
        options: [
          { sq: "Kontrolloj vetë në portalin zyrtar", en: "Check myself on the official portal" },
          { sq: "Klikoj shpejt para se të skadojë", en: "Click fast before it expires" },
          { sq: "Dërgoj numrin personal me email", en: "Send my personal number by email" },
        ],
        answer: 0,
        why: { sq: "Shërbimet e vërteta i gjen në portal pa pasur nevojë për lidhje.", en: "Real services are on the portal without needing a link." },
      },
      {
        q: { sq: "Ke futur fjalëkalimin në faqen e rreme. Hapi i parë?", en: "You entered your password on the fake site. First step?" },
        options: [
          { sq: "Ndryshoj fjalëkalimin", en: "Change my password" },
          { sq: "Nuk bëj asgjë", en: "Do nothing" },
          { sq: "Krijoj llogari të re email-i", en: "Create a new email account" },
        ],
        answer: 0,
        why: { sq: "Ndryshoje menjëherë dhe aktivizo verifikimin me dy hapa.", en: "Change it right away and turn on two-step verification." },
      },
    ],
  },
  {
    slug: "qr-codes",
    icon: "qr",
    title: { sq: "Kode QR të rreme", en: "Fake QR codes" },
    summary: {
      sq: "Ngjitëse QR mbi parkimetra, fletëpalosje ose fatura që të çojnë në faqe pagese të rreme.",
      en: "QR stickers on parking meters, flyers or bills that lead to fake payment pages.",
    },
    example: {
      channel: "qr",
      sender: "Ngjitëse në parkimetër",
      text: {
        sq: "Skano për të paguar parkimin: hxxps://parkim-tirana-pagesa[.]top[.]example",
        en: "Scan to pay for parking: hxxps://parkim-tirana-pagesa[.]top[.]example",
      },
    },
    signs: [
      { sq: "Ngjitësja duket e vendosur mbi një kod tjetër.", en: "The sticker looks placed over another code." },
      { sq: "Adresa që shfaqet pas skanimit nuk është zyrtare.", en: "The address shown after scanning is not official." },
      { sq: "Faqja kërkon menjëherë të dhënat e kartës.", en: "The page asks for card details straight away." },
    ],
    todo: [
      { sq: "Para se të hapësh, lexo adresën që shfaq telefoni.", en: "Before opening, read the address your phone shows." },
      { sq: "Ngarko foton e kodit këtu dhe kontrolloje pa e hapur.", en: "Upload a photo of the code here and check it without opening it." },
    ],
    quiz: [
      {
        q: { sq: "Çfarë kontrollon para se të hapësh një kod QR?", en: "What do you check before opening a QR code?" },
        options: [
          { sq: "Ngjyrën e kodit", en: "The colour of the code" },
          { sq: "Adresën që shfaq telefoni", en: "The address your phone shows" },
          { sq: "Asgjë", en: "Nothing" },
        ],
        answer: 1,
        why: { sq: "Adresa tregon ku do të të çojë kodi.", en: "The address tells you where the code will take you." },
      },
      {
        q: { sq: "Një ngjitëse QR është mbi një kod tjetër. Çfarë do të thotë?", en: "A QR sticker covers another code. What does it mean?" },
        options: [
          { sq: "Mund të jetë mashtrim", en: "It may be a scam" },
          { sq: "Është përditësim zyrtar", en: "It is an official update" },
          { sq: "Asgjë", en: "Nothing" },
        ],
        answer: 0,
        why: { sq: "Mashtruesit ngjitin kodet e tyre mbi ato zyrtare.", en: "Scammers stick their codes over official ones." },
      },
      {
        q: { sq: "Si mund të kontrollosh një kod QR pa e hapur?", en: "How can you check a QR code without opening it?" },
        options: [
          { sq: "Ngarko foton te Mburoja", en: "Upload a photo to Mburoja" },
          { sq: "Nuk ka mënyrë", en: "There is no way" },
          { sq: "Pyet një kalimtar", en: "Ask a passer-by" },
        ],
        answer: 0,
        why: { sq: "Mburoja e lexon kodin në pajisjen tënde dhe e kontrollon adresën.", en: "Mburoja reads the code on your device and checks the address." },
      },
    ],
  },
];

export function getGuide(slug: string): Guide | undefined {
  return GUIDES.find((g) => g.slug === slug);
}
