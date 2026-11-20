import { describe, expect, it } from "vitest";
import { evaluate, splitByGroup, trainModel, type LabeledDoc } from "./train";

const scam = [
  "Keni një gjobë të papaguar. Paguani sot te {d} për të shmangur bllokimin.",
  "Pakoja juaj është ndalur. Paguani tarifën e dërgesës te {d} brenda 24 orëve.",
  "Llogaria juaj do të pezullohet. Verifikoni kodin OTP te {d} menjëherë.",
  "Fituat një rimbursim. Klikoni {d} dhe vendosni të dhënat e kartës.",
];
const legit = [
  "Takimi i prindërve do të mbahet të hënën në orën 18:00 në shkollë.",
  "Faleminderit për blerjen. Fatura juaj mujore është gati në degë.",
  "Kujtesë: biblioteka mbyllet më herët këtë të shtunë.",
  "Urime ditëlindjen! Shihemi në darkë me familjen.",
];

function corpus(): LabeledDoc[] {
  const docs: LabeledDoc[] = [];
  for (let c = 0; c < 10; c++) {
    for (let i = 0; i < 12; i++) {
      docs.push({ id: `s${c}-${i}`, label: 1, group: `F${c}`, text: scam[(c + i) % scam.length].replace("{d}", `x${c}-${i}[.]example`) });
    }
  }
  for (let i = 0; i < 120; i++) docs.push({ id: `l${i}`, label: 0, group: `L${i}`, text: `${legit[i % legit.length]} (${i})` });
  return docs;
}

describe("train-classifier", () => {
  it("never puts one campaign in both train and test", () => {
    const { train, test } = splitByGroup(corpus());
    const trainGroups = new Set(train.map((d) => d.group));
    expect(test.some((d) => trainGroups.has(d.group))).toBe(false);
    expect(test.length / (train.length + test.length)).toBeGreaterThan(0.15);
  });

  it("learns a separable synthetic corpus", () => {
    const { train, test } = splitByGroup(corpus());
    const model = trainModel(train, { epochs: 10 });
    const m = evaluate(model, test, train.length);
    expect(m.f1).toBeGreaterThan(0.9);
  });
});
