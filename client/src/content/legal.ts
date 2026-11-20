/** Bilingual legal pages (SPEC 7, 15.2). Plain language; privacy marked as a draft for legal review. */
type L = { sq: string; en: string };
export interface LegalDoc {
  title: L;
  updated: string;
  draft?: boolean;
  intro: L;
  sections: { heading: L; body: L[] }[];
}

export const LEGAL: Record<"privacy" | "terms" | "accessibility", LegalDoc> = {
  privacy: {
    title: { sq: "Politika e privatësisë", en: "Privacy policy" },
    updated: "2026-11-20",
    draft: true,
    intro: {
      sq: "Mburoja është ndërtuar që të dijë sa më pak për ty. Ky dokument shpjegon çfarë ruajmë, pse dhe për sa kohë.",
      en: "Mburoja is built to know as little about you as possible. This document explains what we store, why and for how long.",
    },
    sections: [
      { heading: { sq: "Kontrolluesi i të dhënave", en: "Data controller" }, body: [{ sq: "Operatori i pilotit të Mburojës (demo). Kontakt: privacy@mburoja.example.", en: "The operator of the Mburoja pilot (demo). Contact: privacy@mburoja.example." }] },
      {
        heading: { sq: "Çfarë ruajmë dhe pse", en: "What we store and why" },
        body: [
          { sq: "Kontrollet: vetëm një gjurmë (hash) e asaj që kontrollon, rezultati dhe arsyet. Nuk ruajmë tekstin. Qëllimi: të dallojmë mashtrimet e përsëritura.", en: "Checks: only a fingerprint (hash) of what you check, the result and the reasons. We do not keep the text. Purpose: spotting repeated scams." },
          { sq: "Raportet: teksti i mesazhit pasi maskojmë telefonat, emailet, IBAN-et, numrat personalë dhe emrat. Qëllimi: hetimi i fushatave dhe kërkesat për bllokim.", en: "Reports: the message text after masking phones, emails, IBANs, personal numbers and names. Purpose: investigating campaigns and requesting takedowns." },
          { sq: "Kontakti yt, vetëm nëse e jep dhe pranon të të kontaktojmë.", en: "Your contact, only if you provide it and agree to be contacted." },
          { sq: "Llogaria (opsionale): emri, emaili, gjuha dhe preferencat. Historiku i kontrolleve vetëm kur aktivizon „ruaj historikun”.", en: "Account (optional): name, email, language and preferences. Check history only when you turn on “save my history”." },
          { sq: "Adresat IP nuk ruhen; përdorim një hash ditor vetëm për të kufizuar abuzimet.", en: "IP addresses are not stored; we use a daily hash only to limit abuse." },
        ],
      },
      {
        heading: { sq: "Sa kohë i mbajmë", en: "How long we keep them" },
        body: [
          { sq: "Kontrollet: 90 ditë.", en: "Checks: 90 days." },
          { sq: "Përmbajtja e raporteve të pakonfirmuara: 180 ditë.", en: "Content of unconfirmed reports: 180 days." },
          { sq: "Paketat e provave: sa është e hapur fushata dhe 1 vit pas saj.", en: "Evidence packs: while the campaign is open plus 1 year." },
        ],
      },
      {
        heading: { sq: "Lidhjet që dërgon", en: "Links you submit" },
        body: [{ sq: "Serveri ynë nuk viziton asnjëherë lidhjet që dërgon. Vlerësimi bazohet në vetë adresën dhe në të dhënat që kemi.", en: "Our server never visits the links you submit. The verdict is based on the address itself and the data we hold." }],
      },
      {
        heading: { sq: "Të drejtat e tua", en: "Your rights" },
        body: [
          { sq: "Mund të shkarkosh të dhënat e tua dhe të fshish llogarinë nga Qendra e privatësisë. Fshirja heq lidhjet me ty; raportet e paidentifikueshme mbeten për të mbrojtur të tjerët.", en: "You can download your data and delete your account from the Privacy centre. Deleting removes the links to you; de-identified reports remain to protect others." },
          { sq: "Për çdo kërkesë tjetër: privacy@mburoja.example.", en: "For any other request: privacy@mburoja.example." },
        ],
      },
      {
        heading: { sq: "Shtesa e shfletuesit", en: "Browser extension" },
        body: [{ sq: "Shtesa lexon vetëm emailin që hap kur klikon „Skano”. Dërgimi automatik kërkon pëlqim të veçantë dhe mund ta fshish çdo raport brenda 10 minutave.", en: "The extension reads only the email you open when you click “Scan”. Auto-submit needs separate consent and you can delete any report within 10 minutes." }],
      },
    ],
  },
  terms: {
    title: { sq: "Kushtet e përdorimit", en: "Terms of use" },
    updated: "2026-11-20",
    intro: { sq: "Duke përdorur Mburojën pranon këto kushte të thjeshta.", en: "By using Mburoja you accept these simple terms." },
    sections: [
      { heading: { sq: "Çfarë ofron Mburoja", en: "What Mburoja offers" }, body: [{ sq: "Një vlerësim automatik të rrezikut për lidhje, mesazhe, numra dhe emaile, dhe një mënyrë për t'i raportuar. Vlerësimi është ndihmë, jo garanci.", en: "An automatic risk assessment for links, messages, numbers and emails, and a way to report them. The assessment is guidance, not a guarantee." }] },
      { heading: { sq: "Përdorimi i drejtë", en: "Fair use" }, body: [{ sq: "Mos dërgo të dhëna të të tjerëve pa nevojë, mos e mbingarko shërbimin dhe mos e përdor për të testuar mashtrime.", en: "Do not send other people’s data without need, do not overload the service and do not use it to test scams." }] },
      { heading: { sq: "Raportet", en: "Reports" }, body: [{ sq: "Raportet shqyrtohen nga ekipi. Nuk mund të garantojmë bllokimin e çdo domeni, por çdo raport ndihmon.", en: "Reports are reviewed by the team. We cannot guarantee every domain is blocked, but every report helps." }] },
      { heading: { sq: "API dhe bizneset", en: "API and businesses" }, body: [{ sq: "Çelësat API janë personalë për organizatën. Mbaji të fshehtë dhe revokoji nëse rrezikohen.", en: "API keys are personal to your organization. Keep them secret and revoke them if exposed." }] },
      { heading: { sq: "Të dhënat demo", en: "Demo data" }, body: [{ sq: "Në këtë pilot të gjitha të dhënat janë sintetike dhe njoftimet e bllokimit simulohen.", en: "In this pilot all data is synthetic and takedown notices are simulated." }] },
    ],
  },
  accessibility: {
    title: { sq: "Deklarata e aksesueshmërisë", en: "Accessibility statement" },
    updated: "2026-11-20",
    intro: { sq: "Synojmë që Mburoja të jetë e përdorshme nga të gjithë, në përputhje me WCAG 2.2 niveli AA.", en: "We aim for Mburoja to be usable by everyone, in line with WCAG 2.2 level AA." },
    sections: [
      { heading: { sq: "Çfarë kemi bërë", en: "What we did" }, body: [
        { sq: "Ngjyrat e flamujve shoqërohen gjithmonë me ikonë dhe fjalë.", en: "Flag colours always come with an icon and a word." },
        { sq: "Navigim i plotë me tastierë dhe fokus i dukshëm.", en: "Full keyboard navigation and visible focus." },
        { sq: "Grafikët kanë një përmbledhje me tekst për lexuesit e ekranit.", en: "Charts include a text summary for screen readers." },
        { sq: "Kontrast i kontrolluar në pamjen e çelët dhe të errët; lëvizjet zvogëlohen kur e kërkon pajisja.", en: "Contrast checked in light and dark themes; motion is reduced when your device asks for it." },
      ] },
      { heading: { sq: "Kufizime të njohura", en: "Known limitations" }, body: [{ sq: "Leximi automatik i tekstit nga pamjet e ekranit nuk është aktiv; ngjit tekstin në vend të saj.", en: "Automatic text reading from screenshots is not enabled; paste the text instead." }] },
      { heading: { sq: "Na shkruaj", en: "Tell us" }, body: [{ sq: "Nëse diçka nuk funksionon për ty: access@mburoja.example.", en: "If something does not work for you: access@mburoja.example." }] },
    ],
  },
};
