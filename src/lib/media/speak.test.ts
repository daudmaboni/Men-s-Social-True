import { describe, expect, it } from "vitest";
import { cardSpeech, pickVoice } from "./speak";
import { savingData } from "./saveData";

describe("Listen", () => {
  const item = { title: "Kegel", titleSw: "Kegel sw", summary: "Hook", summarySw: "Ndoano" };
  const spec = { type: "exercise", challenges: ["last"], results: "weeks2", need: ["A chair"], needSw: ["Kiti"], steps: [{ title: "Find it", titleSw: "Upate", text: "Squeeze • hold", textSw: "Bana • shika" }], why: "Strong", whySw: "Imara" } as never;
  it("reads title, hook, needs, steps and the secret in his language", () => {
    expect(cardSpeech(item, spec, true)).toEqual(["Kegel sw", "Ndoano", "Mahitaji: Kiti.", "Hatua 1. Upate. Bana shika", "Siri yake: Imara"]);
    expect(cardSpeech(item, spec, false)[2]).toBe("You need: A chair.");
  });
  it("reads an article's text without the heading marks", () => {
    expect(cardSpeech({ ...item, body: ["## Why", "Because."] }, undefined, false)).toEqual(["Kegel", "Hook", "Why", "Because."]);
  });
  it("picks a Kiswahili voice when there is one", () => {
    const v = (lang: string, localService = true) => ({ lang, localService, name: lang });
    expect(pickVoice([v("en-US"), v("sw_KE"), v("sw-TZ", false)], "sw")?.lang).toBe("sw-TZ");
    expect(pickVoice([v("en-US")], "sw")).toBeNull();
    expect(pickVoice([v("en-US"), v("en-GB")], "en")?.lang).toBe("en-GB");
  });
});

describe("Save data", () => {
  it("follows his choice, or the connection on Auto", () => {
    expect(savingData("on", false)).toBe(true);
    expect(savingData("off", true)).toBe(false);
    expect(savingData("auto", true)).toBe(true);
    expect(savingData("auto", false)).toBe(false);
  });
});
