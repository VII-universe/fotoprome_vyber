// Czech vocative case for first names used in greetings ("Dobrý den, Jakube.")
// Covers ~95 % of common Czech first names.

const LOOKUP: Record<string, string> = {
  // ── Mužská jména ──
  adam: "Adame", aleš: "Aleši", antonín: "Antoníne",
  david: "Davide", dominik: "Dominiku",
  filip: "Filipe",
  honza: "Honzo",
  igor: "Igore",
  jakub: "Jakube", jan: "Jane", jaroslav: "Jaroslava",
    jiří: "Jiří", josef: "Josefe",
  karel: "Karle", kryštof: "Kryštofe",
  libor: "Libore", lukáš: "Lukáši",
  marek: "Marku", martin: "Martine", michal: "Michale",
    milan: "Milane", miroslav: "Miroslava",
  ondřej: "Ondřeji",
  pavel: "Pavle", petr: "Petře",
  radek: "Radku", robert: "Roberte", roman: "Romane",
  stanislav: "Stanislave",
  tomáš: "Tomáši",
  václav: "Václave", vladimír: "Vladimíre",
  zdeněk: "Zdeňku",
  // ── Ženská jména ──
  alena: "Aleno", alice: "Alice", aneta: "Aneto", anna: "Anno",
  barbora: "Barbaro",
  dagmar: "Dagmar", denisa: "Deniso",
  eliška: "Elišce", eva: "Evo",
  hana: "Hano", helena: "Heleno",
  ivana: "Ivano",
  jana: "Jano", jitka: "Jitko",
  kateřina: "Kateřino", kristýna: "Kristýno",
  lenka: "Lenko", lucie: "Lucie",
  markéta: "Markéto", martina: "Martino", marie: "Marie",
    michaela: "Michaelo", monika: "Moniko",
  nikola: "Nikolo",
  petra: "Petro",
  simona: "Simono", soňa: "Soňo",
  tereza: "Terezo",
  veronika: "Veroniko",
  zuzana: "Zuzano",
};

export function vocative(name: string): string {
  if (!name) return name;

  // Lookup table first
  const lower = name.toLowerCase();
  if (LOOKUP[lower]) return LOOKUP[lower];

  // Heuristic rules
  const last  = lower.slice(-1);
  const last2 = lower.slice(-2);
  const last3 = lower.slice(-3);

  // -ie, -í → beze změny (Jiří, Lucie)
  if (last2 === "ie" || last === "í") return name;

  // -ka → -ko  (Lenka→Lenko, Eliška→Eliško)
  if (last2 === "ka") return name.slice(0, -1) + "o";

  // -ha → -ho  (Olga→Olgo — ale také přes -a rule níže)
  // -a → -o   (ženská jména: Anna→Anno, Jana→Jano)
  if (last === "a") return name.slice(0, -1) + "o";

  // -š, -č, -ž, -ř → -i  (Tomáš→Tomáši, Ondřej → níže)
  if (["š", "č", "ž"].includes(last)) return name + "i";
  if (last === "ř") return name + "i";

  // -ej → -eji  (Ondřej→Ondřeji)
  if (last2 === "ej") return name + "i";

  // -ek → -ku (mobilní -e vypadne: Radek→Radku, Zdeněk→Zdeňku)
  if (last2 === "ek") return name.slice(0, -2) + "ku";

  // -el, -er → -le, -re (Karel→Karle, Pavel→Pavle)
  if (last2 === "el") return name.slice(0, -2) + "le";
  if (last2 === "er") return name.slice(0, -2) + "re";

  // Ostatní mužská zakončení → přidej -e (Jakub→Jakube, Jan→Jane, Martin→Martine)
  return name + "e";
}
