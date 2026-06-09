// All WC 2026 nations — alphabetical list for the Follow panel.

import { TEAMS } from "./worldcup";

export type WcNation = {
  code: string;
  name: string;
  flag: string;
};

const DISPLAY_NAMES: Record<string, string> = {
  ARG: "Argentina",
  AUS: "Australia",
  AUT: "Austria",
  ALG: "Algeria",
  BEL: "Belgium",
  BIH: "Bosnia-Herzegovina",
  BRA: "Brazil",
  CAN: "Canada",
  CPV: "Cape Verde",
  COL: "Colombia",
  CIV: "Ivory Coast",
  CRO: "Croatia",
  CUW: "Curaçao",
  CZE: "Czechia",
  COD: "Congo DR",
  DEN: "Denmark",
  ECU: "Ecuador",
  EGY: "Egypt",
  ENG: "England",
  FRA: "France",
  GER: "Germany",
  GHA: "Ghana",
  HAI: "Haiti",
  IRQ: "Iraq",
  IRN: "Iran",
  JOR: "Jordan",
  JPN: "Japan",
  KOR: "South Korea",
  KSA: "Saudi Arabia",
  MAR: "Morocco",
  MEX: "Mexico",
  NED: "Netherlands",
  NZL: "New Zealand",
  NOR: "Norway",
  PAN: "Panama",
  PAR: "Paraguay",
  POR: "Portugal",
  QAT: "Qatar",
  RSA: "South Africa",
  SCO: "Scotland",
  SEN: "Senegal",
  ESP: "Spain",
  SUI: "Switzerland",
  SWE: "Sweden",
  TUN: "Tunisia",
  TUR: "Türkiye",
  USA: "United States",
  URU: "Uruguay",
  UZB: "Uzbekistan",
};

/** 48 nations, sorted A→Z. De-duped by code. */
export const WC_NATIONS: WcNation[] = Object.values(TEAMS)
  .reduce<WcNation[]>((acc, t) => {
    if (acc.some((x) => x.code === t.code)) return acc;
    acc.push({
      code: t.code,
      name: DISPLAY_NAMES[t.code] ?? t.code,
      flag: t.flag,
    });
    return acc;
  }, [])
  .sort((a, b) => a.name.localeCompare(b.name));

export function nationName(code: string): string {
  return WC_NATIONS.find((n) => n.code === code)?.name ?? code;
}
