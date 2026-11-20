/** Synthetic context mirroring the dataset conventions (.example / .test). */
import { createContext, type ContextData } from "../context";

export const IDS = {
  lezhe: "inst-lezhe",
  pogradec: "inst-pogradec",
  ealbania: "inst-ealbania",
  posta: "inst-posta",
  banka: "inst-banka",
};

export const F019 = { id: "camp-f019", code: "F019", status: "confirmed" as const };

export const baseData: ContextData = {
  institutions: [
    { id: IDS.lezhe, name: "Bashkia Lezhë", aliases: ["Lezhë", "Bashkia Lezhe"] },
    { id: IDS.pogradec, name: "Bashkia Pogradec", aliases: ["Pogradec"] },
    { id: IDS.ealbania, name: "e-Albania", aliases: ["e-albania", "ealbania"] },
    { id: IDS.posta, name: "Posta Shqiptare", aliases: ["posta shqiptare"] },
    { id: IDS.banka, name: "Banka Shembull", aliases: ["banka shembull"] },
  ],
  officialDomains: [
    { domain: "lezhe.gov.al.example", institutionId: IDS.lezhe },
    { domain: "pogradec.gov.al.example", institutionId: IDS.pogradec },
    { domain: "e-albania.al.example", institutionId: IDS.ealbania },
    { domain: "postashqiptare.al.example", institutionId: IDS.posta },
    { domain: "bankashembull.al.example", institutionId: IDS.banka },
  ],
  officialChannels: [
    { kind: "sms_sender", value: "BashkiaLezhe", institutionId: IDS.lezhe },
    { kind: "sms_sender", value: "e-Albania", institutionId: IDS.ealbania },
    { kind: "phone", value: "+355 42 222 222", institutionId: IDS.ealbania },
    { kind: "email", value: "njoftime@bankashembull.al.example", institutionId: IDS.banka },
  ],
  domainIntel: [
    { domain: "1ezhe-gov.al.example", ageDays: 4, registrar: "Regjistrues Shembull", hostingCountry: "XX", privacy: true },
  ],
  campaignIocs: [
    { kind: "domain", value: "pogradec-fines-gov.al.example", campaign: F019 },
    { kind: "domain", value: "xn--pogradc-dhg.al.test", campaign: F019 },
  ],
};

export const ctx = (extra: Partial<ContextData> = {}) => createContext({ ...baseData, ...extra });
